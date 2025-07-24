const axios = require('axios');
const crypto = require('crypto');
const qs = require('qs');

class XiaomiCloudConnector {
    constructor(logger, authObj) {
        this.logger = logger;
        this.agent = this.generateAgent();
        this.deviceId = this.generateDeviceId();

        this.username = null;
        this.password = null;

        this._sign = null;
        this.captCode = false;
        this.ssecurity = null;
        this.userId = null;
        this.location = null;

        this.serviceToken = null;

        this.homeIds = null;
        this.init(authObj);

        this.session = axios.create({ withCredentials: true });
    }
    init(authObj) {
        if (authObj) {
            if (authObj.username) {
                this.username = authObj.username;
            }
            if (authObj.password) {
                this.password = authObj.password;
            }
            if (authObj._sign) {
                this._sign = authObj._sign;
            }
            if (authObj.captCode) {
                this.captCode = authObj.captCode;
            }
            if (authObj.deviceId) {
                this.deviceId = authObj.deviceId;
            }
        }
        this.commonCookies = `sdkVersion=accountsdk-18.8.15; deviceId=${this.deviceId};`;
    }
    loggedIn() {
        return !!this.serviceToken;
    }

    async loginStep1() {
        if (this._sign) {
            return { ok: true };
        }
        this.logger.debug('CloudApi-CloudApi-Step 1: Getting sign token');
        const url = 'https://account.xiaomi.com/pass/serviceLogin?sid=xiaomiio&_json=true';
        const headers = {
            'User-Agent': this.agent,
            'Content-Type': 'application/x-www-form-urlencoded',
            Cookie: `userId=${this.username}; ${this.commonCookies}`,
        };
        //this.logger.debug(headers.Cookie);
        try {
            const response = await this.session.get(url, {
                headers,
            });

            const body = this.parseJSON(response.data);
            if (response.status === 200 && body._sign) {
                this._sign = body._sign;
                return { ok: true };
            }
        } catch (err) {
            // @ts-expect-error err.message not defined
            this.logger.error('CloudApi-Login Step 1 failed:', err.message);
            // @ts-expect-error err.message not defined
            return { err: err.message };
        }
        return { err: 'Could not get signature' };
    }

    async loginStep2() {
        if (this.userId) {
            return { ok: true };
        }
        this.logger.debug('CloudApi-Step 2: Authenticating user');
        const url = 'https://account.xiaomi.com/pass/serviceLoginAuth2';
        const hash = crypto.createHash('md5').update(this.password).digest('hex').toUpperCase();
        const headers = {
            'User-Agent': this.agent,
            'Content-Type': 'application/x-www-form-urlencoded',
            Cookie: `${this.commonCookies} pass_ua=web; uLocale=de_DE;`,
        };
        const fields = {
            sid: 'xiaomiio',
            hash,
            callback: 'https://sts.api.io.mi.com/sts',
            qs: '%3Fsid%3Dxiaomiio%26_json%3Dtrue',
            user: this.username,
            _sign: this._sign,
            _json: 'true',
        };
        if (typeof this.captCode == 'string') {
            fields.captCode = this.captCode;
            this.captCode = true;
        }
        const call = `${url}?${qs.stringify(fields)}`;
        //this.logger.debug(`CloudApi-call: ${call}`);
        //this.logger.debug(`CloudApi-headers: ${JSON.stringify(headers)}`);
        try {
            const response = await this.session.post(`${call}`, null, {
                headers,
                maxRedirects: 0,
            });

            let data = this.parseJSON(response.data);
            if (data.captchaUrl) {
                // wir bekommen nicht die aktuelle session hier, daher klappt das Auflösen des captcha nicht
                this.logger.error('CloudApi-Login failed, because no captcha resolving possible');
                return { err: 'Login failed, because no captcha resolving possible' };
                /*
                if (!this.captCode) {
                    this.logger.error('CloudApi-Login failed, because no captcha resolving possible');
                    return { err: 'Login failed, because no captcha resolving possible' };
                }
                let captchaUrl = data.captchaUrl;
                if (captchaUrl.indexOf('/') == 0) {
                    captchaUrl = `https://account.xiaomi.com${captchaUrl}`;
                }
                return {
                    err: 'Please resolve captcha',
                    captchaUrl: captchaUrl,
                    username: this.username,
                    password: this.password,
                    _sign: this._sign,
                    deviceId: this.deviceId,
                };
                */
            }

            if (data.ssecurity && data.ssecurity.length > 4) {
                this.ssecurity = data.ssecurity;
                this.location = data.location;
                this.userId = data.userId;
                return { ok: true };
            } else if (data.notificationUrl) {
                this.logger.error(
                    `CloudApi-Login failed, because Two factor authentication required, please use following url and restart adapter\n${data.notificationUrl}`,
                );
                return { err: 'Login failed, because Two factor authentication required' };
            }
        } catch (err) {
            // @ts-expect-error err.message not defined
            this.logger.error('CloudApi-Login Step 2 failed:', err.message);
            // @ts-expect-error err.message not defined
            return { err: err.message };
        }
        return { err: 'could not get securityToken' };
    }

    async loginStep3() {
        this.logger.debug('CloudApi-Step 3: Fetching service token');
        const headers = {
            'User-Agent': this.agent,
            'Content-Type': 'application/x-www-form-urlencoded',
            Cookie: this.commonCookies,
        };
        //this.logger.debug(headers.Cookie);
        try {
            const response = await this.session.get(this.location, { headers });
            if (response.status === 200) {
                const setCookie = response.headers['set-cookie'] || [];
                const serviceToken = setCookie.find(c => c.includes('serviceToken'));
                this.serviceToken = serviceToken ? serviceToken.split('=')[1].split(';')[0] : null;
                if ((this, serviceToken)) {
                    return { ok: true };
                }
                throw 'serviceToken not found';
            }
        } catch (err) {
            // @ts-expect-error err.message not defined
            this.logger.error('CloudApi-Login Step 3 failed:', err.message);
            // @ts-expect-error err.message not defined
            return { err: err.message };
        }
        return { err: 'could not get serviceToken' };
    }

    async refreshToken() {
        this._sign = null;
        this.captCode = false;
        this.ssecurity = null;
        this.serviceToken = null;
        return this.login();
    }

    async login() {
        if (this.serviceToken) {
            return { ok: true };
        }
        this.logger.debug('CloudApi-Login gestartet…');
        let result = await this.loginStep1();
        if (!result.err) {
            result = await this.loginStep2();
            if (!result.err) {
                result = await this.loginStep3();
                if (!result.err) {
                    this.logger.debug('CloudApi-Login erfolgreich!');
                    return { ok: true };
                }
                throw result;
            } else {
                throw result;
            }
        } else {
            throw result;
        }
    }

    parseJSON(raw) {
        try {
            if (typeof raw === 'string') {
                return JSON.parse(raw.replace('&&&START&&&', ''));
            }
            return raw;
        } catch (err) {
            // @ts-expect-error err.message not defined
            this.logger.error('CloudApi-JSON Parse Error:', err.message);
            return {};
        }
    }

    async getHomes(country) {
        const url = `${this.getApiUrl(country)}/v2/homeroom/gethome`;
        const data = JSON.stringify({ fg: true, fetch_share: true, fetch_share_dev: true, limit: 300, app_ver: 7 });
        return await this.executeEncryptedApiCall(url, { data }).then(json => {
            this.homeIds = [];
            if (json && json.result && json.result.homelist) {
                for (let h of json.result.homelist) {
                    this.homeIds.push(h.id);
                }
            }
        });
    }
    async getDevices(country, homeIds) {
        if (!homeIds) {
            if (!this.homeIds) {
                await this.getHomes(country);
            }
            homeIds = this.homeIds?.slice();
        } else if (typeof homeIds != 'object') {
            homeIds = [homeIds];
        }
        const url = `${this.getApiUrl(country)}/v2/home/home_device_list`;
        const params = {
            home_owner: this.userId,
            limit: 200,
            get_split_device: true,
            support_smart_home: true,
        };
        const devices = {};
        for (let homeId of homeIds) {
            params.home_id = homeId;
            const data = JSON.stringify(params);
            devices[homeId] = await this.executeEncryptedApiCall(url, { data });
        }
        return devices;
    }

    async executeEncryptedApiCall(url, params) {
        const headers = {
            'Accept-Encoding': 'identity',
            'User-Agent': this.agent,
            'Content-Type': 'application/x-www-form-urlencoded',
            'x-xiaomi-protocal-flag-cli': 'PROTOCAL-HTTP2',
            'MIOT-ENCRYPT-ALGORITHM': 'ENCRYPT-RC4',
            Cookie: `userId=${this.userId}; yetAnotherServiceToken=${this.serviceToken}; serviceToken=${this.serviceToken}; locale=de_DE; timezone=GMT%2B02%3A00; is_daylight=1; dst_offset=3600000; channel=MI_APP_STORE; ${this.commonCookies}`,
        };
        //this.logger.debug(headers.Cookie);
        const millis = Date.now();
        const nonce = this.generateNonce(millis);
        const signedNonce = this.signedNonce(nonce, this.ssecurity);
        const rc4 = new XiaomiRC4Cipher(signedNonce);
        this.logger.debug(`CloudApi-call: ${url} with ${JSON.stringify(params)}`);
        const fields = this.generateEncryptedParams(rc4, url, 'POST', nonce, params, this.ssecurity);
        //this.logger.debug(fields);
        //this.logger.debug(`Headers: ${JSON.stringify(headers)}`)
        const query = qs.stringify(fields, { encode: true });
        //this.logger.debug(query);
        try {
            const response = await axios.post(`${url}?${query}`, null, {
                headers,
                maxRedirects: 0,
                //validateStatus: () => true, // Damit 401 nicht als Fehler behandelt wird
            });

            if (response.status === 200) {
                const decrypted = new XiaomiRC4Cipher(signedNonce).decrypt(response.data);
                this.logger.debug(`CloudApi-get ${decrypted}`);
                return JSON.parse(decrypted);
            }
        } catch (err) {
            //@ts-expect-error undefined err.message
            this.logger.error('CloudApi: executeEncryptedApiCall Error:', err.message);
        }
        return null;
    }

    generateAgent() {
        // Erzeuge agent_id: 13 Großbuchstaben zwischen A (65) und E (69)
        let agentId = Array.from({ length: 13 }, () => String.fromCharCode(Math.floor(Math.random() * 5) + 65)).join(
            '',
        );
        // Erzeuge random_text: 18 Kleinbuchstaben zwischen a (97) und z (122)
        let randomText = Array.from({ length: 18 }, () =>
            String.fromCharCode(Math.floor(Math.random() * 26) + 97),
        ).join('');
        return `${randomText}-${agentId} APP/com.xiaomi.mihome APPV/10.5.201`;
    }
    generateDeviceId() {
        return Array.from({ length: 6 }, () => String.fromCharCode(Math.floor(Math.random() * 26) + 97)).join('');
    }

    getApiUrl(country) {
        return `https://${country === 'cn' ? '' : `${country}.`}api.io.mi.com/app`;
    }

    signedNonce(nonce, ssecurity) {
        const hash = crypto
            .createHash('sha256')
            .update(Buffer.concat([Buffer.from(ssecurity, 'base64'), Buffer.from(nonce, 'base64')]))
            .digest();
        return Buffer.from(hash).toString('base64');
    }

    generateNonce(millis) {
        const randomBytes = crypto.randomBytes(8);
        const timeBytes = Buffer.alloc(4);
        timeBytes.writeUInt32BE(Math.floor(millis / 60000), 0);
        return Buffer.concat([randomBytes, timeBytes]).toString('base64');
    }

    generateEncSignature(url, method, signedNonce, params) {
        const paramsArray = [];
        paramsArray.push('POST');
        paramsArray.push(`/${url.split('/app/')[1]}`);
        for (const key in params) {
            paramsArray.push(`${key}=${params[key]}`);
        }
        paramsArray.push(signedNonce);
        const shasum = crypto.createHash('sha1');
        return shasum.update(paramsArray.join('&'), 'utf8').digest('base64');
        /*paramArray 1. call
(
    [0] => POST
    [1] => /home/device_list
    [2] => data={"getVirtualModel":true,"getHuamiDevices":1,"get_split_device":false,"support_smart_home":true}
    [3] => ADD83VgGuKnY10hfkjsdgfD43eeXeFg/+GdANJDAf7U=
)
paramArray 2.call
(
    [0] => POST
    [1] => /home/device_list
    [2] => data=IShRZk6Pq6BiYbsOWj8oRSjPkoQjSHIhq5hiF9LyeSeGNnCwjKSu0/TkOoPsi89fPLJmoZNS9ABIYEeLDy5rC42Rix+EaS95ZL6UoeprLZ01unoIjWKydxpbnA7nmo34=
    [3] => rc4_hash__=b2x/O1G7jrkuep4zWxdnFiDUmplkCm5k3rKXXg==
    [4] => ADD83VgGuKnY10hfkjsdgfD43eeXeF//+GdANJDAf7U=
)
*/
    }

    generateEncryptedParams(rc4, url, method, nonce, params, ssecurity) {
        params['rc4_hash__'] = this.generateEncSignature(url, method, rc4.passwordB64, params);
        for (const [k, v] of Object.entries(params)) {
            params[k] = rc4.encrypt(v);
        }
        params['signature'] = this.generateEncSignature(url, method, rc4.passwordB64, params);
        params['ssecurity'] = ssecurity;
        params['_nonce'] = nonce;

        return params;
    }
}

class XiaomiRC4Cipher {
    constructor(passwordB64) {
        this.passwordB64 = passwordB64;
        this.key = Buffer.from(passwordB64, 'base64');
        this.S = new Uint8Array(256);
        for (let i = 0; i < 256; i++) {
            this.S[i] = i;
        }

        let j = 0;
        for (let i = 0; i < 256; i++) {
            j = (j + this.S[i] + this.key[i % this.key.length]) % 256;
            [this.S[i], this.S[j]] = [this.S[j], this.S[i]];
        }

        // Drop Phase
        this.i = 0;
        this.j = 0;
        for (let drop = 0; drop < 1024; drop++) {
            this.generateKeystreamByte();
        }
    }

    generateKeystreamByte() {
        this.i = (this.i + 1) % 256;
        this.j = (this.j + this.S[this.i]) % 256;
        [this.S[this.i], this.S[this.j]] = [this.S[this.j], this.S[this.i]];
        return this.S[(this.S[this.i] + this.S[this.j]) % 256];
    }

    encrypt(plainText) {
        const input = Buffer.from(String(plainText), 'utf8');
        const output = Buffer.alloc(input.length);
        for (let k = 0; k < input.length; k++) {
            const rnd = this.generateKeystreamByte();
            output[k] = input[k] ^ rnd;
        }
        return output.toString('base64');
    }

    decrypt(cipherTextB64) {
        const input = Buffer.from(cipherTextB64, 'base64');
        const output = Buffer.alloc(input.length);
        for (let k = 0; k < input.length; k++) {
            const rnd = this.generateKeystreamByte();
            output[k] = input[k] ^ rnd;
        }
        return output.toString('utf8');
    }
}

module.exports = XiaomiCloudConnector;

/*
var argv = require('minimist')(process.argv.slice(2));
const CloudApi = new XiaomiCloudConnector(
    console,
    { username: argv.u, password: argv.p, captCode: true },
);
CloudApi.login()
    .then(result => {
        console.log(result);
    })
    .catch(result => {
        console.log(result);
    });
*/

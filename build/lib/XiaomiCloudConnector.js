"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const axios_1 = __importDefault(require("axios"));
const crypto = __importStar(require("node:crypto"));
const qs_1 = __importDefault(require("qs"));
const XiaomiCloudCrypto_1 = require("./XiaomiCloudCrypto");
const XiaomiCloudSession_1 = require("./XiaomiCloudSession");
const diagnostics_1 = require("./diagnostics");
const XiaomiCloudProtocol_1 = require("./XiaomiCloudProtocol");
const QR_LOGIN_URL = 'https://account.xiaomi.com/longPolling/loginUrl';
const LONG_POLL_TIMEOUT_MS = 10 * 1000;
function asRecord(value) {
    return value !== null && typeof value === 'object' ? value : null;
}
function toCloudString(value) {
    return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
}
/** Xiaomi Cloud authentication and encrypted API client. */
class XiaomiCloudConnector {
    logger;
    adapter;
    session;
    agent;
    deviceId;
    commonCookies = '';
    sessionCookies = '';
    ssecurity = null;
    userId = null;
    location = null;
    serviceToken = null;
    homeIds = null;
    loginInProgress = false;
    unloaded = false;
    abortController = null;
    qrLoginUrl = '';
    longPollingUrl = '';
    qrExpiresAt = 0;
    constructor(logger, authObj = {}, adapter) {
        this.logger = logger;
        this.adapter = adapter;
        this.session = axios_1.default.create({ timeout: 15_000, maxRedirects: 0, validateStatus: () => true });
        this.agent = this.generateAgent();
        this.deviceId = this.generateDeviceId();
        this.init(authObj);
    }
    init(authObj = {}) {
        if (authObj.deviceId) {
            this.deviceId = authObj.deviceId;
        }
        this.commonCookies = `sdkVersion=accountsdk-18.8.15; deviceId=${this.deviceId};`;
        const storedSession = authObj.cloudSession || this.adapter?.config?.cloudSession;
        const restored = this.restoreSession(storedSession);
        if (storedSession && !restored) {
            this.logger.debug('Cloud auth: stored session is incomplete or cannot be read; waiting for a new QR login');
        }
        else if (restored) {
            this.logger.debug('Cloud auth: restored stored session');
        }
        else {
            this.logger.debug('Cloud auth: no stored session found');
        }
    }
    restoreSession(rawSession) {
        if (!rawSession) {
            return false;
        }
        const decoded = (0, XiaomiCloudSession_1.decodeStoredCloudSession)(rawSession, this.adapter?.decrypt?.bind(this.adapter));
        if (decoded.status === 'invalid_json') {
            this.logger.debug('Cloud auth: stored session is not valid JSON');
            return false;
        }
        if (decoded.status === 'invalid_session') {
            this.logger.debug('Cloud auth: stored session failed plausibility validation');
            return false;
        }
        const saved = decoded.session;
        this.deviceId = saved.deviceId || this.deviceId;
        this.commonCookies = `sdkVersion=accountsdk-18.8.15; deviceId=${this.deviceId};`;
        this.ssecurity = saved.ssecurity;
        this.userId = saved.userId;
        this.location = saved.location;
        this.serviceToken = saved.serviceToken;
        this.sessionCookies = saved.sessionCookies || '';
        void this.updateAuth('authenticated', { loginUrl: '', lastError: '', expiresAt: 0 });
        return true;
    }
    isValidSession(session) {
        return (0, XiaomiCloudSession_1.isValidCloudSession)(session);
    }
    loggedIn() {
        return this.isValidSession(this.exportSession());
    }
    exportSession() {
        return {
            deviceId: this.deviceId,
            sessionCookies: this.sessionCookies,
            ssecurity: this.ssecurity,
            userId: this.userId,
            location: this.location,
            serviceToken: this.serviceToken,
        };
    }
    async persistSession() {
        if (!this.adapter || this.unloaded) {
            return;
        }
        const objectId = `system.adapter.${this.adapter.namespace}`;
        const object = await this.adapter.getForeignObjectAsync(objectId);
        if (!object) {
            throw new Error('Adapter configuration is unavailable');
        }
        const serializedSession = JSON.stringify(this.exportSession());
        object.native = {
            ...object.native,
            cloudSession: this.encryptSession(serializedSession),
        };
        await this.adapter.setForeignObjectAsync(objectId, object);
        this.logger.debug('Cloud auth: session saved to protected adapter configuration');
    }
    async clearPersistedSession() {
        if (!this.adapter || this.unloaded) {
            return;
        }
        const objectId = `system.adapter.${this.adapter.namespace}`;
        const object = await this.adapter.getForeignObjectAsync(objectId);
        if (!object) {
            return;
        }
        object.native = { ...object.native, cloudSession: this.encryptSession('') };
        await this.adapter.setForeignObjectAsync(objectId, object);
    }
    encryptSession(serializedSession) {
        if (!this.adapter?.encrypt) {
            throw new Error('Adapter encryption is unavailable');
        }
        return this.adapter.encrypt(serializedSession);
    }
    async updateAuth(status, options = {}) {
        if (!this.adapter || this.unloaded) {
            return;
        }
        try {
            await this.adapter.setStateAsync('auth.status', status, true);
            if (options.loginUrl !== undefined) {
                await this.adapter.setStateAsync('auth.loginUrl', options.loginUrl, true);
            }
            if (options.lastError !== undefined) {
                await this.adapter.setStateAsync('auth.lastError', options.lastError, true);
            }
            if (options.expiresAt !== undefined) {
                await this.adapter.setStateAsync('auth.expiresAt', options.expiresAt, true);
            }
        }
        catch {
            // The adapter may be shutting down or its database may already be closed.
        }
    }
    advancedDiagnostic(operation, details) {
        (0, diagnostics_1.logAdvancedDiagnostic)(this.logger, this.adapter?.config?.enableAdvancedDebug === true, operation, details);
    }
    mergeSetCookie(setCookie) {
        this.sessionCookies = (0, XiaomiCloudProtocol_1.mergeSessionCookies)(this.sessionCookies, setCookie);
    }
    buildCookieHeader() {
        return (0, XiaomiCloudProtocol_1.buildCookieHeader)(this.commonCookies, this.sessionCookies);
    }
    async startQrLogin() {
        if (this.unloaded) {
            return { err: 'Adapter is stopping' };
        }
        if (this.loggedIn()) {
            return { ok: true };
        }
        if (this.loginInProgress) {
            return { pending: true };
        }
        this.loginInProgress = true;
        this.abortController = new AbortController();
        await this.updateAuth('waiting_for_scan', { lastError: '' });
        try {
            const response = await this.session.get(QR_LOGIN_URL, {
                params: {
                    _qrsize: '480',
                    qs: '%3Fsid%3Dxiaomiio%26_json%3Dtrue',
                    callback: 'https://sts.api.io.mi.com/sts',
                    _hasLogo: 'false',
                    sid: 'xiaomiio',
                    _locale: 'en_GB',
                    _dc: Date.now().toString(),
                },
                headers: { 'User-Agent': this.agent, Accept: '*/*' },
                signal: this.abortController.signal,
            });
            this.advancedDiagnostic('cloud login initialization response', {
                status: response.status,
                payload: response.data,
            });
            const data = asRecord(this.parseJSON(response.data));
            if (response.status !== 200 || typeof data?.loginUrl !== 'string' || typeof data.lp !== 'string') {
                this.logger.debug(`Cloud auth: QR login initialization returned HTTP ${response.status}`);
                throw new Error('Invalid Xiaomi QR login response');
            }
            this.qrLoginUrl = data.loginUrl;
            this.longPollingUrl = data.lp;
            this.qrExpiresAt = Date.now() + Math.max(1, Number.parseInt(String(data.timeout), 10) || 300) * 1000;
            await this.updateAuth('waiting_for_scan', {
                loginUrl: this.qrLoginUrl,
                expiresAt: this.qrExpiresAt,
            });
            void this.waitForQrLogin().catch(error => this.finishQrLoginError(error));
            return { pending: true, loginUrl: this.qrLoginUrl };
        }
        catch (error) {
            this.loginInProgress = false;
            const message = this.safeError(error);
            await this.updateAuth('error', { lastError: message });
            return { err: message };
        }
    }
    async waitForQrLogin() {
        while (!this.unloaded && Date.now() < this.qrExpiresAt) {
            try {
                const response = await this.session.get(this.longPollingUrl, {
                    timeout: LONG_POLL_TIMEOUT_MS,
                    signal: this.abortController?.signal,
                    headers: { 'User-Agent': this.agent, Cookie: this.buildCookieHeader() },
                });
                this.advancedDiagnostic('cloud login polling response', {
                    status: response.status,
                    payload: response.data,
                });
                const data = asRecord(this.parseJSON(response.data));
                const userId = toCloudString(data?.userId);
                const security = toCloudString(data?.ssecurity);
                const location = toCloudString(data?.location);
                if (response.status === 200 && userId && security && location) {
                    this.logger.debug('Cloud auth: QR login was confirmed; requesting service token');
                    this.userId = userId;
                    this.ssecurity = security;
                    this.location = location;
                    await this.updateAuth('waiting_for_confirmation');
                    await this.fetchServiceToken();
                    await this.persistSession();
                    this.loginInProgress = false;
                    await this.updateAuth('authenticated', { loginUrl: '', lastError: '', expiresAt: 0 });
                    return;
                }
                if (response.status === 401 || response.status === 403) {
                    this.logger.debug(`Cloud auth: QR long-poll was rejected with HTTP ${response.status}`);
                    throw new Error('Xiaomi rejected the QR login');
                }
                await this.delay(500);
            }
            catch (error) {
                const errorObject = error !== null && typeof error === 'object' ? error : null;
                const errorCode = errorObject?.code;
                const errorMessage = error instanceof Error ? error.message : '';
                if (this.unloaded || errorCode === 'ERR_CANCELED') {
                    return;
                }
                if (errorCode !== 'ECONNABORTED' && !errorMessage.includes('timeout')) {
                    await this.delay(2_000);
                }
            }
        }
        if (!this.unloaded) {
            await this.finishQrLoginError(new Error('QR login expired'));
        }
    }
    async fetchServiceToken() {
        let requestUrl = this.location;
        if (!requestUrl) {
            throw new Error('Xiaomi did not provide a service token');
        }
        for (let redirect = 0; redirect < 6; redirect++) {
            const response = await this.session.get(requestUrl, {
                headers: { 'User-Agent': this.agent, Cookie: this.buildCookieHeader() },
                maxRedirects: 0,
                signal: this.abortController?.signal,
            });
            this.advancedDiagnostic('cloud service-token response', {
                status: response.status,
                redirect,
                hasSetCookie: Array.isArray(response.headers['set-cookie']),
                hasLocation: typeof response.headers.location === 'string',
            });
            this.mergeSetCookie(response.headers['set-cookie']);
            const serviceToken = this.getCookie('serviceToken');
            if (serviceToken) {
                this.serviceToken = serviceToken;
                this.logger.debug(`Cloud auth: service token received after ${redirect} redirect(s)`);
                return;
            }
            const location = response.headers.location;
            if (response.status < 300 || response.status >= 400 || !location) {
                this.logger.debug(`Cloud auth: service-token request ended with HTTP ${response.status} without token`);
                break;
            }
            this.logger.debug(`Cloud auth: following service-token redirect ${redirect + 1}`);
            requestUrl = new URL(String(location), requestUrl).toString();
        }
        throw new Error('Xiaomi did not provide a service token');
    }
    getCookie(name) {
        return (0, XiaomiCloudProtocol_1.getSessionCookie)(this.sessionCookies, name);
    }
    async finishQrLoginError(error) {
        if (this.unloaded) {
            return;
        }
        this.loginInProgress = false;
        const message = this.safeError(error);
        const expired = message === 'QR login expired';
        await this.updateAuth(expired ? 'expired' : 'error', { lastError: message });
    }
    login() {
        if (this.loggedIn()) {
            return Promise.resolve({ ok: true });
        }
        return Promise.resolve({
            err: 'Xiaomi Cloud authentication required; start the QR login in the adapter configuration',
        });
    }
    async refreshToken() {
        await this.invalidateSession('not_authenticated');
        return { err: 'Xiaomi Cloud authentication required; start the QR login in the adapter configuration' };
    }
    async invalidateSession(status = 'not_authenticated', lastError = '') {
        this.logger.debug(`Cloud auth: invalidating session (${lastError || status})`);
        this.ssecurity = null;
        this.userId = null;
        this.location = null;
        this.serviceToken = null;
        this.sessionCookies = '';
        await this.clearPersistedSession();
        await this.updateAuth(status, { loginUrl: '', expiresAt: 0, lastError });
    }
    async getHomes(country) {
        const url = `${this.getApiUrl(country)}/v2/homeroom/gethome`;
        const data = JSON.stringify({ fg: true, fetch_share: true, fetch_share_dev: true, limit: 300, app_ver: 7 });
        const json = (await this.executeEncryptedApiCall(url, { data }));
        this.homeIds = json?.result?.homelist?.map(home => home.id) || [];
        this.advancedDiagnostic('cloud home discovery summary', { region: country, homeCount: this.homeIds.length });
    }
    async getDevices(country, homeIds) {
        let selectedHomeIds;
        if (!homeIds) {
            if (!this.homeIds) {
                await this.getHomes(country);
            }
            selectedHomeIds = this.homeIds?.slice() || [];
        }
        else {
            selectedHomeIds = Array.isArray(homeIds) ? homeIds : [homeIds];
        }
        const url = `${this.getApiUrl(country)}/v2/home/home_device_list`;
        const devices = {};
        for (const homeId of selectedHomeIds) {
            devices[String(homeId)] = await this.executeEncryptedApiCall(url, {
                data: JSON.stringify({
                    home_owner: this.userId,
                    home_id: homeId,
                    limit: 200,
                    get_split_device: true,
                    support_smart_home: true,
                }),
            });
        }
        this.advancedDiagnostic('cloud device discovery summary', {
            region: country,
            requestedHomeCount: selectedHomeIds.length,
            response: devices,
        });
        return devices;
    }
    async executeEncryptedApiCall(url, params) {
        const cloudSession = this.exportSession();
        if (!this.isValidSession(cloudSession)) {
            throw new Error('Xiaomi Cloud authentication required');
        }
        const nonce = this.generateNonce(Date.now());
        const nonceSignature = this.signedNonce(nonce, cloudSession.ssecurity);
        const fields = this.generateEncryptedParams(new XiaomiCloudCrypto_1.XiaomiRC4Cipher(nonceSignature), url, 'POST', nonce, { ...params }, cloudSession.ssecurity);
        const operation = new URL(url).pathname.split('/').slice(-3).join('/');
        this.advancedDiagnostic('cloud API request', {
            operation,
            method: 'POST',
            encryptedFieldCount: Object.keys(fields).length,
        });
        try {
            const response = await this.session.post(`${url}?${qs_1.default.stringify(fields, { encode: true })}`, null, {
                headers: {
                    'Accept-Encoding': 'identity',
                    'User-Agent': this.agent,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'x-xiaomi-protocal-flag-cli': 'PROTOCAL-HTTP2',
                    'MIOT-ENCRYPT-ALGORITHM': 'ENCRYPT-RC4',
                    Cookie: `userId=${this.userId}; yetAnotherServiceToken=${this.serviceToken}; serviceToken=${this.serviceToken}; ${this.buildCookieHeader()}`,
                },
            });
            this.advancedDiagnostic('cloud API encrypted response', {
                operation,
                status: response.status,
                encryptedBytes: typeof response.data === 'string' ? response.data.length : 0,
            });
            if ([401, 403].includes(response.status)) {
                await this.invalidateSession('not_authenticated', 'Xiaomi Cloud session is no longer authorized');
                throw new Error('Xiaomi Cloud session is no longer authorized');
            }
            if (response.status !== 200) {
                throw new Error(`Xiaomi Cloud request failed (HTTP ${response.status})`);
            }
            const decrypted = JSON.parse(new XiaomiCloudCrypto_1.XiaomiRC4Cipher(nonceSignature).decrypt(response.data).replace('&&&START&&&', ''));
            this.advancedDiagnostic('cloud API decrypted response structure', { operation, payload: decrypted });
            return decrypted;
        }
        catch (error) {
            throw new Error(this.safeError(error));
        }
    }
    parseJSON(raw) {
        return (0, XiaomiCloudProtocol_1.parseXiaomiJSON)(raw);
    }
    safeError(error) {
        return (0, XiaomiCloudProtocol_1.safeXiaomiError)(error);
    }
    delay(ms) {
        return new Promise(resolve => {
            if (!this.adapter?.setTimeout?.(resolve, ms)) {
                resolve();
            }
        });
    }
    shutdown() {
        this.unloaded = true;
        this.abortController?.abort();
    }
    generateAgent() {
        return `mihome-vacuum/${crypto.randomBytes(8).toString('hex')}`;
    }
    generateDeviceId() {
        return crypto.randomBytes(6).toString('hex').slice(0, 6);
    }
    getApiUrl(country) {
        return `https://${country === 'cn' || country === '-' ? '' : `${country}.`}api.io.mi.com/app`;
    }
    signedNonce(nonce, ssecurity) {
        return (0, XiaomiCloudCrypto_1.signedNonce)(nonce, ssecurity);
    }
    generateNonce(millis) {
        return (0, XiaomiCloudCrypto_1.generateNonce)(millis);
    }
    generateEncSignature(url, method, nonceSignature, params) {
        return (0, XiaomiCloudCrypto_1.generateEncSignature)(url, method, nonceSignature, params);
    }
    generateEncryptedParams(rc4, url, method, nonce, params, ssecurity) {
        return (0, XiaomiCloudCrypto_1.generateEncryptedParams)(rc4, url, method, nonce, params, ssecurity);
    }
}
module.exports = XiaomiCloudConnector;
//# sourceMappingURL=XiaomiCloudConnector.js.map
const request = require('request');
const zlib = require('zlib');
const RRMapParser = require('./RRMapParser2');
const mapCreator = require('./mapCreator');
// libs for Cloudmap
const TreeMap = require('treemap-js');
let crypto = require('crypto');


let ssecurity = '';
let servicetoken = '';
let userId = '';
let mapUrlCache = [];

//helpermap just for dev
let maptest = '["robomap%2F74476450%2F0"]';

// just for testing 
//-----------------------------------
let adapter_helper = {

    log: {
        info: function (msg) {
            console.log('INFO: ' + msg);
        },
        error: function (msg) {
            console.log('ERROR: ' + msg);
        },
        debug: function (msg) {
            console.log('DEBUG: ' + msg);
        },
        warn: function (msg) {
            console.log('WARN: ' + msg);
        }
    },
    msg: {
        info: [],
        error: [],
        debug: [],
        warn: []
    }
};
//------------------------------------

function encodePassword(password) {
    return crypto.createHash('md5').update(password).digest('hex').toUpperCase();
}

function parseJson(data) {
    if (data.includes('&&&START&&&'))
        return JSON.parse(data.replace('&&&START&&&', ''));
    else
        return false;
}

function generateSignature(path, params) {
    let nonce = crypto.randomBytes(16)
    nonce.writeInt32LE(new Date().getTime() / 60000);
    nonce = nonce.toString('base64');

    let b = Buffer.from(crypto.randomBytes(8));
    let millis = Buffer.allocUnsafe(4);
    millis.writeUInt32BE(Math.round(new Date().getTime() / 60000));
    nonce = Buffer.concat([b, millis]).toString('base64');

    let signature = crypto.createHash('sha256').update(Buffer.concat([Buffer.from(ssecurity, 'base64'), Buffer.from(nonce, 'base64')])).digest('base64');

    let paramsTreeMap = new TreeMap();

    params.forEach(element => {
        paramsTreeMap.set(element.key, element.value);
    });

    let paramsArray = Array();
    if (path != null) {
        paramsArray.push(path);
    }

    paramsArray.push(signature);
    paramsArray.push(nonce);

    if (paramsTreeMap.getLength() > 0) {
        paramsTreeMap.each(function (value, key) {
            paramsArray.push(key + '=' + value);
        });
    } else {
        paramsArray.push('data=');
    }

    let postData = '';
    paramsArray.forEach(function (value) {
        if (postData != '') {
            postData += '&';
        }

        postData += value;
    });

    let body = {
        'signature': HashHmacSHA256(postData, signature),
        '_nonce': nonce
    };

    paramsTreeMap.each(function (value, key) {
        body[key] = value;
    });
    return body;
}

function HashHmacSHA256(data, secret) {
    let hmac = crypto.createHmac('sha256', Uint8Array.from(Buffer.from(secret, 'base64')));
    //passing the data to be hashed
    data = hmac.update(data);
    //Creating the hmac in the required format
    return data.digest('base64');
}


function getMapURL(mapName) {
    var self = this;

    return new Promise(function (resolve, reject) {
        let url = 'https://' + self.config.server + '.api.io.mi.com/app/home/getmapfileurl';
        let headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'x-xiaomi-protocal-flag-cli': 'PROTOCAL-HTTP2',
            'User-Agent': 'Android-7.1.1-1.0.0-ONEPLUS A3010-136-9D28921C354D7 APP/xiaomi.smarthome APPV/62830',
            'Cookie': 'userId=' + userId + '; yetAnotherServiceToken=' + servicetoken + '; serviceToken=' + servicetoken + '; locale=de_DE; timezone=GMT%2B01%3A00; is_daylight=1; dst_offset=3600000; channel=MI_APP_STORE',
        };

        let params = [{
            key: 'data',
            value: '{"obj_name":"' + mapName + '"}'
        }];

        let body = generateSignature('/home/getmapfileurl', params);

        let options = {
            url: url,
            method: 'POST',
            headers: headers,
            form: body,
            gzip: true
        };

        request(options, function (error, response, body) {
            if (!error && response.statusCode === 200) {
                let json = JSON.parse(response.body);

                if (json.message == 'ok') {
                    resolve(json);
                } else {
                    self.adapter.log.error('Error when receiving mapurl');
                    servicetoken = undefined;
                    reject(json.message);
                }
                return;
            }

            let json = JSON.parse(response.body);
            servicetoken = undefined;
            self.adapter.log.debug(response);

            reject(json.message);
        });
    });
}

const Maphelper = function (options, adapter) {
    if (typeof (adapter) === 'undefined') adapter = adapter_helper;

    this.adapter = adapter;
    this.ready = false;

    this.config = {
        username: options.username  || 'rensen26@gmail.com',
        password: options.password  || '2511tore',
        deviceId: '74476450',
        clientId: Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 6),
        deviceip: '127.0.0.1',
        token: '00000000000000000000000000000000',
        server: 'de',
        roboname: ''
    };

    this.login();
};

Maphelper.prototype.getRawMapData = function (urlstring, robotIp) {
    let that = this;
    let url;
    
    // micloud
    if ((typeof(robotIp) === 'undefined' || typeof(robotIp) === 'number') && typeof(urlstring) !== 'undefined'){
        url = urlstring;
    }
    // Valetudo
    else{
        url = 'http://' + robotIp + '/api/map/latest';
    }

    let options = {
        url: url
    };

    let requestWithEncoding = function (options, callback) {
        let req = request.get(options);

        req.on('response', function (res) {
            let chunks = [];
            res.on('data', function (chunk) {
                chunks.push(chunk);
            });

            res.on('end', function () {
                let buffer = Buffer.concat(chunks);

                try {
                    if (buffer[0x00] === 0x1f && buffer[0x01] === 0x8b) { // gzipped data
                        zlib.gunzip(buffer, function (err, decoded) {
                            callback(err, RRMapParser.PARSEDATA(decoded));
                        });
                    } else {
                        callback(null, JSON.parse(buffer));
                    }
                } catch (e) {
                    callback(e, null);
                }
            });
        });

        req.on('error', function (err) {
            callback(err);
        });
    };

    // Return new promise 
    return new Promise(function (resolve, reject) {

        requestWithEncoding(options, function (err, data) {
            if (err) {
                reject(err);
            } else {
                //console.log(JSON.stringify(data));
                //let map = mapCreator.CanvasMap(data);
                resolve(data);
            }
        });
    });
};

Maphelper.prototype.getMapBase64 = function (ip, options, url) {
    let that = this;

    return new Promise(function (resolve, reject) {

        that.getRawMapData(url,ip).then(function (data) {
            let map = mapCreator.CanvasMap(data);
            console.log('<img src="' + map.toDataURL() + '" /style="width: auto ;height: 100%;">')
            resolve(map);
        })
            .catch(error => reject(error));

    });
};


Maphelper.prototype.login = function (username, password) {
    let self = this;

    if (username == undefined)
        username = self.config.username;
    else
        servicetoken = null;

    if (password == undefined)
        password = self.config.password;
    else
        servicetoken = null;

    return new Promise(function (resolve, reject) {

        if (username.trim() == '' || password.trim() == '') {
            self.adapter.log.error(new Date(), 'Xiaomi Cloud: username or password missing.');
            reject('Xiaomi Cloud username or password missing.');
            return;
        }

        if (servicetoken) {
            resolve(true);
            return;
        } else {
            self.adapter.log.debug(new Date(), 'Xiaomi Cloud: Logging in');
        }

        // Set the headers for the request
        let headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Android-7.1.1-1.0.0-ONEPLUS A3010-136-9D28921C354D7 APP/xiaomi.smarthome APPV/62830',
            'Cookie': 'sdkVersion=accountsdk-18.8.15; userId=' + username + '; deviceId=' + self.config.clientId
        };

        // Configure the request
        let options = {
            url: 'https://account.xiaomi.com/pass/serviceLogin?sid=xiaomiio&_json=true',
            method: 'GET',
            headers: headers,
            gzip: true
        };

        // Start the request
        request(options, function (error, response, body) {
            if (!error && response.statusCode === 200) {
                // Print out the response body
                //console.log({status: 0, statusDsc: 'success', data: body});
                let jsonData = parseJson(body);

                if (jsonData == false) {
                    reject('Failed to get sign variable');
                    return;
                }

                headers.Cookie = 'sdkVersion=accountsdk-18.8.15; deviceId=' + self.config.clientId;

                let options = {
                    url: 'https://account.xiaomi.com/pass/serviceLoginAuth2',
                    method: 'POST',
                    headers: headers,
                    form: {
                        'sid': 'xiaomiio',
                        'hash': encodePassword(password),
                        'callback': 'https://sts.api.io.mi.com/sts',
                        'qs': '%3Fsid%3Dxiaomiio%26_json%3Dtrue',
                        'user': username,
                        '_sign': jsonData._sign,
                        '_json': 'true'
                    },
                    gzip: true
                };

                //headers.length = postBody.length;
                request(options, function (error, response, body) {
                    if (!error && response.statusCode === 200) {
                        // Print out the response body
                        //console.log({status: 0, statusDsc: 'success', data: body});
                        let jsonData = parseJson(body);

                        if (jsonData.code != 0) {
                            reject('Login failed');
                            return;
                        }

                        ssecurity = jsonData.ssecurity;
                        userId = jsonData.userId;
                        //cUserId = jsonData.cUserId;

                        const j = request.jar();
                        let options = {
                            url: jsonData.location,
                            method: 'GET',
                            headers: headers,
                            gzip: true,
                            jar: j
                        };

                        request(options, function (error, response, body) {
                            if (!error && response.statusCode === 200) {
                                const cookies = j.getCookies('https://sts.api.io.mi.com/');

                                let found = false;
                                cookies.forEach(cookie => {
                                    if (cookie.key == 'serviceToken') {
                                        servicetoken = cookie.value;
                                        found = true;
                                        //console.log(servicetoken);
                                        self.adapter.log.debug('Xiaomi Cloud: Login successful');
                                        self.ready = true;
                                        resolve(true);
                                        return;
                                    }
                                });

                                if (!found) {
                                    reject('Token cookie not found');
                                    return;
                                }

                            } else {
                                reject('HTTP error when getting token cookie');
                                self.adapter.log.error(new Date(), JSON.stringify(error));
                            }
                        });
                    } else {
                        reject('HTTP error when logging in');
                        self.adapter.log.error(JSON.stringify(error));
                    }
                });
            } else {
                reject('HTTP error when getting _sign')
                self.adapter.log.error(JSON.stringify(error));
            }
        });
    });
};


Maphelper.prototype.updateMap = function (dontRetry) {
    let self = this;

    if (dontRetry == true && servicetoken != undefined) {
        return;
    }


    //self.vacuum.getMapV1(function (error, mapRes) {
    let mapRes = JSON.parse(maptest);

    if (mapRes != undefined && mapRes[0] != 'retry') {

        let unixtime = Math.floor(new Date() / 1000);
        if (mapUrlCache[mapRes[0]] == undefined || mapUrlCache[mapRes[0]].expires > (unixtime - 60)) {
            getMapURL.call(self, mapRes[0]).then(function (result) {

                mapUrlCache[mapRes[0]] = {
                    expires: result.result.expires_time,
                    url: result.result.url
                };

                //self.getRawMapData.call(self, mapUrlCache[mapRes[0]].url);
                self.getMapBase64(0,null,mapUrlCache[mapRes[0]].url);
            }).catch(function (error) {
                self.adapter.log.error(error);
                if (!dontRetry) {
                    self.login().then(function (reponse) {
                        self.updateMap(true);
                    }).catch(function () {});
                }
            });
        } else {
            self.getRawMapData.call(this, mapUrlCache[mapRes[0]].url);
        }
    }
    //});
};

Maphelper.prototype.getDeviceStatus = function (username, password, obj) {
    let self = this;

    return new Promise(function (resolve, reject) {

        self.login(username, password).then(function (resp) {
            let url = 'https://' + self.config.server + '.api.io.mi.com/app/home/device_list';
            let headers = {
                'Content-Type': 'application/x-www-form-urlencoded',
                'x-xiaomi-protocal-flag-cli': 'PROTOCAL-HTTP2',
                'User-Agent': 'Android-7.1.1-1.0.0-ONEPLUS A3010-136-9D28921C354D7 APP/xiaomi.smarthome APPV/62830',
                'Cookie': 'userId=' + userId + '; yetAnotherServiceToken=' + servicetoken + '; serviceToken=' + servicetoken + '; locale=de_DE; timezone=GMT%2B01%3A00; is_daylight=1; dst_offset=3600000; channel=MI_APP_STORE',
            };

            let params = [{
                key: 'data',
                //value: '{"dids":["117978555"]}'
                value: obj
            }];

            let body = generateSignature('/home/device_list', params);

            let options = {
                url: url,
                method: 'POST',
                headers: headers,
                form: body,
                gzip: true
            };

            request(options, function (error, response, body) {
                if (!error && response.statusCode === 200) {
                    let json = JSON.parse(response.body);
                    if (json.message == 'ok')
                        resolve(json.result.list);
                    else
                        reject(json.message);
                    /*if(json.message == 'ok') {
                      resolve(json);
                    }
                    else {
                      servicetoken = undefined;
                      reject(json.message);
                    }*/
                    return;
                }

                console.log(response);
                servicetoken = undefined;
                reject('HTTP ERROR');
            });
        }).catch(function (error) {
            reject(error);
        });
    });
};




module.exports = Maphelper;
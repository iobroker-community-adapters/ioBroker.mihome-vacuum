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
/* eslint-disable @typescript-eslint/only-throw-error, @typescript-eslint/prefer-promise-reject-errors, @typescript-eslint/require-await */
const axios_1 = __importDefault(require("axios"));
const node_module_1 = require("node:module");
const zlib = __importStar(require("node:zlib"));
const XiaomiCloudConnector_1 = __importDefault(require("./XiaomiCloudConnector"));
const RRMapParser_1 = __importDefault(require("./RRMapParser"));
const runtimeRequire = (0, node_module_1.createRequire)(__filename);
const adapterHelper = {
    config: {},
    log: {
        info: message => console.log(`INFO: ${String(message)}`),
        error: message => console.log(`ERROR: ${String(message)}`),
        debug: message => console.log(`DEBUG: ${String(message)}`),
        warn: message => console.log(`WARN: ${String(message)}`),
    },
};
function loadMapCreator() {
    try {
        return runtimeRequire('./mapCreator');
    }
    catch (error) {
        console.warn(error);
        return null;
    }
}
class MapHelper {
    adapter;
    ready = false;
    shutdownComplete = false;
    mapUrlCache = new Map();
    mapCreator = null;
    config;
    cloudConnector;
    constructor(_options, adapter = adapterHelper) {
        let deviceId;
        if (adapter.config.devices) {
            try {
                const devices = JSON.parse(adapter.config.devices);
                deviceId = devices.did;
            }
            catch {
                adapter.log.debug('Map helper: configured cloud device data is not valid JSON');
            }
        }
        this.adapter = adapter;
        this.config = {
            username: adapter.config.email || '',
            password: adapter.config.password || '',
            deviceId: deviceId || '',
            server: adapter.config.server || '-',
            valetudo: adapter.config.valetudo_enable || false,
            mimap: adapter.config.enableMiMap || false,
            ip: adapter.config.ip || '',
            COLOR_OPTIONS: {
                FLOORCOLOR: adapter.config.valetudo_color_floor,
                WALLCOLOR: adapter.config.valetudo_color_wall,
                PATHCOLOR: adapter.config.valetudo_color_path,
                ROBOT: adapter.config.robot_select,
                newmap: adapter.config.newmap || false,
            },
        };
        if (this.config.valetudo || this.config.mimap) {
            this.mapCreator = loadMapCreator();
            adapter.log.debug(`load Map creator... ${Boolean(this.mapCreator)}`);
        }
        this.cloudConnector = new XiaomiCloudConnector_1.default(adapter.log, {}, adapter);
    }
    getRawMapData(urlString) {
        const url = urlString !== undefined && this.config.mimap ? urlString : `http://${this.config.ip}/api/map/latest`;
        return new Promise((resolve, reject) => {
            axios_1.default
                .get(url, { responseType: 'arraybuffer', decompress: false })
                .then(response => {
                const buffer = Buffer.from(response.data);
                if (response.status !== 200) {
                    reject(response.status === 404 ? 'wrong server selected' : 'no map found on server');
                    return;
                }
                try {
                    if (buffer[0x00] === 0x1f && buffer[0x01] === 0x8b) {
                        zlib.gunzip(buffer, (error, decoded) => {
                            if (error) {
                                reject(error);
                            }
                            else {
                                resolve(RRMapParser_1.default.PARSEDATA(decoded));
                            }
                        });
                    }
                    else {
                        resolve(JSON.parse(buffer.toString('utf8')));
                    }
                }
                catch (error) {
                    reject(error);
                }
            })
                .catch(error => reject(error));
        });
    }
    getMapBase64(url) {
        return new Promise((resolve, reject) => {
            const mapCreator = this.mapCreator;
            if (!mapCreator?.CanvasMap) {
                this.adapter.log.warn('CANVAS package not installed....please install Canvas package manually or disable Map in config see also https://github.com/iobroker-community-adapters/ioBroker.mihome-vacuum#error-at-installation');
                this.config.mimap = false;
                this.config.valetudo = false;
                reject('CanvasMap not loaded');
                return;
            }
            this.getRawMapData(url)
                .then(rawData => {
                try {
                    const data = rawData;
                    const map = mapCreator.CanvasMap(data, this.config.COLOR_OPTIONS, this.adapter);
                    resolve([map, data.image.segments.id, data.currently_cleaned_zones, data.goto_target]);
                }
                catch (error) {
                    reject(error);
                }
            })
                .catch(error => reject(error));
        });
    }
    login() {
        if (this.cloudConnector.loggedIn()) {
            return Promise.resolve({ ok: true });
        }
        return Promise.reject(new Error('Xiaomi Cloud authentication required; start the QR login in the adapter configuration'));
    }
    updateMap(mapUrl, dontRetry) {
        return new Promise((resolve, reject) => {
            if (this.config.mimap === true) {
                this.adapter.log.debug('update_Map Mimap enabled');
                if (dontRetry && this.cloudConnector.loggedIn()) {
                    this.adapter.log.debug('dont retry');
                    reject('dont repeat');
                    return;
                }
                const unixTime = Math.floor(Date.now() / 1000);
                const cachedMapUrl = this.mapUrlCache.get(mapUrl);
                if (!cachedMapUrl || cachedMapUrl.expires < unixTime - 60) {
                    this.adapter.log.debug('update_Map need new mapurl');
                    this.getMapURL(mapUrl)
                        .then(result => {
                        const newMapUrl = {
                            expires: result.result.expires_time,
                            url: result.result.url,
                        };
                        this.mapUrlCache.set(mapUrl, newMapUrl);
                        this.adapter.log.debug('update_Map received new cloud map location');
                        this.adapter.log.debug(`update_Map got new expires:${newMapUrl.expires}`);
                        this.adapter.log.debug(`update_Map got new time:${unixTime}`);
                        this.getMapBase64(newMapUrl.url)
                            .then(mapData => resolve(mapData))
                            .catch(error => reject(error));
                    })
                        .catch(() => {
                        this.adapter.log.warn('Map request failed');
                        if (!dontRetry) {
                            this.login()
                                .then(() => this.updateMap(mapUrl, true))
                                .catch(error => reject(error));
                        }
                    });
                }
                else {
                    this.adapter.log.debug('update_Map use old mapurl');
                    this.getMapBase64(cachedMapUrl.url)
                        .then(mapData => resolve(mapData))
                        .catch(error => reject(error));
                }
            }
            else if (this.config.valetudo === true) {
                this.getMapBase64()
                    .then(mapData => resolve(mapData))
                    .catch(error => reject(error));
            }
        });
    }
    getMapURL(mapName) {
        return new Promise((resolve, reject) => {
            this.login()
                .then(() => {
                const url = this.config.server === '-'
                    ? 'https://api.io.mi.com/app/home/getmapfileurl'
                    : `https://${this.config.server}.api.io.mi.com/app/home/getmapfileurl`;
                const data = JSON.stringify({ obj_name: mapName });
                this.cloudConnector
                    .executeEncryptedApiCall(url, { data })
                    .then(rawResponse => {
                    const response = rawResponse;
                    try {
                        if (response.message === 'ok') {
                            resolve(response);
                        }
                        else {
                            throw response.message;
                        }
                    }
                    catch {
                        this.adapter.log.error('Error when receiving map URL');
                        reject(new Error('Map URL request was rejected'));
                    }
                })
                    .catch(() => {
                    this.adapter.log.warn('Error while requesting map URL');
                    reject(new Error('Map URL request failed'));
                });
            })
                .catch(error => reject(error));
        });
    }
    async shutdown() {
        if (this.shutdownComplete) {
            return;
        }
        this.shutdownComplete = true;
        this.mapUrlCache.clear();
        this.cloudConnector.shutdown();
    }
}
module.exports = MapHelper;
//# sourceMappingURL=maphelper.js.map
const axios = require('axios');
//const zlib = require('zlib');
const zlib = require('node:zlib');
const RRMapParser = require('./RRMapParser');
//const mapCreator = require('./mapCreator');
// libs for Cloudmap
const XiaomiCloudConnector = require('./XiaomiCloudConnector');

//load if map is selected
let mapCreator = {
    load: function () {
        try {
            mapCreator = require('./mapCreator');
            return true;
        } catch (error) {
            console.warn(error);
            return false;
        }
    },
};

const mapUrlCache = [];

//helpermap just for dev
// let maptest = '["robomap%2F74476450%2F0"]';
class MapHelper {
    constructor(options, adapter) {
        if (typeof adapter === 'undefined') {
            adapter = adapter_helper;
        }
        let did;
        try {
            did = JSON.parse(adapter.config.devices).did;
        } catch (error) {
            adapter.log.error(error);
        }
        this.adapter = adapter;
        this.ready = false;

        this.config = {
            username: adapter && adapter.config && adapter.config.email ? adapter.config.email : '',
            password: adapter && adapter.config && adapter.config.password ? adapter.config.password : '',
            deviceId: did ? did : '',
            server: adapter && adapter.config && adapter.config.server ? adapter.config.server : '-',
            valetudo:
                adapter && adapter.config && adapter.config.valetudo_enable ? adapter.config.valetudo_enable : false,
            mimap: adapter && adapter.config && adapter.config.enableMiMap ? adapter.config.enableMiMap : false,
            ip: adapter && adapter.config && adapter.config.ip ? adapter.config.ip : '',
            COLOR_OPTIONS: {
                FLOORCOLOR: adapter.config.valetudo_color_floor,
                WALLCOLOR: adapter.config.valetudo_color_wall,
                PATHCOLOR: adapter.config.valetudo_color_path,
                ROBOT: adapter.config.robot_select,
                newmap: adapter && adapter.config && adapter.config.newmap ? adapter.config.newmap : false,
            },
        };
        if (this.config.valetudo || this.config.mimap) {
            adapter.log.debug(`load Map creator... ${mapCreator.load()}`);
        }

        this.cloudConnector = new XiaomiCloudConnector(adapter.log, {
            username: this.config.username,
            password: this.config.password,
        });
        //this.adapter.log.debug("Maphelper_config___" + JSON.stringify(this.config));
        //this.login();
    }

    getRawMapData(urlstring) {
        let url;

        // micloud
        if (typeof urlstring !== 'undefined' && this.config.mimap) {
            url = urlstring;
        } else {
            // Valetudo
            url = `http://${this.config.ip}/api/map/latest`;
        }

        // Return new promise
        return new Promise(function (resolve, reject) {
            axios
                .get(url, {
                    responseType: 'arraybuffer', // wichtig für Binärdaten
                    decompress: false, // wir entpacken manuell
                })
                .then(response => {
                    const status = response.status;
                    const buffer = Buffer.from(response.data);

                    if (status !== 200) {
                        if (status === 404) {
                            //this.adapter.log.debug(`Mapresponse_ ${JSON.stringify(response.headers)}`);
                            reject(`wrong server selected___${JSON.stringify(response.headers)}`);
                        } else {
                            reject(`no map found on server___${JSON.stringify(response.headers)}`);
                        }
                        return;
                    }

                    try {
                        if (buffer[0x00] === 0x1f && buffer[0x01] === 0x8b) {
                            // gzip-Daten
                            zlib.gunzip(buffer, (err, decoded) => {
                                if (err) {
                                    reject(err);
                                } else {
                                    resolve(RRMapParser.PARSEDATA(decoded));
                                }
                            });
                        } else {
                            resolve(JSON.parse(buffer.toString('utf8')));
                        }
                    } catch (e) {
                        reject(e);
                    }
                })
                .catch(err => {
                    reject(err);
                });
        });
    }

    getMapBase64(url) {
        return new Promise((resolve, reject) => {
            if (!mapCreator.CanvasMap) {
                this.adapter.log.warn(
                    'CANVAS package not installed....please install Canvas package manually or disable Map in config see also https://github.com/iobroker-community-adapters/ioBroker.mihome-vacuum#error-at-installation',
                );
                this.config.mimap = false;
                this.config.valetudo = false;
                reject('CanvasMap not loaded');
            }
            this.getRawMapData(url)
                .then(data => {
                    try {
                        //(self.adapter.log.debug(JSON.stringify(data));
                        const map = mapCreator.CanvasMap(data, this.config.COLOR_OPTIONS, this.adapter);
                        //console.log('<img src="' + map.toDataURL() + '" /style="width: auto ;height: 100%;">')
                        resolve([map, data.image.segments.id, data.currently_cleaned_zones, data.goto_target]);
                    } catch (e) {
                        reject(e);
                    }
                })
                .catch(error => reject(error));
        });
    }

    login() {
        return this.cloudConnector.login();
    }

    updateMap(mapurl, dontRetry) {
        return new Promise((resolve, reject) => {
            // if mimap is selected
            if (this.config.mimap === true) {
                this.adapter.log.debug('update_Map Mimap enabled');
                if (dontRetry && this.cloudConnector.loggedIn()) {
                    this.adapter.log.debug('dont retry');
                    return reject('dont repeat');
                }
                const unixTime = Math.floor(Date.now() / 1000);
                if (!mapUrlCache[mapurl] || mapUrlCache[mapurl].expires < unixTime - 60) {
                    this.adapter.log.debug('update_Map need new mapurl');
                    this.getMapURL(mapurl)
                        .then(result => {
                            mapUrlCache[mapurl] = {
                                expires: result.result.expires_time,
                                url: result.result.url,
                            };

                            this.adapter.log.debug(`update_Map got new url:${mapUrlCache[mapurl].url}`);
                            this.adapter.log.debug(`update_Map got new expires:${mapUrlCache[mapurl].expires}`);
                            this.adapter.log.debug(`update_Map got new time:${unixTime}`);
                            this.getMapBase64(mapUrlCache[mapurl].url)
                                .then(mapData => resolve(mapData))
                                .catch(error => reject(error));
                        })
                        .catch(error => {
                            //reject(error);
                            this.adapter.log.warn(`map error:${error}`);
                            if (!dontRetry) {
                                this.login()
                                    .then(() => this.updateMap(mapurl, true))
                                    .catch(error => reject(error));
                            }
                        });
                } else {
                    this.adapter.log.debug('update_Map use old mapurl');
                    this.getMapBase64(mapUrlCache[mapurl].url)
                        .then(mapData => resolve(mapData))
                        .catch(error => reject(error));
                }
            } else if (this.config.valetudo === true) {
                this.getMapBase64()
                    .then(mapData => resolve(mapData))
                    .catch(error => reject(error));
            }
        });
    }

    getMapURL(mapName) {
        return new Promise((resolve, reject) =>
            this.login()
                .then(() => {
                    let url;
                    if (this.config.server === '-') {
                        url = 'https://api.io.mi.com/app/home/getmapfileurl';
                    } else {
                        url = `https://${this.config.server}.api.io.mi.com/app/home/getmapfileurl`;
                    }
                    const data = JSON.stringify({
                        obj_name: mapName,
                    });
                    this.cloudConnector
                        .executeEncryptedApiCall(url, { data })
                        .then(json => {
                            try {
                                if (json.message === 'ok') {
                                    resolve(json);
                                } else {
                                    throw json.message;
                                }
                            } catch (err) {
                                this.adapter.log.error(`Error when receiving map url: ${json}`);
                                //this.cloudConnector.refreshToken();
                                reject(err);
                            }
                        })
                        .catch(error => {
                            this.cloudConnector.refreshToken();
                            this.adapter.log.warn(`Get Error when receiving map url: ${error.message}`);
                            reject(error);
                        });
                })
                .catch(error => reject(error)),
        );
    }
}

// just for testing
//-----------------------------------
const adapter_helper = {
    log: {
        info: function (msg) {
            console.log(`INFO: ${msg}`);
        },
        error: function (msg) {
            console.log(`ERROR: ${msg}`);
        },
        debug: function (msg) {
            console.log(`DEBUG: ${msg}`);
        },
        warn: function (msg) {
            console.log(`WARN: ${msg}`);
        },
    },
    msg: {
        info: [],
        error: [],
        debug: [],
        warn: [],
    },
};
module.exports = MapHelper;

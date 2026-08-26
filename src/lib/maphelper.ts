/* eslint-disable @typescript-eslint/only-throw-error, @typescript-eslint/prefer-promise-reject-errors, @typescript-eslint/require-await */
import axios from 'axios';
import { createRequire } from 'node:module';
import * as zlib from 'node:zlib';
import XiaomiCloudConnector from './XiaomiCloudConnector';
import RRMapParser from './RRMapParser';
import type { MapCreatorModule, MapHelperAdapter, MapHelperConfig, MapUrlResponse } from '../types/mapHelper';
import type { RRMapData } from '../types/rrMap';
import type { XiaomiCloudAdapter } from '../types/xiaomiCloudConnector';

interface CloudConnector {
    loggedIn(): boolean;
    executeEncryptedApiCall(url: string, params: { data: string }): Promise<unknown>;
    shutdown(): void;
}

interface CachedMapUrl {
    expires: number;
    url: string;
}

type MapResult = [unknown, number[], RRMapData['currently_cleaned_zones'], RRMapData['goto_target']];

const runtimeRequire = createRequire(__filename);

const adapterHelper: MapHelperAdapter = {
    config: {},
    log: {
        info: message => console.log(`INFO: ${String(message)}`),
        error: message => console.log(`ERROR: ${String(message)}`),
        debug: message => console.log(`DEBUG: ${String(message)}`),
        warn: message => console.log(`WARN: ${String(message)}`),
    },
};

function loadMapCreator(): MapCreatorModule | null {
    try {
        return runtimeRequire('./mapCreator') as MapCreatorModule;
    } catch (error) {
        console.warn(error);
        return null;
    }
}

class MapHelper {
    readonly adapter: MapHelperAdapter;
    ready = false;
    shutdownComplete = false;
    readonly mapUrlCache = new Map<string, CachedMapUrl>();
    mapCreator: MapCreatorModule | null = null;
    readonly config: MapHelperConfig;
    readonly cloudConnector: CloudConnector;

    constructor(_options: unknown, adapter: MapHelperAdapter = adapterHelper) {
        let deviceId: string | undefined;
        if (adapter.config.devices) {
            try {
                const devices = JSON.parse(adapter.config.devices) as { did?: string };
                deviceId = devices.did;
            } catch {
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
        this.cloudConnector = new XiaomiCloudConnector(
            adapter.log,
            {},
            adapter as MapHelperAdapter & XiaomiCloudAdapter,
        );
    }

    getRawMapData(urlString?: string): Promise<unknown> {
        const url =
            urlString !== undefined && this.config.mimap ? urlString : `http://${this.config.ip}/api/map/latest`;

        return new Promise((resolve, reject) => {
            axios
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
                                } else {
                                    resolve(RRMapParser.PARSEDATA(decoded));
                                }
                            });
                        } else {
                            resolve(JSON.parse(buffer.toString('utf8')));
                        }
                    } catch (error) {
                        reject(error);
                    }
                })
                .catch(error => reject(error));
        });
    }

    getMapBase64(url?: string): Promise<MapResult> {
        return new Promise((resolve, reject) => {
            const mapCreator = this.mapCreator;
            if (!mapCreator?.CanvasMap) {
                this.adapter.log.warn(
                    'CANVAS package not installed....please install Canvas package manually or disable Map in config see also https://github.com/iobroker-community-adapters/ioBroker.mihome-vacuum#error-at-installation',
                );
                this.config.mimap = false;
                this.config.valetudo = false;
                reject('CanvasMap not loaded');
                return;
            }
            this.getRawMapData(url)
                .then(rawData => {
                    try {
                        const data = rawData as RRMapData;
                        const map = mapCreator.CanvasMap(data, this.config.COLOR_OPTIONS, this.adapter);
                        resolve([map, data.image!.segments.id, data.currently_cleaned_zones, data.goto_target]);
                    } catch (error) {
                        reject(error);
                    }
                })
                .catch(error => reject(error));
        });
    }

    login(): Promise<{ ok: true }> {
        if (this.cloudConnector.loggedIn()) {
            return Promise.resolve({ ok: true });
        }
        return Promise.reject(
            new Error('Xiaomi Cloud authentication required; start the QR login in the adapter configuration'),
        );
    }

    updateMap(mapUrl: string, dontRetry?: boolean): Promise<unknown> {
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
                } else {
                    this.adapter.log.debug('update_Map use old mapurl');
                    this.getMapBase64(cachedMapUrl.url)
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

    getMapURL(mapName: string): Promise<MapUrlResponse> {
        return new Promise((resolve, reject) => {
            this.login()
                .then(() => {
                    const url =
                        this.config.server === '-'
                            ? 'https://api.io.mi.com/app/home/getmapfileurl'
                            : `https://${this.config.server}.api.io.mi.com/app/home/getmapfileurl`;
                    const data = JSON.stringify({ obj_name: mapName });
                    this.cloudConnector
                        .executeEncryptedApiCall(url, { data })
                        .then(rawResponse => {
                            const response = rawResponse as Partial<MapUrlResponse>;
                            try {
                                if (response.message === 'ok') {
                                    resolve(response as MapUrlResponse);
                                } else {
                                    throw response.message;
                                }
                            } catch {
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

    async shutdown(): Promise<void> {
        if (this.shutdownComplete) {
            return;
        }
        this.shutdownComplete = true;
        this.mapUrlCache.clear();
        this.cloudConnector.shutdown();
    }
}

export = MapHelper;

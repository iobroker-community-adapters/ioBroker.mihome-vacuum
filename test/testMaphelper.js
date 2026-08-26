const assert = require('node:assert/strict');
const proxyquire = require('proxyquire').noCallThru().noPreserveCache();
const MapHelper = require('../build/lib/maphelper');

describe('MapHelper logging', () => {
    function createAdapter() {
        return {
            config: {
                enableMiMap: false,
                server: 'de',
            },
            log: {
                debug: () => undefined,
                info: () => undefined,
                warn: () => undefined,
                error: () => undefined,
            },
        };
    }

    it('does not log the cloud map location', async () => {
        const debugMessages = [];
        const adapter = {
            config: {
                enableMiMap: false,
                server: 'de',
            },
            log: {
                debug: message => debugMessages.push(String(message)),
                info: () => undefined,
                warn: () => undefined,
                error: () => undefined,
            },
        };
        const mapHelper = new MapHelper({}, adapter);
        const sensitiveLocationMarker = 'SENSITIVE_MAP_LOCATION_MARKER';

        mapHelper.config.mimap = true;
        mapHelper.getMapURL = async () => ({
            message: 'ok',
            result: {
                expires_time: Math.floor(Date.now() / 1000) + 300,
                url: sensitiveLocationMarker,
            },
        });
        mapHelper.getMapBase64 = async () => ['map-data', [], undefined, undefined];

        const result = await mapHelper.updateMap(`map-${Date.now()}`);

        assert.deepEqual(result, ['map-data', [], undefined, undefined]);
        assert.equal(debugMessages.some(message => message.includes(sensitiveLocationMarker)), false);
    });

    it('shuts down its cloud connector once', async () => {
        const adapter = {
            config: {},
            log: {
                debug: () => undefined,
                info: () => undefined,
                warn: () => undefined,
                error: () => undefined,
            },
        };
        const mapHelper = new MapHelper({}, adapter);
        let shutdownCalls = 0;
        mapHelper.cloudConnector.shutdown = () => shutdownCalls++;
        mapHelper.mapUrlCache.set('test-map', {
            expires: Math.floor(Date.now() / 1000) + 300,
            url: 'sensitive-map-url',
        });

        await mapHelper.shutdown();
        await mapHelper.shutdown();

        assert.equal(shutdownCalls, 1);
        assert.equal(mapHelper.mapUrlCache.size, 0);
    });

    it('does not refresh or restart authentication after an ordinary map request error', async () => {
        const adapter = {
            config: { server: 'de' },
            log: {
                debug: () => undefined,
                info: () => undefined,
                warn: () => undefined,
                error: () => undefined,
            },
        };
        const mapHelper = new MapHelper({}, adapter);
        let refreshCalls = 0;
        mapHelper.cloudConnector.loggedIn = () => true;
        mapHelper.cloudConnector.executeEncryptedApiCall = async () => {
            throw new Error('synthetic map request failure');
        };
        /** @type {any} */ (mapHelper.cloudConnector).refreshToken = async () => {
            refreshCalls++;
            return { err: '' };
        };

        await assert.rejects(mapHelper.getMapURL('test-map'));

        assert.equal(refreshCalls, 0);
    });

    it('keeps cloud map URL caches isolated between adapter instances', async () => {
        const firstMapHelper = new MapHelper({}, createAdapter());
        const secondMapHelper = new MapHelper({}, createAdapter());
        const mapName = `shared-map-${Date.now()}`;
        let firstUrlRequests = 0;
        let secondUrlRequests = 0;

        firstMapHelper.config.mimap = true;
        secondMapHelper.config.mimap = true;
        firstMapHelper.getMapURL = async () => {
            firstUrlRequests++;
            return {
                message: 'ok',
                result: {
                    expires_time: Math.floor(Date.now() / 1000) + 300,
                    url: 'first-instance-map-url',
                },
            };
        };
        secondMapHelper.getMapURL = async () => {
            secondUrlRequests++;
            return {
                message: 'ok',
                result: {
                    expires_time: Math.floor(Date.now() / 1000) + 300,
                    url: 'second-instance-map-url',
                },
            };
        };
        firstMapHelper.getMapBase64 = async url => [url, [], undefined, undefined];
        secondMapHelper.getMapBase64 = async url => [url, [], undefined, undefined];

        assert.deepEqual(await firstMapHelper.updateMap(mapName), ['first-instance-map-url', [], undefined, undefined]);
        assert.deepEqual(await secondMapHelper.updateMap(mapName), [
            'second-instance-map-url',
            [],
            undefined,
            undefined,
        ]);
        assert.equal(firstUrlRequests, 1);
        assert.equal(secondUrlRequests, 1);
    });
});

describe('MapHelper TypeScript runtime', () => {
    function createObservedAdapter(config = {}) {
        /** @type {Record<'debug' | 'info' | 'warn' | 'error', string[]>} */
        const logs = { debug: [], info: [], warn: [], error: [] };
        return {
            adapter: {
                config,
                log: {
                    debug: message => logs.debug.push(String(message)),
                    info: message => logs.info.push(String(message)),
                    warn: message => logs.warn.push(String(message)),
                    error: message => logs.error.push(String(message)),
                },
            },
            logs,
        };
    }

    it('parses configuration and keeps URL caches isolated', async () => {
        const config = {
            devices: JSON.stringify({ did: 'synthetic-device-id' }),
            server: 'de',
            ip: '192.0.2.1',
            enableMiMap: false,
            valetudo_enable: false,
            newmap: true,
        };
        const firstAdapter = createObservedAdapter(structuredClone(config));
        const secondAdapter = createObservedAdapter(structuredClone(config));
        const first = new MapHelper({}, firstAdapter.adapter);
        const second = new MapHelper({}, secondAdapter.adapter);

        try {
            assert.deepEqual(first.config, {
                username: '',
                password: '',
                deviceId: 'synthetic-device-id',
                server: 'de',
                valetudo: false,
                mimap: false,
                ip: '192.0.2.1',
                COLOR_OPTIONS: {
                    FLOORCOLOR: undefined,
                    WALLCOLOR: undefined,
                    PATHCOLOR: undefined,
                    ROBOT: undefined,
                    newmap: true,
                },
            });
            first.mapUrlCache.set('first-only', { expires: 1, url: 'first-url' });
            second.mapUrlCache.set('second-only', { expires: 1, url: 'second-url' });
            assert.equal(second.mapUrlCache.has('first-only'), false);
            assert.equal(first.mapUrlCache.has('second-only'), false);
        } finally {
            await first.shutdown();
            await second.shutdown();
        }
    });

    it('routes fresh and cached map URLs without exposing locations', async () => {
        const observed = createObservedAdapter({ server: 'de' });
        const mapHelper = new MapHelper({}, observed.adapter);
        const sensitiveUrl = 'SENSITIVE_TYPED_MAP_URL';
        let requests = 0;

        try {
            mapHelper.config.mimap = true;
            mapHelper.getMapURL = async () => {
                requests++;
                return { message: 'ok', result: { expires_time: 9999999999, url: sensitiveUrl } };
            };
            mapHelper.getMapBase64 = async url => [url, [], undefined, undefined];

            const expected = [sensitiveUrl, [], undefined, undefined];
            assert.deepEqual(await mapHelper.updateMap('same-map'), expected);
            assert.deepEqual(await mapHelper.updateMap('same-map'), expected);
            assert.equal(requests, 1);
            assert.equal(JSON.stringify(observed.logs).includes(sensitiveUrl), false);
        } finally {
            await mapHelper.shutdown();
        }
    });

    it('redacts HTTP headers and cloud response details from errors and logs', async () => {
        const sensitiveMarker = 'SENSITIVE_HEADER_OR_RESPONSE';
        const axiosStub = {
            get: async () => ({ status: 404, data: Buffer.alloc(0), headers: { private: sensitiveMarker } }),
        };
        const FakeCloudConnector = class {
            loggedIn() {
                return true;
            }
            shutdown() {}
        };
        const MapHelperWithMocks = proxyquire('../build/lib/maphelper', {
            axios: { default: axiosStub, ...axiosStub },
            './XiaomiCloudConnector': FakeCloudConnector,
        });
        const observed = createObservedAdapter({});
        const mapHelper = new MapHelperWithMocks({}, observed.adapter);

        try {
            await assert.rejects(mapHelper.getRawMapData(), error => !String(error).includes(sensitiveMarker));
            mapHelper.cloudConnector.executeEncryptedApiCall = async () => ({ message: sensitiveMarker });
            await assert.rejects(mapHelper.getMapURL('map'), error => !String(error).includes(sensitiveMarker));
            assert.equal(JSON.stringify(observed.logs).includes(sensitiveMarker), false);
        } finally {
            await mapHelper.shutdown();
        }
    });
});

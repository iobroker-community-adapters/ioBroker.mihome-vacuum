const assert = require('node:assert/strict');
const EventEmitter = require('node:events');
const proxyquire = require('proxyquire').noCallThru();
const sinon = require('sinon');

function withManagedTimers(adapter) {
    adapter.setTimeout = (callback, delay, ...args) => setTimeout(callback, delay, ...args);
    adapter.clearTimeout = timeout => clearTimeout(timeout);
    return adapter;
}

class FakeSocket extends EventEmitter {
    constructor() {
        super();
        this.closeCalls = 0;
        this.sentPackets = [];
        this.deferSendCallback = false;
        this.pendingSendCallbacks = [];
        this.sendError = null;
    }

    bind() {}

    close(callback) {
        this.closeCalls++;
        this.emit('close');
        if (callback) callback();
    }

    send(...args) {
        this.sentPackets.push(args[0]);
        const callback = args[args.length - 1];
        if (typeof callback === 'function') {
            if (this.deferSendCallback) {
                this.pendingSendCallbacks.push(callback);
            } else {
                callback(this.sendError);
            }
        }
    }

    address() {
        return { address: 'test-host', port: 12345 };
    }
}

/**
 * @param {string} [modulePath]
 * @param {number | string} [port]
 */
function createClient(modulePath = '../build/lib/miio', port = 54321) {
    const socket = new FakeSocket();
    const connectionStates = [];
    /** @type {Record<string, string[]>} */
    const logs = { debug: [], info: [], warn: [], error: [] };
    const adapter = withManagedTimers({
        config: {
            ownPort: 53421,
            port,
            ip: 'test-host',
            token: '00000000000000000000000000000000',
        },
        log: Object.fromEntries(
            Object.keys(logs).map(level => [level, message => logs[level].push(String(message))]),
        ),
        setConnection: connected => connectionStates.push(connected),
    });
    const Miio = proxyquire(modulePath, {
        'node:dgram': {
            createSocket: () => socket,
        },
    });
    const client = new Miio(adapter);
    let answer = {};
    client.connected = true;
    client.packet.msgCounter = 1;
    client.packet.getRaw_fast = () => Buffer.from('request');
    client.packet.setRaw = () => undefined;
    client.packet.getPlainData = () => JSON.stringify(answer);

    return {
        client,
        socket,
        connectionStates,
        logs,
        answer(id, result = ['ok']) {
            answer = { id, result };
            socket.emit('message', Buffer.alloc(33), { port: Number(port) });
        },
    };
}

function createPacketClient(modulePath = '../build/lib/miio') {
    const socket = new FakeSocket();
    const Miio = proxyquire(modulePath, { 'node:dgram': { createSocket: () => socket } });
    const client = new Miio(withManagedTimers({
        config: {
            ownPort: 53421,
            port: 54321,
            ip: 'test-host',
            token: '00000000000000000000000000000000',
        },
        log: { debug() {}, info() {}, warn() {}, error() {} },
        setConnection() {},
    }));
    return { client, socket };
}

describe('Miio lifecycle', () => {
    it('keeps response handling isolated between adapter instances', async () => {
        const sockets = [new FakeSocket(), new FakeSocket()];
        let socketIndex = 0;
        const Miio = proxyquire('../build/lib/miio', {
            'node:dgram': {
                createSocket: () => sockets[socketIndex++],
            },
        });
        const createAdapter = () => {
            const connectionStates = [];
            return withManagedTimers({
                config: {
                    ownPort: 53421,
                    port: 54321,
                    ip: 'test-host',
                    token: '00000000000000000000000000000000',
                },
                connectionStates,
                log: {
                    debug: () => undefined,
                    info: () => undefined,
                    warn: () => undefined,
                    error: () => undefined,
                },
                setConnection: connected => connectionStates.push(connected),
            });
        };
        const firstAdapter = createAdapter();
        const secondAdapter = createAdapter();
        const firstClient = new Miio(firstAdapter);
        const secondClient = new Miio(secondAdapter);
        firstClient.connected = true;
        firstClient.packet.msgCounter = 1;
        firstClient.packet.getRaw_fast = () => Buffer.from('request');
        firstClient.packet.setRaw = () => undefined;
        firstClient.packet.getPlainData = () => JSON.stringify({ id: 1, result: ['ok'] });

        const response = firstClient.sendMessage('get_status');
        sockets[0].emit('message', Buffer.alloc(33), { port: 54321 });

        assert.deepEqual(await response, { id: 1, result: ['ok'] });
        assert.deepEqual(firstAdapter.connectionStates, [true]);
        assert.deepEqual(secondAdapter.connectionStates, []);
        firstClient.close();
        secondClient.close();
    });

    it('does not log the complete hello packet', () => {
        const { client, socket, logs } = createClient();
        const helloPacket = Buffer.alloc(32, 0xab);
        client.connected = null;
        client.packet.stamprec = Buffer.alloc(4);

        client.__sendPing();
        socket.emit('message', helloPacket, { port: 54321 });

        assert.equal(logs.debug.includes('MIIO hello received'), true);
        assert.equal(logs.debug.some(message => message.includes(helloPacket.toString('hex'))), false);
        client.close();
    });

    it('synchronizes the hello header before emitting the first connect event', () => {
        const { client, socket } = createClient();
        const helloPacket = Buffer.alloc(32);
        helloPacket.writeUInt16BE(0x2131, 0);
        helloPacket.writeUInt16BE(32, 2);
        helloPacket.writeUInt32BE(0x01020304, 8);
        helloPacket.writeUInt32BE(Math.floor(Date.now() / 1000), 12);
        client.connected = null;
        client.packet.setRaw = () => {
            client.packet.serial = Buffer.from('01020304', 'hex');
            client.packet.stamprec = Buffer.alloc(4);
            client.packet.stamprec.writeUInt32BE(Math.floor(Date.now() / 1000));
        };
        let serialAtConnect;
        let timeDifferenceAtConnect;
        client.on('connect', () => {
            serialAtConnect = client.packet.serial.toString('hex');
            timeDifferenceAtConnect = client.packet.timediff;
        });

        client.__sendPing();
        socket.emit('message', helloPacket, { port: 54321 });

        assert.equal(serialAtConnect, '01020304');
        assert.equal(timeDifferenceAtConnect, 0);
        client.close();
    });

    it('closes a failed UDP socket without terminating the process', () => {
        const exit = sinon.stub(process, 'exit');
        try {
            const { client, socket, connectionStates } = createClient();

            socket.emit('error', new Error('synthetic UDP failure'));

            assert.equal(exit.called, false);
            assert.equal(client.connected, false);
            assert.deepEqual(connectionStates, [false]);
            assert.equal(socket.closeCalls, 1);
        } finally {
            exit.restore();
        }
    });

    it('closes the UDP socket once and invokes every close callback once', () => {
        const { client, socket } = createClient();
        let firstCallbackCalls = 0;
        let secondCallbackCalls = 0;

        client.close(() => firstCallbackCalls++);
        client.close(() => secondCallbackCalls++);

        assert.equal(firstCallbackCalls, 1);
        assert.equal(secondCallbackCalls, 1);
        assert.equal(socket.closeCalls, 1);
    });
});

describe('Miio packet encoding', () => {
    it('preserves the encrypted byte contract and decrypts the packet payload', () => {
        const socket = new FakeSocket();
        const Miio = proxyquire('../build/lib/miio', { 'node:dgram': { createSocket: () => socket } });
        const client = new Miio(withManagedTimers({
            config: {
                ownPort: 53421,
                port: 54321,
                ip: 'test-host',
                token: '00000000000000000000000000000000',
            },
            log: { debug() {}, info() {}, warn() {}, error() {} },
            setConnection() {},
        }));
        const clock = sinon.useFakeTimers({ now: 1700000000000 });
        const plain = JSON.stringify({ id: 7, method: 'get_status', params: [] });

        try {
            const raw = client.packet.getRaw_fast(plain);
            assert.equal(
                raw.toString('hex'),
                '21310050ffffffffffffffff6553f100b65806b7ade2816ff5af438ba716224e91d54e6ed3d1920ae6f9e793ba9c463de223d43fd5773dcc870f7f19d95d95b44da109f937fa64eb46b20e41b55990d8',
            );

            client.packet.setRaw(raw);
            assert.equal(client.packet.getPlainData(), plain);
        } finally {
            clock.restore();
            client.close();
        }
    });
});

describe('Miio request lifecycle', () => {
    let clock;

    beforeEach(() => {
        clock = sinon.useFakeTimers({ now: 1000 });
    });

    afterEach(() => {
        clock.restore();
    });

    it('clears timeout and listener when an answer arrives before timeout', async () => {
        const fixture = createClient();
        const response = fixture.client.sendMessage('get_status', ['PRIVATE_PAYLOAD_MARKER']);

        await clock.tickAsync(100);
        fixture.answer(1);
        assert.deepEqual(await response, { id: 1, result: ['ok'] });
        await clock.tickAsync(3000);

        assert.equal(fixture.socket.listenerCount('message'), 1);
        assert.equal(fixture.logs.debug.some(message => message.includes('timed out')), false);
        assert.equal(fixture.logs.debug.some(message => message.includes('PRIVATE_PAYLOAD_MARKER')), false);
    });

    it('accepts an answer directly before timeout', async () => {
        const fixture = createClient();
        const response = fixture.client.sendMessage('get_status');

        await clock.tickAsync(1999);
        fixture.answer(1);

        assert.deepEqual(await response, { id: 1, result: ['ok'] });
        assert.equal(fixture.logs.debug.some(message => message.includes('timed out')), false);
    });

    it('rejects a request while the device is disconnected', async () => {
        const fixture = createClient();
        fixture.client.connected = false;

        await assert.rejects(fixture.client.sendMessage('get_status'), { code: 'MIIO_NOT_CONNECTED' });
        assert.equal(fixture.socket.sentPackets.length, 0);
    });

    it('rejects a UDP send failure with a stable error code', async () => {
        const fixture = createClient();
        fixture.socket.sendError = new Error('synthetic send failure');

        await assert.rejects(fixture.client.sendMessage('get_status'), { code: 'MIIO_SEND_FAILED' });
        assert.equal(fixture.socket.listenerCount('message'), 1);
    });

    it('rejects an invalid response without exposing its contents', async () => {
        const fixture = createClient();
        fixture.client.packet.getPlainData = () => 'PRIVATE_INVALID_RESPONSE';
        const response = fixture.client.sendMessage('get_status');

        fixture.socket.emit('message', Buffer.alloc(33), { port: 54321 });

        await assert.rejects(response, error => {
            assert.ok(error instanceof Error);
            assert.ok('code' in error);
            assert.equal(error.code, 'MIIO_INVALID_RESPONSE');
            assert.doesNotMatch(error.message, /PRIVATE_INVALID_RESPONSE/);
            return true;
        });
    });

    it('settles every pending request when a response has no request ID', async () => {
        const fixture = createClient();
        fixture.client.packet.getPlainData = () => 'null';
        const firstRejection = assert.rejects(fixture.client.sendMessage('get_status'), {
            code: 'MIIO_INVALID_RESPONSE',
        });
        const secondRejection = assert.rejects(fixture.client.sendMessage('get_sound_volume'), {
            code: 'MIIO_INVALID_RESPONSE',
        });

        fixture.socket.emit('message', Buffer.alloc(33), { port: 54321 });

        await Promise.all([firstRejection, secondRejection]);
        assert.equal(fixture.client.pendingRequests.size, 0);
        assert.equal(fixture.socket.listenerCount('message'), 1);
    });

    it('times out once with safe request context', async () => {
        const fixture = createClient();
        const response = fixture.client.sendMessage('get_status');
        const rejection = assert.rejects(response, { code: 'MIIO_TIMEOUT' });

        await clock.tickAsync(2000);

        await rejection;
        assert.equal(
            fixture.logs.debug.includes(
                'MIIO request timed out: method=get_status, id=1, duration=2000ms, timeout=2000ms',
            ),
            true,
        );
        assert.equal(fixture.socket.listenerCount('message'), 1);
    });

    it('moves the next request ID beyond a retained device replay window', async () => {
        const fixture = createClient();
        const firstResponse = fixture.client.sendMessage('get_status');
        const firstRejection = assert.rejects(firstResponse, { code: 'MIIO_TIMEOUT' });

        await clock.tickAsync(2000);
        await firstRejection;
        const secondResponse = fixture.client.sendMessage('get_status');

        fixture.answer(102);

        assert.deepEqual(await secondResponse, { id: 102, result: ['ok'] });
    });

    it('ignores a late answer after timeout', async () => {
        const fixture = createClient();
        const response = fixture.client.sendMessage('get_status');
        const rejection = assert.rejects(response, { code: 'MIIO_TIMEOUT' });

        await clock.tickAsync(2000);
        await rejection;
        fixture.answer(1, ['late']);

        assert.equal(fixture.socket.listenerCount('message'), 1);
        assert.deepEqual(fixture.connectionStates, []);
    });

    it('keeps parallel requests separate by message ID', async () => {
        const fixture = createClient();
        const first = fixture.client.sendMessage('get_status');
        const second = fixture.client.sendMessage('get_sound_volume');
        assert.equal(fixture.socket.listenerCount('message'), 1);
        let firstSettled = false;
        first.then(() => (firstSettled = true));

        fixture.answer(2, ['second']);
        assert.deepEqual(await second, { id: 2, result: ['second'] });
        await Promise.resolve();
        assert.equal(firstSettled, false);

        fixture.answer(1, ['first']);
        assert.deepEqual(await first, { id: 1, result: ['first'] });
        assert.equal(fixture.socket.listenerCount('message'), 1);
    });

    it('settles and removes the listener on shutdown during a request', async () => {
        const fixture = createClient();
        fixture.socket.deferSendCallback = true;
        const response = fixture.client.sendMessage('get_status');
        const rejection = assert.rejects(response, { code: 'MIIO_SOCKET_CLOSED' });

        fixture.client.close();
        const sendCallback = fixture.socket.pendingSendCallbacks.shift();
        assert.equal(typeof sendCallback, 'function');
        sendCallback();
        await clock.tickAsync(3000);

        await rejection;
        assert.equal(fixture.socket.listenerCount('message'), 1);
        assert.equal(fixture.logs.debug.some(message => message.includes('timed out')), false);
    });

    it('does not start or log another request after shutdown', async () => {
        const fixture = createClient();

        fixture.client.close();
        const sentPackets = fixture.socket.sentPackets.length;
        const debugMessages = fixture.logs.debug.length;
        const errorMessages = fixture.logs.error.length;

        await assert.rejects(fixture.client.sendMessage('get_status'), { code: 'MIIO_CLOSED' });
        assert.equal(fixture.socket.sentPackets.length, sentPackets);
        assert.equal(fixture.logs.debug.length, debugMessages);
        assert.equal(fixture.logs.error.length, errorMessages);
    });

    it('ignores an answer with the wrong message ID until timeout', async () => {
        const fixture = createClient();
        const response = fixture.client.sendMessage('get_status');
        let settled = false;
        const rejection = assert.rejects(response, { code: 'MIIO_TIMEOUT' });
        response.then(
            () => (settled = true),
            () => (settled = true),
        );

        fixture.answer(99);
        await Promise.resolve();
        assert.equal(settled, false);
        await clock.tickAsync(2000);

        await rejection;
    });

    it('settles and removes the listener on socket error', async () => {
        const fixture = createClient();
        const response = fixture.client.sendMessage('get_status');
        const rejection = assert.rejects(response, { code: 'MIIO_SOCKET_CLOSED' });

        fixture.socket.emit('error', new Error('synthetic UDP failure'));

        await rejection;
        assert.equal(fixture.socket.listenerCount('message'), 1);
        assert.equal(fixture.socket.closeCalls, 1);
    });
});

describe('Miio TypeScript runtime protocol', () => {
    it('builds every supported request JSON shape', () => {
        const runtime = createPacketClient();
        const cases = [
            ['get_status', undefined, '{"id":7,"method":"get_status"}'],
            ['app_segment_clean', [16, 17], '{"id":7,"method":"app_segment_clean","params":[16,17]}'],
            ['app_zoned_clean', ['[[1,2,3,4]]'], '{"id":7,"method":"app_zoned_clean","params":[[[1,2,3,4]]]}'],
            ['set_custom_mode', '', '{"id":7,"method":"set_custom_mode"}'],
            ['', ['ignored'], '{}'],
        ];

        try {
            for (const [method, params, expected] of cases) {
                assert.equal(runtime.client._buildMsg(method, params, 7), expected);
            }
            assert.equal(runtime.client.adapter.log.warn !== undefined, true);
        } finally {
            runtime.client.close();
        }
    });

    it('recovers from timeout with the next successful request ID', async () => {
        const clock = sinon.useFakeTimers({ now: 1000 });
        const runtime = createClient();

        try {
            const first = assert.rejects(runtime.client.sendMessage('get_status'), { code: 'MIIO_TIMEOUT' });
            await clock.tickAsync(2000);
            await first;

            const second = runtime.client.sendMessage('get_status');
            runtime.answer(102);

            assert.deepEqual(await second, { id: 102, result: ['ok'] });
            assert.equal(runtime.client.pendingRequests.size, 0);
            assert.deepEqual(runtime.connectionStates, [true]);
            assert.equal(runtime.logs.debug.some(message => message.includes('id=1')), true);
        } finally {
            runtime.client.close();
            clock.restore();
        }
    });

    it('supports string-valued port configuration', async () => {
        const runtime = createClient('../build/lib/miio', '54321');

        try {
            const response = runtime.client.sendMessage('get_status');
            runtime.answer(1);

            assert.deepEqual(await response, { id: 1, result: ['ok'] });
            assert.deepEqual(runtime.connectionStates, [true]);
        } finally {
            runtime.client.close();
        }
    });
});

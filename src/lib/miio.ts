import * as crypto from 'node:crypto';
import * as dgram from 'node:dgram';
import EventEmitter from 'node:events';
import type { MiioResponse, MiioTransportErrorCode } from '../types/miio';
import type { AdapterTimeout } from '../types/adapter';

interface MiioAdapter {
    config: {
        ownPort?: number | string;
        port?: number | string;
        ip: string;
        token: string;
    };
    log: {
        debug(message: unknown): void;
        info(message: unknown): void;
        warn(message: unknown): void;
        error(message: unknown): void;
    };

    setConnection(connected: boolean): void;
    setTimeout: (
        callback: (...args: unknown[]) => void,
        delay: number,
        ...args: unknown[]
    ) => AdapterTimeout | undefined;
    clearTimeout: (timeout: AdapterTimeout | undefined) => void;
}

interface PendingRequest {
    resolve(value: MiioResponse): void;

    reject(reason: Error): void;

    method: string;
    startedAt: number;
}

type RequestError = Error & { code: MiioTransportErrorCode };

const pingMessage = stringToHex('21310020ffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

class Miio extends EventEmitter {
    readonly adapter: MiioAdapter;
    readonly ownPort: number | string;
    readonly port: number | string;
    readonly ip: string;
    readonly token: Buffer;
    connected: boolean | null = null;
    closing = false;
    closeStarted = false;
    closeComplete = false;
    closeCallbacks: Array<() => void> = [];
    pingTimeout = 10_000;
    packet: Packet;
    timeout: AdapterTimeout | undefined;
    pendingRequests = new Map<number, PendingRequest>();
    globalTimeouts: Record<string, AdapterTimeout | undefined> = {};
    server: dgram.Socket;

    constructor(adapterInstance: MiioAdapter) {
        super();
        this.adapter = adapterInstance;
        this.ownPort = this.adapter.config.ownPort || 53_421;
        this.port = this.adapter.config.port || 54_321;
        this.ip = this.adapter.config.ip;
        this.token = stringToHex(this.adapter.config.token);
        this.adapter.log.debug('MIIO: Configured local UDP connection');
        this.packet = new Packet(this.token);
        this.server = dgram.createSocket('udp4');

        try {
            this.server.bind(this.ownPort as number);
        } catch (error) {
            this.adapter.log.error(`Cannot open UDP port, please make sure port is not in use: ${String(error)}`);
            return;
        }

        this.server.on('listening', () => {
            const address = this.server.address();
            this.adapter.log.debug(`server started on ${address.address}:${address.port}`);
            this.__sendPing();
        });
        this.server.on('message', (message, remoteInfo) => this._handleMessage(message, remoteInfo));
        this.server.on('error', error => {
            this.adapter.log.error(`UDP error: ${String(error)}`);
            this.connected = false;
            this.closing = true;
            this.adapter.setConnection(false);
            try {
                this.server.close();
            } catch (closeError) {
                this.adapter.log.debug(closeError);
            }
        });
        this.server.on('close', () => {
            if (this.closing) {
                this.adapter.log.debug('UDP socket closed');
            } else {
                this.adapter.log.warn('UDP socket closed unexpectedly');
            }
            this._failAllPending('MIIO_SOCKET_CLOSED', 'MIIO socket closed during request');
            Object.keys(this.globalTimeouts).forEach(id => {
                const timeout = this.globalTimeouts[id];
                if (timeout) {
                    this.adapter.clearTimeout(timeout);
                }
            });
            this.globalTimeouts = {};
        });
    }

    close(callback?: () => void): void {
        if (typeof callback === 'function') {
            if (this.closeComplete) {
                callback();
                return;
            }
            this.closeCallbacks.push(callback);
        }
        if (this.closeStarted) {
            return;
        }
        this.closeStarted = true;
        this.closing = true;
        this.connected = false;
        this._failAllPending('MIIO_SOCKET_CLOSED', 'MIIO socket closed during request');
        Object.keys(this.globalTimeouts).forEach(id => {
            const timeout = this.globalTimeouts[id];
            if (timeout) {
                this.adapter.clearTimeout(timeout);
            }
        });
        this.globalTimeouts = {};

        const finishClose = (): void => {
            if (this.closeComplete) {
                return;
            }
            this.closeComplete = true;
            const callbacks = this.closeCallbacks.splice(0);
            callbacks.forEach(closeCallback => closeCallback());
        };

        const nextPing = this.globalTimeouts.nextPing;
        const pingTimeout = this.globalTimeouts.pingTimeout;
        if (nextPing) {
            this.adapter.clearTimeout(nextPing);
        }
        if (pingTimeout) {
            this.adapter.clearTimeout(pingTimeout);
        }
        try {
            this.server.close(finishClose);
        } catch (error) {
            this.adapter.log.debug(error);
            finishClose();
        }
    }

    _createRequestError(code: MiioTransportErrorCode, message: string): RequestError {
        return Object.assign(new Error(message), { code });
    }

    _finishRequest(
        messageCounter: number,
        settle: (request: PendingRequest, result: MiioResponse | RequestError) => void,
        result: MiioResponse | RequestError,
    ): void {
        const request = this.pendingRequests.get(messageCounter);
        if (!request) {
            return;
        }
        const timeoutId = `sendMessage${messageCounter}`;
        this.adapter.clearTimeout(this.globalTimeouts[timeoutId]);
        delete this.globalTimeouts[timeoutId];
        this.pendingRequests.delete(messageCounter);
        settle(request, result);
    }

    _failRequest(messageCounter: number, code: MiioTransportErrorCode, message: string): void {
        this._finishRequest(
            messageCounter,
            (request, error) => request.reject(error as RequestError),
            this._createRequestError(code, message),
        );
    }

    _failAllPending(code: MiioTransportErrorCode, message: string): void {
        for (const messageCounter of [...this.pendingRequests.keys()]) {
            this._failRequest(messageCounter, code, message);
        }
    }

    _handleMessage(message: Buffer, remoteInfo: dgram.RemoteInfo): void {
        if (message.length === 32 || remoteInfo.port !== Number.parseInt(String(this.port), 10)) {
            return;
        }

        let answer: unknown;
        try {
            this.packet.setRaw(message);
            answer = JSON.parse(this.packet.getPlainData());
        } catch {
            this.adapter.log.debug(`MIIO response could not be parsed: pending=${this.pendingRequests.size}`);
            this._failAllPending('MIIO_INVALID_RESPONSE', 'MIIO response could not be parsed');
            return;
        }
        if (!answer || typeof answer !== 'object' || !('id' in answer)) {
            this.adapter.log.debug(`MIIO response has no request ID: pending=${this.pendingRequests.size}`);
            this._failAllPending('MIIO_INVALID_RESPONSE', 'MIIO response has no request ID');
            return;
        }

        const response = answer as MiioResponse;
        const request = this.pendingRequests.get(response.id);
        if (!request) {
            return;
        }
        this.adapter.setConnection(true);
        this.adapter.log.debug(
            `MIIO request succeeded: method=${request.method}, id=${response.id}, duration=${Date.now() - request.startedAt}ms`,
        );
        this._finishRequest(
            response.id,
            (pendingRequest, result) => pendingRequest.resolve(result as MiioResponse),
            response,
        );
    }

    __sendPing(): void {
        const checkAnswer = (message: Buffer, remoteInfo: dgram.RemoteInfo): void => {
            if (message.length === 32 && remoteInfo.port === Number.parseInt(String(this.port), 10)) {
                this.adapter.clearTimeout(this.globalTimeouts.pingTimeout);
                this.adapter.clearTimeout(this.globalTimeouts.nextPing);
                this.adapter.log.debug('MIIO hello received');
                this.server.removeListener('message', checkAnswer);

                this.packet.setRaw(message);
                const now = Math.floor(Date.now() / 1000);
                const messageTime = Number.parseInt(this.packet.stamprec.toString('hex'), 16);
                this.packet.timediff = messageTime - now === -1 ? 0 : messageTime - now;

                if (!this.connected) {
                    const firstConnection = this.connected === null;
                    this.connected = true;
                    if (firstConnection) {
                        this.emit('connect');
                    }
                }
                if (this.packet.timediff !== 0) {
                    this.adapter.log.debug(
                        `Time difference between Mihome Vacuum and ioBroker: ${this.packet.timediff} sec`,
                    );
                }
                this.globalTimeouts.nextPing = this.adapter.setTimeout(() => {
                    this.globalTimeouts.nextPing = undefined;
                    this.__sendPing();
                }, this.pingTimeout);
            }
        };

        this.server.on('message', checkAnswer);
        try {
            this.server.send(
                pingMessage,
                0,
                pingMessage.length,
                Number.parseInt(String(this.port), 10),
                this.ip,
                error => {
                    if (error) {
                        this.adapter.log.warn(`Helo message: ${String(error)}`);
                        this.server.removeListener('message', checkAnswer);
                        this.globalTimeouts.nextPing = this.adapter.setTimeout(() => {
                            this.globalTimeouts.nextPing = undefined;
                            this.__sendPing();
                        }, this.pingTimeout);
                    } else {
                        this.globalTimeouts.pingTimeout = this.adapter.setTimeout(() => {
                            this.globalTimeouts.pingTimeout = undefined;
                            this.adapter.log.debug('Helo message Timeout');
                            this.connected = false;
                            this.server.removeListener('message', checkAnswer);
                            this.globalTimeouts.nextPing = this.adapter.setTimeout(() => {
                                this.globalTimeouts.nextPing = undefined;
                                this.__sendPing();
                            }, this.pingTimeout);
                        }, 2000);
                    }
                },
            );
        } finally {
            // Keep the legacy synchronous socket error boundary.
        }
    }

    async sendMessage(method: unknown, params?: unknown): Promise<MiioResponse> {
        const safeMethod = String(method)
            .replace(/[^a-zA-Z0-9_.-]/g, '?')
            .slice(0, 80);
        return new Promise((resolve, reject) => {
            if (this.closing) {
                reject(this._createRequestError('MIIO_CLOSED', 'MIIO client is closed'));
                return;
            }
            if (!this.connected) {
                this.adapter.log.debug('your device is not connected, but this could be temporary');
                reject(this._createRequestError('MIIO_NOT_CONNECTED', 'MIIO device is not connected'));
                return;
            }
            if (this.packet.msgCounter > 10_000) {
                this.packet.msgCounter = 1;
            }
            const messageCounter = this.packet.msgCounter++;
            const startedAt = Date.now();

            let rawMessage: Buffer;
            try {
                rawMessage = this.packet.getRaw_fast(this._buildMsg(method, params, messageCounter));
            } catch {
                this.adapter.log.error(`MIIO request failed: method=${safeMethod}`);
                reject(this._createRequestError('MIIO_REQUEST_FAILED', 'MIIO request failed'));
                return;
            }
            this.pendingRequests.set(messageCounter, {
                resolve,
                reject,
                method: safeMethod,
                startedAt,
            });
            this.adapter.log.debug(`MIIO request started: method=${safeMethod}, id=${messageCounter}, duration=0ms`);

            try {
                this.server.send(
                    rawMessage,
                    0,
                    rawMessage.length,
                    Number.parseInt(String(this.port), 10),
                    this.adapter.config.ip,
                    error => {
                        if (!this.pendingRequests.has(messageCounter)) {
                            return;
                        }
                        if (error) {
                            this.adapter.log.debug(
                                `MIIO request send failed: method=${safeMethod}, id=${messageCounter}, duration=${Date.now() - startedAt}ms`,
                            );
                            this._failRequest(messageCounter, 'MIIO_SEND_FAILED', 'MIIO request could not be sent');
                            return;
                        }
                        this.globalTimeouts[`sendMessage${messageCounter}`] = this.adapter.setTimeout(
                            counter => {
                                this.adapter.log.debug(
                                    `MIIO request timed out: method=${safeMethod}, id=${String(counter)}, duration=${Date.now() - startedAt}ms, timeout=2000ms`,
                                );
                                this.packet.msgCounter += 100;
                                this._failRequest(messageCounter, 'MIIO_TIMEOUT', 'MIIO request timed out');
                            },
                            2000,
                            messageCounter,
                        );
                    },
                );
            } catch {
                this.adapter.log.error(`MIIO request failed: method=${safeMethod}`);
                this._failRequest(messageCounter, 'MIIO_REQUEST_FAILED', 'MIIO request failed');
            }
        });
    }

    _buildMsg(method: unknown, params: unknown, messageCounter: number): string {
        const message: { id?: number; method?: unknown; params?: unknown } = {};
        if (method) {
            message.id = messageCounter;
            message.method = method;
            if (!(
                params === '' ||
                params === undefined ||
                params === null ||
                (params instanceof Array && params.length === 1 && params[0] === '')
            )) {
                message.params = params;
            }
        } else {
            this.adapter.log.warn('Could not build message without arguments');
        }
        return JSON.stringify(message)
            .replace('["[', '[[')
            .replace(']"]', ']]')
            .replace(/\]","\[/g, '],[');
    }
}

class Packet {
    magic: Buffer = Buffer.alloc(2);
    len: Buffer = Buffer.alloc(2);
    unknown: Buffer = Buffer.alloc(4);
    serial: Buffer = Buffer.alloc(4);
    stamp: Buffer = Buffer.alloc(4);
    checksum: Buffer = Buffer.alloc(16);
    data: Buffer = Buffer.alloc(0);
    token: Buffer = Buffer.alloc(16);
    key: Buffer = Buffer.alloc(16);
    iv: Buffer = Buffer.alloc(16);
    ioskey: Buffer = Buffer.from('00000000000000000000000000000000', 'hex');
    msgCounter = 1;
    stamprec: Buffer = Buffer.alloc(4);
    timediff = 0;

    constructor(token?: Buffer) {
        this.setHelo();
        if (token) {
            this.setToken(token);
        }
    }

    setHelo(): void {
        this.magic = Buffer.from('2131', 'hex');
        this.len = Buffer.from('0020', 'hex');
        this.unknown = Buffer.from('FFFFFFFF', 'hex');
        this.serial = Buffer.from('FFFFFFFF', 'hex');
        this.stamp = Buffer.from('FFFFFFFF', 'hex');
        this.checksum = Buffer.from('FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF', 'hex');
        this.data = Buffer.alloc(0);
    }

    setIosToken(iosToken: Buffer): Buffer {
        const tokenHex = iosToken.toString('hex');
        const encrypted = Buffer.from(tokenHex.substring(0, 64), 'hex');
        const decipher = crypto.createDecipheriv('aes-128-ecb', this.ioskey, '');
        decipher.setAutoPadding(false);
        return stringToHex(decipher.update(encrypted).toString('ascii'));
    }

    getRaw_fast(plainData: string): Buffer {
        const cipher = crypto.createCipheriv('aes-128-cbc', this.key, this.iv);
        this.data = Buffer.concat([cipher.update(plainData, 'utf8'), cipher.final()]);
        const stamp = `00000000${(Math.floor(Date.now() / 1000) + this.timediff).toString(16)}`;
        this.stamp = Buffer.from(stamp.substring(stamp.length - 8), 'hex');

        if (this.data.length > 0) {
            this.len = Buffer.from(decimalToHex(this.data.length + 32, 4), 'hex');
            const rawWithoutChecksum = Buffer.from(
                this.magic.toString('hex') +
                    this.len.toString('hex') +
                    this.unknown.toString('hex') +
                    this.serial.toString('hex') +
                    this.stamp.toString('hex') +
                    this.token.toString('hex') +
                    this.data.toString('hex'),
                'hex',
            );
            this.checksum = md5(rawWithoutChecksum);
        }
        return Buffer.from(
            this.magic.toString('hex') +
                this.len.toString('hex') +
                this.unknown.toString('hex') +
                this.serial.toString('hex') +
                this.stamp.toString('hex') +
                this.checksum.toString('hex') +
                this.data.toString('hex'),
            'hex',
        );
    }

    setRaw(raw: Buffer): void {
        const rawHex = raw.toString('hex');
        this.magic = Buffer.from(rawHex.substring(0, 4), 'hex');
        this.len = Buffer.from(rawHex.substring(4, 8), 'hex');
        this.unknown = Buffer.from(rawHex.substring(8, 16), 'hex');
        this.serial = Buffer.from(rawHex.substring(16, 24), 'hex');
        this.stamprec = Buffer.from(rawHex.substring(24, 32), 'hex');
        this.checksum = Buffer.from(rawHex.substring(32, 64), 'hex');
        this.data = Buffer.from(rawHex.substring(64), 'hex');
    }

    getPlainData(): string {
        const decipher = crypto.createDecipheriv('aes-128-cbc', this.key, this.iv);
        let decrypted = Buffer.concat([decipher.update(this.data), decipher.final()]).toString('utf8');
        decrypted = decrypted.substring(0, decrypted.length - 1);
        if (!decrypted.endsWith('}')) {
            decrypted += '}';
        }
        return decrypted;
    }

    setToken(token: Buffer): void {
        this.token = token.length === 48 ? this.setIosToken(token) : token;
        this.key = md5(this.token);
        this.iv = md5(Buffer.from(this.key.toString('hex') + this.token.toString('hex'), 'hex'));
    }
}

function md5(data: crypto.BinaryLike): Buffer {
    return Buffer.from(crypto.createHash('md5').update(data).digest('hex'), 'hex');
}

function decimalToHex(decimal: number, characters: number): string {
    return (decimal + Math.pow(16, characters)).toString(16).slice(-characters).toUpperCase();
}

function stringToHex(value: string): Buffer {
    const compactValue = value.replace(/\s/g, '');
    const buffer = Buffer.alloc(compactValue.length / 2);
    for (let index = 0; index < compactValue.length / 2; index++) {
        buffer[index] = Number.parseInt(compactValue[index * 2] + compactValue[index * 2 + 1], 16);
    }
    return buffer;
}

export = Miio;

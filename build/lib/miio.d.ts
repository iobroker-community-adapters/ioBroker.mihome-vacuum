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
    setTimeout: (callback: (...args: unknown[]) => void, delay: number, ...args: unknown[]) => AdapterTimeout | undefined;
    clearTimeout: (timeout: AdapterTimeout | undefined) => void;
}
interface PendingRequest {
    resolve(value: MiioResponse): void;
    reject(reason: Error): void;
    method: string;
    startedAt: number;
}
type RequestError = Error & {
    code: MiioTransportErrorCode;
};
declare class Miio extends EventEmitter {
    readonly adapter: MiioAdapter;
    readonly ownPort: number | string;
    readonly port: number | string;
    readonly ip: string;
    readonly token: Buffer;
    connected: boolean | null;
    closing: boolean;
    closeStarted: boolean;
    closeComplete: boolean;
    closeCallbacks: Array<() => void>;
    pingTimeout: number;
    packet: Packet;
    timeout: AdapterTimeout | undefined;
    pendingRequests: Map<number, PendingRequest>;
    globalTimeouts: Record<string, AdapterTimeout | undefined>;
    server: dgram.Socket;
    constructor(adapterInstance: MiioAdapter);
    close(callback?: () => void): void;
    _createRequestError(code: MiioTransportErrorCode, message: string): RequestError;
    _finishRequest(messageCounter: number, settle: (request: PendingRequest, result: MiioResponse | RequestError) => void, result: MiioResponse | RequestError): void;
    _failRequest(messageCounter: number, code: MiioTransportErrorCode, message: string): void;
    _failAllPending(code: MiioTransportErrorCode, message: string): void;
    _handleMessage(message: Buffer, remoteInfo: dgram.RemoteInfo): void;
    __sendPing(): void;
    sendMessage(method: unknown, params?: unknown): Promise<MiioResponse>;
    _buildMsg(method: unknown, params: unknown, messageCounter: number): string;
}
declare class Packet {
    magic: Buffer;
    len: Buffer;
    unknown: Buffer;
    serial: Buffer;
    stamp: Buffer;
    checksum: Buffer;
    data: Buffer;
    token: Buffer;
    key: Buffer;
    iv: Buffer;
    ioskey: Buffer;
    msgCounter: number;
    stamprec: Buffer;
    timediff: number;
    constructor(token?: Buffer);
    setHelo(): void;
    setIosToken(iosToken: Buffer): Buffer;
    getRaw_fast(plainData: string): Buffer;
    setRaw(raw: Buffer): void;
    getPlainData(): string;
    setToken(token: Buffer): void;
}
export = Miio;

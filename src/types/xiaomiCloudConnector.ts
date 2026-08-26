import type { XiaomiAuthStatus } from './xiaomiCloud';

export type XiaomiHomeId = string | number;

export interface XiaomiCloudLogger {
    debug(message: string): void;
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
}

export interface XiaomiCloudAdapterObject {
    native?: Record<string, unknown>;
    [key: string]: unknown;
}

export interface XiaomiCloudAdapter {
    config?: {
        cloudSession?: unknown;
        enableAdvancedDebug?: boolean;
    };
    namespace: string;
    encrypt?(value: string): string;
    decrypt?(value: string): string;
    setStateAsync(id: string, value: string | number, ack: boolean): Promise<unknown>;
    getForeignObjectAsync(id: string): Promise<XiaomiCloudAdapterObject | null | undefined>;
    setForeignObjectAsync(id: string, object: XiaomiCloudAdapterObject): Promise<unknown>;
}

export interface XiaomiCloudAuthConfig {
    deviceId?: string;
    cloudSession?: unknown;
}

export interface XiaomiCloudSessionState {
    deviceId: string;
    sessionCookies: string;
    ssecurity: string | null;
    userId: string | null;
    location: string | null;
    serviceToken: string | null;
}

export interface XiaomiHomeResponse {
    result?: {
        homelist?: Array<{ id: XiaomiHomeId }>;
    };
}

export interface XiaomiCloudRequestError {
    code?: unknown;
}

export interface XiaomiCloudAuthInvalidation {
    status?: XiaomiAuthStatus;
    lastError?: string;
}

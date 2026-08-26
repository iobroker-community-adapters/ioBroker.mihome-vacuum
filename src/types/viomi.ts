import type { AdapterTimeout } from './adapter';

export interface ViomiLogger {
    debug(message: string): void;
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
}

export interface ViomiState {
    val: unknown;
    ack?: boolean;
}

export interface ViomiObjectDefinition {
    _id?: string;
    common: {
        type?: string;
    };
    [key: string]: unknown;
}

export interface ViomiObjectsModule {
    viomiObjects: ViomiObjectDefinition[];
}

export interface ViomiAdapter {
    config: {
        pingInterval: number;
    };
    log: ViomiLogger;
    setTimeout: (callback: () => void, delay: number) => AdapterTimeout | undefined;
    clearTimeout: (timeout: AdapterTimeout | undefined) => void;
    setObjectNotExistsAsync(id: string, object: ViomiObjectDefinition): Promise<unknown>;
    setStateAsync(id: string, state: { val: unknown; ack: true }): Promise<unknown>;
}

export interface ViomiMiioResponse {
    result?: unknown;
    [key: string]: unknown;
}

export interface ViomiMiioClient {
    sendMessage(method: string, params: readonly unknown[]): Promise<ViomiMiioResponse | null | undefined>;
}

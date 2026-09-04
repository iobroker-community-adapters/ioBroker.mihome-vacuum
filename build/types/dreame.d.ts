import type { AdapterTimeout } from './adapter';
export interface DreameLogger {
    debug(message: string): void;
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
}
export interface DreameState {
    val: unknown;
    ack?: boolean;
}
export interface DreameObjectDefinition {
    _id: string;
    [key: string]: unknown;
}
export interface DreameObjectsModule {
    stockControl: DreameObjectDefinition[];
    stockInfo: DreameObjectDefinition[];
    settings: DreameObjectDefinition[];
    stockHistory: DreameObjectDefinition[];
    wash_base: DreameObjectDefinition[];
    wash_base_info: DreameObjectDefinition[];
    stockConsumable: {
        channel: DreameObjectDefinition;
        list: Record<string, {
            state: DreameObjectDefinition;
            button: DreameObjectDefinition;
        }>;
    };
}
export interface DreameAdapter {
    namespace: string;
    config: {
        pingInterval: number;
    };
    log: DreameLogger;
    setTimeout: (callback: () => void, delay: number) => AdapterTimeout | undefined;
    clearTimeout: (timeout: AdapterTimeout | undefined) => void;
    setObjectNotExistsAsync(id: string, object: DreameObjectDefinition): Promise<unknown>;
    setStateAsync(id: string, state: {
        val: unknown;
        ack: true;
    }): Promise<unknown>;
    getStateAsync(id: string): Promise<{
        val: unknown;
    } | null | undefined>;
}
export interface DreamePropertyDefinition {
    did: string;
    siid: number;
    piid: number;
    control?: string;
    control_mapping?: Record<string, unknown>;
    type?: 'int' | 'boolean';
}
export interface DreameActionDefinition {
    did: string;
    siid: number;
    aiid: number;
    control?: string;
}
export interface DreamePropertyValue {
    siid: number;
    piid: number;
    value?: unknown;
    code?: number;
    [key: string]: unknown;
}
export interface DreameMiioResponse {
    result?: unknown;
    [key: string]: unknown;
}
export interface DreameMiioClient {
    sendMessage(method: string, params: unknown): Promise<DreameMiioResponse>;
}
export interface DreameProtocolModule {
    DreameWaterVolumes: Record<string, number>;
    DreameErrors: Record<string, number>;
    DreameState: Record<string, number>;
    DreameWashBaseState: Record<string, number>;
    DreameProperties: Record<string, DreamePropertyDefinition>;
    DreameActions: Record<string, DreameActionDefinition>;
    DreameBlockedObjects: string[];
}

export declare const protectedConfigFields: readonly ["password", "token", "cloudSession"];
export type TokenUpdate = {
    action: 'keep';
} | {
    action: 'replace';
    value: string;
} | {
    action: 'delete';
};
export interface ProtectedConfigSaveRequest {
    native: Record<string, unknown>;
    tokenUpdate: TokenUpdate;
}
export interface ProtectedConfigSaveResult {
    native: Record<string, unknown>;
    tokenStored: boolean;
}
export declare class ProtectedConfigError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
export declare function normalizeDeviceToken(value: unknown): string;
export declare function parseProtectedConfigSaveRequest(value: unknown): ProtectedConfigSaveRequest;
export declare function mergeProtectedConfig(existingNative: Record<string, unknown>, request: ProtectedConfigSaveRequest, encrypt: (value: string) => string): ProtectedConfigSaveResult;

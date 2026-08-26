export const protectedConfigFields = ['password', 'token', 'cloudSession'] as const;

export type TokenUpdate = { action: 'keep' } | { action: 'replace'; value: string } | { action: 'delete' };

export interface ProtectedConfigSaveRequest {
    native: Record<string, unknown>;
    tokenUpdate: TokenUpdate;
}

export interface ProtectedConfigSaveResult {
    native: Record<string, unknown>;
    tokenStored: boolean;
}

const ignoredNativeFields = new Set<string>([
    ...protectedConfigFields,
    'devices',
    'MiDevice',
    '__proto__',
    'constructor',
    'prototype',
]);

const tokenPattern = /^(?:[a-f\d]{31}|[a-f\d]{32}|[a-f\d]{96})$/i;

export class ProtectedConfigError extends Error {
    readonly code: string;

    constructor(code: string, message: string) {
        super(message);
        this.name = 'ProtectedConfigError';
        this.code = code;
    }
}

export function normalizeDeviceToken(value: unknown): string {
    const token = typeof value === 'string' ? value.replace(/\s/g, '') : '';
    if (!tokenPattern.test(token) || /^\*+$/.test(token)) {
        throw new ProtectedConfigError('INVALID_TOKEN', 'Token must contain 31, 32, or 96 hexadecimal characters');
    }
    return token;
}

export function parseProtectedConfigSaveRequest(value: unknown): ProtectedConfigSaveRequest {
    if (!value || typeof value !== 'object') {
        throw new ProtectedConfigError('INVALID_REQUEST', 'Invalid protected configuration request');
    }
    const request = value as Record<string, unknown>;
    if (!request.native || typeof request.native !== 'object' || Array.isArray(request.native)) {
        throw new ProtectedConfigError('INVALID_REQUEST', 'Invalid protected configuration request');
    }
    if (!request.tokenUpdate || typeof request.tokenUpdate !== 'object') {
        throw new ProtectedConfigError('INVALID_REQUEST', 'Invalid protected configuration request');
    }
    const update = request.tokenUpdate as Record<string, unknown>;
    if (update.action === 'keep' || update.action === 'delete') {
        return { native: request.native as Record<string, unknown>, tokenUpdate: { action: update.action } };
    }
    if (update.action === 'replace') {
        return {
            native: request.native as Record<string, unknown>,
            tokenUpdate: { action: 'replace', value: normalizeDeviceToken(update.value) },
        };
    }
    throw new ProtectedConfigError('INVALID_REQUEST', 'Invalid protected configuration request');
}

export function mergeProtectedConfig(
    existingNative: Record<string, unknown>,
    request: ProtectedConfigSaveRequest,
    encrypt: (value: string) => string,
): ProtectedConfigSaveResult {
    const native = { ...existingNative };
    for (const [key, value] of Object.entries(request.native)) {
        if (ignoredNativeFields.has(key)) {
            continue;
        }
        if (value === undefined) {
            delete native[key];
        } else {
            native[key] = value;
        }
    }

    let tokenStored = typeof existingNative.token === 'string' && existingNative.token.length > 0;
    if (request.tokenUpdate.action === 'replace') {
        native.token = encrypt(normalizeDeviceToken(request.tokenUpdate.value));
        tokenStored = true;
    } else if (request.tokenUpdate.action === 'delete') {
        native.token = encrypt('');
        tokenStored = false;
    }

    return { native, tokenStored };
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProtectedConfigError = exports.protectedConfigFields = void 0;
exports.normalizeDeviceToken = normalizeDeviceToken;
exports.parseProtectedConfigSaveRequest = parseProtectedConfigSaveRequest;
exports.mergeProtectedConfig = mergeProtectedConfig;
exports.protectedConfigFields = ['password', 'token', 'cloudSession'];
const ignoredNativeFields = new Set([
    ...exports.protectedConfigFields,
    'devices',
    'MiDevice',
    '__proto__',
    'constructor',
    'prototype',
]);
const tokenPattern = /^(?:[a-f\d]{31}|[a-f\d]{32}|[a-f\d]{96})$/i;
class ProtectedConfigError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.name = 'ProtectedConfigError';
        this.code = code;
    }
}
exports.ProtectedConfigError = ProtectedConfigError;
function normalizeDeviceToken(value) {
    const token = typeof value === 'string' ? value.replace(/\s/g, '') : '';
    if (!tokenPattern.test(token) || /^\*+$/.test(token)) {
        throw new ProtectedConfigError('INVALID_TOKEN', 'Token must contain 31, 32, or 96 hexadecimal characters');
    }
    return token;
}
function parseProtectedConfigSaveRequest(value) {
    if (!value || typeof value !== 'object') {
        throw new ProtectedConfigError('INVALID_REQUEST', 'Invalid protected configuration request');
    }
    const request = value;
    if (!request.native || typeof request.native !== 'object' || Array.isArray(request.native)) {
        throw new ProtectedConfigError('INVALID_REQUEST', 'Invalid protected configuration request');
    }
    if (!request.tokenUpdate || typeof request.tokenUpdate !== 'object') {
        throw new ProtectedConfigError('INVALID_REQUEST', 'Invalid protected configuration request');
    }
    const update = request.tokenUpdate;
    if (update.action === 'keep' || update.action === 'delete') {
        return { native: request.native, tokenUpdate: { action: update.action } };
    }
    if (update.action === 'replace') {
        return {
            native: request.native,
            tokenUpdate: { action: 'replace', value: normalizeDeviceToken(update.value) },
        };
    }
    throw new ProtectedConfigError('INVALID_REQUEST', 'Invalid protected configuration request');
}
function mergeProtectedConfig(existingNative, request, encrypt) {
    const native = { ...existingNative };
    for (const [key, value] of Object.entries(request.native)) {
        if (ignoredNativeFields.has(key)) {
            continue;
        }
        if (value === undefined) {
            delete native[key];
        }
        else {
            native[key] = value;
        }
    }
    let tokenStored = typeof existingNative.token === 'string' && existingNative.token.length > 0;
    if (request.tokenUpdate.action === 'replace') {
        native.token = encrypt(normalizeDeviceToken(request.tokenUpdate.value));
        tokenStored = true;
    }
    else if (request.tokenUpdate.action === 'delete') {
        native.token = encrypt('');
        tokenStored = false;
    }
    return { native, tokenStored };
}
//# sourceMappingURL=protectedConfig.js.map
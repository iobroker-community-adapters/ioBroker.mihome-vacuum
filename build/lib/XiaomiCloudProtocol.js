"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergeSessionCookies = mergeSessionCookies;
exports.buildCookieHeader = buildCookieHeader;
exports.getSessionCookie = getSessionCookie;
exports.parseXiaomiJSON = parseXiaomiJSON;
exports.safeXiaomiError = safeXiaomiError;
function mergeSessionCookies(currentCookies, setCookie) {
    if (!Array.isArray(setCookie)) {
        return currentCookies;
    }
    const cookies = new Map();
    for (const value of currentCookies.split(';')) {
        const [name, cookieValue] = value.trim().split(/=(.*)/s);
        if (name && cookieValue !== undefined) {
            cookies.set(name, cookieValue);
        }
    }
    for (const header of setCookie) {
        const [name, value] = String(header).split(';')[0].split(/=(.*)/s);
        if (name && value !== undefined) {
            cookies.set(name.trim(), value.trim());
        }
    }
    return [...cookies].map(([name, value]) => `${name}=${value}`).join('; ');
}
function buildCookieHeader(commonCookies, sessionCookies) {
    return [commonCookies, 'pass_ua=web', 'uLocale=en_GB', sessionCookies].filter(Boolean).join('; ');
}
function getSessionCookie(sessionCookies, name) {
    return sessionCookies
        .split(';')
        .map(cookie => cookie.trim())
        .find(cookie => cookie.startsWith(`${name}=`))
        ?.slice(name.length + 1);
}
function parseXiaomiJSON(raw) {
    try {
        return typeof raw === 'string' ? JSON.parse(raw.replace('&&&START&&&', '')) : raw;
    }
    catch {
        return null;
    }
}
function safeXiaomiError(error) {
    const errorObject = error !== null && typeof error === 'object' ? error : null;
    const response = errorObject?.response !== null && typeof errorObject?.response === 'object'
        ? errorObject.response
        : null;
    if (response?.status) {
        return `Xiaomi request failed (HTTP ${response.status})`;
    }
    if (errorObject?.code === 'ECONNABORTED') {
        return 'Xiaomi request timed out';
    }
    const message = error instanceof Error ? error.message : 'Xiaomi request failed';
    return String(message).replace(/https?:\/\/\S+/g, '[redacted URL]');
}
//# sourceMappingURL=XiaomiCloudProtocol.js.map
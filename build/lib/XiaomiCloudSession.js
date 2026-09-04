"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidCloudSession = isValidCloudSession;
exports.decodeStoredCloudSession = decodeStoredCloudSession;
function isValidCloudSession(session) {
    if (!session || (typeof session !== 'object' && typeof session !== 'function')) {
        return false;
    }
    const candidate = session;
    return !!(typeof candidate.ssecurity === 'string' &&
        candidate.ssecurity.length >= 16 &&
        /^[A-Za-z0-9+/]+={0,2}$/.test(candidate.ssecurity) &&
        typeof candidate.userId === 'string' &&
        candidate.userId.length > 0 &&
        typeof candidate.serviceToken === 'string' &&
        candidate.serviceToken.length >= 8 &&
        typeof candidate.sessionCookies === 'string' &&
        candidate.sessionCookies.length > 0 &&
        typeof candidate.location === 'string' &&
        candidate.location.startsWith('https://'));
}
function decodeStoredCloudSession(rawSession, decrypt) {
    try {
        let saved = rawSession;
        if (typeof rawSession === 'string') {
            try {
                saved = JSON.parse(rawSession);
            }
            catch {
                saved = JSON.parse(decrypt ? decrypt(rawSession) : rawSession);
            }
        }
        return isValidCloudSession(saved) ? { status: 'valid', session: saved } : { status: 'invalid_session' };
    }
    catch {
        return { status: 'invalid_json' };
    }
}
//# sourceMappingURL=XiaomiCloudSession.js.map
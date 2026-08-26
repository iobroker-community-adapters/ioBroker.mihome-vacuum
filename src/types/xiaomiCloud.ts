export type XiaomiAuthStatus =
    'not_authenticated' | 'waiting_for_scan' | 'waiting_for_confirmation' | 'authenticated' | 'expired' | 'error';

export interface XiaomiAuthUpdate {
    loginUrl?: string;
    lastError?: string;
    expiresAt?: number;
}

export interface XiaomiCloudSession {
    deviceId?: string;
    sessionCookies: string;
    ssecurity: string;
    userId: string;
    location: string;
    serviceToken: string;
}

export type XiaomiCloudSessionDecodeResult =
    { status: 'valid'; session: XiaomiCloudSession } | { status: 'invalid_session' } | { status: 'invalid_json' };

export type XiaomiQrLoginResult =
    { ok: true } | { pending: true; loginUrl?: string; expiresAt?: number } | { err: string };

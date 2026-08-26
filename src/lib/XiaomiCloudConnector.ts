import axios, { type AxiosInstance } from 'axios';
import * as crypto from 'node:crypto';
import qs from 'qs';
import {
    signedNonce,
    generateNonce,
    generateEncSignature,
    generateEncryptedParams,
    XiaomiRC4Cipher,
    type XiaomiEncryptedParams,
} from './XiaomiCloudCrypto';
import { isValidCloudSession, decodeStoredCloudSession } from './XiaomiCloudSession';
import { logAdvancedDiagnostic } from './diagnostics';
import {
    mergeSessionCookies,
    buildCookieHeader,
    getSessionCookie,
    parseXiaomiJSON,
    safeXiaomiError,
} from './XiaomiCloudProtocol';
import type { XiaomiAuthStatus, XiaomiAuthUpdate, XiaomiCloudSession, XiaomiQrLoginResult } from '../types/xiaomiCloud';
import type {
    XiaomiCloudAdapter,
    XiaomiCloudAuthConfig,
    XiaomiCloudLogger,
    XiaomiCloudRequestError,
    XiaomiCloudSessionState,
    XiaomiHomeId,
    XiaomiHomeResponse,
} from '../types/xiaomiCloudConnector';

const QR_LOGIN_URL = 'https://account.xiaomi.com/longPolling/loginUrl';
const LONG_POLL_TIMEOUT_MS = 10 * 1000;

function asRecord(value: unknown): Record<string, unknown> | null {
    return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function toCloudString(value: unknown): string | null {
    return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
}

/** Xiaomi Cloud authentication and encrypted API client. */
class XiaomiCloudConnector {
    readonly logger: XiaomiCloudLogger;
    readonly adapter?: XiaomiCloudAdapter;
    readonly session: AxiosInstance;
    agent: string;
    deviceId: string;
    commonCookies = '';
    sessionCookies = '';
    ssecurity: string | null = null;
    userId: string | null = null;
    location: string | null = null;
    serviceToken: string | null = null;
    homeIds: XiaomiHomeId[] | null = null;
    loginInProgress = false;
    unloaded = false;
    abortController: AbortController | null = null;
    qrLoginUrl = '';
    longPollingUrl = '';
    qrExpiresAt = 0;

    constructor(logger: XiaomiCloudLogger, authObj: XiaomiCloudAuthConfig = {}, adapter?: XiaomiCloudAdapter) {
        this.logger = logger;
        this.adapter = adapter;
        this.session = axios.create({ timeout: 15_000, maxRedirects: 0, validateStatus: () => true });
        this.agent = this.generateAgent();
        this.deviceId = this.generateDeviceId();
        this.init(authObj);
    }

    init(authObj: XiaomiCloudAuthConfig = {}): void {
        if (authObj.deviceId) {
            this.deviceId = authObj.deviceId;
        }
        this.commonCookies = `sdkVersion=accountsdk-18.8.15; deviceId=${this.deviceId};`;
        const storedSession = authObj.cloudSession || this.adapter?.config?.cloudSession;
        const restored = this.restoreSession(storedSession);
        if (storedSession && !restored) {
            this.logger.debug('Cloud auth: stored session is incomplete or cannot be read; waiting for a new QR login');
        } else if (restored) {
            this.logger.debug('Cloud auth: restored stored session');
        } else {
            this.logger.debug('Cloud auth: no stored session found');
        }
    }

    restoreSession(rawSession: unknown): boolean {
        if (!rawSession) {
            return false;
        }
        const decoded = decodeStoredCloudSession(rawSession, this.adapter?.decrypt?.bind(this.adapter));
        if (decoded.status === 'invalid_json') {
            this.logger.debug('Cloud auth: stored session is not valid JSON');
            return false;
        }
        if (decoded.status === 'invalid_session') {
            this.logger.debug('Cloud auth: stored session failed plausibility validation');
            return false;
        }
        const saved = decoded.session;
        this.deviceId = saved.deviceId || this.deviceId;
        this.commonCookies = `sdkVersion=accountsdk-18.8.15; deviceId=${this.deviceId};`;
        this.ssecurity = saved.ssecurity;
        this.userId = saved.userId;
        this.location = saved.location;
        this.serviceToken = saved.serviceToken;
        this.sessionCookies = saved.sessionCookies || '';
        void this.updateAuth('authenticated', { loginUrl: '', lastError: '', expiresAt: 0 });
        return true;
    }

    isValidSession(session: unknown): session is XiaomiCloudSession {
        return isValidCloudSession(session);
    }

    loggedIn(): boolean {
        return this.isValidSession(this.exportSession());
    }

    exportSession(): XiaomiCloudSessionState {
        return {
            deviceId: this.deviceId,
            sessionCookies: this.sessionCookies,
            ssecurity: this.ssecurity,
            userId: this.userId,
            location: this.location,
            serviceToken: this.serviceToken,
        };
    }

    async persistSession(): Promise<void> {
        if (!this.adapter || this.unloaded) {
            return;
        }
        const objectId = `system.adapter.${this.adapter.namespace}`;
        const object = await this.adapter.getForeignObjectAsync(objectId);
        if (!object) {
            throw new Error('Adapter configuration is unavailable');
        }
        const serializedSession = JSON.stringify(this.exportSession());
        object.native = {
            ...object.native,
            cloudSession: this.encryptSession(serializedSession),
        };
        await this.adapter.setForeignObjectAsync(objectId, object);
        this.logger.debug('Cloud auth: session saved to protected adapter configuration');
    }

    async clearPersistedSession(): Promise<void> {
        if (!this.adapter || this.unloaded) {
            return;
        }
        const objectId = `system.adapter.${this.adapter.namespace}`;
        const object = await this.adapter.getForeignObjectAsync(objectId);
        if (!object) {
            return;
        }
        object.native = { ...object.native, cloudSession: this.encryptSession('') };
        await this.adapter.setForeignObjectAsync(objectId, object);
    }

    encryptSession(serializedSession: string): string {
        if (!this.adapter?.encrypt) {
            throw new Error('Adapter encryption is unavailable');
        }
        return this.adapter.encrypt(serializedSession);
    }

    async updateAuth(status: XiaomiAuthStatus, options: XiaomiAuthUpdate = {}): Promise<void> {
        if (!this.adapter || this.unloaded) {
            return;
        }
        try {
            await this.adapter.setStateAsync('auth.status', status, true);
            if (options.loginUrl !== undefined) {
                await this.adapter.setStateAsync('auth.loginUrl', options.loginUrl, true);
            }
            if (options.lastError !== undefined) {
                await this.adapter.setStateAsync('auth.lastError', options.lastError, true);
            }
            if (options.expiresAt !== undefined) {
                await this.adapter.setStateAsync('auth.expiresAt', options.expiresAt, true);
            }
        } catch {
            // The adapter may be shutting down or its database may already be closed.
        }
    }

    advancedDiagnostic(operation: string, details: unknown): void {
        logAdvancedDiagnostic(this.logger, this.adapter?.config?.enableAdvancedDebug === true, operation, details);
    }

    mergeSetCookie(setCookie: unknown): void {
        this.sessionCookies = mergeSessionCookies(this.sessionCookies, setCookie);
    }

    buildCookieHeader(): string {
        return buildCookieHeader(this.commonCookies, this.sessionCookies);
    }

    async startQrLogin(): Promise<XiaomiQrLoginResult> {
        if (this.unloaded) {
            return { err: 'Adapter is stopping' };
        }
        if (this.loggedIn()) {
            return { ok: true };
        }
        if (this.loginInProgress) {
            return { pending: true };
        }

        this.loginInProgress = true;
        this.abortController = new AbortController();
        await this.updateAuth('waiting_for_scan', { lastError: '' });
        try {
            const response = await this.session.get<unknown>(QR_LOGIN_URL, {
                params: {
                    _qrsize: '480',
                    qs: '%3Fsid%3Dxiaomiio%26_json%3Dtrue',
                    callback: 'https://sts.api.io.mi.com/sts',
                    _hasLogo: 'false',
                    sid: 'xiaomiio',
                    _locale: 'en_GB',
                    _dc: Date.now().toString(),
                },
                headers: { 'User-Agent': this.agent, Accept: '*/*' },
                signal: this.abortController.signal,
            });
            this.advancedDiagnostic('cloud login initialization response', {
                status: response.status,
                payload: response.data,
            });
            const data = asRecord(this.parseJSON(response.data));
            if (response.status !== 200 || typeof data?.loginUrl !== 'string' || typeof data.lp !== 'string') {
                this.logger.debug(`Cloud auth: QR login initialization returned HTTP ${response.status}`);
                throw new Error('Invalid Xiaomi QR login response');
            }

            this.qrLoginUrl = data.loginUrl;
            this.longPollingUrl = data.lp;
            this.qrExpiresAt = Date.now() + Math.max(1, Number.parseInt(String(data.timeout), 10) || 300) * 1000;
            await this.updateAuth('waiting_for_scan', {
                loginUrl: this.qrLoginUrl,
                expiresAt: this.qrExpiresAt,
            });
            void this.waitForQrLogin().catch(error => this.finishQrLoginError(error));
            return { pending: true, loginUrl: this.qrLoginUrl };
        } catch (error) {
            this.loginInProgress = false;
            const message = this.safeError(error);
            await this.updateAuth('error', { lastError: message });
            return { err: message };
        }
    }

    async waitForQrLogin(): Promise<void> {
        while (!this.unloaded && Date.now() < this.qrExpiresAt) {
            try {
                const response = await this.session.get<unknown>(this.longPollingUrl, {
                    timeout: LONG_POLL_TIMEOUT_MS,
                    signal: this.abortController?.signal,
                    headers: { 'User-Agent': this.agent, Cookie: this.buildCookieHeader() },
                });
                this.advancedDiagnostic('cloud login polling response', {
                    status: response.status,
                    payload: response.data,
                });
                const data = asRecord(this.parseJSON(response.data));
                const userId = toCloudString(data?.userId);
                const security = toCloudString(data?.ssecurity);
                const location = toCloudString(data?.location);
                if (response.status === 200 && userId && security && location) {
                    this.logger.debug('Cloud auth: QR login was confirmed; requesting service token');
                    this.userId = userId;
                    this.ssecurity = security;
                    this.location = location;
                    await this.updateAuth('waiting_for_confirmation');
                    await this.fetchServiceToken();
                    await this.persistSession();
                    this.loginInProgress = false;
                    await this.updateAuth('authenticated', { loginUrl: '', lastError: '', expiresAt: 0 });
                    return;
                }
                if (response.status === 401 || response.status === 403) {
                    this.logger.debug(`Cloud auth: QR long-poll was rejected with HTTP ${response.status}`);
                    throw new Error('Xiaomi rejected the QR login');
                }
                await this.delay(500);
            } catch (error) {
                const errorObject: XiaomiCloudRequestError | null =
                    error !== null && typeof error === 'object' ? error : null;
                const errorCode = errorObject?.code;
                const errorMessage = error instanceof Error ? error.message : '';
                if (this.unloaded || errorCode === 'ERR_CANCELED') {
                    return;
                }
                if (errorCode !== 'ECONNABORTED' && !errorMessage.includes('timeout')) {
                    await this.delay(2_000);
                }
            }
        }
        if (!this.unloaded) {
            await this.finishQrLoginError(new Error('QR login expired'));
        }
    }

    async fetchServiceToken(): Promise<void> {
        let requestUrl = this.location;
        if (!requestUrl) {
            throw new Error('Xiaomi did not provide a service token');
        }
        for (let redirect = 0; redirect < 6; redirect++) {
            const response = await this.session.get<unknown>(requestUrl, {
                headers: { 'User-Agent': this.agent, Cookie: this.buildCookieHeader() },
                maxRedirects: 0,
                signal: this.abortController?.signal,
            });
            this.advancedDiagnostic('cloud service-token response', {
                status: response.status,
                redirect,
                hasSetCookie: Array.isArray(response.headers['set-cookie']),
                hasLocation: typeof response.headers.location === 'string',
            });
            this.mergeSetCookie(response.headers['set-cookie']);
            const serviceToken = this.getCookie('serviceToken');
            if (serviceToken) {
                this.serviceToken = serviceToken;
                this.logger.debug(`Cloud auth: service token received after ${redirect} redirect(s)`);
                return;
            }
            const location = response.headers.location;
            if (response.status < 300 || response.status >= 400 || !location) {
                this.logger.debug(`Cloud auth: service-token request ended with HTTP ${response.status} without token`);
                break;
            }
            this.logger.debug(`Cloud auth: following service-token redirect ${redirect + 1}`);
            requestUrl = new URL(String(location), requestUrl).toString();
        }
        throw new Error('Xiaomi did not provide a service token');
    }

    getCookie(name: string): string | undefined {
        return getSessionCookie(this.sessionCookies, name);
    }

    async finishQrLoginError(error: unknown): Promise<void> {
        if (this.unloaded) {
            return;
        }
        this.loginInProgress = false;
        const message = this.safeError(error);
        const expired = message === 'QR login expired';
        await this.updateAuth(expired ? 'expired' : 'error', { lastError: message });
    }

    login(): Promise<XiaomiQrLoginResult> {
        if (this.loggedIn()) {
            return Promise.resolve({ ok: true });
        }
        return Promise.resolve({
            err: 'Xiaomi Cloud authentication required; start the QR login in the adapter configuration',
        });
    }

    async refreshToken(): Promise<XiaomiQrLoginResult> {
        await this.invalidateSession('not_authenticated');
        return { err: 'Xiaomi Cloud authentication required; start the QR login in the adapter configuration' };
    }

    async invalidateSession(status: XiaomiAuthStatus = 'not_authenticated', lastError = ''): Promise<void> {
        this.logger.debug(`Cloud auth: invalidating session (${lastError || status})`);
        this.ssecurity = null;
        this.userId = null;
        this.location = null;
        this.serviceToken = null;
        this.sessionCookies = '';
        await this.clearPersistedSession();
        await this.updateAuth(status, { loginUrl: '', expiresAt: 0, lastError });
    }

    async getHomes(country: string): Promise<void> {
        const url = `${this.getApiUrl(country)}/v2/homeroom/gethome`;
        const data = JSON.stringify({ fg: true, fetch_share: true, fetch_share_dev: true, limit: 300, app_ver: 7 });
        const json = (await this.executeEncryptedApiCall(url, { data })) as XiaomiHomeResponse;
        this.homeIds = json?.result?.homelist?.map(home => home.id) || [];
        this.advancedDiagnostic('cloud home discovery summary', { region: country, homeCount: this.homeIds.length });
    }

    async getDevices(
        country: string,
        homeIds?: XiaomiHomeId | XiaomiHomeId[] | null,
    ): Promise<Record<string, unknown>> {
        let selectedHomeIds: XiaomiHomeId[];
        if (!homeIds) {
            if (!this.homeIds) {
                await this.getHomes(country);
            }
            selectedHomeIds = this.homeIds?.slice() || [];
        } else {
            selectedHomeIds = Array.isArray(homeIds) ? homeIds : [homeIds];
        }
        const url = `${this.getApiUrl(country)}/v2/home/home_device_list`;
        const devices: Record<string, unknown> = {};
        for (const homeId of selectedHomeIds) {
            devices[String(homeId)] = await this.executeEncryptedApiCall(url, {
                data: JSON.stringify({
                    home_owner: this.userId,
                    home_id: homeId,
                    limit: 200,
                    get_split_device: true,
                    support_smart_home: true,
                }),
            });
        }
        this.advancedDiagnostic('cloud device discovery summary', {
            region: country,
            requestedHomeCount: selectedHomeIds.length,
            response: devices,
        });
        return devices;
    }

    async executeEncryptedApiCall(url: string, params: XiaomiEncryptedParams): Promise<unknown> {
        const cloudSession = this.exportSession();
        if (!this.isValidSession(cloudSession)) {
            throw new Error('Xiaomi Cloud authentication required');
        }
        const nonce = this.generateNonce(Date.now());
        const nonceSignature = this.signedNonce(nonce, cloudSession.ssecurity);
        const fields = this.generateEncryptedParams(
            new XiaomiRC4Cipher(nonceSignature),
            url,
            'POST',
            nonce,
            { ...params },
            cloudSession.ssecurity,
        );
        const operation = new URL(url).pathname.split('/').slice(-3).join('/');
        this.advancedDiagnostic('cloud API request', {
            operation,
            method: 'POST',
            encryptedFieldCount: Object.keys(fields).length,
        });
        try {
            const response = await this.session.post<string>(`${url}?${qs.stringify(fields, { encode: true })}`, null, {
                headers: {
                    'Accept-Encoding': 'identity',
                    'User-Agent': this.agent,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'x-xiaomi-protocal-flag-cli': 'PROTOCAL-HTTP2',
                    'MIOT-ENCRYPT-ALGORITHM': 'ENCRYPT-RC4',
                    Cookie: `userId=${this.userId}; yetAnotherServiceToken=${this.serviceToken}; serviceToken=${this.serviceToken}; ${this.buildCookieHeader()}`,
                },
            });
            this.advancedDiagnostic('cloud API encrypted response', {
                operation,
                status: response.status,
                encryptedBytes: typeof response.data === 'string' ? response.data.length : 0,
            });
            if ([401, 403].includes(response.status)) {
                await this.invalidateSession('not_authenticated', 'Xiaomi Cloud session is no longer authorized');
                throw new Error('Xiaomi Cloud session is no longer authorized');
            }
            if (response.status !== 200) {
                throw new Error(`Xiaomi Cloud request failed (HTTP ${response.status})`);
            }
            const decrypted = JSON.parse(
                new XiaomiRC4Cipher(nonceSignature).decrypt(response.data).replace('&&&START&&&', ''),
            );
            this.advancedDiagnostic('cloud API decrypted response structure', { operation, payload: decrypted });
            return decrypted;
        } catch (error) {
            throw new Error(this.safeError(error));
        }
    }

    parseJSON(raw: unknown): unknown {
        return parseXiaomiJSON(raw);
    }

    safeError(error: unknown): string {
        return safeXiaomiError(error);
    }

    delay(ms: number): Promise<void> {
        return new Promise(resolve => {
            if (!this.adapter?.setTimeout?.(resolve, ms)) {
                resolve();
            }
        });
    }

    shutdown(): void {
        this.unloaded = true;
        this.abortController?.abort();
    }

    generateAgent(): string {
        return `mihome-vacuum/${crypto.randomBytes(8).toString('hex')}`;
    }

    generateDeviceId(): string {
        return crypto.randomBytes(6).toString('hex').slice(0, 6);
    }

    getApiUrl(country: string): string {
        return `https://${country === 'cn' || country === '-' ? '' : `${country}.`}api.io.mi.com/app`;
    }

    signedNonce(nonce: string, ssecurity: string): string {
        return signedNonce(nonce, ssecurity);
    }

    generateNonce(millis: number): string {
        return generateNonce(millis);
    }

    generateEncSignature(url: string, method: string, nonceSignature: string, params: XiaomiEncryptedParams): string {
        return generateEncSignature(url, method, nonceSignature, params);
    }

    generateEncryptedParams(
        rc4: XiaomiRC4Cipher,
        url: string,
        method: string,
        nonce: string,
        params: XiaomiEncryptedParams,
        ssecurity: string,
    ): XiaomiEncryptedParams {
        return generateEncryptedParams(rc4, url, method, nonce, params, ssecurity);
    }
}

export = XiaomiCloudConnector;

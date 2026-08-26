interface ExternalRequestError {
    code?: unknown;
    response?: unknown;
}

interface ExternalResponse {
    status?: number | string;
}

export function mergeSessionCookies(currentCookies: string, setCookie: unknown): string {
    if (!Array.isArray(setCookie)) {
        return currentCookies;
    }
    const cookies = new Map<string, string>();
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

export function buildCookieHeader(commonCookies: string, sessionCookies: string): string {
    return [commonCookies, 'pass_ua=web', 'uLocale=en_GB', sessionCookies].filter(Boolean).join('; ');
}

export function getSessionCookie(sessionCookies: string, name: string): string | undefined {
    return sessionCookies
        .split(';')
        .map(cookie => cookie.trim())
        .find(cookie => cookie.startsWith(`${name}=`))
        ?.slice(name.length + 1);
}

export function parseXiaomiJSON(raw: unknown): unknown {
    try {
        return typeof raw === 'string' ? JSON.parse(raw.replace('&&&START&&&', '')) : raw;
    } catch {
        return null;
    }
}

export function safeXiaomiError(error: unknown): string {
    const errorObject: ExternalRequestError | null = error !== null && typeof error === 'object' ? error : null;
    const response =
        errorObject?.response !== null && typeof errorObject?.response === 'object'
            ? (errorObject.response as ExternalResponse)
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

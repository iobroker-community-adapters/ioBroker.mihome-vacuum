export declare function mergeSessionCookies(currentCookies: string, setCookie: unknown): string;
export declare function buildCookieHeader(commonCookies: string, sessionCookies: string): string;
export declare function getSessionCookie(sessionCookies: string, name: string): string | undefined;
export declare function parseXiaomiJSON(raw: unknown): unknown;
export declare function safeXiaomiError(error: unknown): string;

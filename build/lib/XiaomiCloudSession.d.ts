import type { XiaomiCloudSession, XiaomiCloudSessionDecodeResult } from '../types/xiaomiCloud';
export declare function isValidCloudSession(session: unknown): session is XiaomiCloudSession;
export declare function decodeStoredCloudSession(rawSession: unknown, decrypt?: (serializedSession: string) => string): XiaomiCloudSessionDecodeResult;

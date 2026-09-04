/**
 * Tests whether the given value is a plain object and not an array or null.
 *
 * @param value Value to inspect.
 */
export declare function isObject(value: unknown): value is Record<string, unknown>;
/**
 * Tests whether the given value is an array.
 *
 * @param value Value to inspect.
 */
export declare function isArray(value: unknown): value is unknown[];
/**
 * Translates text to the target language using the configured translation service.
 *
 * @param text Source text.
 * @param targetLang Target language code.
 * @param yandexApiKey Optional Yandex API key.
 */
export declare function translateText(text: string, targetLang: string, yandexApiKey?: string): Promise<string>;

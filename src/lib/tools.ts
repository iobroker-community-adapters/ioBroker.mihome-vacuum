import axios from 'axios';

/**
 * Tests whether the given value is a plain object and not an array or null.
 *
 * @param value Value to inspect.
 */
export function isObject(value: unknown): value is Record<string, unknown> {
    return Object.prototype.toString.call(value) === '[object Object]';
}

/**
 * Tests whether the given value is an array.
 *
 * @param value Value to inspect.
 */
export function isArray(value: unknown): value is unknown[] {
    return Array.isArray(value);
}

/**
 * Translates text to the target language using the configured translation service.
 *
 * @param text Source text.
 * @param targetLang Target language code.
 * @param yandexApiKey Optional Yandex API key.
 */
export async function translateText(text: string, targetLang: string, yandexApiKey?: string): Promise<string> {
    if (targetLang === 'en') {
        return text;
    }
    if (!text) {
        return '';
    }
    if (yandexApiKey) {
        return translateYandex(text, targetLang, yandexApiKey);
    }
    return translateGoogle(text, targetLang);
}

async function translateYandex(text: string, targetLang: string, apiKey: string): Promise<string> {
    if (targetLang === 'zh-cn') {
        targetLang = 'zh';
    }
    try {
        const url = `https://translate.yandex.net/api/v1.5/tr.json/translate?key=${apiKey}&text=${encodeURIComponent(text)}&lang=en-${targetLang}`;
        const response = await axios({ url, timeout: 15000 });
        if (response.data?.text && isArray(response.data.text)) {
            return String(response.data.text[0]);
        }
        throw new Error('Invalid response for translate request');
    } catch (error) {
        throw new Error(`Could not translate to "${targetLang}": ${formatError(error)}`);
    }
}

async function translateGoogle(text: string, targetLang: string): Promise<string> {
    try {
        const url = `http://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}&ie=UTF-8&oe=UTF-8`;
        const response = await axios({ url, timeout: 15000 });
        if (isArray(response.data) && isArray(response.data[0]) && isArray(response.data[0][0])) {
            return String(response.data[0][0][0]);
        }
        throw new Error('Invalid response for translate request');
    } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 429) {
            throw new Error(`Could not translate to "${targetLang}": Rate-limited by Google Translate`);
        }
        throw new Error(`Could not translate to "${targetLang}": ${formatError(error)}`);
    }
}

function formatError(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown error';
}

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isObject = isObject;
exports.isArray = isArray;
exports.translateText = translateText;
const axios_1 = __importDefault(require("axios"));
/**
 * Tests whether the given value is a plain object and not an array or null.
 *
 * @param value Value to inspect.
 */
function isObject(value) {
    return Object.prototype.toString.call(value) === '[object Object]';
}
/**
 * Tests whether the given value is an array.
 *
 * @param value Value to inspect.
 */
function isArray(value) {
    return Array.isArray(value);
}
/**
 * Translates text to the target language using the configured translation service.
 *
 * @param text Source text.
 * @param targetLang Target language code.
 * @param yandexApiKey Optional Yandex API key.
 */
async function translateText(text, targetLang, yandexApiKey) {
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
async function translateYandex(text, targetLang, apiKey) {
    if (targetLang === 'zh-cn') {
        targetLang = 'zh';
    }
    try {
        const url = `https://translate.yandex.net/api/v1.5/tr.json/translate?key=${apiKey}&text=${encodeURIComponent(text)}&lang=en-${targetLang}`;
        const response = await (0, axios_1.default)({ url, timeout: 15000 });
        if (response.data?.text && isArray(response.data.text)) {
            return String(response.data.text[0]);
        }
        throw new Error('Invalid response for translate request');
    }
    catch (error) {
        throw new Error(`Could not translate to "${targetLang}": ${formatError(error)}`);
    }
}
async function translateGoogle(text, targetLang) {
    try {
        const url = `http://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}&ie=UTF-8&oe=UTF-8`;
        const response = await (0, axios_1.default)({ url, timeout: 15000 });
        if (isArray(response.data) && isArray(response.data[0]) && isArray(response.data[0][0])) {
            return String(response.data[0][0][0]);
        }
        throw new Error('Invalid response for translate request');
    }
    catch (error) {
        if (axios_1.default.isAxiosError(error) && error.response?.status === 429) {
            throw new Error(`Could not translate to "${targetLang}": Rate-limited by Google Translate`);
        }
        throw new Error(`Could not translate to "${targetLang}": ${formatError(error)}`);
    }
}
function formatError(error) {
    return error instanceof Error ? error.message : 'Unknown error';
}
//# sourceMappingURL=tools.js.map
import translations from '../translations';

export type WidgetTextKey = keyof typeof translations.en;
export type TextFunction = (key: WidgetTextKey) => string;

/**
 * Returns a lookup function for the widget texts of one language.
 * Unknown languages fall back to English; unknown keys return the key itself so a missing
 * translation is visible instead of rendering an empty string.
 *
 * @param language - ioBroker language code, e.g. `de`
 */
export function createText(language: string): TextFunction {
    const dictionary: Record<string, string> = translations[language as keyof typeof translations] || translations.en;
    return key => dictionary[key] ?? translations.en[key] ?? key;
}

/**
 * Looks up an optional translation without falling back to the key.
 *
 * @param language - ioBroker language code
 * @param key - dictionary key
 */
export function optionalText(language: string, key: string): string | undefined {
    const dictionary: Record<string, string> = translations[language as keyof typeof translations] || translations.en;
    return dictionary[key] ?? (translations.en as Record<string, string>)[key];
}

/**
 * Resolves an ioBroker multi-language name to a single string.
 *
 * @param name - `common.name` of an object
 * @param language - preferred language
 */
export function resolveName(name: unknown, language: string): string {
    if (typeof name === 'string') {
        return name;
    }
    if (name && typeof name === 'object') {
        const record = name as Record<string, unknown>;
        const candidate = record[language] ?? record.en ?? Object.values(record)[0];
        return typeof candidate === 'string' ? candidate : '';
    }
    return '';
}

import { optionalText, type TextFunction } from './i18n';
import type { FanOption, StateCatalog, StateValue } from './types';

/**
 * Fallback catalogue used when the `info.state` object of the adapter cannot be read.
 * The adapter's own `common.states` is the primary source.
 */
export const FALLBACK_STATES: StateCatalog = {
    0: 'Unknown',
    1: 'Initiating',
    2: 'Sleeping',
    3: 'Waiting',
    5: 'Cleaning',
    6: 'Back to home',
    7: 'Manual mode',
    8: 'Charging',
    9: 'Charging error',
    10: 'Pause',
    11: 'Spot cleaning',
    12: 'In error',
    13: 'Shutting down',
    14: 'Updating',
    15: 'Docking',
    16: 'Going to spot',
    17: 'Zone cleaning',
    18: 'Room cleaning',
    22: 'Dust collecting',
    23: 'Mop cleaning',
    26: 'Going to mop cleaning',
    27: 'Cleaning mop paused',
    28: 'Drying mop',
    29: 'Washing mop',
    30: 'Mopping',
    31: 'Cleaning and mopping',
    32: 'Remote clean',
    33: 'Water inspecting',
    34: 'Charging complete',
    35: 'Building',
};

/** Fallback for the readable part of the adapter's `info.error` catalogue. */
export const FALLBACK_ERRORS: StateCatalog = {
    0: 'No error',
    1: 'Laser distance sensor error',
    2: 'Collision sensor error',
    3: 'Wheels on top of void, move robot',
    4: 'Clean hovering sensors, move robot',
    5: 'Clean main brush',
    6: 'Clean side brush',
    7: 'Main wheel stuck?',
    8: 'Device stuck, clean area',
    9: 'Dust collector missing',
    10: 'Clean filter',
    11: 'Stuck in magnetic barrier',
    12: 'Low battery',
    13: 'Charging fault',
    14: 'Battery fault',
    15: 'Wall sensors dirty, wipe them',
    16: 'Place me on flat surface',
    17: 'Side brushes problem, reboot me',
    18: 'Suction fan problem',
    19: 'Unpowered charging station',
    20: 'Remove mop',
    21: 'Clean mop pad',
    22: 'Fresh water tank dry',
    // The adapter additionally reports firmware codes up to WASHBOARD_LEVEL; they are shown verbatim.
};

/** Fan level names used by the adapter's `control.fan_power` catalogue, mapped to translation keys. */
const FAN_LABEL_KEYS: Record<string, string> = {
    QUIET: 'quiet',
    SILENT: 'quiet',
    BALANCED: 'balanced',
    STANDARD: 'balanced',
    MEDIUM: 'medium',
    TURBO: 'turbo',
    MAXIMUM: 'maximum',
    MAX: 'maximum',
    'MAXIMUM+': 'maximumPlus',
    CUSTOM: 'custom',
    OFF: 'off',
    MOP: 'mop',
};

/**
 * Names used by the water level, mop mode and dock status catalogues of the Roborock, Viomi and
 * Dreame managers, mapped to translation keys. Unknown names are shown as they are.
 */
export const CATALOG_LABEL_KEYS: Record<string, string> = {
    OFF: 'off',
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    NORMAL: 'normal',
    STANDARD: 'standard',
    CUSTOM: 'custom',
    DEEP: 'deep',
    DEEPPLUS: 'deepPlus',
    VACUUM: 'vacuum',
    VACUUMANDMOP: 'vacuumAndMop',
    MOP: 'mop',
    OK: 'ok',
    IDLE: 'idle',
    WASHING: 'washing',
    DRYING: 'drying',
    RETURNING: 'returning',
    PAUSED: 'paused',
    'CLEAN ADD WATER': 'cleanAddWater',
    'ADDING WATER': 'addingWater',
    'WATER EMPTY': 'waterEmpty',
    'WASTE WATER TANK FULL': 'wasteWaterTankFull',
};

/**
 * Translates a catalogue entry: first by numeric code (`state_5`), then by the catalogue text.
 *
 * @param language - widget language
 * @param prefix - translation key prefix, `state` or `error`
 * @param code - numeric state code
 * @param catalogText - text from the adapter's `common.states`
 */
function translateCatalogEntry(language: string, prefix: string, code: number, catalogText: string): string {
    return optionalText(language, `${prefix}_${code}`) ?? catalogText;
}

/**
 * Translates the name of a catalogue entry when a translation key is mapped for it.
 *
 * @param name - text from the adapter's `common.states`
 * @param language - widget language
 * @param keys - name (upper case) to translation key
 */
export function catalogLabel(
    name: string,
    language: string,
    keys: Record<string, string> = CATALOG_LABEL_KEYS,
): string {
    const key = keys[name.trim().toUpperCase()];
    return (key ? optionalText(language, key) : undefined) ?? name;
}

/**
 * Builds the selectable options of a numeric state from its `common.states` catalogue, sorted by
 * value. Returns an empty list when the object has no catalogue.
 *
 * @param catalog - `common.states` of the object, if known
 * @param language - widget language
 * @param keys - name (upper case) to translation key; pass an empty object to keep the names verbatim
 */
export function buildOptions(
    catalog: StateCatalog | undefined,
    language: string,
    keys: Record<string, string> = CATALOG_LABEL_KEYS,
): FanOption[] {
    if (!catalog) {
        return [];
    }
    return Object.entries(catalog)
        .map(([value, name]) => ({ value: Number(value), name: String(name) }))
        .filter(entry => Number.isFinite(entry.value))
        .sort((a, b) => a.value - b.value)
        .map(entry => ({ value: entry.value, label: catalogLabel(entry.name, language, keys) }));
}

/**
 * Formats a catalogue-backed value (water level, mop mode, dock status) for display.
 *
 * @param value - raw state value
 * @param catalog - `common.states` of the object, if known
 * @param language - widget language
 * @param text - text lookup
 */
export function formatCatalogValue(
    value: StateValue | undefined,
    catalog: StateCatalog | undefined,
    language: string,
    text: TextFunction,
): string {
    if (value === undefined || value === null || value === '') {
        return text('unknown');
    }
    const entry = catalog?.[String(value)];
    if (entry) {
        return catalogLabel(entry, language);
    }
    return typeof value === 'string' ? value : String(value);
}

export type DockLevel = 'good' | 'busy' | 'critical';

/**
 * Classifies the dock status: idle and ok are good, water or tank problems are critical, every
 * other known state (washing, drying, filling) is a running activity.
 *
 * @param value - value of the dock status state
 * @param catalog - `common.states` of the dock status object, if known
 */
export function dockLevel(value: StateValue | undefined, catalog: StateCatalog | undefined): DockLevel {
    const numeric = Number(value);
    if (value === undefined || value === null || value === '' || !Number.isFinite(numeric) || numeric === 0) {
        return 'good';
    }
    const name = (catalog?.[String(numeric)] ?? '').toUpperCase();
    if (name === 'OK' || name === 'IDLE') {
        return 'good';
    }
    if (numeric >= 30 || /EMPTY|FULL|ERROR/.test(name)) {
        return 'critical';
    }
    return 'busy';
}

/**
 * Formats the robot state for display.
 *
 * @param value - value of `info.state`
 * @param catalog - `common.states` of the `info.state` object, if known
 * @param language - widget language
 * @param text - text lookup
 */
export function formatState(
    value: StateValue | undefined,
    catalog: StateCatalog | undefined,
    language: string,
    text: TextFunction,
): string {
    const numeric = Number(value);
    if (value !== null && value !== '' && Number.isFinite(numeric)) {
        const source = catalog && Object.keys(catalog).length ? catalog : FALLBACK_STATES;
        const entry = source[String(numeric)] ?? FALLBACK_STATES[String(numeric)];
        if (entry && entry !== '?') {
            return translateCatalogEntry(language, 'state', numeric, entry);
        }
        return `${text('unknown')} (${numeric})`;
    }
    return typeof value === 'string' && value ? value : text('unknown');
}

/**
 * Formats the robot error for display. Code 0 always yields the translated "no error".
 *
 * @param value - value of `info.error`
 * @param catalog - `common.states` of the `info.error` object, if known
 * @param language - widget language
 * @param text - text lookup
 */
export function formatError(
    value: StateValue | undefined,
    catalog: StateCatalog | undefined,
    language: string,
    text: TextFunction,
): { label: string; isError: boolean } {
    const numeric = Number(value);
    if (value !== null && value !== '' && Number.isInteger(numeric) && numeric >= 0) {
        if (numeric === 0) {
            return { label: text('noError'), isError: false };
        }
        const source = catalog && Object.keys(catalog).length ? catalog : FALLBACK_ERRORS;
        const entry = source[String(numeric)] ?? FALLBACK_ERRORS[String(numeric)];
        return {
            label: entry
                ? translateCatalogEntry(language, 'error', numeric, entry)
                : `${text('unknownError')} (${numeric})`,
            isError: true,
        };
    }
    if (typeof value === 'string' && value) {
        return { label: value, isError: !/^no error$/i.test(value) };
    }
    return { label: text('noError'), isError: false };
}

/**
 * Builds the selectable fan levels from the `control.fan_power` catalogue of the adapter.
 * Falls back to the three configured numeric levels when the object has no catalogue.
 *
 * @param catalog - `common.states` of the fan object, if known
 * @param fallback - configured quiet/balanced/turbo values
 * @param fallback.quiet - value of the quiet level
 * @param fallback.balanced - value of the balanced level
 * @param fallback.turbo - value of the turbo level
 * @param language - widget language
 * @param text - text lookup
 */
export function buildFanOptions(
    catalog: StateCatalog | undefined,
    fallback: { quiet: number; balanced: number; turbo: number },
    language: string,
    text: TextFunction,
): FanOption[] {
    if (catalog && Object.keys(catalog).length) {
        return buildOptions(catalog, language, FAN_LABEL_KEYS);
    }
    return [
        { value: fallback.quiet, label: text('quiet') },
        { value: fallback.balanced, label: text('balanced') },
        { value: fallback.turbo, label: text('turbo') },
    ];
}

/**
 * Clamps a state value to a 0-100 percentage.
 *
 * @param value - raw state value
 */
export function percent(value: StateValue | undefined): number {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.min(100, Math.round(number))) : 0;
}

export type ConsumableLevel = 'good' | 'warning' | 'critical';

/**
 * Classifies the remaining lifetime of a consumable.
 *
 * @param remainingPercent - remaining lifetime in percent
 */
export function consumableLevel(remainingPercent: number): ConsumableLevel {
    if (remainingPercent <= 15) {
        return 'critical';
    }
    if (remainingPercent <= 35) {
        return 'warning';
    }
    return 'good';
}

/**
 * Formats a numeric value with an optional unit; non-numeric values are shown verbatim.
 *
 * @param value - raw state value
 * @param unit - unit suffix, may be empty
 */
export function formatMetric(value: StateValue | undefined, unit: string): string {
    if (value === undefined || value === null || value === '') {
        return '—';
    }
    const numeric = Number(value);
    const shown =
        typeof value === 'number' || Number.isFinite(numeric) ? String(Math.round(numeric * 100) / 100) : String(value);
    return unit ? `${shown} ${unit}` : shown;
}

/**
 * Interprets a state value as boolean (`true`, `'true'`, `1` and `'1'` are on).
 *
 * @param value - raw state value
 */
export function isOn(value: StateValue | undefined): boolean {
    return value === true || value === 'true' || value === 1 || value === '1';
}

import type { VacuumControlData } from './types';

/** Instance used for the attribute defaults of a freshly added widget. */
export const DEFAULT_BASE = 'mihome-vacuum.0';

/**
 * Attribute name to state suffix below the adapter instance.
 * The order matters only for readability; every entry is filled independently.
 */
export const AUTO_FILL_FIELDS: ReadonlyArray<readonly [keyof VacuumControlData, string]> = [
    ['mapOid', 'cleanmap.map64'],
    ['connectionOid', 'info.connection'],
    ['stateOid', 'info.state'],
    ['batteryOid', 'info.battery'],
    ['areaOid', 'info.cleanedarea'],
    ['timeOid', 'info.cleanedtime'],
    ['errorOid', 'info.error'],
    ['fanOid', 'control.fan_power'],
    ['startOid', 'control.start'],
    ['pauseOid', 'control.pause'],
    ['homeOid', 'control.home'],
    ['findOid', 'control.find'],
    ['filterOid', 'consumable.filter'],
    ['filterResetOid', 'consumable.filter_reset'],
    ['mainBrushOid', 'consumable.main_brush'],
    ['mainBrushResetOid', 'consumable.main_brush_reset'],
    ['sideBrushOid', 'consumable.side_brush'],
    ['sideBrushResetOid', 'consumable.side_brush_reset'],
    ['sensorsOid', 'consumable.sensors'],
    ['sensorsResetOid', 'consumable.sensors_reset'],
    ['waterFilterOid', 'consumable.water_filter'],
    ['waterFilterResetOid', 'consumable.water_filter_reset'],
    ['mopPadOid', 'consumable.mop_pad'],
    ['mopPadResetOid', 'consumable.mop_pad_reset'],
    ['strainerOid', 'consumable.strainer'],
    ['strainerResetOid', 'consumable.strainer_reset'],
    ['cleaningBrushOid', 'consumable.cleaning_brush'],
    ['cleaningBrushResetOid', 'consumable.cleaning_brush_reset'],
    ['dustCollectionOid', 'consumable.dust_collection'],
    ['dustCollectionResetOid', 'consumable.dust_collection_reset'],
    ['historyJsonOid', 'history.allTableJSON'],
    ['historyTotalAreaOid', 'history.total_area'],
    ['historyTotalTimeOid', 'history.total_time'],
    ['historyTotalCleanupsOid', 'history.total_cleanups'],
];

/**
 * Extracts the adapter instance (`mihome-vacuum.1`) from any state ID below it.
 * Returns an empty string for IDs that do not belong to this adapter.
 *
 * @param id - full state ID
 */
export function instanceBaseFromId(id: string | undefined): string {
    if (!id) {
        return '';
    }
    const match = /^(mihome-vacuum\.\d+)\./.exec(id);
    return match ? match[1] : '';
}

/**
 * Returns the attribute values that should change when the user selects a state of another
 * adapter instance. Only empty attributes and attributes that still point at the default instance
 * are touched, and only when the target state exists.
 *
 * @param data - current widget attributes
 * @param base - target instance, e.g. `mihome-vacuum.1`
 * @param exists - tells whether a state ID exists
 */
export function collectInstanceChanges(
    data: Record<string, unknown>,
    base: string,
    exists: (id: string) => boolean,
): Record<string, string> {
    const changes: Record<string, string> = {};
    if (!base) {
        return changes;
    }
    for (const [field, suffix] of AUTO_FILL_FIELDS) {
        const current = data[field];
        const target = `${base}.${suffix}`;
        if (current === target) {
            continue;
        }
        const replaceable =
            current === undefined ||
            current === null ||
            current === '' ||
            (typeof current === 'string' && current.startsWith(`${DEFAULT_BASE}.`) && base !== DEFAULT_BASE);
        if (replaceable && exists(target)) {
            changes[field] = target;
        }
    }
    return changes;
}

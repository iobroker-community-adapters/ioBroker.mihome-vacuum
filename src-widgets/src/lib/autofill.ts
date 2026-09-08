import type { VacuumControlData } from './types';

/** Instance used for the attribute defaults of a freshly added widget. */
export const DEFAULT_BASE = 'mihome-vacuum.0';

/**
 * Attribute name followed by the state suffixes below the adapter instance, in order of preference.
 * The first suffix is the attribute default; the alternatives cover the Viomi and Dreame managers,
 * which create the same function under another ID. Every entry is filled independently.
 */
export const AUTO_FILL_FIELDS: ReadonlyArray<readonly [keyof VacuumControlData, string, ...string[]]> = [
    ['mapOid', 'cleanmap.map64'],
    ['mapSelectOid', 'cleanmap.actualMap'],
    ['mapReloadOid', 'cleanmap.loadMap'],
    ['connectionOid', 'info.connection'],
    ['stateOid', 'info.state'],
    ['batteryOid', 'info.battery'],
    ['areaOid', 'info.cleanedarea'],
    ['timeOid', 'info.cleanedtime'],
    ['errorOid', 'info.error'],
    ['fanOid', 'control.fan_power', 'control.suction_grade', 'setting.suction_grade'],
    ['startOid', 'control.start'],
    ['pauseOid', 'control.pause'],
    ['homeOid', 'control.home'],
    ['findOid', 'control.find'],
    ['waterOid', 'control.water_box_mode', 'control.water_grade', 'setting.water_grade'],
    ['mopModeOid', 'control.mop_mode', 'control.is_mop'],
    ['carpetOid', 'control.carpet_mode'],
    ['dockStatusOid', 'info.dock_status', 'info.dock_state'],
    ['dustCollectOid', 'control.dustCollect'],
    ['washMopOid', 'control.washMop'],
    ['pauseWashMopOid', 'control.pauseWashMop'],
    ['startDryingOid', 'control.startDrying'],
    ['stopDryingOid', 'control.stopDrying'],
    ['dndOid', 'info.dnd'],
    ['nextTimerOid', 'info.nextTimer'],
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
 * All state IDs the auto-fill may point at for one instance, so their existence can be checked in
 * a single request.
 *
 * @param base - adapter instance, e.g. `mihome-vacuum.1`
 */
export function autoFillCandidates(base: string): string[] {
    return AUTO_FILL_FIELDS.flatMap(([, ...suffixes]) => suffixes.map(suffix => `${base}.${suffix}`));
}

/**
 * Candidate state IDs for the attributes a widget does not have at all (`undefined`), which is
 * the case for widgets created before the attribute existed.
 *
 * @param data - current widget attributes
 * @param base - adapter instance, e.g. `mihome-vacuum.1`
 */
export function missingAttributeCandidates(data: Record<string, unknown>, base: string): string[] {
    return AUTO_FILL_FIELDS.filter(([field]) => data[field] === undefined).flatMap(([, ...suffixes]) =>
        suffixes.map(suffix => `${base}.${suffix}`),
    );
}

/**
 * Resolves the attributes a widget does not have at all to the first existing candidate state of
 * the instance, so a widget created before an attribute existed still shows the matching control.
 * Attributes the user emptied on purpose (`''`) are left alone.
 *
 * @param data - current widget attributes
 * @param base - adapter instance, e.g. `mihome-vacuum.1`
 * @param exists - tells whether a state ID exists
 */
export function resolveMissingAttributes(
    data: Record<string, unknown>,
    base: string,
    exists: (id: string) => boolean,
): Record<string, string> {
    const resolved: Record<string, string> = {};
    if (!base) {
        return resolved;
    }
    for (const [field, ...suffixes] of AUTO_FILL_FIELDS) {
        if (data[field] !== undefined) {
            continue;
        }
        const target = suffixes.map(suffix => `${base}.${suffix}`).find(exists);
        if (target) {
            resolved[field] = target;
        }
    }
    return resolved;
}

/**
 * Returns the attribute values that should change when the user selects a state of another
 * adapter instance. Only empty attributes and attributes that still point at the default instance
 * are touched, and only when one of the candidate states exists (the first existing one wins).
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
    for (const [field, ...suffixes] of AUTO_FILL_FIELDS) {
        const current = data[field];
        const target = suffixes.map(suffix => `${base}.${suffix}`).find(exists);
        if (!target || current === target) {
            continue;
        }
        const replaceable =
            current === undefined ||
            current === null ||
            current === '' ||
            (typeof current === 'string' && current.startsWith(`${DEFAULT_BASE}.`) && base !== DEFAULT_BASE);
        if (replaceable) {
            changes[field] = target;
        }
    }
    return changes;
}

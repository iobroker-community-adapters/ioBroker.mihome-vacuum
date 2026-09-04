export interface VacuumStatusInput {
    state: number;
    battery: number;
    clean_time: number;
    clean_area: number;
    error_code: number;
    in_cleaning: number | boolean;
    fan_power: number;
    dnd_enabled: number | boolean;
    map_status: number;
    map_present: number | boolean;
    mop_forbidden_enable?: unknown;
    water_box_status?: unknown;
    water_box_mode?: unknown;
    distance_off?: unknown;
    mop_mode?: unknown;
    dock_error_status?: unknown;
    dust_collection_status?: unknown;
    wash_ready?: unknown;
    isLocating?: unknown;
    error_text?: string;
    [property: string]: unknown;
}
export interface VacuumStatus extends Omit<VacuumStatusInput, 'dnd_enabled' | 'in_cleaning' | 'map_present'> {
    dnd_enabled: boolean;
    in_cleaning: boolean;
    map_present: boolean;
    error_text: string | undefined;
}
export interface VacuumStatusResponse {
    result: [VacuumStatusInput, ...VacuumStatusInput[]];
}

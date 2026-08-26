export interface VacuumFeatureDeviceState {
    modell: string;
}

export interface FeatureLogger {
    debug(message: string): void;
    info(message: string): void;
}

export interface FeatureAdapter {
    log: FeatureLogger;
    getState(id: string, callback: (error: unknown, state: { val: unknown } | null | undefined) => void): void;
    getStates(
        pattern: string,
        callback: (error: unknown, states: Record<string, unknown> | null | undefined) => void,
    ): void;
    setState(id: string, value: unknown, ack: boolean): void;
    setStateChanged(id: string, value: unknown, ack: boolean): void;
    setStateAsync(id: string, state: { val: unknown; ack: true }): Promise<unknown>;
    setObjectAsync(id: string, object: unknown): Promise<unknown>;
    setObjectNotExistsAsync(id: string, object: unknown): Promise<unknown>;
}

export interface FeatureObjectsModule {
    newfan_power: {
        common: {
            max: number;
            states: Record<string | number, string>;
        };
    };
    water_box: unknown;
    dustCollect: unknown;
    washMop: unknown;
    mop: unknown;
    water_box_mode: {
        common: {
            max: number;
            states: Record<string | number, string>;
        };
    };
    water_box_level: unknown;
    mop_mode: unknown;
    dock_status: unknown;
}

export interface ConsumableFeature {
    name: string;
    calc?: number;
}

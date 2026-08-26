import type { RRMapData } from './rrMap';

export interface MapHelperAdapter {
    config: {
        devices?: string;
        email?: string;
        password?: string;
        server?: string;
        valetudo_enable?: boolean;
        enableMiMap?: boolean;
        ip?: string;
        valetudo_color_floor?: string;
        valetudo_color_wall?: string;
        valetudo_color_path?: string;
        robot_select?: number | string;
        newmap?: boolean;
        cloudSession?: string;
    };
    log: {
        info(message: unknown): void;
        error(message: unknown): void;
        debug(message: unknown): void;
        warn(message: unknown): void;
    };
}

export interface MapColorOptions {
    FLOORCOLOR?: string;
    WALLCOLOR?: string;
    PATHCOLOR?: string;
    ROBOT?: number | string;
    newmap: boolean;
}

export interface MapHelperConfig {
    username: string;
    password: string;
    deviceId: string;
    server: string;
    valetudo: boolean;
    mimap: boolean;
    ip: string;
    COLOR_OPTIONS: MapColorOptions;
}

export interface MapUrlResponse {
    message: string;
    result: {
        expires_time: number;
        url: string;
    };
}

export interface MapCanvas {
    toDataURL?: () => string;
}

export interface MapCreatorModule {
    CanvasMap(data: RRMapData, options: MapColorOptions, adapter: MapHelperAdapter): MapCanvas;
}

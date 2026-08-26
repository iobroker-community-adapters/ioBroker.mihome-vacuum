export interface CarpetModeSettings {
    enable: unknown;
    [property: string]: unknown;
}

export interface CarpetModeResponse {
    result?: unknown;
}

export interface ParsedCarpetMode {
    enabled: boolean;
    settings: CarpetModeSettings;
}

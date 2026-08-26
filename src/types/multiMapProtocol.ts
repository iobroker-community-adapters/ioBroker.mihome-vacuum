export interface MultiMapInfo {
    mapFlag: string | number;
    name: string;
    [property: string]: unknown;
}

export interface MultiMapResult {
    map_info: MultiMapInfo[];
    [property: string]: unknown;
}

export interface MultiMapResponse {
    result?: [MultiMapResult, ...unknown[]] | 'unknown_method' | null;
}

export interface ParsedMultiMapList {
    maps: MultiMapInfo[];
    states: Record<string | number, string>;
}

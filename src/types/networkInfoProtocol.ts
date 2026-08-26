export interface NetworkInfoResult {
    rssi?: unknown;
    [property: string]: unknown;
}

export interface NetworkInfoResponse {
    result?: NetworkInfoResult | 'unknown_method' | null;
}

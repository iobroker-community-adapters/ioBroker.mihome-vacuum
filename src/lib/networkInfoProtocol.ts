import type { NetworkInfoResponse } from '../types/networkInfoProtocol';

export function parseWifiSignal(response: NetworkInfoResponse): unknown {
    if (!response.result || response.result === 'unknown_method' || !response.result.rssi) {
        return null;
    }
    return response.result.rssi;
}

import type { MapPointerResponse, MapPointerResult } from '../types/mapPointerProtocol';

export function parseMapPointerResponse(response: MapPointerResponse): MapPointerResult {
    if (!response.result) {
        return { action: 'retry' };
    }

    const pointer = (response.result as unknown[])[0] as string;
    const parts = pointer.split('%');
    if (parts.length === 1 && pointer.startsWith('map_slot')) {
        return { action: 'stop' };
    }
    if (parts.length === 3) {
        return { action: 'ready', pointer };
    }
    return { action: 'retry' };
}

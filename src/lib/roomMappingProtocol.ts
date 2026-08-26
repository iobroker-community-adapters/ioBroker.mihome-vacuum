import type { RoomMappingResponse } from '../types/roomMappingProtocol';

export function parseRoomMapping(response: RoomMappingResponse): unknown {
    if (response.result && response.result !== 'unknown_method' && (response.result as { length?: number }).length) {
        return response.result;
    }
    return null;
}

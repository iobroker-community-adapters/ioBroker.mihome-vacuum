import type { MultiMapResponse, ParsedMultiMapList } from '../types/multiMapProtocol';

export function parseMultiMapList(response: MultiMapResponse): ParsedMultiMapList | null {
    if (!response.result || response.result === 'unknown_method') {
        return null;
    }

    const maps = response.result[0].map_info;
    const states: Record<string | number, string> = {};
    maps.forEach(map => {
        states[map.mapFlag] = map.name !== '' ? map.name : `${map.mapFlag}`;
    });

    return { maps, states };
}

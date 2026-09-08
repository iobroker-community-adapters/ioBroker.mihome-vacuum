import { resolveName } from './i18n';
import type { RoomDefinition, VacuumControlData } from './types';

/** Minimal shape of an ioBroker object as returned by the object views. */
export interface ObjectLike {
    _id: string;
    type?: string;
    common?: { name?: unknown };
}

/**
 * Builds the room list from the `rooms.*` channels of an adapter instance.
 * A room needs a `roomClean` state; the fan state is optional and only used when it exists.
 *
 * @param base - adapter instance, e.g. `mihome-vacuum.0`
 * @param channels - channel objects below `<base>.rooms`
 * @param stateIds - IDs of the state objects below `<base>.rooms`
 * @param language - language for the room names
 */
export function roomsFromObjects(
    base: string,
    channels: ObjectLike[],
    stateIds: Iterable<string>,
    language: string,
): RoomDefinition[] {
    const states = new Set(stateIds);
    const prefix = `${base}.rooms.`;
    return channels
        .filter(channel => channel._id.startsWith(prefix) && channel._id.split('.').length === 4)
        .map(channel => {
            const startOid = `${channel._id}.roomClean`;
            const fanOid = `${channel._id}.roomFanPower`;
            return {
                key: channel._id,
                name: resolveName(channel.common?.name, language) || channel._id.split('.').pop() || channel._id,
                startOid,
                fanOid: states.has(fanOid) ? fanOid : '',
            };
        })
        .filter(room => states.has(room.startOid))
        .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Builds the room list from the six manually configured room attributes.
 *
 * @param data - widget attributes
 */
export function roomsFromAttributes(data: VacuumControlData): RoomDefinition[] {
    const rooms: RoomDefinition[] = [];
    for (let index = 1; index <= 6; index++) {
        const name = data[`room${index}Name` as keyof VacuumControlData];
        const startOid = data[`room${index}StartOid` as keyof VacuumControlData];
        const fanOid = data[`room${index}FanOid` as keyof VacuumControlData];
        if (typeof name === 'string' && name && typeof startOid === 'string' && startOid) {
            rooms.push({ key: `room${index}`, name, startOid, fanOid: typeof fanOid === 'string' ? fanOid : '' });
        }
    }
    return rooms;
}

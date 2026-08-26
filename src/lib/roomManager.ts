import type { RoomAdapter, RoomTranslations } from '../types/room';

type RoomMapping = Record<string, string | number>;

class RoomManager {
    readonly stateRoomClean;
    readonly stateRoomStatus;
    readonly stateRoomRepeat;

    constructor(
        readonly adapter: RoomAdapter,
        readonly i18n: RoomTranslations,
    ) {
        this.stateRoomClean = {
            type: 'state',
            common: {
                name: this.i18n.cleanRoom,
                type: 'boolean',
                role: 'button',
                read: false,
                write: true,
                def: false,
                desc: 'Start Room Cleaning',
                smartName: this.i18n.cleanRooms,
            },
            native: {},
        };
        this.stateRoomStatus = {
            type: 'state',
            common: {
                name: 'info',
                type: 'string',
                role: 'info',
                read: true,
                write: false,
                def: '',
                desc: 'Status of Cleaning',
            },
            native: {},
        };
        this.stateRoomRepeat = {
            type: 'state',
            common: {
                name: 'repeat',
                type: 'number',
                role: 'level.repeat',
                read: true,
                write: true,
                min: 1,
                max: 10,
                step: 1,
                def: 1,
                desc: 'number of iterations',
            },
            native: {},
        };
        this.adapter.setObject('rooms.loadRooms', {
            type: 'state',
            common: {
                name: this.i18n.loadRooms,
                type: 'boolean',
                role: 'button',
                read: false,
                write: true,
                def: false,
                desc: "loads id's from stored rooms",
            },
            native: {},
        });
        this.adapter.setObject('rooms.multiRoomClean', {
            type: 'state',
            common: {
                name: this.i18n.cleanMultiRooms,
                type: 'boolean',
                role: 'button',
                read: false,
                write: true,
                def: false,
                desc: 'clean all rooms, which are connected to this datapoint',
            },
            native: {},
        });
        this.adapter.setObject(
            'rooms.addRoom',
            {
                type: 'state',
                common: {
                    name: this.i18n.addRoom,
                    type: 'string',
                    role: 'value',
                    read: true,
                    write: true,
                    desc: 'add roos manual with map Index or zone coordinates',
                },
                native: {},
            },
            (_error, object) => {
                if (object) {
                    this.adapter.setForeignState(object.id, this.i18n.addRoom, true);
                }
            },
        );

        this.adapter.getStates(`${this.adapter.namespace}.rooms.*`, (_error, states) => {
            if (states) {
                for (const stateId of Object.keys(states)) {
                    if (stateId.endsWith('.mapIndex')) {
                        void this.updateRoomStates(stateId.slice(0, -'.mapIndex'.length));
                    }
                }
            }
        });
    }

    processRoomMaping(response: { result: unknown }): false | void {
        const rooms: RoomMapping = {};
        if (typeof response.result !== 'object') {
            return false;
        }

        const result = (response.result ?? {}) as Record<string, Array<string | number | null | undefined>>;
        for (const room of Object.values(result)) {
            if (room[1]) {
                rooms[String(room[1])] = room[0] as string | number;
            } else {
                this.adapter.log.warn(`empty roomid for segment ${room[0]}`);
            }
        }
        this.adapter.getChannelsOf('rooms', (_error, roomObjects) => {
            if (roomObjects) {
                for (const roomObject of roomObjects) {
                    const externalRoomId = roomObject._id.split('.').pop() as string;
                    if (!externalRoomId.includes('manual_')) {
                        const room = rooms[externalRoomId];
                        if (!room) {
                            this.adapter.setStateChanged(
                                `${roomObject._id}.mapIndex`,
                                this.i18n.notAvailable,
                                true,
                                (_stateError, _id, notChanged) => {
                                    if (!notChanged) {
                                        this.adapter.log.info(`room: ${externalRoomId} not mapped`);
                                        this.adapter.setState(`${roomObject._id}.state`, this.i18n.notAvailable, true);
                                    }
                                },
                            );
                        } else {
                            const roomNumber = Number.parseInt(String(room), 10);
                            this.adapter.setStateChanged(
                                `${roomObject._id}.mapIndex`,
                                roomNumber,
                                true,
                                (_stateError, _id, notChanged) => {
                                    if (!notChanged) {
                                        this.adapter.log.info(
                                            `room: ${externalRoomId} mapped with index ${roomNumber}`,
                                        );
                                        void this.updateRoomStates(roomObject._id);
                                    }
                                },
                            );
                            delete rooms[externalRoomId];
                        }
                    }
                }
            }
            for (const [externalRoomId, room] of Object.entries(rooms)) {
                this.adapter.getObject(`rooms.${externalRoomId}`, (_objectError, roomObject) => {
                    if (roomObject) {
                        this.adapter.setStateChanged(`${roomObject._id}.mapIndex`, room, true);
                    } else {
                        void this.createRoom(externalRoomId, room);
                    }
                });
            }
        });
    }

    cleanRooms(mapIndexStates: string[]): void {
        this.adapter.getForeignStates(mapIndexStates, (_error, states) => {
            const mapIndexes: unknown[] = [];
            const zones: unknown[] = [];
            const mapChannels: string[] = [];
            const zoneChannels: string[] = [];
            if (!states) {
                return;
            }
            for (const [stateId, state] of Object.entries(states)) {
                if (stateId.indexOf('.mapIndex') > 0) {
                    const value = state?.val || 'invalid';
                    if (!Number.isNaN(Number(value))) {
                        if (!mapIndexes.includes(Number.parseInt(String(value), 10))) {
                            mapIndexes.push(value);
                            mapChannels.push(stateId.replace(/\.([^.]+)$/, ''));
                        }
                    } else if (String(value)[0] === '[') {
                        if (!zones.includes(value)) {
                            zones.push(value);
                            zoneChannels.push(stateId.replace(/\.([^.]+)$/, ''));
                        }
                    } else {
                        this.adapter.log.error(
                            `could not clean ${stateId}, because mapIndex/zone is invalid: ${value}`,
                        );
                    }
                } else {
                    this.adapter.log.error(`state must be .mapIndex for roomManager.cleanRooms ${stateId}`);
                }
            }
            if (mapIndexes.length > 0) {
                this.adapter.sendTo(this.adapter.namespace, 'cleanSegments', {
                    segments: mapIndexes,
                    channels: mapChannels,
                });
            }
            if (zones.length > 0) {
                this.adapter.sendTo(this.adapter.namespace, 'cleanZone', { zones, channels: zoneChannels });
            }
        });
    }

    cleanRoomsFromState(id: string): void {
        this.adapter.getForeignObjects(id, 'state', 'rooms', (_error, states) => {
            if (!states) {
                return;
            }
            const mapIndexes: string[] = [];
            const object = states[id];
            if (object.native.channels) {
                for (const channel of object.native.channels) {
                    mapIndexes.push(`${this.adapter.namespace}.rooms.${channel}.mapIndex`);
                }
            }
            let rooms = '';
            for (const room of Object.keys(object.enums)) {
                rooms += room;
            }
            if (rooms.length > 0) {
                this.findMapIndexByRoom(rooms, statesFound => this.cleanRooms(mapIndexes.concat(statesFound)));
            } else if (mapIndexes.length > 0) {
                this.cleanRooms(mapIndexes);
            } else {
                this.adapter.log.warn(`no room found for ${id}`);
            }
        });
    }

    findMapIndexByRoom(rooms: string, callback?: (states: string[]) => void): void {
        this.adapter.getForeignObjects(`${this.adapter.namespace}.rooms.*`, 'state', 'rooms', (_error, states) => {
            if (!states) {
                return;
            }
            const mapIndexStates: string[] = [];
            for (const [stateId, state] of Object.entries(states)) {
                for (const room of Object.keys(state.enums)) {
                    if (rooms.includes(room) && stateId.endsWith('.mapIndex')) {
                        mapIndexStates.push(stateId);
                    }
                }
            }
            callback?.(mapIndexStates);
        });
    }

    findChannelsByMapIndex(mapList: unknown[], callback?: (channels: string[]) => void): void {
        this.adapter.getStates('rooms.*', (_error, states) => {
            const channels: string[] = [];
            if (states) {
                for (const [stateId, state] of Object.entries(states)) {
                    if (stateId.endsWith('.mapIndex') && state && mapList.includes(state.val)) {
                        channels.push(stateId.replace(/\.([^.]+)$/, ''));
                    }
                }
            }
            callback?.(channels);
        });
    }

    async createRoom(roomId: string, mapIndex: string | number): Promise<void> {
        this.adapter.log.info(`create new room: ${roomId}`);
        const roomObjectId = `rooms.${roomId}`;
        try {
            await this.adapter.setObjectNotExistsAsync(roomObjectId, {
                type: 'channel',
                common: { name: roomId },
                native: {},
            });
            const commonZone = {
                name: 'map zone',
                type: 'string',
                role: 'value',
                read: false,
                write: false,
                desc: 'coordinates of map zone',
            };
            const commonMap = {
                name: 'map index',
                type: 'number',
                role: 'value',
                read: false,
                write: false,
                desc: 'index of assigned map',
            };
            await this.adapter.setObjectNotExistsAsync(`${roomObjectId}.mapIndex`, {
                type: 'state',
                common: typeof mapIndex === 'string' && mapIndex.startsWith('[') ? commonZone : commonMap,
                native: {},
            });
            await this.adapter.setStateAsync(`${roomObjectId}.mapIndex`, mapIndex, true);
            await this.updateRoomStates(roomObjectId);
        } catch {
            this.adapter.log.warn(`Could not create room objects for ${roomId}`);
        }
    }

    async updateRoomStates(roomObjectId: string): Promise<void> {
        const namespacePrefix = `${this.adapter.namespace}.`;
        const localRoomId = roomObjectId.startsWith(namespacePrefix)
            ? roomObjectId.slice(namespacePrefix.length)
            : roomObjectId;
        try {
            await Promise.all([
                this.adapter.setObjectNotExistsAsync(`${localRoomId}.roomClean`, this.stateRoomClean),
                this.adapter.setObjectNotExistsAsync(`${localRoomId}.state`, this.stateRoomStatus),
                this.adapter.setObjectNotExistsAsync(`${localRoomId}.repeat`, this.stateRoomRepeat),
            ]);
            await this.adapter.setStateAsync(`${localRoomId}.state`, '', true);

            const optionalRoomStates = [
                ['control.fan_power', 'roomFanPower'],
                ['control.water_box_mode', 'roomWaterBoxMode'],
                ['control.water_box_level', 'roomWaterBoxLevel'],
                ['control.mop_mode', 'roomMopMode'],
            ] as const;
            await Promise.all(
                optionalRoomStates.map(async ([sourceId, targetId]) => {
                    const sourceObject = await this.adapter.getObjectAsync(sourceId);
                    if (sourceObject) {
                        await this.adapter.setObjectNotExistsAsync(`${localRoomId}.${targetId}`, {
                            type: 'state',
                            common: sourceObject.common,
                            native: {},
                        });
                    }
                }),
            );
        } catch {
            this.adapter.log.warn(`Could not update room states for ${localRoomId}`);
        }
    }
}

export = RoomManager;

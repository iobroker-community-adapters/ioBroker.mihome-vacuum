import { parseRRMapHeader } from './rrMapHeader';
import type {
    RRMapCoordinate,
    RRMapData,
    RRMapForbiddenZone,
    RRMapHeader,
    RRMapImageBlock,
    RRMapMopPathBlock,
    RRMapPathBlock,
    RRMapPositionBlock,
    RRMapZone,
} from '../types/rrMap';

const DIMENSION_PIXELS = 1024;
const DIMENSION_MM = 50 * 1024;

type RRMapBlock =
    | RRMapImageBlock
    | RRMapPositionBlock
    | RRMapPathBlock
    | RRMapMopPathBlock
    | RRMapZone[]
    | RRMapForbiddenZone[]
    | number[];

type RRMapBlocks = Record<number, RRMapBlock | undefined>;

function getBlock<T extends RRMapBlock>(blocks: RRMapBlocks, type: number): T | undefined {
    return blocks[type] as T | undefined;
}

const TYPES = {
    CHARGER_LOCATION: 1,
    IMAGE: 2,
    PATH: 3,
    GOTO_PATH: 4,
    GOTO_PREDICTED_PATH: 5,
    CURRENTLY_CLEANED_ZONES: 6,
    GOTO_TARGET: 7,
    ROBOT_POSITION: 8,
    FORBIDDEN_ZONES: 9,
    VIRTUAL_WALLS: 10,
    CURRENTLY_CLEANED_BLOCKS: 11,
    NO_MOP_ZONE: 12,
    OBSTACLES: 13,
    IGNORED_OBSTACLES: 14,
    OBSTACLES3: 15,
    IGNORED_OBSTACLES2: 16,
    CARPET_MAP: 17,
    MOP_PATH: 18,
    CARPET_FORBIDDEN: 19,
    SMART_ZONE_PATH_TYPE: 20,
    SMART_ZONE: 21,
    CUSTOM_CARPET: 22,
    CL_FORBIDDEN_ZONES: 23,
    FLOOR_MAP: 24,
    FURNITURES: 25,
    DOCK_TYPE: 26,
    ENEMIES: 27,
    DIGEST: 1024,
} as const;

function PARSEBLOCK(buffer: Buffer, offset: number, result: RRMapBlocks = {}): RRMapBlocks {
    if (buffer.length <= offset) {
        return result;
    }

    const type = buffer.readUInt16LE(offset);
    const headerLength = buffer.readUInt16LE(offset + 0x02);
    const length = buffer.readUInt32LE(offset + 0x04);
    const gen3Offset = headerLength > 24 ? 4 : 0;

    switch (type) {
        case TYPES.ROBOT_POSITION:
        case TYPES.CHARGER_LOCATION:
            result[type] = {
                position: [buffer.readUInt16LE(offset + 0x08), buffer.readUInt16LE(offset + 0x0c)],
                angle: length >= 12 ? buffer.readInt32LE(offset + 0x10) : 0,
            };
            break;

        case TYPES.IMAGE: {
            const image: RRMapImageBlock = {
                segments: {
                    count: gen3Offset ? buffer.readInt32LE(offset + 0x08) : 0,
                    id: [],
                },
                position: {
                    top: buffer.readInt32LE(offset + 0x08 + gen3Offset),
                    left: buffer.readInt32LE(offset + 0x0c + gen3Offset),
                },
                dimensions: {
                    height: buffer.readInt32LE(offset + 0x10 + gen3Offset),
                    width: buffer.readInt32LE(offset + 0x14 + gen3Offset),
                },
                pixels: [],
            };

            image.position.top = DIMENSION_PIXELS - image.position.top - image.dimensions.height;
            if (image.dimensions.height > 0 && image.dimensions.width > 0) {
                const pixels = { floor: [] as number[], obstacle: [] as number[], segments: [] as number[] };
                for (let index = 0; index < length; index++) {
                    const pixel = buffer.readUInt8(offset + 0x18 + gen3Offset + index);
                    switch (pixel & 0x07) {
                        case 0:
                            break;
                        case 1:
                            pixels.obstacle.push(index);
                            break;
                        default: {
                            pixels.floor.push(index);
                            const segment = (pixel & 248) >> 3;
                            if (segment !== 0) {
                                if (!image.segments.id.includes(segment)) {
                                    image.segments.id.push(segment);
                                }
                                pixels.segments.push(index | (segment << 21));
                            }
                        }
                    }
                }
                image.pixels = pixels;
            }
            result[type] = image;
            break;
        }

        case TYPES.CARPET_MAP: {
            const carpet: number[] = [];
            for (let index = 0; index < length; index++) {
                if ((buffer.readUInt8(offset + 0x18 + index) & 0x07) === 1) {
                    carpet.push(index);
                }
            }
            result[type] = carpet;
            break;
        }

        case TYPES.MOP_PATH: {
            const mopPath: RRMapMopPathBlock = [];
            for (let index = 0; index < length; index++) {
                mopPath.push(buffer.readUInt8(offset + 0x14 + index));
            }
            result[type] = mopPath;
            break;
        }

        case TYPES.PATH:
        case TYPES.GOTO_PATH:
        case TYPES.GOTO_PREDICTED_PATH: {
            const points: RRMapCoordinate[] = [];
            for (let index = 0; index < length; index += 4) {
                points.push([buffer.readUInt16LE(offset + 0x14 + index), buffer.readUInt16LE(offset + 0x16 + index)]);
            }
            result[type] = {
                current_angle: buffer.readUInt32LE(offset + 0x10),
                points,
            };
            break;
        }

        case TYPES.GOTO_TARGET:
            result[type] = {
                position: [buffer.readUInt16LE(offset + 0x08), buffer.readUInt16LE(offset + 0x0a)],
            };
            break;

        case TYPES.CURRENTLY_CLEANED_ZONES: {
            const zones: RRMapZone[] = [];
            if (buffer.readUInt32LE(offset + 0x08) > 0) {
                for (let index = 0; index < length; index += 8) {
                    zones.push([
                        buffer.readUInt16LE(offset + 0x0c + index),
                        buffer.readUInt16LE(offset + 0x0e + index),
                        buffer.readUInt16LE(offset + 0x10 + index),
                        buffer.readUInt16LE(offset + 0x12 + index),
                    ]);
                }
                result[type] = zones;
            }
            break;
        }

        case TYPES.FORBIDDEN_ZONES: {
            const zones: RRMapForbiddenZone[] = [];
            if (buffer.readUInt32LE(offset + 0x08) > 0) {
                for (let index = 0; index < length; index += 16) {
                    zones.push([
                        buffer.readUInt16LE(offset + 0x0c + index),
                        buffer.readUInt16LE(offset + 0x0e + index),
                        buffer.readUInt16LE(offset + 0x10 + index),
                        buffer.readUInt16LE(offset + 0x12 + index),
                        buffer.readUInt16LE(offset + 0x14 + index),
                        buffer.readUInt16LE(offset + 0x16 + index),
                        buffer.readUInt16LE(offset + 0x18 + index),
                        buffer.readUInt16LE(offset + 0x1a + index),
                    ]);
                }
                result[type] = zones;
            }
            break;
        }

        case TYPES.VIRTUAL_WALLS: {
            const walls: RRMapZone[] = [];
            if (buffer.readUInt32LE(offset + 0x08) > 0) {
                for (let index = 0; index < length; index += 8) {
                    walls.push([
                        buffer.readUInt16LE(offset + 0x0c + index),
                        buffer.readUInt16LE(offset + 0x0e + index),
                        buffer.readUInt16LE(offset + 0x10 + index),
                        buffer.readUInt16LE(offset + 0x12 + index),
                    ]);
                }
                result[type] = walls;
            }
            break;
        }

        case TYPES.CURRENTLY_CLEANED_BLOCKS: {
            const blocks: number[] = [];
            if (buffer.readUInt32LE(offset + 0x08) > 0) {
                for (let index = 0; index < length; index++) {
                    blocks.push(buffer.readUInt8(offset + 0x0c + index));
                }
                result[type] = blocks;
            }
            break;
        }
    }

    return PARSEBLOCK(buffer, offset + length + headerLength, result);
}

function PARSE(mapBuffer: Buffer | null | undefined): Partial<RRMapHeader> {
    return parseRRMapHeader(mapBuffer);
}

function PARSEDATA(mapBuffer: Buffer | null | undefined): RRMapData | null {
    if (!PARSE(mapBuffer).map_index || !mapBuffer) {
        return null;
    }

    const blocks = PARSEBLOCK(mapBuffer, 0x14);
    const parsed: RRMapData = {};
    const image = getBlock<RRMapImageBlock>(blocks, TYPES.IMAGE);
    if (!image) {
        return parsed;
    }

    parsed.image = image;
    image.pixels.carpet = getBlock<number[]>(blocks, TYPES.CARPET_MAP);

    const paths: ReadonlyArray<
        | { type: typeof TYPES.PATH | typeof TYPES.GOTO_PREDICTED_PATH; name: 'path' | 'goto_predicted_path' }
        | { type: typeof TYPES.MOP_PATH; name: 'mop_path' }
    > = [
        { type: TYPES.PATH, name: 'path' },
        { type: TYPES.GOTO_PREDICTED_PATH, name: 'goto_predicted_path' },
        { type: TYPES.MOP_PATH, name: 'mop_path' },
    ];

    for (const item of paths) {
        const path = getBlock<RRMapPathBlock | RRMapMopPathBlock>(blocks, item.type);
        if (!path) {
            continue;
        }
        if (path.points) {
            path.points = path.points.map(point => {
                point[1] = DIMENSION_MM - point[1];
                return point;
            });
        } else {
            path.points = [];
        }
        if (path.points.length >= 2) {
            const last = path.points[path.points.length - 1];
            const previous = path.points[path.points.length - 2];
            path.current_angle = (Math.atan2(last[1] - previous[1], last[0] - previous[0]) * 180) / Math.PI;
        }
        if (item.name === 'mop_path') {
            parsed.mop_path = path as RRMapMopPathBlock;
        } else if (item.name === 'path') {
            parsed.path = path as RRMapPathBlock;
        } else {
            parsed.goto_predicted_path = path as RRMapPathBlock;
        }
    }

    const charger = getBlock<RRMapPositionBlock>(blocks, TYPES.CHARGER_LOCATION);
    if (charger) {
        parsed.charger = charger.position;
        parsed.charger[1] = DIMENSION_MM - parsed.charger[1];
    }
    const robot = getBlock<RRMapPositionBlock>(blocks, TYPES.ROBOT_POSITION);
    if (robot) {
        parsed.robot = robot.position;
        parsed.robot[1] = DIMENSION_MM - parsed.robot[1];
    }
    const gotoTarget = getBlock<RRMapPositionBlock>(blocks, TYPES.GOTO_TARGET);
    if (gotoTarget) {
        parsed.goto_target = gotoTarget.position;
        parsed.goto_target[1] = DIMENSION_MM - parsed.goto_target[1];
    }

    const cleanedZones = getBlock<RRMapZone[]>(blocks, TYPES.CURRENTLY_CLEANED_ZONES);
    if (cleanedZones) {
        parsed.currently_cleaned_zones = cleanedZones.map(zone => {
            zone[1] = DIMENSION_MM - zone[1];
            zone[3] = DIMENSION_MM - zone[3];
            return zone;
        });
    }
    const forbiddenZones = getBlock<RRMapForbiddenZone[]>(blocks, TYPES.FORBIDDEN_ZONES);
    if (forbiddenZones) {
        parsed.forbidden_zones = forbiddenZones.map(zone => {
            zone[1] = DIMENSION_MM - zone[1];
            zone[3] = DIMENSION_MM - zone[3];
            zone[5] = DIMENSION_MM - zone[5];
            zone[7] = DIMENSION_MM - zone[7];
            return zone;
        });
    }
    const walls = getBlock<RRMapZone[]>(blocks, TYPES.VIRTUAL_WALLS);
    if (walls) {
        parsed.virtual_walls = walls.map(wall => {
            wall[1] = DIMENSION_MM - wall[1];
            wall[3] = DIMENSION_MM - wall[3];
            return wall;
        });
    }
    const cleanedBlocks = getBlock<number[]>(blocks, TYPES.CURRENTLY_CLEANED_BLOCKS);
    if (cleanedBlocks) {
        parsed.currently_cleaned_blocks = cleanedBlocks;
    }

    return parsed;
}

const RRMapParser = Object.assign(function RRMapParser(): void {}, {
    TYPES,
    PARSEBLOCK,
    PARSE,
    PARSEDATA,
});

export = RRMapParser;

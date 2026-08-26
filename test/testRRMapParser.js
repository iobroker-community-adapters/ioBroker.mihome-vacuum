const assert = require('node:assert/strict');
const RRMapParser = require('../build/lib/RRMapParser');
const { parseRRMapHeader } = require('../build/lib/rrMapHeader');

function createBlock(type, headerLength, dataLength, writePayload) {
    const block = Buffer.alloc(headerLength + dataLength);
    block.writeUInt16LE(type, 0x00);
    block.writeUInt16LE(headerLength, 0x02);
    block.writeUInt32LE(dataLength, 0x04);
    writePayload(block);
    return block;
}

function createSyntheticRRMap() {
    const blocks = [
        createBlock(RRMapParser.TYPES.IMAGE, 24, 4, block => {
            block.writeInt32LE(10, 0x08);
            block.writeInt32LE(20, 0x0c);
            block.writeInt32LE(2, 0x10);
            block.writeInt32LE(2, 0x14);
            Buffer.from([1, (3 << 3) | 2, 2, 0]).copy(block, 0x18);
        }),
        createBlock(RRMapParser.TYPES.CARPET_MAP, 24, 4, block => {
            Buffer.from([1, 0, 0, 0]).copy(block, 0x18);
        }),
        createBlock(RRMapParser.TYPES.PATH, 20, 8, block => {
            block.writeUInt32LE(0, 0x10);
            block.writeUInt16LE(100, 0x14);
            block.writeUInt16LE(200, 0x16);
            block.writeUInt16LE(300, 0x18);
            block.writeUInt16LE(400, 0x1a);
        }),
        createBlock(RRMapParser.TYPES.CHARGER_LOCATION, 8, 12, block => {
            block.writeUInt16LE(1000, 0x08);
            block.writeUInt16LE(2000, 0x0c);
            block.writeInt32LE(0, 0x10);
        }),
        createBlock(RRMapParser.TYPES.ROBOT_POSITION, 8, 12, block => {
            block.writeUInt16LE(3000, 0x08);
            block.writeUInt16LE(4000, 0x0c);
            block.writeInt32LE(90, 0x10);
        }),
        createBlock(RRMapParser.TYPES.GOTO_TARGET, 8, 4, block => {
            block.writeUInt16LE(5000, 0x08);
            block.writeUInt16LE(6000, 0x0a);
        }),
        createBlock(RRMapParser.TYPES.CURRENTLY_CLEANED_ZONES, 12, 8, block => {
            block.writeUInt32LE(1, 0x08);
            [100, 200, 300, 400].forEach((value, index) => block.writeUInt16LE(value, 0x0c + index * 2));
        }),
        createBlock(RRMapParser.TYPES.FORBIDDEN_ZONES, 12, 16, block => {
            [1, 2, 3, 4, 5, 6, 7, 8].forEach((value, index) => block.writeUInt16LE(value, 0x0c + index * 2));
            block.writeUInt32LE(1, 0x08);
        }),
        createBlock(RRMapParser.TYPES.VIRTUAL_WALLS, 12, 8, block => {
            block.writeUInt32LE(1, 0x08);
            [10, 20, 30, 40].forEach((value, index) => block.writeUInt16LE(value, 0x0c + index * 2));
        }),
        createBlock(RRMapParser.TYPES.CURRENTLY_CLEANED_BLOCKS, 12, 2, block => {
            block.writeUInt32LE(2, 0x08);
            Buffer.from([7, 9]).copy(block, 0x0c);
        }),
    ];
    const payload = Buffer.concat(blocks);
    const header = Buffer.alloc(0x14);
    header.write('rr', 0, 'ascii');
    header.writeUInt16LE(0x14, 0x02);
    header.writeUInt16LE(payload.length, 0x04);
    header.writeUInt16LE(2, 0x08);
    header.writeUInt16LE(7, 0x0a);
    header.writeUInt16LE(42, 0x0c);
    header.writeUInt16LE(9, 0x10);
    return Buffer.concat([header, payload]);
}

function createGen3PathMap() {
    const blocks = [
        createBlock(RRMapParser.TYPES.IMAGE, 28, 4, block => {
            block.writeInt32LE(2, 0x08);
            block.writeInt32LE(30, 0x0c);
            block.writeInt32LE(40, 0x10);
            block.writeInt32LE(2, 0x14);
            block.writeInt32LE(2, 0x18);
            Buffer.from([(4 << 3) | 2, 1, 0, (5 << 3) | 2]).copy(block, 0x1c);
        }),
        createBlock(RRMapParser.TYPES.CARPET_MAP, 28, 4, block => {
            Buffer.from([1, 1, 0, 0]).copy(block, 0x1c);
        }),
        createBlock(RRMapParser.TYPES.GOTO_PATH, 20, 4, block => {
            block.writeUInt16LE(700, 0x14);
            block.writeUInt16LE(800, 0x16);
        }),
        createBlock(RRMapParser.TYPES.GOTO_PREDICTED_PATH, 20, 8, block => {
            block.writeUInt16LE(900, 0x14);
            block.writeUInt16LE(1000, 0x16);
            block.writeUInt16LE(1100, 0x18);
            block.writeUInt16LE(1200, 0x1a);
        }),
        createBlock(RRMapParser.TYPES.MOP_PATH, 20, 3, block => {
            Buffer.from([1, 2, 3]).copy(block, 0x14);
        }),
    ];
    const payload = Buffer.concat(blocks);
    const header = Buffer.alloc(0x14);
    header.write('rr', 0, 'ascii');
    header.writeUInt16LE(0x14, 0x02);
    header.writeUInt16LE(payload.length, 0x04);
    header.writeUInt16LE(1, 0x0c);
    return Buffer.concat([header, payload]);
}

describe('RR map header parser', () => {
    it('parses the stable RR map header fields', () => {
        const map = Buffer.alloc(0x14);
        map.write('rr', 0, 'ascii');
        map.writeUInt16LE(0x14, 0x02);
        map.writeUInt16LE(128, 0x04);
        map.writeUInt16LE(2, 0x08);
        map.writeUInt16LE(7, 0x0a);
        map.writeUInt16LE(42, 0x0c);
        map.writeUInt16LE(9, 0x10);

        const expectedHeader = {
            header_length: 0x14,
            data_length: 128,
            version: { major: 2, minor: 7 },
            map_index: 42,
            map_sequence: 9,
        };

        assert.deepEqual(RRMapParser.PARSE(map), expectedHeader);
        assert.deepEqual(parseRRMapHeader(map), expectedHeader);
    });

    it('rejects data without an RR map signature', () => {
        assert.deepEqual(RRMapParser.PARSE(Buffer.alloc(0x14)), {});
        assert.deepEqual(parseRRMapHeader(Buffer.alloc(0x14)), {});
        assert.equal(RRMapParser.PARSEDATA(Buffer.alloc(0x14)), null);
        assert.deepEqual(parseRRMapHeader(undefined), {});
        assert.deepEqual(RRMapParser.PARSE(undefined), {});
        assert.equal(RRMapParser.PARSEDATA(undefined), null);
    });

    it('preserves the legacy truncated-signature error contract', () => {
        const truncatedMap = Buffer.from('rr', 'ascii');

        assert.throws(() => RRMapParser.PARSE(truncatedMap), RangeError);
        assert.throws(() => parseRRMapHeader(truncatedMap), RangeError);
    });

    it('freezes the legacy block and coordinate transformation contract', () => {
        const map = createSyntheticRRMap();
        const blocks = RRMapParser.PARSEBLOCK(map, 0x14);

        assert.deepEqual(blocks[RRMapParser.TYPES.IMAGE], {
            segments: { count: 0, id: [3] },
            position: { top: 1012, left: 20 },
            dimensions: { height: 2, width: 2 },
            pixels: { floor: [1, 2], obstacle: [0], segments: [6291457] },
        });
        assert.deepEqual(blocks[RRMapParser.TYPES.CARPET_MAP], [0]);

        assert.deepEqual(RRMapParser.PARSEDATA(map), {
            image: {
                segments: { count: 0, id: [3] },
                position: { top: 1012, left: 20 },
                dimensions: { height: 2, width: 2 },
                pixels: { floor: [1, 2], obstacle: [0], segments: [6291457], carpet: [0] },
            },
            path: {
                current_angle: -45,
                points: [
                    [100, 51000],
                    [300, 50800],
                ],
            },
            charger: [1000, 49200],
            robot: [3000, 47200],
            goto_target: [5000, 45200],
            currently_cleaned_zones: [[100, 51000, 300, 50800]],
            forbidden_zones: [[1, 51198, 3, 51196, 5, 51194, 7, 51192]],
            virtual_walls: [[10, 51180, 30, 51160]],
            currently_cleaned_blocks: [7, 9],
        });
    });

    it('parses generation-3 segments, predicted paths, and mop paths', () => {
        const mopPath = /** @type {number[] & { points: unknown[] }} */ ([1, 2, 3]);
        mopPath.points = [];

        assert.deepEqual(RRMapParser.PARSEDATA(createGen3PathMap()), {
            image: {
                segments: { count: 2, id: [4, 5] },
                position: { top: 992, left: 40 },
                dimensions: { height: 2, width: 2 },
                pixels: {
                    floor: [0, 3],
                    obstacle: [1],
                    segments: [8388608, 10485763],
                    carpet: [],
                },
            },
            goto_predicted_path: {
                current_angle: -45,
                points: [
                    [900, 50200],
                    [1100, 50000],
                ],
            },
            mop_path: mopPath,
        });
    });

    it('rejects invalid and truncated runtime input consistently', () => {
        const invalid = Buffer.alloc(0x14);
        const truncated = Buffer.from('rr', 'ascii');

        assert.deepEqual(RRMapParser.PARSE(invalid), {});
        assert.equal(RRMapParser.PARSEDATA(invalid), null);
        assert.throws(() => RRMapParser.PARSE(truncated), RangeError);
        assert.throws(() => RRMapParser.PARSEDATA(truncated), RangeError);
    });
});

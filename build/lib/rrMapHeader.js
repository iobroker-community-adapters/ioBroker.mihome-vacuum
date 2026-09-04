"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseRRMapHeader = parseRRMapHeader;
/**
 * Parses the stable header fields of an RR map buffer.
 *
 * @param mapBuffer Buffer containing an RR map.
 * @returns Parsed header fields or an empty object for a non-RR buffer.
 */
function parseRRMapHeader(mapBuffer) {
    if (!mapBuffer || mapBuffer[0x00] !== 0x72 || mapBuffer[0x01] !== 0x72) {
        return {};
    }
    return {
        header_length: mapBuffer.readUInt16LE(0x02),
        data_length: mapBuffer.readUInt16LE(0x04),
        version: {
            major: mapBuffer.readUInt16LE(0x08),
            minor: mapBuffer.readUInt16LE(0x0a),
        },
        map_index: mapBuffer.readUInt16LE(0x0c),
        map_sequence: mapBuffer.readUInt16LE(0x10),
    };
}
//# sourceMappingURL=rrMapHeader.js.map
import type { RRMapHeader } from '../types/rrMap';
/**
 * Parses the stable header fields of an RR map buffer.
 *
 * @param mapBuffer Buffer containing an RR map.
 * @returns Parsed header fields or an empty object for a non-RR buffer.
 */
export declare function parseRRMapHeader(mapBuffer: Buffer | null | undefined): Partial<RRMapHeader>;

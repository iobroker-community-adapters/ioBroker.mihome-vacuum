import type { CarpetModeResponse, ParsedCarpetMode } from '../types/carpetModeProtocol';
export declare function isCarpetModeSupported(response: CarpetModeResponse): boolean;
export declare function parseCarpetMode(response: CarpetModeResponse): ParsedCarpetMode | null;

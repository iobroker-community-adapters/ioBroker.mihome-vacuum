import type { CarpetModeResponse, CarpetModeSettings, ParsedCarpetMode } from '../types/carpetModeProtocol';

export function isCarpetModeSupported(response: CarpetModeResponse): boolean {
    return !!response.result && response.result !== 'unknown_method';
}

export function parseCarpetMode(response: CarpetModeResponse): ParsedCarpetMode | null {
    if (response.result) {
        const settings = (response.result as CarpetModeSettings[])[0];
        if (settings.enable === 0 || settings.enable === 1) {
            return {
                enabled: settings.enable === 1,
                settings,
            };
        }
    }
    return null;
}

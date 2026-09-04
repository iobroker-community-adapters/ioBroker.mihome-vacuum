"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCarpetModeSupported = isCarpetModeSupported;
exports.parseCarpetMode = parseCarpetMode;
function isCarpetModeSupported(response) {
    return !!response.result && response.result !== 'unknown_method';
}
function parseCarpetMode(response) {
    if (response.result) {
        const settings = response.result[0];
        if (settings.enable === 0 || settings.enable === 1) {
            return {
                enabled: settings.enable === 1,
                settings,
            };
        }
    }
    return null;
}
//# sourceMappingURL=carpetModeProtocol.js.map
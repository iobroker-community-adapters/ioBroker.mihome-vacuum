"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseWifiSignal = parseWifiSignal;
function parseWifiSignal(response) {
    if (!response.result || response.result === 'unknown_method' || !response.result.rssi) {
        return null;
    }
    return response.result.rssi;
}
//# sourceMappingURL=networkInfoProtocol.js.map
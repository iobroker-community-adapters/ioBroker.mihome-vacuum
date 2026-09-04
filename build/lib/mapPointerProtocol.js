"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseMapPointerResponse = parseMapPointerResponse;
function parseMapPointerResponse(response) {
    if (!response.result) {
        return { action: 'retry' };
    }
    const pointer = response.result[0];
    const parts = pointer.split('%');
    if (parts.length === 1 && pointer.startsWith('map_slot')) {
        return { action: 'stop' };
    }
    if (parts.length === 3) {
        return { action: 'ready', pointer };
    }
    return { action: 'retry' };
}
//# sourceMappingURL=mapPointerProtocol.js.map
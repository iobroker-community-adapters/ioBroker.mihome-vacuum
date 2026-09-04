"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseRoomMapping = parseRoomMapping;
function parseRoomMapping(response) {
    if (response.result && response.result !== 'unknown_method' && response.result.length) {
        return response.result;
    }
    return null;
}
//# sourceMappingURL=roomMappingProtocol.js.map
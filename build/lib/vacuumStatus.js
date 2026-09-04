"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseStatus = parseStatus;
const vacuumProtocol_1 = require("./vacuumProtocol");
function parseStatus(response) {
    const status = response.result[0];
    status.dnd_enabled = status.dnd_enabled === 1;
    status.error_text = vacuumProtocol_1.errorTexts[status.error_code];
    status.in_cleaning = status.in_cleaning === 1;
    status.map_present = status.map_present === 1;
    return status;
}
//# sourceMappingURL=vacuumStatus.js.map
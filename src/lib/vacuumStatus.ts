import { errorTexts } from './vacuumProtocol';
import type { VacuumStatus, VacuumStatusResponse } from '../types/vacuumStatus';

export function parseStatus(response: VacuumStatusResponse): VacuumStatus {
    const status = response.result[0];
    status.dnd_enabled = status.dnd_enabled === 1;
    status.error_text = errorTexts[status.error_code];
    status.in_cleaning = status.in_cleaning === 1;
    status.map_present = status.map_present === 1;
    return status as VacuumStatus;
}

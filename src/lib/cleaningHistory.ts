import type {
    CleaningRecordsResponse,
    CleaningSummaryResponse,
    DisplayCleaningRecord,
    LegacyCleaningRecord,
    LegacyCleaningSummary,
    ModernCleaningRecord,
    ModernCleaningSummary,
    ParsedCleaningRecord,
    ParsedCleaningSummary,
} from '../types/cleaningHistory';

function isModernSummary(result: ModernCleaningSummary | LegacyCleaningSummary): result is ModernCleaningSummary {
    return !Array.isArray(result) && Boolean(result.clean_time);
}

export function parseCleaningSummary(response: CleaningSummaryResponse): ParsedCleaningSummary {
    const result = response.result;

    if (isModernSummary(result)) {
        return {
            clean_time: result.clean_time,
            total_area: result.clean_area,
            num_cleanups: result.clean_count,
            cleaning_record_ids: result.records,
        };
    }
    return {
        clean_time: result[0],
        total_area: result[1],
        num_cleanups: result[2],
        cleaning_record_ids: result[3],
    };
}

export function isEquivalent(first: object, second: object): boolean {
    const firstRecord = first as Record<string, unknown>;
    const secondRecord = second as Record<string, unknown>;
    const firstProperties = Object.getOwnPropertyNames(first);
    const secondProperties = Object.getOwnPropertyNames(second);

    if (firstProperties.length !== secondProperties.length) {
        return false;
    }

    return firstProperties.every(propertyName => firstRecord[propertyName] === secondRecord[propertyName]);
}

function isModernRecord(entry: ModernCleaningRecord | LegacyCleaningRecord): entry is ModernCleaningRecord {
    return !Array.isArray(entry) && Boolean(entry.begin);
}

export function parseCleaningRecords(
    response: CleaningRecordsResponse | null | undefined,
): ParsedCleaningRecord[] | null {
    if (!response?.result) {
        return null;
    }

    return response.result.map(entry => {
        if (isModernRecord(entry)) {
            return {
                start_time: entry.begin,
                end_time: entry.end,
                duration: entry.duration,
                area: entry.area,
                errors: entry.error,
                completed: entry.complete === 1,
                start_type: entry.start_type,
                clean_type: entry.clean_type,
            };
        }
        return {
            start_time: entry[0],
            end_time: entry[1],
            duration: entry[2],
            area: entry[3],
            errors: entry[4],
            completed: entry[5] === 1,
            start_type: entry[6],
            clean_type: entry[7],
        };
    });
}

export function createHtmlTable(cleaningRecords: DisplayCleaningRecord[]): string {
    const tableAttributes =
        '<colgroup> <col width="50"> <col width="50"> <col width="80"> <col width="100"> <col width="50"> <col width="50"> </colgroup>';
    const tableHeader =
        '<tr> <th>Datum</th> <th>Start</th> <th>Saugzeit</th> <th>Fläche</th> <th>???</th> <th>Ende</th></tr>';

    const lines = cleaningRecords
        .map(
            line =>
                `<tr><td>${line.Datum}</td><td>${line.Start}</td><td ALIGN="RIGHT">${line.Saugzeit}</td><td ALIGN="RIGHT">${line['Fläche']}</td><td ALIGN="CENTER">${line.Error}</td><td ALIGN="CENTER">${line.Ende}</td></tr>`,
        )
        .join('');

    return `<table>${tableAttributes}${tableHeader}${lines}</table>`;
}

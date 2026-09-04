import type { CleaningRecordsResponse, CleaningSummaryResponse, DisplayCleaningRecord, ParsedCleaningRecord, ParsedCleaningSummary } from '../types/cleaningHistory';
export declare function parseCleaningSummary(response: CleaningSummaryResponse): ParsedCleaningSummary;
export declare function isEquivalent(first: object, second: object): boolean;
export declare function parseCleaningRecords(response: CleaningRecordsResponse | null | undefined): ParsedCleaningRecord[] | null;
export declare function createHtmlTable(cleaningRecords: DisplayCleaningRecord[]): string;

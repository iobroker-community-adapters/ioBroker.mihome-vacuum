export interface ModernCleaningSummary {
    clean_time: number;
    clean_area: number;
    clean_count: number;
    records: number[];
}

export type LegacyCleaningSummary = [number, number, number, number[]];

export interface CleaningSummaryResponse {
    result: ModernCleaningSummary | LegacyCleaningSummary;
}

export interface ParsedCleaningSummary {
    clean_time: number;
    total_area: number;
    num_cleanups: number;
    cleaning_record_ids: number[];
}

export interface ModernCleaningRecord {
    begin: number;
    end: number;
    duration: number;
    area: number;
    error: number;
    complete: number;
    start_type: number;
    clean_type: number;
}

export type LegacyCleaningRecord = [number, number, number, number, number, number, number, number];

export interface CleaningRecordsResponse {
    result?: Array<ModernCleaningRecord | LegacyCleaningRecord>;
}

export interface ParsedCleaningRecord {
    start_time: number;
    end_time: number;
    duration: number;
    area: number;
    errors: number;
    completed: boolean;
    start_type: number;
    clean_type: number;
}

export interface DisplayCleaningRecord {
    Datum: string;
    Start: string;
    Saugzeit: string;
    Fläche: string;
    Error: number;
    Ende: boolean;
}

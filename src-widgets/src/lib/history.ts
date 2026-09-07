import type { HistoryEntry, StateValue } from './types';

/**
 * Formats a raw history cell for display.
 *
 * @param value - raw cell value
 */
export function displayValue(value: unknown): string {
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : '—';
}

/**
 * Parses the `history.allTableJSON` state of the adapter.
 * Accepts the German column names written by the adapter as well as English ones, and never throws:
 * malformed or absent input yields an empty list so the widget renders its empty state.
 *
 * @param raw - state value (JSON string or already parsed array)
 */
export function parseHistory(raw: StateValue | undefined): HistoryEntry[] {
    if (!raw) {
        return [];
    }
    try {
        const parsed: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!Array.isArray(parsed)) {
            return [];
        }
        return parsed.flatMap((item): HistoryEntry[] => {
            if (!item || typeof item !== 'object') {
                return [];
            }
            const row = item as Record<string, unknown>;
            return [
                {
                    date: displayValue(row.Datum ?? row.date),
                    start: displayValue(row.Start ?? row.start),
                    duration: displayValue(row.Saugzeit ?? row.duration),
                    area: displayValue(row['Fläche'] ?? row.area),
                    completed: Boolean(row.Ende ?? row.completed),
                    error: Number(row.Error ?? row.error ?? 0) || 0,
                },
            ];
        });
    } catch {
        return [];
    }
}

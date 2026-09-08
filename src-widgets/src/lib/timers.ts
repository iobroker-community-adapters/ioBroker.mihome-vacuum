import type { TimerDefinition } from './types';

/** Timer state values as used by the adapter's timer manager. */
export const TIMER_DISABLED = -1;
export const TIMER_SKIP = 0;
export const TIMER_ENABLED = 1;
export const TIMER_START = 2;

/** Minimal shape of a timer state object as returned by the object view. */
export interface TimerObjectLike {
    _id: string;
    type?: string;
    common?: Record<string, unknown>;
    native?: Record<string, unknown>;
}

const TIMER_ID = /^([0-6]*)_(\d{1,2})_(\d{1,2})$/;

/**
 * Builds the timer list from the `timer.*` states of an adapter instance.
 * The ID encodes weekdays, hour and minute; the adapter stores the next run in `common.states['1']`
 * once it has calculated it.
 *
 * @param base - adapter instance, e.g. `mihome-vacuum.0`
 * @param objects - state objects below `<base>.timer`
 */
export function timersFromObjects(base: string, objects: TimerObjectLike[]): TimerDefinition[] {
    const prefix = `${base}.timer.`;
    const timers: TimerDefinition[] = [];
    for (const object of objects) {
        if ((object.type && object.type !== 'state') || !object._id.startsWith(prefix)) {
            continue;
        }
        const id = object._id.slice(prefix.length);
        const match = TIMER_ID.exec(id);
        if (!match) {
            continue;
        }
        const hour = Number(match[2]);
        const minute = Number(match[3]);
        if (hour > 23 || minute > 59) {
            continue;
        }
        const states = object.common?.states;
        const nextRunEntry =
            states && typeof states === 'object' ? (states as Record<string, unknown>)['1'] : undefined;
        const nextRun = typeof nextRunEntry === 'string' && nextRunEntry !== 'enabled' ? nextRunEntry : '';
        const channels = Array.isArray(object.native?.channels)
            ? object.native.channels.filter((channel): channel is string => typeof channel === 'string')
            : [];
        timers.push({
            oid: object._id,
            days: [...new Set(match[1].split('').map(Number))].sort((a, b) => a - b),
            hour,
            minute,
            channels,
            nextRun,
        });
    }
    return timers.sort(
        (a, b) => a.hour - b.hour || a.minute - b.minute || a.days.join('').localeCompare(b.days.join('')),
    );
}

/**
 * Short weekday names for Sunday to Saturday in the widget language, taken from the browser's
 * locale data so the widget needs no extra translations for them.
 *
 * @param language - ioBroker language code
 */
export function weekdayNames(language: string): string[] {
    const fallback = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    try {
        const format = new Intl.DateTimeFormat(language || 'en', { weekday: 'short' });
        // 2023-01-01 was a Sunday.
        return fallback.map((_name, day) => format.format(new Date(2023, 0, 1 + day)));
    } catch {
        return fallback;
    }
}

/**
 * Formats the start time of a timer as `HH:MM`.
 *
 * @param hour - hour of day
 * @param minute - minute
 */
export function formatTimerTime(hour: number, minute: number): string {
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/**
 * Formats the weekdays of a timer, e.g. `Mon Wed Fri`, with the week starting on Monday.
 * Seven days yield the `everyDay` text.
 *
 * @param days - weekdays as `Date.getDay()` numbers
 * @param names - short weekday names for Sunday to Saturday
 * @param everyDay - text used when the timer runs daily
 */
export function formatTimerDays(days: number[], names: string[], everyDay: string): string {
    if (new Set(days).size >= 7) {
        return everyDay;
    }
    const order = [1, 2, 3, 4, 5, 6, 0];
    return order
        .filter(day => days.includes(day))
        .map(day => names[day] ?? String(day))
        .join(' ');
}

import type { TimerAdapter, TimerObject, TimerTranslations } from '../types/timer';
import type { AdapterTimeout } from '../types/adapter';
declare class TimerManager {
    private readonly adapter;
    private readonly i18n;
    static readonly DISABLED = -1;
    static readonly SKIP = 0;
    static readonly ENABLED = 1;
    static readonly START = 2;
    readonly timeouts: Set<AdapterTimeout>;
    nextTimerId: string | null;
    nextProcessTime: Date | null;
    closed: boolean;
    constructor(adapter: TimerAdapter, i18n: TimerTranslations);
    private _setTimeout;
    close(): void;
    check(): void;
    _calcNextProcessTime(timerObject: TimerObject, now: Date, onlyCalculate?: boolean): Date | 0;
    calcNextProcess(): void;
    private selectNextTimer;
}
export = TimerManager;

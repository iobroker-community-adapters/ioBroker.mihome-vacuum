import type { ViomiAdapter, ViomiMiioClient, ViomiState } from '../types/viomi';
import type { AdapterTimeout } from '../types/adapter';
declare class ViomiManager {
    readonly Miio: ViomiMiioClient;
    readonly adapter: ViomiAdapter;
    readonly lastProps: Record<string, unknown>;
    globalTimeouts: Record<string, AdapterTimeout | undefined>;
    closed: boolean;
    readonly ViomiDevices: string[];
    readonly PARAMS: string[];
    readonly ERROR_CODES: Record<number, string>;
    readonly STATES: Record<number, string>;
    readonly FANSPEED: Record<number, string>;
    readonly MODE: Record<number, string>;
    readonly ready: Promise<void>;
    constructor(adapterInstance: ViomiAdapter, Miio: ViomiMiioClient);
    main(): Promise<void>;
    getStates(): Promise<void>;
    initStates(): Promise<void>;
    stateChange(id: string, state: ViomiState | null | undefined): Promise<void>;
    private getActionMode;
    startClean(): void;
    close(): Promise<void>;
}
export = ViomiManager;

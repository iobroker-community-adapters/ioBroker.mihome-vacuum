import type { DisplayCleaningRecord } from '../types/cleaningHistory';
/**
 * @typedef {object} VacuumDeviceState
 * @property {string} modell Detected vacuum model.
 * @property {{ carpetMode: boolean | null, roomMapping: boolean | null }} features Detected feature flags.
 * @property {unknown[]} lastGoto Last go-to coordinates.
 * @property {unknown[][]} lastZone Last zone-clean coordinates.
 * @property {unknown} [firmware] Detected firmware version.
 * @property {unknown[]} [rooms] Detected room mapping.
 */
declare class VacuumManager {
    [property: string]: any;
    constructor(adapterInstance: any, Miio: any);
    main(): Promise<void>;
    init(): Promise<void>;
    delObj(id: any): Promise<void>;
    getStates(): Promise<void>;
    getOnlyAtStart(): Promise<void>;
    getSetNetwork(): Promise<void>;
    getMultiMapsList(): Promise<boolean>;
    checkFeaturesRoomMapping(): Promise<void>;
    getMapPointer(): Promise<void>;
    delay(time: any): Promise<unknown>;
    getMapData(): Promise<void>;
    checkFeaturesCarpet(): Promise<void>;
    setGetCarpetMode(): Promise<void>;
    setGetCleanSummary(): Promise<boolean>;
    parseCleaningSummary(response: any): Promise<any>;
    isEquivalent(a: any, b: any): Promise<any>;
    getLogEntries(logArray: any): Promise<DisplayCleaningRecord[] | undefined>;
    parseCleaningRecords(response: any): Promise<any>;
    createHtmlTable(cleanJSON: any): Promise<any>;
    asyncForEach(array: any, callback: any): Promise<void>;
    setGetSoundVolume(): Promise<void>;
    setGetConsumable(): Promise<boolean>;
    setGetStatus(): Promise<void>;
    parseStatus(response: any): Promise<any>;
    /** Parses the answer of get_room_mapping */
    initStates(): Promise<void>;
    parseGoTo(params: any): Promise<void>;
    stateChange(id: any, state: any): Promise<void>;
    onMessage(obj: any): Promise<any>;
    /**
     * is called, if robot send status
     *
     * @param newVal new status
     */
    setRemoteState(newVal: any): Promise<void>;
    startCleaning(cleanStatus: any, messageObj: any): Promise<boolean>;
    /**
     * Apply fan/water/mop params to the robot before starting a clean.
     * Sends miIO commands directly so equal ioBroker values still reach the device
     * (important after dock/home between queued rooms/repeats).
     *
     * @param messageObj cleaning request object
     */
    applyCleaningParams(messageObj: any): Promise<void>;
    stopCleaning(): Promise<void>;
    clearQueue(): void;
    push(messageObj: any): void;
    updateQueue(): void;
    close(): Promise<any>;
}
export = VacuumManager;

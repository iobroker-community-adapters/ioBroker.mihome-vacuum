declare const utils: any;
export declare class MihomeVacuum extends utils.Adapter {
    constructor(options?: {});
    main(): Promise<void>;
    handleConnect(): Promise<void>;
    advancedDiagnostic(operation: any, details: any): void;
    isUnsupportedFeature(key: any): boolean;
    setUnsupportedFeature(key: any): Promise<void>;
    /**
     * first communication to find out the model
     */
    getModel(): Promise<void>;
    getManager(model: any, configuredManager: any): any;
    /**
     * function to set DeviceInfo
     *
     * @param deviceInfo Model name from Xiaomi eg: viomi.vacuum.v8
     */
    setModelInfoObject(deviceInfo: any): Promise<boolean>;
    /**
     * Function to set the connection indicator
     *
     * @param indicator could be true or false
     */
    setConnection(indicator: any): Promise<void>;
    getModelFromApi(): Promise<any>;
    /**
     * delete async function
     *
     * @param id id
     */
    delObj(id: any): Promise<void>;
    /**
     * Is called when databases are connected and adapter received configuration.
     */
    onReady(): Promise<void>;
    ensureAuthStates(): Promise<void>;
    getTimersForAdmin(): Promise<{
        timers: {
            id: string;
            enabled: boolean;
            day: string[];
            hour: number;
            minute: number;
            channels: string[];
            rooms: string[];
        }[];
        rooms: {
            id: string;
            name: unknown;
        }[];
        channels: {
            id: string | undefined;
            name: unknown;
        }[];
    }>;
    getProtectedConfigStatus(): {
        ok: boolean;
        tokenStored: boolean;
        token: string;
        tokenReadable: boolean;
        passwordStored: boolean;
        cloudSessionStored: boolean;
    };
    saveConfigFromAdmin(message: any): Promise<{
        ok: boolean;
        tokenStored: boolean;
    }>;
    saveTimersFromAdmin(timers: any): Promise<{
        timers: {
            id: string;
            enabled: boolean;
            day: string[];
            hour: number;
            minute: number;
            channels: string[];
            rooms: string[];
        }[];
        rooms: {
            id: string;
            name: unknown;
        }[];
        channels: {
            id: string | undefined;
            name: unknown;
        }[];
    }>;
    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     *
     * @param callback function
     */
    onUnload(callback: any): Promise<void>;
    /**
     * Is called if a subscribed state changes
     *
     * @param id id
     * @param state state
     */
    onStateChange(id: any, state: any): Promise<any>;
    /**
     * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
     * Using this method requires "common.message" property to be set to true in io-package.json
     *
     * @param obj message object
     */
    onMessage(obj: any): Promise<any>;
}
export {};

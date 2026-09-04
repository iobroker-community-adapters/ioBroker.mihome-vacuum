export interface MapCreatorOptions {
    FLOORCOLOR?: string;
    WALLCOLOR?: string;
    PATHCOLOR?: string;
    newmap?: boolean;
    ROBOT?: string;
}
export interface MapCreatorAdapter {
    log: {
        debug(message: string): void;
    };
}

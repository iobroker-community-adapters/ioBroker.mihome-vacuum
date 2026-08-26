export interface AdapterRuntimeObject {
    _id: string;
    type: string;
    common: {
        name: unknown;
        members?: string[];
        [property: string]: unknown;
    };
    native: {
        channels?: string[];
        [property: string]: unknown;
    };
    [property: string]: unknown;
}

export interface RoomEnumObject extends AdapterRuntimeObject {
    common: AdapterRuntimeObject['common'] & { members?: string[] };
}

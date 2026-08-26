export interface RRMapVersion {
    major: number;
    minor: number;
}

export interface RRMapHeader {
    header_length: number;
    data_length: number;
    version: RRMapVersion;
    map_index: number;
    map_sequence: number;
}

export type RRMapCoordinate = [number, number];
export type RRMapZone = [number, number, number, number];
export type RRMapForbiddenZone = [number, number, number, number, number, number, number, number];

export interface RRMapPositionBlock {
    position: RRMapCoordinate;
    angle?: number;
}

export interface RRMapPathBlock {
    current_angle: number;
    points: RRMapCoordinate[];
}

export type RRMapMopPathBlock = number[] & {
    current_angle?: number;
    points?: RRMapCoordinate[];
};

export type RRMapPixels =
    | (number[] & { carpet?: number[] })
    | {
          floor: number[];
          obstacle: number[];
          segments: number[];
          carpet?: number[];
      };

export interface RRMapImageBlock {
    segments: {
        count: number;
        id: number[];
    };
    position: {
        top: number;
        left: number;
    };
    dimensions: {
        height: number;
        width: number;
    };
    pixels: RRMapPixels;
}

export interface RRMapData {
    image?: RRMapImageBlock;
    path?: RRMapPathBlock;
    goto_predicted_path?: RRMapPathBlock;
    mop_path?: RRMapMopPathBlock;
    charger?: RRMapCoordinate;
    robot?: RRMapCoordinate;
    goto_target?: RRMapCoordinate;
    currently_cleaned_zones?: RRMapZone[];
    forbidden_zones?: RRMapForbiddenZone[];
    virtual_walls?: RRMapZone[];
    currently_cleaned_blocks?: number[];
}

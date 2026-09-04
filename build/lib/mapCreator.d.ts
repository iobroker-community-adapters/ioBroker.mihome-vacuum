import { createCanvas, Image } from 'canvas';
import type { MapCreatorAdapter, MapCreatorOptions } from '../types/mapCreator';
declare function rotateCanvas(img: Image, angle: number): ReturnType<typeof createCanvas>;
declare function CanvasMap(Mapdata: any, options: MapCreatorOptions | undefined, adapter: MapCreatorAdapter): ReturnType<typeof createCanvas>;
declare const MapCreator: (() => undefined) & {
    CanvasMap: typeof CanvasMap;
    rotateCanvas: typeof rotateCanvas;
};
export = MapCreator;

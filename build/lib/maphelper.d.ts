import type { MapCreatorModule, MapHelperAdapter, MapHelperConfig, MapUrlResponse } from '../types/mapHelper';
import type { RRMapData } from '../types/rrMap';
interface CloudConnector {
    loggedIn(): boolean;
    executeEncryptedApiCall(url: string, params: {
        data: string;
    }): Promise<unknown>;
    shutdown(): void;
}
interface CachedMapUrl {
    expires: number;
    url: string;
}
type MapResult = [unknown, number[], RRMapData['currently_cleaned_zones'], RRMapData['goto_target']];
declare class MapHelper {
    readonly adapter: MapHelperAdapter;
    ready: boolean;
    shutdownComplete: boolean;
    readonly mapUrlCache: Map<string, CachedMapUrl>;
    mapCreator: MapCreatorModule | null;
    readonly config: MapHelperConfig;
    readonly cloudConnector: CloudConnector;
    constructor(_options: unknown, adapter?: MapHelperAdapter);
    getRawMapData(urlString?: string): Promise<unknown>;
    getMapBase64(url?: string): Promise<MapResult>;
    login(): Promise<{
        ok: true;
    }>;
    updateMap(mapUrl: string, dontRetry?: boolean): Promise<unknown>;
    getMapURL(mapName: string): Promise<MapUrlResponse>;
    shutdown(): Promise<void>;
}
export = MapHelper;

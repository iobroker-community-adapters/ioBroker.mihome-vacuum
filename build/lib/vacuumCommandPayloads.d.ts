import type { GoToParseResult, RemoteMoveParameters, RemoteMovePayload } from '../types/vacuumCommandPayloads';
export declare function parseGoToCoordinates(params: string): GoToParseResult;
export declare function createRemoteMovePayload(params: RemoteMoveParameters): RemoteMovePayload;

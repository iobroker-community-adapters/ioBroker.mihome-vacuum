import type {
    GoToParseResult,
    RemoteMoveCommand,
    RemoteMoveParameters,
    RemoteMovePayload,
} from '../types/vacuumCommandPayloads';

export function parseGoToCoordinates(params: string): GoToParseResult {
    const coordinates = params.split(',');
    if (coordinates.length !== 2) {
        return { coordinates: null, error: 'argument_count' };
    }

    const xValue = coordinates[0];
    const yValue = coordinates[1];
    if (isNaN(Number(yValue)) || isNaN(Number(xValue))) {
        return { coordinates: null, error: 'invalid_coordinate' };
    }

    return {
        coordinates: [parseInt(xValue), parseInt(yValue)],
        error: null,
    };
}

export function createRemoteMovePayload(params: RemoteMoveParameters): RemoteMovePayload {
    const move: [RemoteMoveCommand] = [
        {
            omega: params.angularVelocity,
            velocity: params.velocity,
            seqnum: params.sequenceNumber,
            duration: params.duration,
        },
    ];
    return [move];
}

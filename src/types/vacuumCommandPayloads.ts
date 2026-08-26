export type GoToParseError = 'argument_count' | 'invalid_coordinate';

export type GoToParseResult =
    | { coordinates: [number, number]; error: null }
    | {
          coordinates: null;
          error: GoToParseError;
      };

export interface RemoteMoveParameters {
    angularVelocity: unknown;
    velocity: unknown;
    sequenceNumber: unknown;
    duration: unknown;
}

export interface RemoteMoveCommand {
    omega: unknown;
    velocity: unknown;
    seqnum: unknown;
    duration: unknown;
}

export type RemoteMovePayload = [[RemoteMoveCommand]];

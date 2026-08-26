export interface ConsumableDefinition {
    state: unknown;
    button: unknown;
    calc?: number;
}

export interface ConsumableCommand {
    params?: unknown;
    [property: string]: unknown;
}

export interface DetectedConsumable extends ConsumableDefinition {
    id: string;
    name: string;
}

export type ConsumableValues = Record<string, unknown>;
export type ConsumableDefinitions = Record<string, ConsumableDefinition>;
export type ConsumableCommands = Record<string, ConsumableCommand | undefined>;

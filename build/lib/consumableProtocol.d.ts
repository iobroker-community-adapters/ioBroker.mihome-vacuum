import type { ConsumableCommands, ConsumableDefinitions, ConsumableValues, DetectedConsumable } from '../types/consumableProtocol';
export declare function detectConsumables(consumable: ConsumableValues, definitions: ConsumableDefinitions, commands: ConsumableCommands): DetectedConsumable[];
export declare function calculateConsumableValue(consumable: ConsumableValues, feature: DetectedConsumable): unknown;

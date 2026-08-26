import type {
    ConsumableCommands,
    ConsumableDefinitions,
    ConsumableValues,
    DetectedConsumable,
} from '../types/consumableProtocol';

export function detectConsumables(
    consumable: ConsumableValues,
    definitions: ConsumableDefinitions,
    commands: ConsumableCommands,
): DetectedConsumable[] {
    const detected: DetectedConsumable[] = [];
    for (const id in definitions) {
        const valueParameter = commands[`${id}_reset`]?.params;
        if (typeof valueParameter === 'string' && consumable[valueParameter] != undefined) {
            const definition = definitions[id];
            detected.push({
                id,
                name: valueParameter,
                calc: definition.calc,
                state: definition.state,
                button: definition.button,
            });
        }
    }
    return detected;
}

export function calculateConsumableValue(consumable: ConsumableValues, feature: DetectedConsumable): unknown {
    const value = consumable[feature.name];
    return feature.calc ? 100 - Math.round(Number(value) / feature.calc) : value;
}

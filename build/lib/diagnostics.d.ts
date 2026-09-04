/**
 * Create a bounded diagnostic representation which never exposes credentials or endpoint identifiers.
 *
 * @param value Value to summarize.
 * @param key Parent property name used for sensitivity classification.
 * @param depth Current recursion depth.
 */
export declare function redactDiagnosticValue(value: unknown, key?: string, depth?: number): unknown;
export declare function logAdvancedDiagnostic(logger: {
    debug(message: string): void;
}, enabled: boolean, operation: string, details: unknown): void;

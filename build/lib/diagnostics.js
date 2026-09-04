"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redactDiagnosticValue = redactDiagnosticValue;
exports.logAdvancedDiagnostic = logAdvancedDiagnostic;
const sensitiveKeyPattern = /(?:authorization|bssid|cookie|deviceid|did|homeid|ip|location|loginurl|lp|mac|nonce|password|security|secret|session|ssid|token|uid|url)/i;
const safeStringKeys = new Set(['command', 'manager', 'method', 'model', 'operation', 'region', 'status']);
function summarizeString(key, value) {
    if (isSensitiveKey(key)) {
        return value ? '<redacted:set>' : '<redacted:empty>';
    }
    if (safeStringKeys.has(key.toLowerCase())) {
        return value.slice(0, 120);
    }
    return `<string:${value.length}>`;
}
function isSensitiveKey(key) {
    return sensitiveKeyPattern.test(key) || /^(?:id|dids|pid)$/i.test(key);
}
/**
 * Create a bounded diagnostic representation which never exposes credentials or endpoint identifiers.
 *
 * @param value Value to summarize.
 * @param key Parent property name used for sensitivity classification.
 * @param depth Current recursion depth.
 */
function redactDiagnosticValue(value, key = '', depth = 0) {
    if (isSensitiveKey(key)) {
        return value ? '<redacted:set>' : '<redacted:empty>';
    }
    if (value === null || value === undefined || typeof value === 'boolean' || typeof value === 'number') {
        return value;
    }
    if (typeof value === 'string') {
        return summarizeString(key, value);
    }
    if (Array.isArray(value)) {
        return {
            type: 'array',
            length: value.length,
            sample: depth < 3 ? value.slice(0, 3).map(entry => redactDiagnosticValue(entry, '', depth + 1)) : [],
        };
    }
    if (typeof value === 'object') {
        if (depth >= 4) {
            return { type: 'object', keys: Object.keys(value).sort() };
        }
        return Object.fromEntries(Object.entries(value)
            .slice(0, 80)
            .map(([entryKey, entryValue]) => [entryKey, redactDiagnosticValue(entryValue, entryKey, depth + 1)]));
    }
    return `<${typeof value}>`;
}
function logAdvancedDiagnostic(logger, enabled, operation, details) {
    if (!enabled) {
        return;
    }
    logger.debug(`Advanced diagnostics: ${operation} ${JSON.stringify(redactDiagnosticValue(details))}`);
}
//# sourceMappingURL=diagnostics.js.map
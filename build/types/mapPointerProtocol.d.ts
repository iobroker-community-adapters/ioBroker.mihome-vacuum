export interface MapPointerResponse {
    result?: unknown;
}
export type MapPointerResult = {
    action: 'retry';
} | {
    action: 'stop';
} | {
    action: 'ready';
    pointer: string;
};

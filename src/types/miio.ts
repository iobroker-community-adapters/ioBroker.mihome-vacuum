export interface MiioDeviceError {
    code: number;
    message: string;
}

export type MiioResponse<TResult = unknown> =
    { id: number; result: TResult; error?: never } | { id: number; error: MiioDeviceError; result?: never };

export type MiioTransportErrorCode =
    | 'MIIO_CLOSED'
    | 'MIIO_NOT_CONNECTED'
    | 'MIIO_SOCKET_CLOSED'
    | 'MIIO_INVALID_RESPONSE'
    | 'MIIO_SEND_FAILED'
    | 'MIIO_TIMEOUT'
    | 'MIIO_REQUEST_FAILED';

export interface StockCommand {
    method: string;
    params?: string;
}

import type { GenericAppState } from '@iobroker/gui-components/build/types';

export type CloudAuthStatus =
    'not_authenticated' | 'waiting_for_scan' | 'waiting_for_confirmation' | 'authenticated' | 'expired' | 'error';

export interface CloudAuthState {
    status: CloudAuthStatus;
    loginUrl: string;
    lastError: string;
    expiresAt: number;
}

export interface DiscoveredDevice {
    token: string;
    localip: string;
    model: string;
}

export interface VacuumNative extends Record<string, unknown> {
    email: string;
    password: string;
    server: string;
    token: string;
    ip: string;
    model: string;
    manager: string;
    enableMiMap: boolean;
    enableSelfCommands: boolean;
    enableAdvancedDebug: boolean;
    sendPauseBeforeHome: boolean;
    enableResumeZone: boolean;
    port: number;
    ownPort: number;
    pingInterval: number;
    wifiInterval: number;
    valetudo_enable: boolean;
    valetudo_color_floor: string;
    valetudo_color_wall: string;
    valetudo_color_path: string;
    robot_select: string;
    valetudo_requestIntervall: number;
    valetudo_MapsaveIntervall: number;
    newmap: boolean;
}

export interface VacuumAdminState extends GenericAppState {
    native: VacuumNative;
    auth: CloudAuthState;
    discoveredDevices: DiscoveredDevice[];
    selectedDevice: number | '';
    authBusy: boolean;
    discoveryBusy: boolean;
    timers: AdminTimer[];
    timerRooms: TimerOption[];
    timerChannels: TimerOption[];
    timersLoading: boolean;
    timersSaving: boolean;
    timersDirty: boolean;
    tokenVisible: boolean;
    tokenStored: boolean;
    tokenDeleteRequested: boolean;
    confirmTokenDelete: boolean;
}

export interface ProtectedConfigStatus {
    ok?: boolean;
    tokenStored?: boolean;
    token?: string;
    tokenReadable?: boolean;
    passwordStored?: boolean;
    cloudSessionStored?: boolean;
}

export interface ConfigSaveResult {
    ok?: boolean;
    tokenStored?: boolean;
    error?: {
        code?: string;
        message?: string;
    };
}

export interface AdminTimer {
    id?: string;
    enabled: boolean;
    day: string[];
    hour: number;
    minute: number;
    rooms: string[];
    channels: string[];
}

export interface TimerOption {
    id: string;
    name: ioBroker.StringOrTranslated;
}

export interface TimerAdminResult {
    err?: string;
    timers?: AdminTimer[];
    rooms?: TimerOption[];
    channels?: TimerOption[];
}

export interface DiscoveryHome {
    result?: {
        device_info?: unknown;
    };
}

export interface DiscoveryResult extends Record<string, unknown> {
    err?: string;
}

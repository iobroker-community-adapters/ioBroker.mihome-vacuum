import type React from 'react';

/** Value of an ioBroker state as delivered by the VIS 2 runtime. */
export type StateValue = string | number | boolean | null;

/** All configurable attributes of the widget (see `getWidgetInfo`). */
export interface VacuumControlData {
    title: string;
    showMap: boolean;
    showMaintenance: boolean;
    showHistory: boolean;
    accentColor: string;
    mapOid: string;
    connectionOid: string;
    stateOid: string;
    batteryOid: string;
    areaOid: string;
    timeOid: string;
    errorOid: string;
    fanOid: string;
    startOid: string;
    pauseOid: string;
    homeOid: string;
    findOid: string;
    filterOid: string;
    filterResetOid: string;
    mainBrushOid: string;
    mainBrushResetOid: string;
    sideBrushOid: string;
    sideBrushResetOid: string;
    sensorsOid: string;
    sensorsResetOid: string;
    waterFilterOid: string;
    waterFilterResetOid: string;
    mopPadOid: string;
    mopPadResetOid: string;
    strainerOid: string;
    strainerResetOid: string;
    cleaningBrushOid: string;
    cleaningBrushResetOid: string;
    dustCollectionOid: string;
    dustCollectionResetOid: string;
    historyJsonOid: string;
    historyTotalAreaOid: string;
    historyTotalTimeOid: string;
    historyTotalCleanupsOid: string;
    historyLimit: number;
    roomsAuto: boolean;
    room1Name: string;
    room1StartOid: string;
    room1FanOid: string;
    room2Name: string;
    room2StartOid: string;
    room2FanOid: string;
    room3Name: string;
    room3StartOid: string;
    room3FanOid: string;
    room4Name: string;
    room4StartOid: string;
    room4FanOid: string;
    room5Name: string;
    room5StartOid: string;
    room5FanOid: string;
    room6Name: string;
    room6StartOid: string;
    room6FanOid: string;
    fanQuiet: number;
    fanBalanced: number;
    fanTurbo: number;
}

export interface HistoryEntry {
    date: string;
    start: string;
    duration: string;
    area: string;
    completed: boolean;
    error: number;
}

export interface ConsumableDefinition {
    key: string;
    label: string;
    oid: string;
    resetOid: string;
    icon: React.ReactNode;
    /** Counters count up (usage) instead of down (remaining percent). */
    counter?: boolean;
}

export interface ConsumableItem extends ConsumableDefinition {
    value: StateValue | undefined;
}

export interface RoomDefinition {
    key: string;
    name: string;
    startOid: string;
    fanOid: string;
}

export interface RoomItem extends RoomDefinition {
    fan: StateValue | undefined;
}

export interface FanOption {
    value: number;
    label: string;
}

/** `common.states` of a state object: value (as string key) to label. */
export type StateCatalog = Record<string, string>;

export type ContainerSize = 'narrow' | 'medium' | 'wide';

import React from 'react';

import type {
    RxRenderWidgetProps,
    RxWidgetInfo,
    RxWidgetInfoAttributesField,
    VisRxWidgetState,
    WidgetData,
} from '@iobroker/types-vis-2';
import type VisRxWidget from '@iobroker/types-vis-2/visRxWidget';

import { Dashboard } from './components/Dashboard';
import { AUTO_FILL_FIELDS, DEFAULT_BASE, collectInstanceChanges, instanceBaseFromId } from './lib/autofill';
import { createText, type TextFunction } from './lib/i18n';
import { roomsFromAttributes, roomsFromObjects } from './lib/rooms';
import type { RoomDefinition, StateCatalog, StateValue, VacuumControlData } from './lib/types';

interface WidgetState extends Partial<VisRxWidgetState> {
    catalogs: { state?: StateCatalog; error?: StateCatalog; fan?: StateCatalog };
    autoRooms: RoomDefinition[];
    roomFans: Record<string, StateValue | undefined>;
}

type SocketLike = {
    getObjectsById: (ids: string[]) => Promise<Record<string, ioBroker.Object> | undefined>;
    getObjectViewSystem: (
        type: string,
        start: string,
        end: string,
    ) => Promise<Record<string, ioBroker.Object> | undefined>;
    getState: (id: string) => Promise<ioBroker.State | null | undefined>;
    setState: (id: string, value: StateValue) => Promise<void>;
    subscribeState: (id: string | string[], cb: ioBroker.StateChangeHandler) => Promise<void>;
    unsubscribeState: (id: string | string[], cb?: ioBroker.StateChangeHandler) => void;
};

/**
 * Fills all empty (or still default) state attributes from the instance of the selected state,
 * so choosing `mihome-vacuum.1.info.state` configures the whole widget for instance 1.
 *
 * @param _field - the changed attribute (always `stateOid`)
 * @param data - current widget attributes
 * @param changeData - callback that stores the updated attributes
 * @param socket - socket of the VIS editor
 * @param socket.getObjectsById - reads objects by ID, used to check that the target states exist
 */
async function fillFromInstance(
    _field: RxWidgetInfoAttributesField,
    data: WidgetData,
    changeData: (newData: WidgetData) => void,
    socket: { getObjectsById: SocketLike['getObjectsById'] },
): Promise<void> {
    const base = instanceBaseFromId(typeof data.stateOid === 'string' ? data.stateOid : '');
    if (!base) {
        return;
    }
    const ids = AUTO_FILL_FIELDS.map(([, suffix]) => `${base}.${suffix}`);
    const objects = (await socket.getObjectsById(ids)) ?? {};
    const changes = collectInstanceChanges(data, base, id => Boolean(objects[id]));
    if (Object.keys(changes).length) {
        changeData({ ...data, ...changes });
    }
}

function catalogOf(object: ioBroker.Object | undefined): StateCatalog | undefined {
    const states = (object as ioBroker.StateObject | undefined)?.common?.states;
    if (!states || typeof states !== 'object' || Array.isArray(states)) {
        return undefined;
    }
    return states;
}

export default class VacuumControlWidget extends (window.visRxWidget as typeof VisRxWidget<
    VacuumControlData,
    WidgetState
>) {
    private unmounted = false;
    private subscribedFans: string[] = [];
    private metaVersion = 0;
    private text: TextFunction = createText('en');
    private textLanguage = '';

    static getWidgetInfo(): RxWidgetInfo {
        const id = (suffix: string): string => `${DEFAULT_BASE}.${suffix}`;
        const text = createText(VacuumControlWidget.getLanguage());
        const manualRoom = (index: number): RxWidgetInfoAttributesField[] => [
            {
                name: `room${index}Name`,
                type: 'text',
                label: `room${index}Name`,
                default: '',
                hidden: 'data.roomsAuto',
            },
            { name: `room${index}StartOid`, type: 'id', label: 'roomStartOid', hidden: 'data.roomsAuto' },
            { name: `room${index}FanOid`, type: 'id', label: 'roomFanOid', hidden: 'data.roomsAuto' },
        ];
        return {
            id: 'tplMihomeVacuumControl',
            visSet: 'mihome-vacuum',
            visSetIcon: 'widgets/mihome-vacuum/img/vacuum.png',
            visSetLabel: text('mihome_vacuum_widget_set'),
            visSetColor: '#42a5f5',
            visName: text('mihome_vacuum_widget'),
            visPrev: 'widgets/mihome-vacuum/img/previewControl.png',
            visAttrs: [
                {
                    name: 'common',
                    fields: [
                        { name: 'title', type: 'text', label: 'title', default: '' },
                        { name: 'showMap', type: 'checkbox', label: 'showMap', default: true },
                        { name: 'showMaintenance', type: 'checkbox', label: 'showMaintenance', default: true },
                        { name: 'showHistory', type: 'checkbox', label: 'showHistory', default: true },
                        { name: 'accentColor', type: 'color', label: 'accentColor', default: '' },
                    ],
                },
                {
                    name: 'states',
                    label: 'states',
                    fields: [
                        {
                            name: 'stateOid',
                            type: 'id',
                            label: 'stateOid',
                            default: id('info.state'),
                            tooltip: 'stateOidTooltip',
                            onChange: fillFromInstance,
                        },
                        { name: 'mapOid', type: 'id', label: 'mapOid', default: id('cleanmap.map64') },
                        { name: 'connectionOid', type: 'id', label: 'connectionOid', default: id('info.connection') },
                        { name: 'batteryOid', type: 'id', label: 'batteryOid', default: id('info.battery') },
                        { name: 'areaOid', type: 'id', label: 'areaOid', default: id('info.cleanedarea') },
                        { name: 'timeOid', type: 'id', label: 'timeOid', default: id('info.cleanedtime') },
                        { name: 'errorOid', type: 'id', label: 'errorOid', default: id('info.error') },
                        { name: 'fanOid', type: 'id', label: 'fanOid', default: id('control.fan_power') },
                        { name: 'startOid', type: 'id', label: 'startOid', default: id('control.start') },
                        { name: 'pauseOid', type: 'id', label: 'pauseOid', default: id('control.pause') },
                        { name: 'homeOid', type: 'id', label: 'homeOid', default: id('control.home') },
                        { name: 'findOid', type: 'id', label: 'findOid', default: id('control.find') },
                        { name: 'fanQuiet', type: 'number', label: 'fanQuiet', default: 101 },
                        { name: 'fanBalanced', type: 'number', label: 'fanBalanced', default: 102 },
                        { name: 'fanTurbo', type: 'number', label: 'fanTurbo', default: 104 },
                    ],
                },
                {
                    name: 'maintenance',
                    label: 'maintenance',
                    fields: [
                        { name: 'filterOid', type: 'id', label: 'filterOid', default: id('consumable.filter') },
                        {
                            name: 'filterResetOid',
                            type: 'id',
                            label: 'filterResetOid',
                            default: id('consumable.filter_reset'),
                        },
                        {
                            name: 'mainBrushOid',
                            type: 'id',
                            label: 'mainBrushOid',
                            default: id('consumable.main_brush'),
                        },
                        {
                            name: 'mainBrushResetOid',
                            type: 'id',
                            label: 'mainBrushResetOid',
                            default: id('consumable.main_brush_reset'),
                        },
                        {
                            name: 'sideBrushOid',
                            type: 'id',
                            label: 'sideBrushOid',
                            default: id('consumable.side_brush'),
                        },
                        {
                            name: 'sideBrushResetOid',
                            type: 'id',
                            label: 'sideBrushResetOid',
                            default: id('consumable.side_brush_reset'),
                        },
                        { name: 'sensorsOid', type: 'id', label: 'sensorsOid', default: id('consumable.sensors') },
                        {
                            name: 'sensorsResetOid',
                            type: 'id',
                            label: 'sensorsResetOid',
                            default: id('consumable.sensors_reset'),
                        },
                        {
                            name: 'waterFilterOid',
                            type: 'id',
                            label: 'waterFilterOid',
                            default: id('consumable.water_filter'),
                        },
                        {
                            name: 'waterFilterResetOid',
                            type: 'id',
                            label: 'waterFilterResetOid',
                            default: id('consumable.water_filter_reset'),
                        },
                        { name: 'mopPadOid', type: 'id', label: 'mopPadOid', default: id('consumable.mop_pad') },
                        {
                            name: 'mopPadResetOid',
                            type: 'id',
                            label: 'mopPadResetOid',
                            default: id('consumable.mop_pad_reset'),
                        },
                        { name: 'strainerOid', type: 'id', label: 'strainerOid', default: id('consumable.strainer') },
                        {
                            name: 'strainerResetOid',
                            type: 'id',
                            label: 'strainerResetOid',
                            default: id('consumable.strainer_reset'),
                        },
                        {
                            name: 'cleaningBrushOid',
                            type: 'id',
                            label: 'cleaningBrushOid',
                            default: id('consumable.cleaning_brush'),
                        },
                        {
                            name: 'cleaningBrushResetOid',
                            type: 'id',
                            label: 'cleaningBrushResetOid',
                            default: id('consumable.cleaning_brush_reset'),
                        },
                        {
                            name: 'dustCollectionOid',
                            type: 'id',
                            label: 'dustCollectionOid',
                            default: id('consumable.dust_collection'),
                        },
                        {
                            name: 'dustCollectionResetOid',
                            type: 'id',
                            label: 'dustCollectionResetOid',
                            default: id('consumable.dust_collection_reset'),
                        },
                    ],
                },
                {
                    name: 'rooms',
                    label: 'rooms',
                    fields: [
                        {
                            name: 'roomsAuto',
                            type: 'checkbox',
                            label: 'roomsAuto',
                            default: true,
                            tooltip: 'roomsAutoTooltip',
                        },
                        ...manualRoom(1),
                        ...manualRoom(2),
                        ...manualRoom(3),
                        ...manualRoom(4),
                        ...manualRoom(5),
                        ...manualRoom(6),
                    ],
                },
                {
                    name: 'history',
                    label: 'history',
                    fields: [
                        {
                            name: 'historyJsonOid',
                            type: 'id',
                            label: 'historyJsonOid',
                            default: id('history.allTableJSON'),
                        },
                        {
                            name: 'historyTotalAreaOid',
                            type: 'id',
                            label: 'historyTotalAreaOid',
                            default: id('history.total_area'),
                        },
                        {
                            name: 'historyTotalTimeOid',
                            type: 'id',
                            label: 'historyTotalTimeOid',
                            default: id('history.total_time'),
                        },
                        {
                            name: 'historyTotalCleanupsOid',
                            type: 'id',
                            label: 'historyTotalCleanupsOid',
                            default: id('history.total_cleanups'),
                        },
                        { name: 'historyLimit', type: 'number', label: 'historyLimit', default: 12, min: 1, max: 200 },
                    ],
                },
            ],
            visDefaultStyle: { width: 1280, height: 800 },
        };
    }

    getWidgetInfo(): RxWidgetInfo {
        return VacuumControlWidget.getWidgetInfo();
    }

    static getI18nPrefix(): string {
        return 'mihome_vacuum_';
    }

    /**
     * `setState` of the VIS base class is typed for the full runtime state; the widget only patches its own fields.
     *
     * @param updater - returns the fields to change based on the previous state
     */
    private patchState(updater: (previous: WidgetState) => Partial<WidgetState>): void {
        (this.setState as unknown as (fn: (previous: WidgetState) => Partial<WidgetState>) => void)(updater);
    }

    private get socket(): SocketLike {
        return this.props.context.socket as unknown as SocketLike;
    }

    componentDidMount(): void {
        super.componentDidMount();
        void this.refreshMeta();
    }

    onRxDataChanged(prevRxData: typeof this.state.rxData): void {
        super.onRxDataChanged(prevRxData);
        void this.refreshMeta();
    }

    componentWillUnmount(): void {
        this.unmounted = true;
        this.unsubscribeFans();
        super.componentWillUnmount();
    }

    /**
     * Reads the `common.states` catalogues of the state, error and fan objects and discovers the
     * rooms of the adapter instance. Runs on mount and whenever the widget attributes change.
     */
    private async refreshMeta(): Promise<void> {
        const version = ++this.metaVersion;
        const data = this.state.rxData;
        const ids = [data.stateOid, data.errorOid, data.fanOid].filter(Boolean);
        let objects: Record<string, ioBroker.Object> = {};
        try {
            objects = (ids.length ? await this.socket.getObjectsById(ids) : undefined) ?? {};
        } catch (error) {
            window.console.warn(`mihome-vacuum widget: cannot read state objects: ${String(error)}`);
        }
        let autoRooms: RoomDefinition[] = [];
        if (data.roomsAuto !== false) {
            autoRooms = await this.discoverRooms(instanceBaseFromId(data.stateOid));
        }
        if (this.unmounted || version !== this.metaVersion) {
            return;
        }
        this.patchState(() => ({
            catalogs: {
                state: catalogOf(objects[data.stateOid]),
                error: catalogOf(objects[data.errorOid]),
                fan: catalogOf(objects[data.fanOid]),
            },
            autoRooms,
        }));
        await this.subscribeFans(autoRooms.map(room => room.fanOid).filter(Boolean));
    }

    private async discoverRooms(base: string): Promise<RoomDefinition[]> {
        if (!base) {
            return [];
        }
        try {
            const start = `${base}.rooms.`;
            const end = `${base}.rooms.香`;
            const [channels, states] = await Promise.all([
                this.socket.getObjectViewSystem('channel', start, end),
                this.socket.getObjectViewSystem('state', start, end),
            ]);
            return roomsFromObjects(
                base,
                Object.values(channels ?? {}),
                Object.keys(states ?? {}),
                VacuumControlWidget.getLanguage(),
            );
        } catch (error) {
            window.console.warn(`mihome-vacuum widget: cannot discover rooms: ${String(error)}`);
            return [];
        }
    }

    /**
     * The room fan states are not part of the widget attributes, so they need their own subscription.
     *
     * @param id - state ID
     * @param state - new state or null when deleted
     */
    private readonly onRoomFan: ioBroker.StateChangeHandler = (id, state) => {
        if (this.unmounted) {
            return;
        }
        const value = (state?.val ?? undefined) as StateValue | undefined;
        this.patchState(previous => ({ roomFans: { ...(previous.roomFans ?? {}), [id]: value } }));
    };

    private async subscribeFans(ids: string[]): Promise<void> {
        const wanted = [...new Set(ids)].sort();
        if (wanted.join('|') === this.subscribedFans.join('|')) {
            return;
        }
        this.unsubscribeFans();
        if (!wanted.length) {
            return;
        }
        this.subscribedFans = wanted;
        try {
            await this.socket.subscribeState(wanted, this.onRoomFan);
            const values = await Promise.all(wanted.map(id => this.socket.getState(id).catch(() => null)));
            if (this.unmounted) {
                return;
            }
            const roomFans: Record<string, StateValue | undefined> = {};
            wanted.forEach((id, index) => {
                roomFans[id] = values[index]?.val ?? undefined;
            });
            this.patchState(previous => ({ roomFans: { ...(previous.roomFans ?? {}), ...roomFans } }));
        } catch (error) {
            window.console.warn(`mihome-vacuum widget: cannot subscribe room states: ${String(error)}`);
        }
    }

    private unsubscribeFans(): void {
        if (this.subscribedFans.length) {
            try {
                this.socket.unsubscribeState(this.subscribedFans, this.onRoomFan);
            } catch {
                // the socket may already be gone during unmount
            }
            this.subscribedFans = [];
        }
    }

    private write = (oid: string, value: StateValue): void => {
        if (!oid || this.props.editMode) {
            return;
        }
        this.socket.setState(oid, value).catch((error: unknown) => {
            window.console.warn(
                `Cannot write vacuum state ${oid}: ${error instanceof Error ? error.message : String(error)}`,
            );
        });
    };

    renderWidgetBody(props: RxRenderWidgetProps): React.JSX.Element {
        super.renderWidgetBody(props);
        const language = VacuumControlWidget.getLanguage();
        if (language !== this.textLanguage) {
            this.textLanguage = language;
            this.text = createText(language);
        }
        const data = this.state.rxData;
        const rooms = data.roomsAuto !== false ? (this.state.autoRooms ?? []) : roomsFromAttributes(data);
        return (
            <Dashboard
                data={data}
                values={this.state.values as Record<string, StateValue | undefined>}
                catalogs={this.state.catalogs ?? {}}
                rooms={rooms}
                roomFans={this.state.roomFans ?? {}}
                language={language}
                text={this.text}
                editMode={this.props.editMode}
                write={this.write}
            />
        );
    }
}

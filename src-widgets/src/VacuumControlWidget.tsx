import React from 'react';
import BatteryFullIcon from '@mui/icons-material/BatteryFull';
import BuildCircleIcon from '@mui/icons-material/BuildCircle';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import HistoryIcon from '@mui/icons-material/History';
import HomeIcon from '@mui/icons-material/Home';
import LocationSearchingIcon from '@mui/icons-material/LocationSearching';
import MapIcon from '@mui/icons-material/Map';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import ScheduleIcon from '@mui/icons-material/Schedule';
import SquareFootIcon from '@mui/icons-material/SquareFoot';
import TuneIcon from '@mui/icons-material/Tune';
import {
    Box,
    Button,
    Chip,
    FormControl,
    IconButton,
    LinearProgress,
    MenuItem,
    Select,
    Tooltip,
    Typography,
} from '@mui/material';
import type { RxRenderWidgetProps, RxWidgetInfo } from '@iobroker/types-vis-2';
import type VisRxWidget from '@iobroker/types-vis-2/visRxWidget';
import translations from './translations';

interface VacuumControlData {
    title: string;
    showMap: boolean;
    showMaintenance: boolean;
    showHistory: boolean;
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

type StateValue = string | number | boolean | null;

interface HistoryEntry {
    date: string;
    start: string;
    duration: string;
    area: string;
    completed: boolean;
    error: number;
}

interface Consumable {
    key: string;
    label: string;
    oid: string;
    resetOid: string;
    icon: React.ReactNode;
    counter?: boolean;
}

interface RoomDefinition {
    key: string;
    name: string;
    startOid: string;
    fanOid: string;
}

const DEFAULT_BASE = 'mihome-vacuum.0';
type WidgetTextKey = keyof typeof translations.en;

function text(key: WidgetTextKey): string {
    const language = VacuumControlWidget.getLanguage();
    const dictionary = translations[language as keyof typeof translations] || translations.en;
    return dictionary[key];
}

const VACUUM_STATES: Record<number, string> = {
    0: 'Unknown',
    1: 'Initiating',
    2: 'Sleeping',
    3: 'Waiting',
    5: 'Cleaning',
    6: 'Returning to dock',
    7: 'Manual mode',
    8: 'Charging',
    9: 'Charging error',
    10: 'Paused',
    11: 'Spot cleaning',
    12: 'Error',
    13: 'Shutting down',
    14: 'Updating',
    15: 'Docking',
    16: 'Going to spot',
    17: 'Zone cleaning',
    18: 'Room cleaning',
    22: 'Dust collecting',
    23: 'Mop cleaning',
    26: 'Going to mop cleaning',
    27: 'Mop cleaning paused',
    28: 'Drying mop',
    29: 'Washing mop',
    30: 'Mopping',
    31: 'Cleaning and mopping',
    32: 'Remote cleaning',
    33: 'Inspecting water',
    34: 'Charging complete',
    35: 'Building map',
};
const VACUUM_STATES_DE: Record<number, string> = {
    0: 'Unbekannt',
    1: 'Wird gestartet',
    2: 'Schläft',
    3: 'Wartet',
    5: 'Reinigt',
    6: 'Fährt zur Ladestation',
    7: 'Manueller Modus',
    8: 'Wird geladen',
    9: 'Ladefehler',
    10: 'Pausiert',
    11: 'Punktreinigung',
    12: 'Fehler',
    13: 'Wird ausgeschaltet',
    14: 'Wird aktualisiert',
    15: 'Dockt an',
    16: 'Fährt zum Ziel',
    17: 'Zonenreinigung',
    18: 'Raumreinigung',
    22: 'Staub wird abgesaugt',
    23: 'Mopp wird gereinigt',
    26: 'Fährt zur Moppreinigung',
    27: 'Moppreinigung pausiert',
    28: 'Mopp wird getrocknet',
    29: 'Mopp wird gewaschen',
    30: 'Wischt',
    31: 'Reinigt und wischt',
    32: 'Fernreinigung',
    33: 'Wasserprüfung',
    34: 'Vollständig geladen',
    35: 'Karte wird erstellt',
};
const VACUUM_ERRORS = [
    'No error',
    'Laser distance sensor error',
    'Collision sensor error',
    'Wheels on top of void, move robot',
    'Clean hovering sensors, move robot',
    'Clean main brush',
    'Clean side brush',
    'Main wheel stuck?',
    'Device stuck, clean area',
    'Dust collector missing',
    'Clean filter',
    'Stuck in magnetic barrier',
    'Low battery',
    'Charging fault',
    'Battery fault',
    'Wall sensors dirty, wipe them',
    'Place me on flat surface',
    'Side brushes problem, reboot me',
    'Suction fan problem',
    'Unpowered charging station',
    'Remove Mop',
    'Clean Mop Pad',
    'Fresh Water Tank Dry',
    'DROP',
    'UNKNOWN',
    'CLIFF',
    'GESTURE',
    'BUMPER_REPEAT',
    'DROP_REPEAT',
    'OPTICAL_FLOW',
    'BOX',
    'TANKBOX',
    'WATERBOX_EMPTY',
    'BOX_FULL',
    'LEFT_WHEEL_MOTOR',
    'RIGHT_WHEEL_MOTOR',
    'TURN_SUFFOCATE',
    'FORWARD_SUFFOCATE',
    'CHARGER_GET',
    'BATTERY_PERCENTAGE',
    'HEART',
    'CAMERA_OCCLUSION',
    'MOVE',
    'FLOW_SHIELDING',
    'INFRARED_SHIELDING',
    'CHARGE_NO_ELECTRIC',
    'FAN_SPEED_ERROR',
    'LEFTWHELL_SPEED',
    'RIGHTWHELL_SPEED',
    'BMI_ACCE',
    'BMI_GYRO',
    'XV',
    'LEFT_MAGNET',
    'RIGHT_MAGNET',
    'FLOW_ERROR',
    'INFRARED_FAULT',
    'CAMERA_FAULT',
    'WATER_PUMP',
    'RTC',
    'AUTO_KEY_TRIG',
    'PV',
    'CAMERA_IDLE',
    'LDS_ERROR',
    'LDS_BUMPER',
    'WATER_PUMP_2',
    'EDGE',
    'CARPET',
    'EDGE_2',
    'ULTRASONIC',
    'NO_GO_ZONE',
    'ROUTE',
    'ROUTE_2',
    'BLOCKED_2',
    'BLOCKED_3',
    'RESTRICTED',
    'RESTRICTED_2',
    'RESTRICTED_3',
    'MOP_REMOVED',
    'MOP_REMOVED_2',
    'MOP_PAD_STOP_ROTATE',
    'MOP_PAD_STOP_ROTATE_2',
    'BIN_FULL',
    'BIN_OPEN',
    'BIN_OPEN_2',
    'BIN_FULL_2',
    'WATER_TANK',
    'DIRTY_WATER_TANK',
    'DIRTY_WATER_TANK_2',
    'DIRTY_WATER_TANK_BLOCKED',
    'DIRTY_WATER_TANK_PUMP',
    'MOP_PAD',
    'WET_MOP_PAD',
    'CLEAN_TANK_LEVEL',
    'DIRTY_TANK_LEVEL',
    'WASHBOARD_LEVEL',
] as const;

const dashboardStyle = {
    width: '100%',
    height: '100%',
    minWidth: 320,
    minHeight: 360,
    boxSizing: 'border-box',
    overflow: 'hidden',
    borderRadius: '24px',
    color: '#f5fbff',
    bgcolor: '#09131b',
    backgroundImage:
        'radial-gradient(circle at 8% -8%, rgba(41,151,220,.32), transparent 35%), radial-gradient(circle at 100% 100%, rgba(38,104,145,.13), transparent 35%), linear-gradient(145deg, #13232e, #081018 72%)',
    border: '1px solid rgba(143,209,249,.12)',
    boxShadow: '0 22px 60px rgba(0,0,0,.38)',
    display: 'grid',
    gridTemplateRows: 'auto auto minmax(0, 1fr)',
    p: { xs: 1.4, sm: 2 },
    gap: 1.25,
    fontVariantNumeric: 'tabular-nums',
} as const;
const robotIconStyle = {
    width: 40,
    height: 40,
    borderRadius: '13px',
    display: 'grid',
    placeItems: 'center',
    color: '#08131b',
    bgcolor: '#69c3ff',
    boxShadow: '0 8px 25px rgba(62,174,245,.3)',
} as const;
const panelStyle = {
    bgcolor: 'rgba(255,255,255,.045)',
    border: '1px solid rgba(154,210,244,.11)',
    borderRadius: '15px',
} as const;
const mapStyle = {
    width: '100%',
    minWidth: 0,
    minHeight: 0,
    aspectRatio: { xs: '1 / 1', md: '16 / 10' },
    alignSelf: 'start',
    position: 'relative',
    overflow: 'hidden',
    borderRadius: '20px',
    bgcolor: 'rgba(3,11,17,.42)',
    border: '1px solid rgba(154,210,244,.13)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,.04)',
    display: 'grid',
    placeItems: 'center',
} as const;
const mutedStyle = { color: 'rgba(235,246,255,.48)' } as const;
const selectStyle = {
    color: '#f5fbff',
    bgcolor: 'rgba(3,11,17,.36)',
    borderRadius: '11px',
    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(105,195,255,.25)' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(105,195,255,.55)' },
    '& .MuiSvgIcon-root': { color: 'rgba(235,246,255,.65)' },
} as const;

function statusChipStyle(connected: boolean): Record<string, string | Record<string, string>> {
    return {
        color: connected ? '#83e9ad' : '#ffaaa5',
        border: '1px solid',
        borderColor: connected ? 'rgba(73,210,128,.38)' : 'rgba(255,106,96,.4)',
        bgcolor: connected ? 'rgba(31,132,76,.16)' : 'rgba(155,42,36,.16)',
        '& .MuiChip-icon': { color: 'inherit' },
    };
}

export default class VacuumControlWidget extends (window.visRxWidget as typeof VisRxWidget<VacuumControlData>) {
    static getWidgetInfo(): RxWidgetInfo {
        const id = (suffix: string): string => `${DEFAULT_BASE}.${suffix}`;
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
                        { name: 'title', type: 'text', label: 'title', default: 'Mi Home Vacuum' },
                        { name: 'showMap', type: 'checkbox', label: 'showMap', default: true },
                        { name: 'showMaintenance', type: 'checkbox', label: 'showMaintenance', default: true },
                        { name: 'showHistory', type: 'checkbox', label: 'showHistory', default: true },
                    ],
                },
                {
                    name: 'states',
                    fields: [
                        { name: 'mapOid', type: 'id', label: 'mapOid', default: id('cleanmap.map64') },
                        { name: 'connectionOid', type: 'id', label: 'connectionOid', default: id('info.connection') },
                        { name: 'stateOid', type: 'id', label: 'stateOid', default: id('info.state') },
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
                    fields: [
                        { name: 'room1Name', type: 'text', label: 'room1Name', default: '' },
                        { name: 'room1StartOid', type: 'id', label: 'roomStartOid' },
                        { name: 'room1FanOid', type: 'id', label: 'roomFanOid' },
                        { name: 'room2Name', type: 'text', label: 'room2Name', default: '' },
                        { name: 'room2StartOid', type: 'id', label: 'roomStartOid' },
                        { name: 'room2FanOid', type: 'id', label: 'roomFanOid' },
                        { name: 'room3Name', type: 'text', label: 'room3Name', default: '' },
                        { name: 'room3StartOid', type: 'id', label: 'roomStartOid' },
                        { name: 'room3FanOid', type: 'id', label: 'roomFanOid' },
                        { name: 'room4Name', type: 'text', label: 'room4Name', default: '' },
                        { name: 'room4StartOid', type: 'id', label: 'roomStartOid' },
                        { name: 'room4FanOid', type: 'id', label: 'roomFanOid' },
                        { name: 'room5Name', type: 'text', label: 'room5Name', default: '' },
                        { name: 'room5StartOid', type: 'id', label: 'roomStartOid' },
                        { name: 'room5FanOid', type: 'id', label: 'roomFanOid' },
                        { name: 'room6Name', type: 'text', label: 'room6Name', default: '' },
                        { name: 'room6StartOid', type: 'id', label: 'roomStartOid' },
                        { name: 'room6FanOid', type: 'id', label: 'roomFanOid' },
                    ],
                },
                {
                    name: 'history',
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

    private value(oid: string): StateValue | undefined {
        return oid ? this.state.values[`${oid}.val`] : undefined;
    }

    private write = (oid: string, value: StateValue): void => {
        if (!oid || this.props.editMode) {
            return;
        }
        this.props.context.socket.setState(oid, value, (error?: Error | null) => {
            if (error) {
                window.console.warn(`Cannot write vacuum state ${oid}: ${error.message}`);
            }
        });
    };

    renderWidgetBody(props: RxRenderWidgetProps): React.JSX.Element {
        super.renderWidgetBody(props);
        return (
            <Dashboard
                data={this.state.rxData}
                read={oid => this.value(oid)}
                write={this.write}
                editMode={this.props.editMode}
            />
        );
    }
}

function Dashboard({
    data,
    read,
    write,
    editMode,
}: {
    data: VacuumControlData;
    read: (oid: string) => StateValue | undefined;
    write: (oid: string, value: StateValue) => void;
    editMode: boolean;
}): React.JSX.Element {
    const [section, setSection] = React.useState<'overview' | 'history'>('overview');
    const connected = Boolean(read(data.connectionOid));
    const error = formatVacuumError(read(data.errorOid));
    const fan = Number(read(data.fanOid));
    const rooms: RoomDefinition[] = [
        { key: 'room1', name: data.room1Name, startOid: data.room1StartOid, fanOid: data.room1FanOid },
        { key: 'room2', name: data.room2Name, startOid: data.room2StartOid, fanOid: data.room2FanOid },
        { key: 'room3', name: data.room3Name, startOid: data.room3StartOid, fanOid: data.room3FanOid },
        { key: 'room4', name: data.room4Name, startOid: data.room4StartOid, fanOid: data.room4FanOid },
        { key: 'room5', name: data.room5Name, startOid: data.room5StartOid, fanOid: data.room5FanOid },
        { key: 'room6', name: data.room6Name, startOid: data.room6StartOid, fanOid: data.room6FanOid },
    ].filter(room => room.name && room.startOid);
    const consumables: Consumable[] = [
        {
            key: 'filter',
            label: text('filter'),
            oid: data.filterOid,
            resetOid: data.filterResetOid,
            icon: <FilterAltIcon />,
        },
        {
            key: 'main',
            label: text('mainBrush'),
            oid: data.mainBrushOid,
            resetOid: data.mainBrushResetOid,
            icon: <CleaningServicesIcon />,
        },
        {
            key: 'side',
            label: text('sideBrush'),
            oid: data.sideBrushOid,
            resetOid: data.sideBrushResetOid,
            icon: <CleaningServicesIcon />,
        },
        {
            key: 'sensors',
            label: text('sensors'),
            oid: data.sensorsOid,
            resetOid: data.sensorsResetOid,
            icon: <TuneIcon />,
        },
        {
            key: 'water',
            label: text('waterFilter'),
            oid: data.waterFilterOid,
            resetOid: data.waterFilterResetOid,
            icon: <FilterAltIcon />,
        },
        {
            key: 'mop',
            label: text('mopPad'),
            oid: data.mopPadOid,
            resetOid: data.mopPadResetOid,
            icon: <CleaningServicesIcon />,
        },
        {
            key: 'strainer',
            label: text('strainer'),
            oid: data.strainerOid,
            resetOid: data.strainerResetOid,
            icon: <FilterAltIcon />,
            counter: true,
        },
        {
            key: 'cleaningBrush',
            label: text('cleaningBrush'),
            oid: data.cleaningBrushOid,
            resetOid: data.cleaningBrushResetOid,
            icon: <CleaningServicesIcon />,
            counter: true,
        },
        {
            key: 'dustCollection',
            label: text('dustCollection'),
            oid: data.dustCollectionOid,
            resetOid: data.dustCollectionResetOid,
            icon: <FilterAltIcon />,
            counter: true,
        },
    ].filter(item => read(item.oid) !== undefined);
    const reset = (item: Consumable): void => {
        if (!editMode && item.resetOid && window.confirm(`${text('reset')} ${item.label}? ${text('resetConfirm')}`)) {
            write(item.resetOid, true);
        }
    };
    return (
        <Box sx={dashboardStyle}>
            <Box
                component="header"
                sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
                    <Box sx={robotIconStyle}>
                        <CleaningServicesIcon />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                        <Typography
                            variant="h6"
                            noWrap
                            sx={{ fontWeight: 800, letterSpacing: '-.025em', lineHeight: 1.15 }}
                        >
                            {data.title || 'Mi Home Vacuum'}
                        </Typography>
                        <Typography
                            variant="body2"
                            noWrap
                            sx={{ color: 'rgba(235,246,255,.64)', mt: 0.35 }}
                        >
                            {formatVacuumState(read(data.stateOid))}
                        </Typography>
                    </Box>
                </Box>
                <Chip
                    icon={connected ? <CheckCircleIcon /> : undefined}
                    size="small"
                    label={connected ? text('online') : text('offline')}
                    sx={statusChipStyle(connected)}
                />
            </Box>
            <Box
                component="nav"
                sx={{ display: 'flex', gap: 0.75 }}
            >
                <SectionButton
                    active={section === 'overview'}
                    onClick={() => setSection('overview')}
                    icon={<HomeIcon />}
                    label={text('dashboard')}
                />
                {data.showHistory !== false ? (
                    <SectionButton
                        active={section === 'history'}
                        onClick={() => setSection('history')}
                        icon={<HistoryIcon />}
                        label={text('history')}
                    />
                ) : null}
            </Box>
            <Box
                sx={{
                    minHeight: 0,
                    overflow: 'auto',
                    pr: 0.5,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    gap: 1.5,
                    '& > *': { flex: '0 0 auto', minWidth: 0 },
                }}
            >
                {section === 'overview' ? (
                    <>
                        <Overview
                            data={data}
                            read={read}
                            write={write}
                            fan={fan}
                            error={error}
                        />
                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 520px), 1fr))',
                                gap: 1.5,
                                alignItems: 'start',
                            }}
                        >
                            {rooms.length ? (
                                <Box sx={{ minWidth: 0 }}>
                                    <SectionHeading
                                        icon={<HomeIcon />}
                                        title={text('rooms')}
                                        subtitle={text('roomsSubtitle')}
                                    />
                                    <RoomPanel
                                        rooms={rooms}
                                        data={data}
                                        read={read}
                                        write={write}
                                    />
                                </Box>
                            ) : null}
                            {data.showMaintenance !== false ? (
                                <Box sx={{ minWidth: 0 }}>
                                    <SectionHeading
                                        icon={<BuildCircleIcon />}
                                        title={text('maintenance')}
                                        subtitle={text('maintenanceSubtitle')}
                                    />
                                    <Maintenance
                                        items={consumables}
                                        read={read}
                                        reset={reset}
                                    />
                                </Box>
                            ) : null}
                        </Box>
                    </>
                ) : (
                    <Box>
                        <SectionHeading
                            icon={<HistoryIcon />}
                            title={text('history')}
                            subtitle={text('historySubtitle')}
                        />
                        <HistoryPanel
                            data={data}
                            read={read}
                        />
                    </Box>
                )}
            </Box>
        </Box>
    );
}

function Overview({
    data,
    read,
    write,
    fan,
    error,
}: {
    data: VacuumControlData;
    read: (oid: string) => StateValue | undefined;
    write: (oid: string, value: StateValue) => void;
    fan: number;
    error: string;
}): React.JSX.Element {
    const mapSource = String(read(data.mapOid) || '');
    return (
        <Box
            sx={{
                minHeight: 280,
                display: 'grid',
                gridTemplateColumns:
                    data.showMap !== false ? { xs: '1fr', md: 'minmax(0, 1.65fr) minmax(250px, .7fr)' } : '1fr',
                gap: 1.5,
                alignItems: 'start',
            }}
        >
            {data.showMap !== false ? (
                <Box sx={mapStyle}>
                    {mapSource ? (
                        <Box
                            component="img"
                            src={mapSource}
                            alt={text('noMapAvailable')}
                            sx={{
                                display: 'block',
                                position: 'absolute',
                                inset: 0,
                                m: 'auto',
                                width: 'auto',
                                height: 'auto',
                                maxWidth: '100%',
                                maxHeight: '100%',
                                objectFit: 'contain',
                                objectPosition: 'center',
                                filter: 'drop-shadow(0 12px 24px rgba(0,0,0,.2))',
                            }}
                        />
                    ) : (
                        <EmptyMap />
                    )}
                </Box>
            ) : null}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, minWidth: 0 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1 }}>
                    <Metric
                        icon={<BatteryFullIcon />}
                        value={read(data.batteryOid)}
                        unit="%"
                        label={text('battery')}
                    />
                    <Metric
                        icon={<SquareFootIcon />}
                        value={read(data.areaOid)}
                        unit="m²"
                        label={text('area')}
                    />
                    <Metric
                        icon={<ScheduleIcon />}
                        value={read(data.timeOid)}
                        unit="min"
                        label={text('time')}
                    />
                </Box>
                <Box sx={{ ...panelStyle, p: 1.25 }}>
                    <Label>{text('suctionPower')}</Label>
                    <FormControl
                        size="small"
                        fullWidth
                        sx={{ mt: 0.5 }}
                    >
                        <Select
                            aria-label={text('suctionPower')}
                            value={Number.isFinite(fan) ? fan : data.fanBalanced}
                            onChange={event => write(data.fanOid, Number(event.target.value))}
                            sx={selectStyle}
                        >
                            <MenuItem value={data.fanQuiet}>{text('quiet')}</MenuItem>
                            <MenuItem value={data.fanBalanced}>{text('balanced')}</MenuItem>
                            <MenuItem value={data.fanTurbo}>{text('turbo')}</MenuItem>
                            {Number.isFinite(fan) && ![data.fanQuiet, data.fanBalanced, data.fanTurbo].includes(fan) ? (
                                <MenuItem value={fan}>
                                    {text('current')} ({fan})
                                </MenuItem>
                            ) : null}
                        </Select>
                    </FormControl>
                </Box>
                <Box sx={{ ...panelStyle, p: 1.25, display: 'grid', gap: 1, flex: 1, alignContent: 'start' }}>
                    <Box>
                        <Label>{text('quickControls')}</Label>
                        <Typography
                            variant="body2"
                            sx={{ mt: 0.35, fontWeight: 750 }}
                        >
                            {formatVacuumState(read(data.stateOid))}
                        </Typography>
                    </Box>
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                            gridAutoRows: 'minmax(52px, 1fr)',
                            gap: 1,
                        }}
                    >
                        <ControlButton
                            label={text('start')}
                            icon={<PlayArrowIcon />}
                            onClick={() => write(data.startOid, true)}
                            primary
                        />
                        <ControlButton
                            label={text('pause')}
                            icon={<PauseIcon />}
                            onClick={() => write(data.pauseOid, true)}
                        />
                        <ControlButton
                            label={text('dock')}
                            icon={<HomeIcon />}
                            onClick={() => write(data.homeOid, true)}
                        />
                        <ControlButton
                            label={text('find')}
                            icon={<LocationSearchingIcon />}
                            onClick={() => write(data.findOid, true)}
                        />
                    </Box>
                </Box>
                <Box
                    sx={{
                        ...panelStyle,
                        p: 1.25,
                        borderColor: error && !isNoError(error) ? 'rgba(255,112,112,.38)' : 'rgba(91,205,142,.22)',
                    }}
                >
                    <Label>{text('robotHealth')}</Label>
                    <Typography
                        variant="body2"
                        title={error}
                        sx={{
                            mt: 0.5,
                            color: error && !isNoError(error) ? '#ffaaa5' : '#88e7b1',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}
                    >
                        {error || text('noError')}
                    </Typography>
                </Box>
            </Box>
        </Box>
    );
}

function RoomPanel({
    rooms,
    data,
    read,
    write,
}: {
    rooms: RoomDefinition[];
    data: VacuumControlData;
    read: (oid: string) => StateValue | undefined;
    write: (oid: string, value: StateValue) => void;
}): React.JSX.Element {
    return (
        <Box
            sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' },
                gap: 1,
            }}
        >
            {rooms.map(room => {
                const fan = Number(read(room.fanOid));
                return (
                    <Box
                        key={room.key}
                        sx={{ ...panelStyle, p: 1.25, display: 'grid', gap: 1 }}
                    >
                        <Typography
                            variant="subtitle2"
                            noWrap
                            title={room.name}
                            sx={{ fontWeight: 800 }}
                        >
                            {room.name}
                        </Typography>
                        <FormControl
                            size="small"
                            fullWidth
                        >
                            <Select
                                aria-label={`${room.name} ${text('suctionPower')}`}
                                disabled={!room.fanOid}
                                value={Number.isFinite(fan) ? fan : data.fanBalanced}
                                onChange={event => write(room.fanOid, Number(event.target.value))}
                                sx={selectStyle}
                            >
                                <MenuItem value={data.fanQuiet}>{text('quiet')}</MenuItem>
                                <MenuItem value={data.fanBalanced}>{text('balanced')}</MenuItem>
                                <MenuItem value={data.fanTurbo}>{text('turbo')}</MenuItem>
                                {Number.isFinite(fan) &&
                                ![data.fanQuiet, data.fanBalanced, data.fanTurbo].includes(fan) ? (
                                    <MenuItem value={fan}>
                                        {text('current')} ({fan})
                                    </MenuItem>
                                ) : null}
                            </Select>
                        </FormControl>
                        <Button
                            variant="contained"
                            startIcon={<PlayArrowIcon />}
                            onClick={() => write(room.startOid, true)}
                            sx={{
                                color: '#07131c',
                                bgcolor: '#69c3ff',
                                textTransform: 'none',
                                fontWeight: 800,
                                borderRadius: '10px',
                                '&:hover': { bgcolor: '#82cdff' },
                            }}
                        >
                            {text('startRoom')}
                        </Button>
                    </Box>
                );
            })}
        </Box>
    );
}

function SectionHeading({
    icon,
    title,
    subtitle,
}: {
    icon: React.ReactNode;
    title: string;
    subtitle: string;
}): React.JSX.Element {
    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Box sx={{ color: '#69c3ff', lineHeight: 0 }}>{icon}</Box>
            <Box>
                <Typography
                    variant="subtitle1"
                    sx={{ fontWeight: 800, lineHeight: 1.15 }}
                >
                    {title}
                </Typography>
                <Typography
                    variant="caption"
                    sx={mutedStyle}
                >
                    {subtitle}
                </Typography>
            </Box>
        </Box>
    );
}

function Maintenance({
    items,
    read,
    reset,
}: {
    items: Consumable[];
    read: (oid: string) => StateValue | undefined;
    reset: (item: Consumable) => void;
}): React.JSX.Element {
    if (!items.length) {
        return (
            <EmptyState
                icon={<BuildCircleIcon />}
                title={text('noMaintenanceData')}
                text={text('noMaintenanceText')}
            />
        );
    }
    return (
        <Box
            sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' },
                gap: 1.25,
            }}
        >
            {items.map(item => {
                const rawValue = read(item.oid);
                const value = percent(rawValue);
                const color = item.counter ? '#69c3ff' : value <= 15 ? '#ff7f73' : value <= 35 ? '#ffbd66' : '#61d995';
                return (
                    <Box
                        key={item.key}
                        sx={{ ...panelStyle, p: 1.5, minHeight: 126, display: 'grid', gap: 1 }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ color, lineHeight: 0 }}>{item.icon}</Box>
                            <Typography
                                variant="subtitle2"
                                sx={{ fontWeight: 750, flex: 1 }}
                            >
                                {item.label}
                            </Typography>
                            <Typography
                                variant="h6"
                                sx={{ color, fontWeight: 800 }}
                            >
                                {item.counter ? (rawValue ?? '—') : `${value}%`}
                            </Typography>
                        </Box>
                        {item.counter ? (
                            <Box sx={{ height: 7 }} />
                        ) : (
                            <LinearProgress
                                variant="determinate"
                                value={value}
                                sx={{
                                    height: 7,
                                    borderRadius: 9,
                                    bgcolor: 'rgba(255,255,255,.07)',
                                    '& .MuiLinearProgress-bar': { borderRadius: 9, bgcolor: color },
                                }}
                            />
                        )}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography
                                variant="caption"
                                sx={{ color: 'rgba(235,246,255,.5)' }}
                            >
                                {item.counter
                                    ? text('usageCounter')
                                    : value <= 15
                                      ? text('replacementRecommended')
                                      : value <= 35
                                        ? text('checkSoon')
                                        : text('goodCondition')}
                            </Typography>
                            <Tooltip title={`${text('reset')} ${item.label}`}>
                                <span>
                                    <IconButton
                                        size="small"
                                        disabled={!item.resetOid}
                                        onClick={() => reset(item)}
                                        sx={{
                                            color: 'rgba(235,246,255,.65)',
                                            '&:hover': { color: '#69c3ff', bgcolor: 'rgba(105,195,255,.1)' },
                                        }}
                                    >
                                        <RestartAltIcon fontSize="small" />
                                    </IconButton>
                                </span>
                            </Tooltip>
                        </Box>
                    </Box>
                );
            })}
        </Box>
    );
}

function HistoryPanel({
    data,
    read,
}: {
    data: VacuumControlData;
    read: (oid: string) => StateValue | undefined;
}): React.JSX.Element {
    const entries = parseHistory(read(data.historyJsonOid));
    return (
        <Box sx={{ display: 'grid', gap: 1.25 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1 }}>
                <Metric
                    icon={<HistoryIcon />}
                    value={read(data.historyTotalCleanupsOid)}
                    unit=""
                    label={text('totalCleanups')}
                />
                <Metric
                    icon={<SquareFootIcon />}
                    value={read(data.historyTotalAreaOid)}
                    unit="m²"
                    label={text('totalArea')}
                />
                <Metric
                    icon={<ScheduleIcon />}
                    value={read(data.historyTotalTimeOid)}
                    unit="min"
                    label={text('totalTime')}
                />
            </Box>
            {entries.length ? (
                <Box sx={{ ...panelStyle, p: 0, overflow: 'hidden' }}>
                    {entries.slice(0, 12).map((entry, index) => (
                        <Box
                            key={`${entry.date}-${entry.start}-${index}`}
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: 'minmax(90px, 1.3fr) repeat(2, minmax(70px, 1fr)) 34px',
                                gap: 1,
                                alignItems: 'center',
                                px: 1.5,
                                py: 1.15,
                                borderBottom:
                                    index === Math.min(entries.length, 12) - 1 ? 0 : '1px solid rgba(255,255,255,.06)',
                            }}
                        >
                            <Box>
                                <Typography
                                    variant="body2"
                                    sx={{ fontWeight: 700 }}
                                >
                                    {entry.date}
                                </Typography>
                                <Typography
                                    variant="caption"
                                    sx={mutedStyle}
                                >
                                    {entry.start}
                                </Typography>
                            </Box>
                            <Box>
                                <Typography variant="body2">{entry.area}</Typography>
                                <Typography
                                    variant="caption"
                                    sx={mutedStyle}
                                >
                                    {text('area')}
                                </Typography>
                            </Box>
                            <Box>
                                <Typography variant="body2">{entry.duration}</Typography>
                                <Typography
                                    variant="caption"
                                    sx={mutedStyle}
                                >
                                    {text('duration')}
                                </Typography>
                            </Box>
                            <Tooltip
                                title={
                                    entry.error
                                        ? `${text('error')} ${entry.error}`
                                        : entry.completed
                                          ? text('completed')
                                          : text('notCompleted')
                                }
                            >
                                <Box
                                    sx={{
                                        color: entry.error || !entry.completed ? '#ff9d93' : '#61d995',
                                        lineHeight: 0,
                                    }}
                                >
                                    {entry.completed && !entry.error ? (
                                        <CheckCircleIcon fontSize="small" />
                                    ) : (
                                        <HistoryIcon fontSize="small" />
                                    )}
                                </Box>
                            </Tooltip>
                        </Box>
                    ))}
                </Box>
            ) : (
                <EmptyState
                    icon={<HistoryIcon />}
                    title={text('noCleaningHistory')}
                    text={text('noCleaningHistoryText')}
                />
            )}
        </Box>
    );
}

function parseHistory(raw: StateValue | undefined): HistoryEntry[] {
    if (!raw) {
        return [];
    }
    try {
        const parsed: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!Array.isArray(parsed)) {
            return [];
        }
        return parsed.flatMap(item => {
            if (!item || typeof item !== 'object') {
                return [];
            }
            const row = item as Record<string, unknown>;
            return [
                {
                    date: displayValue(row.Datum ?? row.date),
                    start: displayValue(row.Start ?? row.start),
                    duration: displayValue(row.Saugzeit ?? row.duration),
                    area: displayValue(row['Fläche'] ?? row.area),
                    completed: Boolean(row.Ende ?? row.completed),
                    error: Number(row.Error ?? row.error ?? 0),
                },
            ];
        });
    } catch {
        return [];
    }
}

function displayValue(value: unknown): string {
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : '—';
}

function formatVacuumState(value: StateValue | undefined): string {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
        const states = VacuumControlWidget.getLanguage() === 'de' ? VACUUM_STATES_DE : VACUUM_STATES;
        return states[numeric] ?? `${text('unknown')} (${numeric})`;
    }
    return typeof value === 'string' && value ? value : text('unknown');
}

function formatVacuumError(value: StateValue | undefined): string {
    const numeric = Number(value);
    if (Number.isInteger(numeric) && numeric >= 0) {
        if (numeric === 0) {
            return text('noError');
        }
        return VACUUM_ERRORS[numeric] ?? `Unknown error (${numeric})`;
    }
    return typeof value === 'string' && value ? value : text('noError');
}

function isNoError(value: string): boolean {
    return value === text('noError') || /no error/i.test(value);
}

function percent(value: StateValue | undefined): number {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.min(100, Math.round(number))) : 0;
}

function Label({ children }: { children: React.ReactNode }): React.JSX.Element {
    return (
        <Typography
            variant="overline"
            sx={{ color: 'rgba(235,246,255,.52)', letterSpacing: '.09em' }}
        >
            {children}
        </Typography>
    );
}

function EmptyMap(): React.JSX.Element {
    return (
        <Box sx={{ textAlign: 'center', color: 'rgba(235,246,255,.38)' }}>
            <MapIcon sx={{ fontSize: 48 }} />
            <Typography variant="body2">{text('noMapAvailable')}</Typography>
        </Box>
    );
}

function Metric({
    icon,
    value,
    unit,
    label,
}: {
    icon: React.ReactNode;
    value: StateValue | undefined;
    unit: string;
    label: string;
}): React.JSX.Element {
    return (
        <Box
            sx={{ ...panelStyle, p: 1.2, minWidth: 0 }}
            title={label}
        >
            <Box sx={{ color: '#69c3ff', lineHeight: 0 }}>{icon}</Box>
            <Typography
                variant="body2"
                noWrap
                sx={{ mt: 0.7, fontWeight: 800 }}
            >
                {value ?? '—'}
                {value == null || !unit ? '' : ` ${unit}`}
            </Typography>
            <Typography
                variant="caption"
                noWrap
                sx={{ display: 'block', ...mutedStyle, mt: 0.15 }}
            >
                {label}
            </Typography>
        </Box>
    );
}

function SectionButton({
    active,
    onClick,
    icon,
    label,
}: {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
}): React.JSX.Element {
    return (
        <Button
            size="small"
            onClick={onClick}
            startIcon={icon}
            sx={{
                px: 1.35,
                py: 0.75,
                borderRadius: '10px',
                textTransform: 'none',
                fontWeight: 750,
                color: active ? '#06131c' : 'rgba(235,246,255,.68)',
                bgcolor: active ? '#69c3ff' : 'rgba(255,255,255,.035)',
                '&:hover': { bgcolor: active ? '#82cdff' : 'rgba(105,195,255,.1)' },
            }}
        >
            {label}
        </Button>
    );
}

function ControlButton({
    label,
    icon,
    onClick,
    primary,
}: {
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    primary?: boolean;
}): React.JSX.Element {
    return (
        <Button
            type="button"
            aria-label={label}
            title={label}
            onClick={onClick}
            variant={primary ? 'contained' : 'outlined'}
            startIcon={icon}
            sx={{
                minWidth: 0,
                px: { xs: 0.5, sm: 1 },
                py: 1,
                borderRadius: '11px',
                textTransform: 'none',
                fontWeight: 750,
                color: primary ? '#07131c' : '#cbe8ff',
                borderColor: 'rgba(105,195,255,.35)',
                bgcolor: primary ? '#69c3ff' : 'rgba(105,195,255,.035)',
                '&:hover': { borderColor: '#69c3ff', bgcolor: primary ? '#82cdff' : 'rgba(105,195,255,.1)' },
                '& .MuiButton-startIcon': { m: { xs: 0, sm: '0 8px 0 -4px' } },
            }}
        >
            <Box
                component="span"
                sx={{ display: { xs: 'none', sm: 'inline' } }}
            >
                {label}
            </Box>
        </Button>
    );
}

function EmptyState({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }): React.JSX.Element {
    return (
        <Box sx={{ ...panelStyle, minHeight: 220, display: 'grid', placeItems: 'center', textAlign: 'center', p: 3 }}>
            <Box>
                <Box sx={{ color: 'rgba(105,195,255,.65)', '& svg': { fontSize: 48 } }}>{icon}</Box>
                <Typography
                    variant="subtitle1"
                    sx={{ mt: 1, fontWeight: 750 }}
                >
                    {title}
                </Typography>
                <Typography
                    variant="body2"
                    sx={{ mt: 0.5, color: 'rgba(235,246,255,.52)', maxWidth: 360 }}
                >
                    {text}
                </Typography>
            </Box>
        </Box>
    );
}

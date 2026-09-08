import React from 'react';

import { Box, Chip, Tab, Tabs, Typography } from '@mui/material';

import { useContainerWidth, containerSize } from '../hooks/useContainerWidth';
import { useStable } from '../hooks/useStable';
import {
    BuildCircleIcon,
    CheckCircleIcon,
    CleaningServicesIcon,
    FilterAltIcon,
    HistoryIcon,
    HomeIcon,
    TuneIcon,
} from '../icons';
import {
    buildFanOptions,
    buildOptions,
    dockLevel,
    formatCatalogValue,
    formatError,
    formatMetric,
    formatState,
    isOn,
} from '../lib/format';
import type { TextFunction } from '../lib/i18n';
import { TIMER_DISABLED, TIMER_ENABLED, TIMER_SKIP, TIMER_START, weekdayNames } from '../lib/timers';
import type {
    ConsumableDefinition,
    ConsumableItem,
    ObjectMetaMap,
    RoomDefinition,
    RoomItem,
    StateValue,
    TimerDefinition,
    TimerItem,
    VacuumControlData,
} from '../lib/types';
import { useWidgetTheme } from '../theme';
import { CleaningSettings } from './CleaningSettings';
import { ConfirmDialog, type ConfirmRequest } from './ConfirmDialog';
import { DockPanel } from './DockPanel';
import { HistoryPanel } from './HistoryPanel';
import { Maintenance } from './Maintenance';
import { Overview } from './Overview';
import { RoomPanel } from './RoomPanel';
import { SchedulePanel } from './SchedulePanel';
import { SectionHeading } from './primitives';

export interface DashboardProps {
    data: VacuumControlData;
    /** Subscribed state values keyed by `<oid>.val`, as maintained by the VIS 2 runtime. */
    values: Record<string, StateValue | undefined>;
    /** Metadata of the configured state objects; a missing entry means the state does not exist. */
    meta: ObjectMetaMap;
    rooms: RoomDefinition[];
    timers: TimerDefinition[];
    /** Values of states outside the widget attributes (auto room fans, timers), keyed by state ID. */
    extraValues: Record<string, StateValue | undefined>;
    language: string;
    text: TextFunction;
    editMode: boolean;
    write: (oid: string, value: StateValue) => void;
}

type Section = 'overview' | 'history';

const NO_KEYS: Record<string, string> = {};

function numberOrUndefined(value: StateValue | undefined): number | undefined {
    if (value === undefined || value === null || value === '') {
        return undefined;
    }
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : undefined;
}

/**
 * Top-level layout of the widget: header, section tabs and the scrollable content area.
 * Everything below receives primitive props, so a changing state only re-renders the affected card.
 *
 * @param props - attributes, state values and callbacks provided by the widget class
 */
export function Dashboard(props: DashboardProps): React.JSX.Element {
    const { data, values, meta, extraValues, language, text, editMode, write } = props;
    const theme = useWidgetTheme(data.accentColor);
    const rootRef = React.useRef<HTMLDivElement | null>(null);
    const width = useContainerWidth(rootRef);
    const size = containerSize(width);
    const [section, setSection] = React.useState<Section>('overview');
    const [confirm, setConfirm] = React.useState<ConfirmRequest | null>(null);

    // Attribute states are subscribed by the VIS runtime (`values`); states the widget resolved or
    // discovered itself arrive through its own subscription (`extraValues`).
    const read = React.useCallback(
        (oid: string): StateValue | undefined => (oid ? (values[`${oid}.val`] ?? extraValues[oid]) : undefined),
        [values, extraValues],
    );
    const has = (oid: string): boolean => Boolean(oid && meta[oid]);

    const connected = Boolean(read(data.connectionOid));
    const stateLabel = formatState(read(data.stateOid), meta[data.stateOid]?.states, language, text);
    const error = formatError(read(data.errorOid), meta[data.errorOid]?.states, language, text);
    const fanCatalog = meta[data.fanOid]?.states;
    const fanOptions = React.useMemo(
        () =>
            buildFanOptions(
                fanCatalog,
                { quiet: Number(data.fanQuiet), balanced: Number(data.fanBalanced), turbo: Number(data.fanTurbo) },
                language,
                text,
            ),
        [fanCatalog, data.fanQuiet, data.fanBalanced, data.fanTurbo, language, text],
    );
    const waterCatalog = meta[data.waterOid]?.states;
    const waterOptions = React.useMemo(() => buildOptions(waterCatalog, language), [waterCatalog, language]);
    const mopCatalog = meta[data.mopModeOid]?.states;
    const mopOptions = React.useMemo(() => buildOptions(mopCatalog, language), [mopCatalog, language]);
    const mapCatalog = meta[data.mapSelectOid]?.states;
    const mapOptions = React.useMemo(() => buildOptions(mapCatalog, language, NO_KEYS), [mapCatalog, language]);
    const dockCatalog = meta[data.dockStatusOid]?.states;
    const dockValue = read(data.dockStatusOid);
    const weekdays = React.useMemo(() => weekdayNames(language), [language]);

    const consumableDefinitions = React.useMemo<ConsumableDefinition[]>(
        () => [
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
        ],
        [data, text],
    );

    // The card lists are rebuilt on every render but handed to the memoized panels with a stable
    // reference as long as the values they depend on did not change.
    const consumables = useStable<ConsumableItem[]>(
        consumableDefinitions
            .map(item => ({ ...item, value: read(item.oid) }))
            .filter(item => item.value !== undefined),
        `${language}|${consumableDefinitions.map(item => `${item.oid}=${String(read(item.oid))}`).join('|')}`,
    );
    const roomFanOf = (room: RoomDefinition): StateValue | undefined =>
        room.fanOid ? (extraValues[room.fanOid] ?? read(room.fanOid)) : undefined;
    const rooms = useStable<RoomItem[]>(
        props.rooms.map(room => ({ ...room, fan: roomFanOf(room) })),
        props.rooms.map(room => `${room.key}:${room.name}:${room.fanOid}:${String(roomFanOf(room))}`).join('|'),
    );
    const timers = useStable<TimerItem[]>(
        props.timers.map(timer => ({ ...timer, value: numberOrUndefined(extraValues[timer.oid]) })),
        props.timers
            .map(timer => `${timer.oid}:${timer.nextRun}:${timer.channels.join(',')}:${String(extraValues[timer.oid])}`)
            .join('|'),
    );

    const onFan = React.useCallback((value: number) => write(data.fanOid, value), [write, data.fanOid]);
    const onStart = React.useCallback(() => write(data.startOid, true), [write, data.startOid]);
    const onPause = React.useCallback(() => write(data.pauseOid, true), [write, data.pauseOid]);
    const onHome = React.useCallback(() => write(data.homeOid, true), [write, data.homeOid]);
    const onFind = React.useCallback(() => write(data.findOid, true), [write, data.findOid]);
    const onMap = React.useCallback((value: number) => write(data.mapSelectOid, value), [write, data.mapSelectOid]);
    const onMapReload = React.useCallback(() => write(data.mapReloadOid, true), [write, data.mapReloadOid]);
    const onWater = React.useCallback((value: number) => write(data.waterOid, value), [write, data.waterOid]);
    const onMopMode = React.useCallback((value: number) => write(data.mopModeOid, value), [write, data.mopModeOid]);
    const onCarpet = React.useCallback((value: boolean) => write(data.carpetOid, value), [write, data.carpetOid]);
    const onDustCollect = React.useCallback(() => write(data.dustCollectOid, true), [write, data.dustCollectOid]);
    const onWashMop = React.useCallback(() => write(data.washMopOid, true), [write, data.washMopOid]);
    const onPauseWashMop = React.useCallback(() => write(data.pauseWashMopOid, true), [write, data.pauseWashMopOid]);
    const onStartDrying = React.useCallback(() => write(data.startDryingOid, true), [write, data.startDryingOid]);
    const onStopDrying = React.useCallback(() => write(data.stopDryingOid, true), [write, data.stopDryingOid]);
    const onRoomFan = React.useCallback((room: RoomItem, value: number) => write(room.fanOid, value), [write]);
    const onRoomStart = React.useCallback((room: RoomItem) => write(room.startOid, true), [write]);
    const onTimerEnabled = React.useCallback(
        (timer: TimerItem, enabled: boolean) => write(timer.oid, enabled ? TIMER_ENABLED : TIMER_DISABLED),
        [write],
    );
    const onTimerSkip = React.useCallback((timer: TimerItem) => write(timer.oid, TIMER_SKIP), [write]);
    const onTimerStart = React.useCallback(
        (timer: TimerItem) => {
            if (editMode) {
                return;
            }
            setConfirm({
                title: text('startTimerNow'),
                text: text('startTimerNowConfirm'),
                onConfirm: () => write(timer.oid, TIMER_START),
            });
        },
        [editMode, text, write],
    );
    const onReset = React.useCallback(
        (item: ConsumableItem) => {
            if (editMode || !item.resetOid) {
                return;
            }
            setConfirm({
                title: `${text('reset')} ${item.label}`,
                text: text('resetConfirm'),
                onConfirm: () => write(item.resetOid, true),
            });
        },
        [editMode, text, write],
    );
    const closeConfirm = React.useCallback(() => setConfirm(null), []);

    const showHistory = data.showHistory !== false;
    const activeSection: Section = showHistory ? section : 'overview';
    const showSettings = has(data.waterOid) || has(data.mopModeOid) || has(data.carpetOid);
    const showDock =
        has(data.dockStatusOid) ||
        has(data.dustCollectOid) ||
        has(data.washMopOid) ||
        has(data.pauseWashMopOid) ||
        has(data.startDryingOid) ||
        has(data.stopDryingOid);
    const showSchedule =
        data.showSchedule !== false && (has(data.dndOid) || has(data.nextTimerOid) || timers.length > 0);

    return (
        <Box
            ref={rootRef}
            sx={{
                width: '100%',
                height: '100%',
                minWidth: 280,
                minHeight: 320,
                boxSizing: 'border-box',
                overflow: 'hidden',
                borderRadius: '22px',
                color: theme.text,
                bgcolor: theme.surfaceBg,
                backgroundImage: `radial-gradient(circle at 8% -8%, ${theme.panelBorder}, transparent 38%)`,
                border: `1px solid ${theme.surfaceBorder}`,
                display: 'grid',
                gridTemplateRows: 'auto auto minmax(0, 1fr)',
                p: size === 'narrow' ? 1.4 : 2,
                gap: 1.25,
                fontVariantNumeric: 'tabular-nums',
            }}
        >
            <Box
                component="header"
                sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
                    <Box
                        sx={{
                            width: 40,
                            height: 40,
                            borderRadius: '13px',
                            display: 'grid',
                            placeItems: 'center',
                            color: theme.onAccent,
                            bgcolor: theme.accent,
                            flex: '0 0 auto',
                        }}
                    >
                        <CleaningServicesIcon />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                        <Typography
                            variant="h6"
                            noWrap
                            sx={{ fontWeight: 800, letterSpacing: '-.025em', lineHeight: 1.15 }}
                        >
                            {data.title || text('defaultTitle')}
                        </Typography>
                        <Typography
                            variant="body2"
                            noWrap
                            sx={{ color: theme.muted, mt: 0.35 }}
                        >
                            {stateLabel}
                        </Typography>
                    </Box>
                </Box>
                <Chip
                    icon={connected ? <CheckCircleIcon /> : undefined}
                    size="small"
                    label={connected ? text('online') : text('offline')}
                    sx={{
                        color: connected ? theme.good : theme.critical,
                        border: '1px solid',
                        borderColor: connected ? theme.good : theme.critical,
                        bgcolor: 'transparent',
                        '& .MuiChip-icon': { color: 'inherit' },
                    }}
                />
            </Box>
            {showHistory ? (
                <Tabs
                    value={activeSection}
                    onChange={(_event, value: Section) => setSection(value)}
                    aria-label={text('dashboard')}
                    sx={{
                        minHeight: 0,
                        '& .MuiTab-root': { minHeight: 40, textTransform: 'none', fontWeight: 750, color: theme.muted },
                        '& .Mui-selected': { color: theme.accent },
                        '& .MuiTabs-indicator': { bgcolor: theme.accent },
                    }}
                >
                    <Tab
                        value="overview"
                        icon={<HomeIcon fontSize="small" />}
                        iconPosition="start"
                        label={text('dashboard')}
                    />
                    <Tab
                        value="history"
                        icon={<HistoryIcon fontSize="small" />}
                        iconPosition="start"
                        label={text('history')}
                    />
                </Tabs>
            ) : (
                <Box />
            )}
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
                {activeSection === 'overview' ? (
                    <>
                        <Overview
                            theme={theme}
                            text={text}
                            size={size}
                            showMap={data.showMap !== false}
                            mapSource={String(read(data.mapOid) || '')}
                            mapOptions={mapOptions}
                            mapValue={read(data.mapSelectOid)}
                            hasMapReload={has(data.mapReloadOid)}
                            battery={formatMetric(read(data.batteryOid), '%')}
                            area={formatMetric(read(data.areaOid), 'm²')}
                            time={formatMetric(read(data.timeOid), 'min')}
                            stateLabel={stateLabel}
                            errorLabel={error.label}
                            hasError={error.isError}
                            fan={read(data.fanOid)}
                            fanOptions={fanOptions}
                            onFan={onFan}
                            onMap={onMap}
                            onMapReload={onMapReload}
                            onStart={onStart}
                            onPause={onPause}
                            onHome={onHome}
                            onFind={onFind}
                        />
                        {showSettings || showDock || showSchedule ? (
                            <Box
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns:
                                        size === 'narrow' ? '1fr' : 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
                                    gap: 1.5,
                                    alignItems: 'start',
                                }}
                            >
                                {showSettings ? (
                                    <CleaningSettings
                                        theme={theme}
                                        text={text}
                                        size={size}
                                        hasWater={has(data.waterOid)}
                                        water={read(data.waterOid)}
                                        waterOptions={waterOptions}
                                        hasMopMode={has(data.mopModeOid)}
                                        mopMode={read(data.mopModeOid)}
                                        mopOptions={mopOptions}
                                        hasCarpet={has(data.carpetOid)}
                                        carpet={read(data.carpetOid)}
                                        onWater={onWater}
                                        onMopMode={onMopMode}
                                        onCarpet={onCarpet}
                                    />
                                ) : null}
                                {showDock ? (
                                    <DockPanel
                                        theme={theme}
                                        text={text}
                                        size={size}
                                        hasStatus={has(data.dockStatusOid)}
                                        statusLabel={formatCatalogValue(dockValue, dockCatalog, language, text)}
                                        level={dockLevel(dockValue, dockCatalog)}
                                        hasDustCollect={has(data.dustCollectOid)}
                                        hasWashMop={has(data.washMopOid)}
                                        hasPauseWashMop={has(data.pauseWashMopOid)}
                                        hasStartDrying={has(data.startDryingOid)}
                                        hasStopDrying={has(data.stopDryingOid)}
                                        onDustCollect={onDustCollect}
                                        onWashMop={onWashMop}
                                        onPauseWashMop={onPauseWashMop}
                                        onStartDrying={onStartDrying}
                                        onStopDrying={onStopDrying}
                                    />
                                ) : null}
                                {showSchedule ? (
                                    <SchedulePanel
                                        theme={theme}
                                        text={text}
                                        size={size}
                                        hasDnd={has(data.dndOid)}
                                        dnd={isOn(read(data.dndOid))}
                                        hasNextTimer={has(data.nextTimerOid)}
                                        nextTimer={String(read(data.nextTimerOid) ?? '')}
                                        timers={timers}
                                        weekdays={weekdays}
                                        onTimerEnabled={onTimerEnabled}
                                        onTimerSkip={onTimerSkip}
                                        onTimerStart={onTimerStart}
                                    />
                                ) : null}
                            </Box>
                        ) : null}
                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns:
                                    size === 'wide' ? 'repeat(auto-fit, minmax(min(100%, 520px), 1fr))' : '1fr',
                                gap: 1.5,
                                alignItems: 'start',
                            }}
                        >
                            {rooms.length || editMode ? (
                                <Box sx={{ minWidth: 0 }}>
                                    <SectionHeading
                                        theme={theme}
                                        icon={<HomeIcon />}
                                        title={text('rooms')}
                                        subtitle={text('roomsSubtitle')}
                                    />
                                    <RoomPanel
                                        theme={theme}
                                        text={text}
                                        size={size}
                                        rooms={rooms}
                                        fanOptions={fanOptions}
                                        editMode={editMode}
                                        onFan={onRoomFan}
                                        onStart={onRoomStart}
                                    />
                                </Box>
                            ) : null}
                            {data.showMaintenance !== false ? (
                                <Box sx={{ minWidth: 0 }}>
                                    <SectionHeading
                                        theme={theme}
                                        icon={<BuildCircleIcon />}
                                        title={text('maintenance')}
                                        subtitle={text('maintenanceSubtitle')}
                                    />
                                    <Maintenance
                                        theme={theme}
                                        text={text}
                                        size={size}
                                        items={consumables}
                                        onReset={onReset}
                                    />
                                </Box>
                            ) : null}
                        </Box>
                    </>
                ) : (
                    <Box>
                        <SectionHeading
                            theme={theme}
                            icon={<HistoryIcon />}
                            title={text('history')}
                            subtitle={text('historySubtitle')}
                        />
                        <HistoryPanel
                            theme={theme}
                            text={text}
                            historyRaw={read(data.historyJsonOid)}
                            limit={Number(data.historyLimit) || 12}
                            totalCleanups={formatMetric(read(data.historyTotalCleanupsOid), '')}
                            totalArea={formatMetric(read(data.historyTotalAreaOid), 'm²')}
                            totalTime={formatMetric(read(data.historyTotalTimeOid), 'min')}
                        />
                    </Box>
                )}
            </Box>
            <ConfirmDialog
                request={confirm}
                confirmLabel={text('confirm')}
                cancelLabel={text('cancel')}
                onClose={closeConfirm}
            />
        </Box>
    );
}

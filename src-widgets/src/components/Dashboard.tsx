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
import { buildFanOptions, formatError, formatMetric, formatState } from '../lib/format';
import type { TextFunction } from '../lib/i18n';
import type {
    ConsumableDefinition,
    ConsumableItem,
    RoomDefinition,
    RoomItem,
    StateCatalog,
    StateValue,
    VacuumControlData,
} from '../lib/types';
import { useWidgetTheme } from '../theme';
import { ConfirmDialog, type ConfirmRequest } from './ConfirmDialog';
import { HistoryPanel } from './HistoryPanel';
import { Maintenance } from './Maintenance';
import { Overview } from './Overview';
import { RoomPanel } from './RoomPanel';
import { SectionHeading } from './primitives';

export interface DashboardProps {
    data: VacuumControlData;
    /** Subscribed state values keyed by `<oid>.val`, as maintained by the VIS 2 runtime. */
    values: Record<string, StateValue | undefined>;
    /** `common.states` catalogues of the state, error and fan objects, if they could be read. */
    catalogs: { state?: StateCatalog; error?: StateCatalog; fan?: StateCatalog };
    rooms: RoomDefinition[];
    /** Values of the room fan states that are not part of the widget subscription (auto rooms). */
    roomFans: Record<string, StateValue | undefined>;
    language: string;
    text: TextFunction;
    editMode: boolean;
    write: (oid: string, value: StateValue) => void;
}

type Section = 'overview' | 'history';

/**
 * Top-level layout of the widget: header, section tabs and the scrollable content area.
 * Everything below receives primitive props, so a changing state only re-renders the affected card.
 *
 * @param props - attributes, state values and callbacks provided by the widget class
 */
export function Dashboard(props: DashboardProps): React.JSX.Element {
    const { data, values, catalogs, language, text, editMode, write } = props;
    const theme = useWidgetTheme(data.accentColor);
    const rootRef = React.useRef<HTMLDivElement | null>(null);
    const width = useContainerWidth(rootRef);
    const size = containerSize(width);
    const [section, setSection] = React.useState<Section>('overview');
    const [confirm, setConfirm] = React.useState<ConfirmRequest | null>(null);

    const read = React.useCallback(
        (oid: string): StateValue | undefined => (oid ? values[`${oid}.val`] : undefined),
        [values],
    );

    const connected = Boolean(read(data.connectionOid));
    const stateLabel = formatState(read(data.stateOid), catalogs.state, language, text);
    const error = formatError(read(data.errorOid), catalogs.error, language, text);
    const fanOptions = React.useMemo(
        () =>
            buildFanOptions(
                catalogs.fan,
                { quiet: Number(data.fanQuiet), balanced: Number(data.fanBalanced), turbo: Number(data.fanTurbo) },
                language,
                text,
            ),
        [catalogs.fan, data.fanQuiet, data.fanBalanced, data.fanTurbo, language, text],
    );

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
        room.fanOid ? (props.roomFans[room.fanOid] ?? read(room.fanOid)) : undefined;
    const rooms = useStable<RoomItem[]>(
        props.rooms.map(room => ({ ...room, fan: roomFanOf(room) })),
        props.rooms.map(room => `${room.key}:${room.name}:${room.fanOid}:${String(roomFanOf(room))}`).join('|'),
    );

    const onFan = React.useCallback((value: number) => write(data.fanOid, value), [write, data.fanOid]);
    const onStart = React.useCallback(() => write(data.startOid, true), [write, data.startOid]);
    const onPause = React.useCallback(() => write(data.pauseOid, true), [write, data.pauseOid]);
    const onHome = React.useCallback(() => write(data.homeOid, true), [write, data.homeOid]);
    const onFind = React.useCallback(() => write(data.findOid, true), [write, data.findOid]);
    const onRoomFan = React.useCallback((room: RoomItem, value: number) => write(room.fanOid, value), [write]);
    const onRoomStart = React.useCallback((room: RoomItem) => write(room.startOid, true), [write]);
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
                            battery={formatMetric(read(data.batteryOid), '%')}
                            area={formatMetric(read(data.areaOid), 'm²')}
                            time={formatMetric(read(data.timeOid), 'min')}
                            stateLabel={stateLabel}
                            errorLabel={error.label}
                            hasError={error.isError}
                            fan={read(data.fanOid)}
                            fanOptions={fanOptions}
                            onFan={onFan}
                            onStart={onStart}
                            onPause={onPause}
                            onHome={onHome}
                            onFind={onFind}
                        />
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

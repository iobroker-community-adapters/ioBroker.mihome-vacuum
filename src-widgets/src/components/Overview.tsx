import React from 'react';

import { Box, IconButton, MenuItem, Select, Tooltip, Typography } from '@mui/material';

import {
    BatteryFullIcon,
    HomeIcon,
    LocationSearchingIcon,
    MapIcon,
    PauseIcon,
    PlayArrowIcon,
    RefreshIcon,
    ScheduleIcon,
    SquareFootIcon,
} from '../icons';
import type { TextFunction } from '../lib/i18n';
import type { ContainerSize, FanOption, StateValue } from '../lib/types';
import type { WidgetTheme } from '../theme';
import { FanSelect } from './FanSelect';
import { ControlButton, Label, Metric } from './primitives';

export interface OverviewProps {
    theme: WidgetTheme;
    text: TextFunction;
    size: ContainerSize;
    showMap: boolean;
    mapSource: string;
    /** Selectable maps of a multi-map robot; the selector appears from two entries on. */
    mapOptions: FanOption[];
    mapValue: StateValue | undefined;
    hasMapReload: boolean;
    battery: string;
    area: string;
    time: string;
    stateLabel: string;
    errorLabel: string;
    hasError: boolean;
    fan: StateValue | undefined;
    fanOptions: FanOption[];
    onFan: (value: number) => void;
    onMap: (value: number) => void;
    onMapReload: () => void;
    onStart: () => void;
    onPause: () => void;
    onHome: () => void;
    onFind: () => void;
}

/**
 * Map, key figures, suction level, quick actions and robot health.
 * Receives only primitive values so it re-renders when one of them changes, not on every state update.
 */
export const Overview = React.memo(function Overview(props: OverviewProps): React.JSX.Element {
    const { theme, text, size } = props;
    const sideBySide = props.showMap && size === 'wide';
    const mapNumeric = Number(props.mapValue);
    const mapSelected =
        props.mapValue !== undefined &&
        props.mapValue !== null &&
        props.mapValue !== '' &&
        props.mapOptions.some(option => option.value === mapNumeric)
            ? mapNumeric
            : '';
    const showMapTools = props.showMap && (props.mapOptions.length > 1 || props.hasMapReload);
    return (
        <Box
            sx={{
                minHeight: props.showMap ? 280 : 0,
                display: 'grid',
                gridTemplateColumns: sideBySide ? 'minmax(0, 1.65fr) minmax(250px, .7fr)' : '1fr',
                gap: 1.5,
                alignItems: 'start',
            }}
        >
            {props.showMap ? (
                <Box
                    sx={{
                        width: '100%',
                        minWidth: 0,
                        minHeight: 0,
                        aspectRatio: size === 'narrow' ? '1 / 1' : '16 / 10',
                        alignSelf: 'start',
                        position: 'relative',
                        overflow: 'hidden',
                        borderRadius: '18px',
                        bgcolor: theme.mapBg,
                        border: `1px solid ${theme.panelBorder}`,
                        display: 'grid',
                        placeItems: 'center',
                    }}
                >
                    {props.mapSource ? (
                        <Box
                            component="img"
                            src={props.mapSource}
                            alt={text('mapAlt')}
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
                        <Box sx={{ textAlign: 'center', color: theme.muted }}>
                            <MapIcon sx={{ fontSize: 48 }} />
                            <Typography variant="body2">{text('noMapAvailable')}</Typography>
                        </Box>
                    )}
                    {showMapTools ? (
                        <Box
                            sx={{
                                position: 'absolute',
                                top: 8,
                                right: 8,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5,
                                zIndex: 1,
                            }}
                        >
                            {props.mapOptions.length > 1 ? (
                                <Select
                                    size="small"
                                    value={mapSelected}
                                    displayEmpty
                                    onChange={event => props.onMap(Number(event.target.value))}
                                    inputProps={{ 'aria-label': text('selectMap') }}
                                    MenuProps={{ disablePortal: false }}
                                    sx={{
                                        ...theme.select,
                                        minWidth: 130,
                                        bgcolor: theme.surfaceBg,
                                        '& .MuiSelect-select': { py: 0.55, fontSize: 13, fontWeight: 700 },
                                    }}
                                >
                                    {mapSelected === '' ? (
                                        <MenuItem
                                            value=""
                                            disabled
                                        >
                                            {text('selectMap')}
                                        </MenuItem>
                                    ) : null}
                                    {props.mapOptions.map(option => (
                                        <MenuItem
                                            key={option.value}
                                            value={option.value}
                                        >
                                            {option.label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            ) : null}
                            {props.hasMapReload ? (
                                <Tooltip title={text('reloadMap')}>
                                    <IconButton
                                        size="small"
                                        aria-label={text('reloadMap')}
                                        onClick={props.onMapReload}
                                        sx={{
                                            color: theme.muted,
                                            bgcolor: theme.surfaceBg,
                                            border: `1px solid ${theme.panelBorder}`,
                                            '&:hover': { color: theme.accent, bgcolor: theme.surfaceBg },
                                        }}
                                    >
                                        <RefreshIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            ) : null}
                        </Box>
                    ) : null}
                </Box>
            ) : null}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, minWidth: 0 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1 }}>
                    <Metric
                        theme={theme}
                        icon={<BatteryFullIcon />}
                        value={props.battery}
                        label={text('battery')}
                    />
                    <Metric
                        theme={theme}
                        icon={<SquareFootIcon />}
                        value={props.area}
                        label={text('area')}
                    />
                    <Metric
                        theme={theme}
                        icon={<ScheduleIcon />}
                        value={props.time}
                        label={text('time')}
                    />
                </Box>
                <Box sx={{ ...theme.panel, p: 1.25 }}>
                    <Label theme={theme}>{text('suctionPower')}</Label>
                    <Box sx={{ mt: 0.5 }}>
                        <FanSelect
                            theme={theme}
                            ariaLabel={text('suctionPower')}
                            value={props.fan}
                            options={props.fanOptions}
                            currentLabel={text('current')}
                            onChange={props.onFan}
                        />
                    </Box>
                </Box>
                <Box sx={{ ...theme.panel, p: 1.25, display: 'grid', gap: 1, alignContent: 'start' }}>
                    <Box>
                        <Label theme={theme}>{text('quickControls')}</Label>
                        <Typography
                            variant="body2"
                            sx={{ mt: 0.35, fontWeight: 750 }}
                        >
                            {props.stateLabel}
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
                            theme={theme}
                            size={size}
                            label={text('start')}
                            icon={<PlayArrowIcon />}
                            onClick={props.onStart}
                            primary
                        />
                        <ControlButton
                            theme={theme}
                            size={size}
                            label={text('pause')}
                            icon={<PauseIcon />}
                            onClick={props.onPause}
                        />
                        <ControlButton
                            theme={theme}
                            size={size}
                            label={text('dock')}
                            icon={<HomeIcon />}
                            onClick={props.onHome}
                        />
                        <ControlButton
                            theme={theme}
                            size={size}
                            label={text('find')}
                            icon={<LocationSearchingIcon />}
                            onClick={props.onFind}
                        />
                    </Box>
                </Box>
                <Box
                    sx={{
                        ...theme.panel,
                        p: 1.25,
                        borderColor: props.hasError ? theme.critical : theme.panelBorder,
                    }}
                >
                    <Label theme={theme}>{text('robotHealth')}</Label>
                    <Typography
                        variant="body2"
                        title={props.errorLabel}
                        sx={{
                            mt: 0.5,
                            color: props.hasError ? theme.critical : theme.good,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}
                    >
                        {props.errorLabel}
                    </Typography>
                </Box>
            </Box>
        </Box>
    );
});

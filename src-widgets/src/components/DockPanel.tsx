import React from 'react';

import { Box, Typography } from '@mui/material';

import { DeleteSweepIcon, DryIcon, LocalLaundryServiceIcon, PauseIcon, StopIcon } from '../icons';
import type { DockLevel } from '../lib/format';
import type { TextFunction } from '../lib/i18n';
import type { ContainerSize } from '../lib/types';
import type { WidgetTheme } from '../theme';
import { ControlButton, Label } from './primitives';

export interface DockPanelProps {
    theme: WidgetTheme;
    text: TextFunction;
    size: ContainerSize;
    hasStatus: boolean;
    statusLabel: string;
    level: DockLevel;
    hasDustCollect: boolean;
    hasWashMop: boolean;
    hasPauseWashMop: boolean;
    hasStartDrying: boolean;
    hasStopDrying: boolean;
    onDustCollect: () => void;
    onWashMop: () => void;
    onPauseWashMop: () => void;
    onStartDrying: () => void;
    onStopDrying: () => void;
}

/**
 * Dock station status and actions (empty dust bin, wash and dry the mop).
 * Buttons appear only for the states the adapter created for the robot's dock.
 */
export const DockPanel = React.memo(function DockPanel(props: DockPanelProps): React.JSX.Element | null {
    const { theme, text, size } = props;
    const hasAction =
        props.hasDustCollect ||
        props.hasWashMop ||
        props.hasPauseWashMop ||
        props.hasStartDrying ||
        props.hasStopDrying;
    if (!props.hasStatus && !hasAction) {
        return null;
    }
    const color = props.level === 'critical' ? theme.critical : props.level === 'busy' ? theme.accent : theme.good;
    return (
        <Box
            sx={{
                ...theme.panel,
                p: 1.25,
                display: 'grid',
                gap: 1,
                alignContent: 'start',
                borderColor: props.level === 'critical' ? theme.critical : theme.panelBorder,
            }}
        >
            <Box>
                <Label theme={theme}>{text('dockStation')}</Label>
                {props.hasStatus ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5 }}>
                        <Box
                            sx={{
                                width: 9,
                                height: 9,
                                borderRadius: '50%',
                                bgcolor: color,
                                flex: '0 0 auto',
                            }}
                        />
                        <Typography
                            variant="body2"
                            noWrap
                            title={props.statusLabel}
                            sx={{ fontWeight: 750, color }}
                        >
                            {props.statusLabel}
                        </Typography>
                    </Box>
                ) : null}
            </Box>
            {hasAction ? (
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 120px), 1fr))',
                        gridAutoRows: 'minmax(48px, auto)',
                        gap: 1,
                    }}
                >
                    {props.hasDustCollect ? (
                        <ControlButton
                            theme={theme}
                            size={size}
                            label={text('dustCollect')}
                            icon={<DeleteSweepIcon />}
                            onClick={props.onDustCollect}
                        />
                    ) : null}
                    {props.hasWashMop ? (
                        <ControlButton
                            theme={theme}
                            size={size}
                            label={text('washMop')}
                            icon={<LocalLaundryServiceIcon />}
                            onClick={props.onWashMop}
                        />
                    ) : null}
                    {props.hasPauseWashMop ? (
                        <ControlButton
                            theme={theme}
                            size={size}
                            label={text('pauseWashMop')}
                            icon={<PauseIcon />}
                            onClick={props.onPauseWashMop}
                        />
                    ) : null}
                    {props.hasStartDrying ? (
                        <ControlButton
                            theme={theme}
                            size={size}
                            label={text('startDrying')}
                            icon={<DryIcon />}
                            onClick={props.onStartDrying}
                        />
                    ) : null}
                    {props.hasStopDrying ? (
                        <ControlButton
                            theme={theme}
                            size={size}
                            label={text('stopDrying')}
                            icon={<StopIcon />}
                            onClick={props.onStopDrying}
                        />
                    ) : null}
                </Box>
            ) : null}
        </Box>
    );
});

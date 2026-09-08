import React from 'react';

import { Box, Chip, IconButton, Switch, Tooltip, Typography } from '@mui/material';

import { DoNotDisturbOnIcon, PlayArrowIcon, SkipNextIcon, TimerIcon } from '../icons';
import type { TextFunction } from '../lib/i18n';
import { TIMER_DISABLED, TIMER_SKIP, formatTimerDays, formatTimerTime } from '../lib/timers';
import type { ContainerSize, TimerItem } from '../lib/types';
import type { WidgetTheme } from '../theme';
import { Label } from './primitives';

const TimerRow = React.memo(function TimerRow({
    theme,
    text,
    timer,
    weekdays,
    onEnabled,
    onSkip,
    onStart,
}: {
    theme: WidgetTheme;
    text: TextFunction;
    timer: TimerItem;
    weekdays: string[];
    onEnabled: (timer: TimerItem, enabled: boolean) => void;
    onSkip: (timer: TimerItem) => void;
    onStart: (timer: TimerItem) => void;
}): React.JSX.Element {
    const enabled = timer.value !== undefined && timer.value !== TIMER_DISABLED;
    const skipped = timer.value === TIMER_SKIP;
    const title = `${formatTimerDays(timer.days, weekdays, text('everyDay'))} ${formatTimerTime(timer.hour, timer.minute)}`;
    const caption = !enabled
        ? text('disabled')
        : skipped
          ? text('nextRunSkipped')
          : timer.nextRun || (timer.channels.length ? timer.channels.join(', ') : text('enabled'));
    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                minHeight: 44,
                px: 1,
                borderRadius: '10px',
                border: `1px solid ${theme.panelBorder}`,
                opacity: enabled ? 1 : 0.65,
            }}
        >
            <Switch
                size="small"
                checked={enabled}
                onChange={event => onEnabled(timer, event.target.checked)}
                slotProps={{ input: { 'aria-label': `${text('timerEnabled')} ${title}` } }}
                sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': { color: theme.accent },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: theme.accent },
                }}
            />
            <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography
                    variant="body2"
                    noWrap
                    title={title}
                    sx={{ fontWeight: 750 }}
                >
                    {title}
                </Typography>
                <Typography
                    variant="caption"
                    noWrap
                    title={caption}
                    sx={{ display: 'block', color: skipped ? theme.warning : theme.muted }}
                >
                    {caption}
                </Typography>
            </Box>
            <Tooltip title={text('skipOnce')}>
                <span>
                    <IconButton
                        size="small"
                        aria-label={`${text('skipOnce')} ${title}`}
                        disabled={!enabled || skipped}
                        onClick={() => onSkip(timer)}
                        sx={{ color: theme.muted, '&:hover': { color: theme.accent, bgcolor: theme.panelBorder } }}
                    >
                        <SkipNextIcon fontSize="small" />
                    </IconButton>
                </span>
            </Tooltip>
            <Tooltip title={text('startTimerNow')}>
                <IconButton
                    size="small"
                    aria-label={`${text('startTimerNow')} ${title}`}
                    onClick={() => onStart(timer)}
                    sx={{ color: theme.muted, '&:hover': { color: theme.accent, bgcolor: theme.panelBorder } }}
                >
                    <PlayArrowIcon fontSize="small" />
                </IconButton>
            </Tooltip>
        </Box>
    );
});

export interface SchedulePanelProps {
    theme: WidgetTheme;
    text: TextFunction;
    size: ContainerSize;
    hasDnd: boolean;
    dnd: boolean;
    hasNextTimer: boolean;
    nextTimer: string;
    timers: TimerItem[];
    weekdays: string[];
    onTimerEnabled: (timer: TimerItem, enabled: boolean) => void;
    onTimerSkip: (timer: TimerItem) => void;
    onTimerStart: (timer: TimerItem) => void;
}

/**
 * Do-not-disturb indicator, the next scheduled run and the cleaning timers of the adapter with
 * their enable switch, skip-once and start-now actions.
 */
export const SchedulePanel = React.memo(function SchedulePanel(props: SchedulePanelProps): React.JSX.Element | null {
    const { theme, text } = props;
    if (!props.hasDnd && !props.hasNextTimer && !props.timers.length) {
        return null;
    }
    return (
        <Box sx={{ ...theme.panel, p: 1.25, display: 'grid', gap: 1, alignContent: 'start' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                <Label theme={theme}>{text('schedule')}</Label>
                {props.hasDnd ? (
                    <Chip
                        size="small"
                        icon={<DoNotDisturbOnIcon />}
                        label={`${text('doNotDisturb')}: ${props.dnd ? text('dndActive') : text('dndInactive')}`}
                        sx={{
                            color: props.dnd ? theme.warning : theme.muted,
                            border: '1px solid',
                            borderColor: props.dnd ? theme.warning : theme.panelBorder,
                            bgcolor: 'transparent',
                            '& .MuiChip-icon': { color: 'inherit' },
                        }}
                    />
                ) : null}
            </Box>
            {props.hasNextTimer ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Box sx={{ color: theme.accent, lineHeight: 0, '& svg': { fontSize: 18 } }}>
                        <TimerIcon />
                    </Box>
                    <Typography
                        variant="body2"
                        noWrap
                        title={props.nextTimer}
                        sx={{ fontWeight: 750 }}
                    >
                        {text('nextTimer')}: {props.nextTimer || text('unknown')}
                    </Typography>
                </Box>
            ) : null}
            {props.timers.length ? (
                <Box sx={{ display: 'grid', gap: 0.75 }}>
                    {props.timers.map(timer => (
                        <TimerRow
                            key={timer.oid}
                            theme={theme}
                            text={text}
                            timer={timer}
                            weekdays={props.weekdays}
                            onEnabled={props.onTimerEnabled}
                            onSkip={props.onTimerSkip}
                            onStart={props.onTimerStart}
                        />
                    ))}
                </Box>
            ) : (
                <Typography
                    variant="caption"
                    sx={{ color: theme.muted }}
                >
                    {text('noTimersText')}
                </Typography>
            )}
        </Box>
    );
});

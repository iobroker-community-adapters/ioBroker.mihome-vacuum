import React from 'react';

import { Box, Tooltip, Typography } from '@mui/material';

import { CheckCircleIcon, HistoryIcon, ScheduleIcon, SquareFootIcon } from '../icons';
import { parseHistory } from '../lib/history';
import type { TextFunction } from '../lib/i18n';
import type { StateValue } from '../lib/types';
import type { WidgetTheme } from '../theme';
import { EmptyState, Metric } from './primitives';

/**
 * Cleaning history: total counters plus the most recent runs of `history.allTableJSON`.
 */
export const HistoryPanel = React.memo(function HistoryPanel({
    theme,
    text,
    historyRaw,
    limit,
    totalCleanups,
    totalArea,
    totalTime,
}: {
    theme: WidgetTheme;
    text: TextFunction;
    historyRaw: StateValue | undefined;
    limit: number;
    totalCleanups: string;
    totalArea: string;
    totalTime: string;
}): React.JSX.Element {
    const entries = React.useMemo(() => parseHistory(historyRaw), [historyRaw]);
    const shown = entries.slice(0, Math.max(1, limit || 12));
    return (
        <Box sx={{ display: 'grid', gap: 1.25 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1 }}>
                <Metric
                    theme={theme}
                    icon={<HistoryIcon />}
                    value={totalCleanups}
                    label={text('totalCleanups')}
                />
                <Metric
                    theme={theme}
                    icon={<SquareFootIcon />}
                    value={totalArea}
                    label={text('totalArea')}
                />
                <Metric
                    theme={theme}
                    icon={<ScheduleIcon />}
                    value={totalTime}
                    label={text('totalTime')}
                />
            </Box>
            {shown.length ? (
                <Box
                    component="ul"
                    sx={{ ...theme.panel, p: 0, m: 0, overflow: 'hidden', listStyle: 'none' }}
                >
                    {shown.map((entry, index) => {
                        const failed = Boolean(entry.error) || !entry.completed;
                        return (
                            <Box
                                component="li"
                                key={`${entry.date}-${entry.start}-${index}`}
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: 'minmax(90px, 1.3fr) repeat(2, minmax(70px, 1fr)) 34px',
                                    gap: 1,
                                    alignItems: 'center',
                                    px: 1.5,
                                    py: 1.15,
                                    borderBottom: index === shown.length - 1 ? 0 : `1px solid ${theme.track}`,
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
                                        sx={{ color: theme.muted }}
                                    >
                                        {entry.start}
                                    </Typography>
                                </Box>
                                <Box>
                                    <Typography variant="body2">{entry.area}</Typography>
                                    <Typography
                                        variant="caption"
                                        sx={{ color: theme.muted }}
                                    >
                                        {text('area')}
                                    </Typography>
                                </Box>
                                <Box>
                                    <Typography variant="body2">{entry.duration}</Typography>
                                    <Typography
                                        variant="caption"
                                        sx={{ color: theme.muted }}
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
                                    <Box sx={{ color: failed ? theme.critical : theme.good, lineHeight: 0 }}>
                                        {failed ? (
                                            <HistoryIcon fontSize="small" />
                                        ) : (
                                            <CheckCircleIcon fontSize="small" />
                                        )}
                                    </Box>
                                </Tooltip>
                            </Box>
                        );
                    })}
                </Box>
            ) : (
                <EmptyState
                    theme={theme}
                    icon={<HistoryIcon />}
                    title={text('noCleaningHistory')}
                    text={text('noCleaningHistoryText')}
                />
            )}
        </Box>
    );
});

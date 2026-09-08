import React from 'react';

import { Box, IconButton, LinearProgress, Tooltip, Typography } from '@mui/material';

import { BuildCircleIcon, RestartAltIcon } from '../icons';
import { consumableLevel, percent } from '../lib/format';
import type { TextFunction } from '../lib/i18n';
import type { ConsumableItem, ContainerSize } from '../lib/types';
import type { WidgetTheme } from '../theme';
import { EmptyState } from './primitives';

const ConsumableCard = React.memo(function ConsumableCard({
    theme,
    text,
    item,
    onReset,
}: {
    theme: WidgetTheme;
    text: TextFunction;
    item: ConsumableItem;
    onReset: (item: ConsumableItem) => void;
}): React.JSX.Element {
    const value = percent(item.value);
    const level = item.counter ? 'good' : consumableLevel(value);
    const color = item.counter
        ? theme.accent
        : level === 'critical'
          ? theme.critical
          : level === 'warning'
            ? theme.warning
            : theme.good;
    const hint = item.counter
        ? text('usageCounter')
        : level === 'critical'
          ? text('replacementRecommended')
          : level === 'warning'
            ? text('checkSoon')
            : text('goodCondition');
    return (
        <Box sx={{ ...theme.panel, p: 1.5, minHeight: 126, display: 'grid', gap: 1 }}>
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
                    {item.counter ? (item.value ?? '—') : `${value}%`}
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
                        bgcolor: theme.track,
                        '& .MuiLinearProgress-bar': { borderRadius: 9, bgcolor: color },
                    }}
                />
            )}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography
                    variant="caption"
                    sx={{ color: theme.muted }}
                >
                    {hint}
                </Typography>
                <Tooltip title={`${text('reset')} ${item.label}`}>
                    <span>
                        <IconButton
                            size="small"
                            aria-label={`${text('reset')} ${item.label}`}
                            disabled={!item.resetOid}
                            onClick={() => onReset(item)}
                            sx={{ color: theme.muted, '&:hover': { color: theme.accent, bgcolor: theme.panelBorder } }}
                        >
                            <RestartAltIcon fontSize="small" />
                        </IconButton>
                    </span>
                </Tooltip>
            </Box>
        </Box>
    );
});

/**
 * Consumable cards. Only consumables whose state currently has a value are listed, so the same
 * widget adapts to the different feature sets of Roborock, Viomi and Dreame models.
 */
export const Maintenance = React.memo(function Maintenance({
    theme,
    text,
    size,
    items,
    onReset,
}: {
    theme: WidgetTheme;
    text: TextFunction;
    size: ContainerSize;
    items: ConsumableItem[];
    onReset: (item: ConsumableItem) => void;
}): React.JSX.Element {
    if (!items.length) {
        return (
            <EmptyState
                theme={theme}
                icon={<BuildCircleIcon />}
                title={text('noMaintenanceData')}
                text={text('noMaintenanceText')}
            />
        );
    }
    const columns = size === 'narrow' ? 1 : size === 'medium' ? 2 : 3;
    return (
        <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 1.25 }}>
            {items.map(item => (
                <ConsumableCard
                    key={item.key}
                    theme={theme}
                    text={text}
                    item={item}
                    onReset={onReset}
                />
            ))}
        </Box>
    );
});

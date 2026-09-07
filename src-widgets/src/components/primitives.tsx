import React from 'react';

import { Box, Button, Typography } from '@mui/material';

import type { WidgetTheme } from '../theme';
import type { ContainerSize } from '../lib/types';

export const Label = React.memo(function Label({
    theme,
    children,
}: {
    theme: WidgetTheme;
    children: React.ReactNode;
}): React.JSX.Element {
    return (
        <Typography
            component="span"
            sx={theme.label}
        >
            {children}
        </Typography>
    );
});

export const SectionHeading = React.memo(function SectionHeading({
    theme,
    icon,
    title,
    subtitle,
}: {
    theme: WidgetTheme;
    icon: React.ReactNode;
    title: string;
    subtitle: string;
}): React.JSX.Element {
    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Box sx={{ color: theme.accent, lineHeight: 0 }}>{icon}</Box>
            <Box sx={{ minWidth: 0 }}>
                <Typography
                    variant="subtitle1"
                    sx={{ fontWeight: 800, lineHeight: 1.15 }}
                >
                    {title}
                </Typography>
                <Typography
                    variant="caption"
                    sx={{ color: theme.muted }}
                >
                    {subtitle}
                </Typography>
            </Box>
        </Box>
    );
});

export const Metric = React.memo(function Metric({
    theme,
    icon,
    value,
    label,
}: {
    theme: WidgetTheme;
    icon: React.ReactNode;
    value: string;
    label: string;
}): React.JSX.Element {
    return (
        <Box
            sx={{ ...theme.panel, p: 1.2, minWidth: 0 }}
            title={label}
        >
            <Box sx={{ color: theme.accent, lineHeight: 0 }}>{icon}</Box>
            <Typography
                variant="body2"
                noWrap
                sx={{ mt: 0.7, fontWeight: 800 }}
            >
                {value}
            </Typography>
            <Typography
                variant="caption"
                noWrap
                sx={{ display: 'block', color: theme.muted, mt: 0.15 }}
            >
                {label}
            </Typography>
        </Box>
    );
});

export const ControlButton = React.memo(function ControlButton({
    theme,
    size,
    label,
    icon,
    onClick,
    primary,
    disabled,
}: {
    theme: WidgetTheme;
    size: ContainerSize;
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    primary?: boolean;
    disabled?: boolean;
}): React.JSX.Element {
    const compact = size === 'narrow';
    return (
        <Button
            type="button"
            aria-label={label}
            title={label}
            onClick={onClick}
            disabled={disabled}
            variant={primary ? 'contained' : 'outlined'}
            startIcon={icon}
            sx={{
                minWidth: 0,
                px: compact ? 0.5 : 1,
                py: 1,
                borderRadius: '11px',
                textTransform: 'none',
                fontWeight: 750,
                color: primary ? theme.onAccent : theme.text,
                borderColor: theme.panelBorder,
                bgcolor: primary ? theme.accent : theme.panelBg,
                '&:hover': { borderColor: theme.accent, bgcolor: primary ? theme.accentHover : theme.panelBorder },
                '& .MuiButton-startIcon': { m: compact ? 0 : '0 8px 0 -4px' },
            }}
        >
            {compact ? null : label}
        </Button>
    );
});

export const EmptyState = React.memo(function EmptyState({
    theme,
    icon,
    title,
    text,
    minHeight,
}: {
    theme: WidgetTheme;
    icon: React.ReactNode;
    title: string;
    text: string;
    minHeight?: number;
}): React.JSX.Element {
    return (
        <Box
            sx={{
                ...theme.panel,
                minHeight: minHeight ?? 220,
                display: 'grid',
                placeItems: 'center',
                textAlign: 'center',
                p: 3,
            }}
        >
            <Box>
                <Box sx={{ color: theme.accent, opacity: 0.7, '& svg': { fontSize: 48 } }}>{icon}</Box>
                <Typography
                    variant="subtitle1"
                    sx={{ mt: 1, fontWeight: 750 }}
                >
                    {title}
                </Typography>
                <Typography
                    variant="body2"
                    sx={{ mt: 0.5, color: theme.muted, maxWidth: 360 }}
                >
                    {text}
                </Typography>
            </Box>
        </Box>
    );
});

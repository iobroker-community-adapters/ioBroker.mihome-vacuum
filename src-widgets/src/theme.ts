import { alpha, useTheme } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';

/** Colors and shared styles derived from the VIS 2 host theme (light or dark). */
export interface WidgetTheme {
    mode: 'light' | 'dark';
    accent: string;
    onAccent: string;
    accentHover: string;
    text: string;
    muted: string;
    panelBg: string;
    panelBorder: string;
    panelStrongBorder: string;
    surfaceBg: string;
    surfaceBorder: string;
    mapBg: string;
    good: string;
    warning: string;
    critical: string;
    track: string;
    panel: SxProps<Theme>;
    label: SxProps<Theme>;
    select: SxProps<Theme>;
}

/**
 * Derives the widget colors from the MUI theme of the VIS 2 host so the widget follows the
 * light/dark mode and the primary color of the view. An optional accent color overrides the
 * primary color.
 *
 * @param accentColor - optional CSS color configured on the widget
 */
export function useWidgetTheme(accentColor?: string): WidgetTheme {
    const theme = useTheme();
    const mode = theme.palette.mode === 'dark' ? 'dark' : 'light';
    const accent = accentColor && accentColor.trim() ? accentColor.trim() : theme.palette.primary.main;
    const onAccent = theme.palette.getContrastText(accent);
    const text = theme.palette.text.primary;
    const muted = theme.palette.text.secondary;
    const contrast = mode === 'dark' ? theme.palette.common.white : theme.palette.common.black;
    const panelBg = alpha(contrast, mode === 'dark' ? 0.05 : 0.035);
    const panelBorder = alpha(accent, mode === 'dark' ? 0.18 : 0.24);
    const surfaceBg = theme.palette.background.paper;

    return {
        mode,
        accent,
        onAccent,
        accentHover: alpha(accent, 0.85),
        text,
        muted,
        panelBg,
        panelBorder,
        panelStrongBorder: alpha(accent, 0.5),
        surfaceBg,
        surfaceBorder: alpha(accent, 0.16),
        mapBg: alpha(contrast, mode === 'dark' ? 0.08 : 0.05),
        good: theme.palette.success.main,
        warning: theme.palette.warning.main,
        critical: theme.palette.error.main,
        track: alpha(contrast, 0.1),
        panel: {
            bgcolor: panelBg,
            border: `1px solid ${panelBorder}`,
            borderRadius: '14px',
            color: text,
        },
        label: {
            color: muted,
            letterSpacing: '.08em',
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            display: 'block',
        },
        select: {
            color: text,
            borderRadius: '10px',
            bgcolor: alpha(contrast, mode === 'dark' ? 0.06 : 0.03),
            '& .MuiOutlinedInput-notchedOutline': { borderColor: panelBorder },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: alpha(accent, 0.6) },
            '& .MuiSvgIcon-root': { color: muted },
        },
    };
}

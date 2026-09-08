import React from 'react';

import { Box, Switch, Typography } from '@mui/material';

import { TextureIcon, WaterDropIcon, WavesIcon } from '../icons';
import { isOn } from '../lib/format';
import type { TextFunction } from '../lib/i18n';
import type { ContainerSize, FanOption, StateValue } from '../lib/types';
import type { WidgetTheme } from '../theme';
import { FanSelect } from './FanSelect';
import { Label } from './primitives';

const SettingField = React.memo(function SettingField({
    theme,
    icon,
    label,
    children,
}: {
    theme: WidgetTheme;
    icon: React.ReactNode;
    label: string;
    children: React.ReactNode;
}): React.JSX.Element {
    return (
        <Box sx={{ minWidth: 0, display: 'grid', gap: 0.5, alignContent: 'start' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: theme.muted }}>
                <Box sx={{ lineHeight: 0, color: theme.accent, '& svg': { fontSize: 18 } }}>{icon}</Box>
                <Typography
                    variant="caption"
                    noWrap
                    sx={{ fontWeight: 700 }}
                >
                    {label}
                </Typography>
            </Box>
            {children}
        </Box>
    );
});

export interface CleaningSettingsProps {
    theme: WidgetTheme;
    text: TextFunction;
    size: ContainerSize;
    hasWater: boolean;
    water: StateValue | undefined;
    waterOptions: FanOption[];
    hasMopMode: boolean;
    mopMode: StateValue | undefined;
    mopOptions: FanOption[];
    hasCarpet: boolean;
    carpet: StateValue | undefined;
    onWater: (value: number) => void;
    onMopMode: (value: number) => void;
    onCarpet: (value: boolean) => void;
}

/**
 * Water level, mop mode and carpet mode. Each control is shown only when the adapter created the
 * matching state for the robot, so the panel adapts to Roborock, Viomi and Dreame feature sets.
 */
export const CleaningSettings = React.memo(function CleaningSettings(
    props: CleaningSettingsProps,
): React.JSX.Element | null {
    const { theme, text, size } = props;
    if (!props.hasWater && !props.hasMopMode && !props.hasCarpet) {
        return null;
    }
    const carpetOn = isOn(props.carpet);
    return (
        <Box sx={{ ...theme.panel, p: 1.25, display: 'grid', gap: 1, alignContent: 'start' }}>
            <Label theme={theme}>{text('cleaningSettings')}</Label>
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: size === 'narrow' ? '1fr' : 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
                    gap: 1.25,
                }}
            >
                {props.hasWater ? (
                    <SettingField
                        theme={theme}
                        icon={<WaterDropIcon />}
                        label={text('waterLevel')}
                    >
                        <FanSelect
                            theme={theme}
                            ariaLabel={text('waterLevel')}
                            value={props.water}
                            options={props.waterOptions}
                            currentLabel={text('current')}
                            onChange={props.onWater}
                        />
                    </SettingField>
                ) : null}
                {props.hasMopMode ? (
                    <SettingField
                        theme={theme}
                        icon={<WavesIcon />}
                        label={text('mopRoute')}
                    >
                        <FanSelect
                            theme={theme}
                            ariaLabel={text('mopRoute')}
                            value={props.mopMode}
                            options={props.mopOptions}
                            currentLabel={text('current')}
                            onChange={props.onMopMode}
                        />
                    </SettingField>
                ) : null}
                {props.hasCarpet ? (
                    <SettingField
                        theme={theme}
                        icon={<TextureIcon />}
                        label={text('carpetMode')}
                    >
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 1,
                                minHeight: 40,
                                px: 1,
                                borderRadius: '10px',
                                border: `1px solid ${theme.panelBorder}`,
                            }}
                        >
                            <Typography
                                variant="body2"
                                sx={{ fontWeight: 700 }}
                            >
                                {carpetOn ? text('on') : text('off')}
                            </Typography>
                            <Switch
                                size="small"
                                checked={carpetOn}
                                onChange={event => props.onCarpet(event.target.checked)}
                                slotProps={{ input: { 'aria-label': text('carpetMode') } }}
                                sx={{
                                    '& .MuiSwitch-switchBase.Mui-checked': { color: theme.accent },
                                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                                        bgcolor: theme.accent,
                                    },
                                }}
                            />
                        </Box>
                    </SettingField>
                ) : null}
            </Box>
        </Box>
    );
});

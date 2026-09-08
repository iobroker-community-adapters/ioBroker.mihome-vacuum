import React from 'react';

import { FormControl, MenuItem, Select } from '@mui/material';

import type { WidgetTheme } from '../theme';
import type { FanOption, StateValue } from '../lib/types';

/**
 * Suction level selector shared by the overview and the room cards.
 * A value that is not part of the catalogue (for example a custom percentage) is kept selectable
 * so the current robot setting is always visible.
 */
export const FanSelect = React.memo(function FanSelect({
    theme,
    ariaLabel,
    value,
    options,
    disabled,
    currentLabel,
    onChange,
}: {
    theme: WidgetTheme;
    ariaLabel: string;
    value: StateValue | undefined;
    options: FanOption[];
    disabled?: boolean;
    currentLabel: string;
    onChange: (value: number) => void;
}): React.JSX.Element {
    const numeric = Number(value);
    const known = Number.isFinite(numeric) && value !== null && value !== '';
    const listed = known && options.some(option => option.value === numeric);
    const selected = known ? numeric : (options[Math.min(1, options.length - 1)]?.value ?? '');
    return (
        <FormControl
            size="small"
            fullWidth
        >
            <Select
                value={selected}
                disabled={disabled}
                onChange={event => onChange(Number(event.target.value))}
                inputProps={{ 'aria-label': ariaLabel }}
                sx={theme.select}
                MenuProps={{ disablePortal: false }}
            >
                {options.map(option => (
                    <MenuItem
                        key={option.value}
                        value={option.value}
                    >
                        {option.label}
                    </MenuItem>
                ))}
                {known && !listed ? (
                    <MenuItem value={numeric}>
                        {currentLabel} ({numeric})
                    </MenuItem>
                ) : null}
            </Select>
        </FormControl>
    );
});

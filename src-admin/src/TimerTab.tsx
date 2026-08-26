import React from 'react';

import { Add, Delete, Refresh, Save, ScheduleRounded } from '@mui/icons-material';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Checkbox,
    Chip,
    CircularProgress,
    FormControl,
    IconButton,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
} from '@mui/material';
import { I18n } from '@iobroker/gui-components/build/i18n';

import type { AdminTimer, TimerOption } from './types';

const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const hours = Array.from({ length: 24 }, (_value, hour) => hour);
const minutes = Array.from({ length: 12 }, (_value, index) => index * 5);

const timerCardSx = {
    borderRadius: 3,
    backgroundImage: 'linear-gradient(145deg, rgba(77, 171, 245, 0.045), transparent 42%)',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.08)',
} as const;

interface TimerTabProps {
    timers: AdminTimer[];
    rooms: TimerOption[];
    channels: TimerOption[];
    loading: boolean;
    saving: boolean;
    dirty: boolean;
    onChange: (timers: AdminTimer[]) => void;
    onReload: () => void;
    onSave: () => void;
}

function optionName(option: TimerOption): string {
    if (typeof option.name === 'string') {
        return option.name;
    }
    const language = I18n.getLanguage();
    return option.name[language] || option.name.en || option.id;
}

export function TimerTab(props: TimerTabProps): React.JSX.Element {
    const roomNames = new Map(props.rooms.map(room => [room.id, optionName(room)]));
    const channelNames = new Map(props.channels.map(channel => [channel.id, optionName(channel)]));
    const dayNames = new Map(days.map((day, dayIndex) => [String(dayIndex), I18n.t(day)]));
    const renderChips = (values: string[], labels: Map<string, string>): React.JSX.Element => (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', py: 0.25 }}>
            {values.map(value => (
                <Chip
                    key={value}
                    label={labels.get(value) || value}
                    size="small"
                    color="primary"
                    variant="outlined"
                />
            ))}
        </Box>
    );
    const updateTimer = (index: number, patch: Partial<AdminTimer>): void => {
        props.onChange(
            props.timers.map((timer, timerIndex) => (timerIndex === index ? { ...timer, ...patch } : timer)),
        );
    };
    const addTimer = (): void => {
        props.onChange([...props.timers, { enabled: true, day: ['1'], hour: 8, minute: 0, rooms: [], channels: [] }]);
    };

    return (
        <Card
            variant="outlined"
            sx={timerCardSx}
        >
            <CardContent>
                <Stack spacing={2.5}>
                    <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1}
                        alignItems={{ sm: 'center' }}
                    >
                        <Box sx={{ flex: 1, minWidth: 240 }}>
                            <Stack
                                direction="row"
                                spacing={1}
                                alignItems="center"
                            >
                                <ScheduleRounded color="primary" />
                                <Typography variant="h6">{I18n.t('Timer')}</Typography>
                            </Stack>
                            <Typography
                                variant="body2"
                                color="text.secondary"
                            >
                                {I18n.t(
                                    'add timer and choose room channels directly and/or choose rooms, which finds assigned room channels',
                                )}
                            </Typography>
                        </Box>
                        <Button
                            startIcon={<Add />}
                            onClick={addTimer}
                            disabled={props.loading || props.saving}
                        >
                            {I18n.t('add')}
                        </Button>
                        <Button
                            startIcon={props.loading ? <CircularProgress size={18} /> : <Refresh />}
                            onClick={props.onReload}
                            disabled={props.loading || props.saving}
                        >
                            {I18n.t('Reload')}
                        </Button>
                        <Button
                            variant="contained"
                            startIcon={props.saving ? <CircularProgress size={18} /> : <Save />}
                            onClick={props.onSave}
                            disabled={!props.dirty || props.loading || props.saving}
                        >
                            {I18n.t('Save timers')}
                        </Button>
                    </Stack>
                    {!props.loading && !props.timers.length ? (
                        <Alert
                            severity="info"
                            variant="outlined"
                            sx={{ borderRadius: 2 }}
                        >
                            {I18n.t('No timers configured')}
                        </Alert>
                    ) : null}
                    <TableContainer sx={{ overflowX: 'auto', borderRadius: 2 }}>
                        <Table
                            size="small"
                            sx={{ minWidth: 1050 }}
                        >
                            <TableHead>
                                <TableRow>
                                    <TableCell>{I18n.t('enabled')}</TableCell>
                                    <TableCell sx={{ minWidth: 220 }}>{I18n.t('day')}</TableCell>
                                    <TableCell sx={{ minWidth: 100 }}>{I18n.t('hour')}</TableCell>
                                    <TableCell sx={{ minWidth: 100 }}>{I18n.t('minute')}</TableCell>
                                    <TableCell sx={{ minWidth: 220 }}>{I18n.t('rooms')}</TableCell>
                                    <TableCell sx={{ minWidth: 220 }}>{I18n.t('channels')}</TableCell>
                                    <TableCell />
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {props.timers.map((timer, index) => (
                                    <TableRow
                                        key={timer.id || `new-${index}`}
                                        sx={{
                                            '&:nth-of-type(odd)': { backgroundColor: 'rgba(128, 128, 128, 0.035)' },
                                            '&:hover': { backgroundColor: 'rgba(66, 165, 245, 0.065)' },
                                        }}
                                    >
                                        <TableCell>
                                            <Checkbox
                                                checked={timer.enabled}
                                                onChange={event =>
                                                    updateTimer(index, { enabled: event.target.checked })
                                                }
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <FormControl
                                                fullWidth
                                                size="small"
                                            >
                                                <InputLabel>{I18n.t('day')}</InputLabel>
                                                <Select
                                                    multiple
                                                    label={I18n.t('day')}
                                                    value={timer.day}
                                                    renderValue={selected => renderChips(selected, dayNames)}
                                                    onChange={event =>
                                                        updateTimer(index, { day: event.target.value as string[] })
                                                    }
                                                >
                                                    {days.map((day, dayIndex) => (
                                                        <MenuItem
                                                            key={day}
                                                            value={String(dayIndex)}
                                                        >
                                                            {I18n.t(day)}
                                                        </MenuItem>
                                                    ))}
                                                </Select>
                                            </FormControl>
                                        </TableCell>
                                        <TableCell>
                                            <Select
                                                fullWidth
                                                size="small"
                                                value={timer.hour}
                                                onChange={event =>
                                                    updateTimer(index, { hour: Number(event.target.value) })
                                                }
                                            >
                                                {hours.map(hour => (
                                                    <MenuItem
                                                        key={hour}
                                                        value={hour}
                                                    >
                                                        {String(hour).padStart(2, '0')}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </TableCell>
                                        <TableCell>
                                            <Select
                                                fullWidth
                                                size="small"
                                                value={timer.minute}
                                                onChange={event =>
                                                    updateTimer(index, { minute: Number(event.target.value) })
                                                }
                                            >
                                                {minutes.map(minute => (
                                                    <MenuItem
                                                        key={minute}
                                                        value={minute}
                                                    >
                                                        {String(minute).padStart(2, '0')}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </TableCell>
                                        <TableCell>
                                            <Select
                                                multiple
                                                fullWidth
                                                size="small"
                                                value={timer.rooms}
                                                displayEmpty
                                                renderValue={selected => renderChips(selected, roomNames)}
                                                onChange={event =>
                                                    updateTimer(index, { rooms: event.target.value as string[] })
                                                }
                                            >
                                                {props.rooms.map(room => (
                                                    <MenuItem
                                                        key={room.id}
                                                        value={room.id}
                                                    >
                                                        {optionName(room)}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </TableCell>
                                        <TableCell>
                                            <Select
                                                multiple
                                                fullWidth
                                                size="small"
                                                value={timer.channels}
                                                displayEmpty
                                                renderValue={selected => renderChips(selected, channelNames)}
                                                onChange={event =>
                                                    updateTimer(index, { channels: event.target.value as string[] })
                                                }
                                            >
                                                {props.channels.map(channel => (
                                                    <MenuItem
                                                        key={channel.id}
                                                        value={channel.id}
                                                    >
                                                        {optionName(channel)}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </TableCell>
                                        <TableCell align="right">
                                            <IconButton
                                                aria-label={I18n.t('delete')}
                                                color="error"
                                                onClick={() =>
                                                    props.onChange(props.timers.filter((_item, i) => i !== index))
                                                }
                                            >
                                                <Delete />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Stack>
            </CardContent>
        </Card>
    );
}

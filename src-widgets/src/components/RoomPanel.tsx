import React from 'react';

import { Box, Button, Typography } from '@mui/material';

import { HomeIcon, PlayArrowIcon } from '../icons';
import type { TextFunction } from '../lib/i18n';
import type { ContainerSize, FanOption, RoomItem } from '../lib/types';
import type { WidgetTheme } from '../theme';
import { FanSelect } from './FanSelect';
import { EmptyState } from './primitives';

const RoomCard = React.memo(function RoomCard({
    theme,
    text,
    room,
    fanOptions,
    onFan,
    onStart,
}: {
    theme: WidgetTheme;
    text: TextFunction;
    room: RoomItem;
    fanOptions: FanOption[];
    onFan: (room: RoomItem, value: number) => void;
    onStart: (room: RoomItem) => void;
}): React.JSX.Element {
    return (
        <Box sx={{ ...theme.panel, p: 1.25, display: 'grid', gap: 1 }}>
            <Typography
                variant="subtitle2"
                noWrap
                title={room.name}
                sx={{ fontWeight: 800 }}
            >
                {room.name}
            </Typography>
            <FanSelect
                theme={theme}
                ariaLabel={`${room.name} ${text('suctionPower')}`}
                disabled={!room.fanOid}
                value={room.fan}
                options={fanOptions}
                currentLabel={text('current')}
                onChange={value => onFan(room, value)}
            />
            <Button
                variant="contained"
                startIcon={<PlayArrowIcon />}
                onClick={() => onStart(room)}
                sx={{
                    color: theme.onAccent,
                    bgcolor: theme.accent,
                    textTransform: 'none',
                    fontWeight: 800,
                    borderRadius: '10px',
                    '&:hover': { bgcolor: theme.accentHover },
                }}
            >
                {text('startRoom')}
            </Button>
        </Box>
    );
});

/**
 * Room cards with a start action and the room's own suction level.
 * In the editor an empty list shows a hint instead of disappearing silently.
 */
export const RoomPanel = React.memo(function RoomPanel({
    theme,
    text,
    size,
    rooms,
    fanOptions,
    editMode,
    onFan,
    onStart,
}: {
    theme: WidgetTheme;
    text: TextFunction;
    size: ContainerSize;
    rooms: RoomItem[];
    fanOptions: FanOption[];
    editMode: boolean;
    onFan: (room: RoomItem, value: number) => void;
    onStart: (room: RoomItem) => void;
}): React.JSX.Element | null {
    if (!rooms.length) {
        return editMode ? (
            <EmptyState
                theme={theme}
                icon={<HomeIcon />}
                title={text('noRoomsConfigured')}
                text={text('noRoomsConfiguredText')}
                minHeight={140}
            />
        ) : null;
    }
    const columns = size === 'narrow' ? 1 : size === 'medium' ? 2 : 3;
    return (
        <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 1 }}>
            {rooms.map(room => (
                <RoomCard
                    key={room.key}
                    theme={theme}
                    text={text}
                    room={room}
                    fanOptions={fanOptions}
                    onFan={onFan}
                    onStart={onStart}
                />
            ))}
        </Box>
    );
});

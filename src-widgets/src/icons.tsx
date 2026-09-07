import React from 'react';

import { SvgIcon, type SvgIconProps } from '@mui/material';

/**
 * Local icon components for the VIS 2 widget.
 *
 * The widget must not import `@mui/icons-material`: every icon module of that package pulls in
 * `@mui/material/utils/createSvgIcon` and with it a private copy of the MUI styled engine and theme
 * code. Module Federation only shares the root `@mui/material` entry, so that copy ends up bundled
 * with the widget and runs against the MUI version and theme of the VIS 2 host. On a host with a
 * different MUI major (VIS 2 2.15 ships MUI 6, VIS 2 2.20 ships MUI 9) the widget then crashes while
 * rendering the first icon.
 *
 * `SvgIcon` from the shared root entry always belongs to the host's MUI, so the same SVG paths render
 * correctly on both hosts. The path data is the Material Icons "filled" set used before.
 *
 * @param name - Material icon name, used as the React display name
 * @param children - SVG content rendered inside the 24x24 view box
 */
function createIcon(name: string, children: React.ReactNode): React.FC<SvgIconProps> {
    const Icon: React.FC<SvgIconProps> = props => <SvgIcon {...props}>{children}</SvgIcon>;
    Icon.displayName = `${name}Icon`;
    return Icon;
}

export const BatteryFullIcon = createIcon(
    'BatteryFull',
    <path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4" />,
);

export const BuildCircleIcon = createIcon(
    'BuildCircle',
    <path
        fillRule="evenodd"
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m4.9 13.49-1.4 1.4c-.2.2-.51.2-.71 0l-3.41-3.41c-1.22.43-2.64.17-3.62-.81-1.11-1.11-1.3-2.79-.59-4.1l2.35 2.35 1.41-1.41-2.35-2.34c1.32-.71 2.99-.52 4.1.59.98.98 1.24 2.4.81 3.62l3.41 3.41c.19.19.19.51 0 .7"
    />,
);

export const CheckCircleIcon = createIcon(
    'CheckCircle',
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8z" />,
);

export const CleaningServicesIcon = createIcon(
    'CleaningServices',
    <path d="M16 11h-1V3c0-1.1-.9-2-2-2h-2c-1.1 0-2 .9-2 2v8H8c-2.76 0-5 2.24-5 5v7h18v-7c0-2.76-2.24-5-5-5m3 10h-2v-3c0-.55-.45-1-1-1s-1 .45-1 1v3h-2v-3c0-.55-.45-1-1-1s-1 .45-1 1v3H9v-3c0-.55-.45-1-1-1s-1 .45-1 1v3H5v-5c0-1.65 1.35-3 3-3h8c1.65 0 3 1.35 3 3z" />,
);

export const FilterAltIcon = createIcon(
    'FilterAlt',
    <path d="M4.25 5.61C6.27 8.2 10 13 10 13v6c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-6s3.72-4.8 5.74-7.39c.51-.66.04-1.61-.79-1.61H5.04c-.83 0-1.3.95-.79 1.61" />,
);

export const HistoryIcon = createIcon(
    'History',
    <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9m-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8z" />,
);

export const HomeIcon = createIcon('Home', <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />);

export const LocationSearchingIcon = createIcon(
    'LocationSearching',
    <path d="M20.94 11c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7" />,
);

export const MapIcon = createIcon(
    'Map',
    <path d="m20.5 3-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5M15 19l-6-2.11V5l6 2.11z" />,
);

export const PauseIcon = createIcon('Pause', <path d="M6 19h4V5H6zm8-14v14h4V5z" />);

export const PlayArrowIcon = createIcon('PlayArrow', <path d="M8 5v14l11-7z" />);

export const RestartAltIcon = createIcon(
    'RestartAlt',
    <path d="M12 5V2L8 6l4 4V7c3.31 0 6 2.69 6 6 0 2.97-2.17 5.43-5 5.91v2.02c3.95-.49 7-3.85 7-7.93 0-4.42-3.58-8-8-8m-6 8c0-1.65.67-3.15 1.76-4.24L6.34 7.34C4.9 8.79 4 10.79 4 13c0 4.08 3.05 7.44 7 7.93v-2.02c-2.83-.48-5-2.94-5-5.91" />,
);

export const ScheduleIcon = createIcon(
    'Schedule',
    <>
        <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2M12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8" />
        <path d="M12.5 7H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
    </>,
);

export const SquareFootIcon = createIcon(
    'SquareFoot',
    <path d="m17.66 17.66-1.06 1.06-.71-.71 1.06-1.06-1.94-1.94-1.06 1.06-.71-.71 1.06-1.06-1.94-1.94-1.06 1.06-.71-.71 1.06-1.06L9.7 9.7l-1.06 1.06-.71-.71 1.06-1.06-1.94-1.94-1.06 1.06-.71-.71 1.06-1.06L4 4v14c0 1.1.9 2 2 2h14zM7 17v-5.76L12.76 17z" />,
);

export const TuneIcon = createIcon(
    'Tune',
    <path d="M3 17v2h6v-2zM3 5v2h10V5zm10 16v-2h8v-2h-8v-2h-2v6zM7 9v2H3v2h4v2h2V9zm14 4v-2H11v2zm-6-4h2V7h4V5h-4V3h-2z" />,
);

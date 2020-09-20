module.exports = {
    'deviceInfo': [{
        _id: 'mac',
        type: 'state',
        common: {
            name: 'device mac adress',
            type: 'string',
            role: 'text',
            read: true,
            write: false,
            desc: 'device mac adresss'
        },
        native: {}
    },
    {
        _id: 'model',
        type: 'state',
        common: {
            name: 'device model',
            type: 'string',
            role: 'text',
            read: true,
            write: false,
            desc: 'device model'
        },
        native: {}
    },
    {
        _id: 'fw_ver',
        type: 'state',
        common: {
            name: 'device fw_ver',
            type: 'string',
            role: 'text',
            read: true,
            write: false,
            desc: 'device Firmwareversion'
        },
        native: {}
    },
    {
        _id: 'wifi_signal',
        type: 'state',
        common: {
            name: 'Wifi RSSI',
            type: 'number',
            role: 'level',
            read: true,
            write: false,
            unit: 'dBm',
            desc: 'Wifi signal of the  vacuum'
        },
        native: {}
    }
    ],
    'customComands': [{
        _id: 'X_send_command',
        type: 'state',
        common: {
            name: 'send command',
            type: 'string',
            read: true,
            write: true,
        },
        native: {}
    },
    {
        _id: 'X_get_response',
        type: 'state',
        common: {
            name: 'get response',
            type: 'string',
            read: true,
            write: false,
        },
        native: {}
    }
    ],
    'viomiObjects': [{
        _id: 'suction_grade',
        type: 'state',
        common: {
            name: 'Suction power',
            type: 'number',
            role: 'level',
            read: true,
            write: true,
            max: 3,
            states: {
                0: 'Silent',
                1: 'Standard',
                2: 'Medium',
                3: 'Turbo'
            }
        },
        native: {}
    },
    {
        _id: 'water_grade',
        type: 'state',
        common: {
            name: 'Suction power',
            type: 'number',
            role: 'level',
            read: true,
            write: true,
            states: {
                11: 'low',
                12: 'normal',
                13: 'high'
            }
        },
        native: {}
    },
    {
        _id: 'run_state',
        type: 'state',
        common: {
            name: 'run state',
            type: 'number',
            role: 'level',
            read: true,
            write: false,
            max: 6,
            states: {
                0: 'IdleNotDocked ',
                1: 'Idle',
                2: 'Idle 2',
                3: 'Cleaning',
                4: 'Returning ',
                5: 'Docked',
                6: 'VacuumingAndMopping'
            }
        },
        native: {}
    },
    {
        _id: 'mode',
        type: 'state',
        common: {
            name: 'mode',
            type: 'number',
            role: 'level',
            read: true,
            write: true,
            max: 2,
            states: {
                0: 'Vacuum',
                1: 'VacuumAndMop',
                2: 'Mop'
            }
        },
        native: {}
    },
    {
        _id: 'err_state',
        type: 'state',
        common: {
            name: 'error state',
            type: 'number',
            role: 'level',
            read: true,
            write: false,
            states: {
                500: 'Radar timed out',
                501: 'Wheels stuck',
                502: 'Low battery',
                503: 'Dust bin missing',
                508: 'Uneven ground',
                509: 'Cliff sensor error',
                510: 'Collision sensor error',
                511: 'Could not return to dock',
                512: 'Could not return to dock',
                513: 'Could not navigate',
                514: 'Vacuum stuck',
                515: 'Charging error',
                516: 'Mop temperature error',
                521: 'Water tank is not installed',
                522: 'Mop is not installed',
                525: 'Insufficient water in water tank',
                527: 'Remove mop',
                528: 'Dust bin missing',
                529: 'Mop and water tank missing',
                530: 'Mop and water tank missing',
                531: 'Water tank is not installed',
                2101: 'Unsufficient battery, continuing cleaning after recharge',
                2105: 'No Error'
            }
        },
        native: {}
    },
    {
        _id: 'battary_life',
        type: 'state',
        common: {
            name: 'battary life',
            type: 'number',
            read: true,
            write: false,
            unit: '%',
            max: 100
        },
        'native': {}
    },
    {
        _id: 's_area',
        type: 'state',
        common: {
            name: 'Cleaned area',
            type: 'number',
            read: true,
            write: false,
            unit: 'm²'
        },
        native: {}
    },
    {
        _id: 's_time',
        type: 'state',
        common: {
            name: 'Cleaning time',
            type: 'number',
            read: true,
            write: false,
            unit: 'min'
        },
        native: {}
    },
    {
        _id: 'find',
        type: 'state',
        common: {
            role: 'button',
            name: 'Find',
            type: 'boolean',
            read: false,
            write: true
        },
        native: {}
    },
    {
        _id: 'light_state',
        type: 'state',
        common: {
            role: 'switch',
            name: 'light state',
            type: 'boolean',
            read: false,
            write: true
        },
        native: {}
    },
    {
        _id: 'is_charge',
        type: 'state',
        common: {
            role: 'switch',
            name: 'is charge',
            type: 'boolean',
            read: false,
            write: false
        },
        native: {}
    },
    {
        _id: 'is_work',
        type: 'state',
        common: {
            role: 'switch',
            name: 'is work',
            type: 'boolean',
            read: false,
            write: false
        },
        native: {}
    },
    {
        _id: 'is_mop',
        type: 'state',
        common: {
            role: 'switch',
            name: 'is mop',
            type: 'boolean',
            read: false,
            write: false
        },
        native: {}
    },
    {
        _id: 'box_type',
        type: 'state',
        common: {
            name: 'box type',
            type: 'number',
            read: true,
            write: false
        },
        'native': {}
    },
    // TODO don't know what v_state is
    {
        _id: 'v_state',
        type: 'state',
        common: {
            name: 'v state???',
            type: 'number',
            read: true,
            write: false
        },
        'native': {}
    },
    // TODO don't know what zone_data is
    {
        _id: 'zone_data',
        type: 'state',
        common: {
            name: 'zone_data???',
            type: 'string',
            role: 'text',
            read: true,
            write: false
        },
        'native': {}
    },
    ]
};
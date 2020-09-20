module.exports = {
    'deviceInfo': [    {
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
    'customComands': [    {
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
    ]
};
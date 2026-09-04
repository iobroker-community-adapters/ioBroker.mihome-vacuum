declare const objects: {
    deviceInfo: ({
        _id: string;
        type: string;
        common: {
            name: string;
            def: string;
            type?: undefined;
            role?: undefined;
            read?: undefined;
            write?: undefined;
            unit?: undefined;
            desc?: undefined;
        };
        native: {};
    } | {
        _id: string;
        type: string;
        common: {
            name: string;
            type: string;
            role: string;
            def: string;
            read: boolean;
            write: boolean;
            unit?: undefined;
            desc?: undefined;
        };
        native: {};
    } | {
        _id: string;
        type: string;
        common: {
            name: string;
            type: string;
            role: string;
            def: number;
            read: boolean;
            write: boolean;
            unit: string;
            desc: string;
        };
        native: {};
    })[];
    iotState: ({
        _id: string;
        type: string;
        common: {
            name: string;
            type: string;
            role: string;
            read: boolean;
            write: boolean;
            def: boolean;
            desc: string;
            smartName: string;
        };
        native: {};
    } | {
        _id: string;
        type: string;
        common: {
            name: string;
            type: string;
            role: string;
            def: boolean;
            read: boolean;
            write: boolean;
            desc: string;
            smartName?: undefined;
        };
        native: {};
    })[];
    customCommands: ({
        _id: string;
        type: string;
        common: {
            name: string;
            type?: undefined;
            def?: undefined;
            read?: undefined;
            write?: undefined;
        };
        native: {};
    } | {
        _id: string;
        type: string;
        common: {
            name: string;
            type: string;
            def: string;
            read: boolean;
            write: boolean;
        };
        native: {};
    })[];
    viomiObjects: ({
        _id: string;
        type: string;
        common: {
            name: string;
            type: string;
            role: string;
            read: boolean;
            write: boolean;
            max: number;
            states: {
                0: string;
                1: string;
                2: string;
                3: string;
                11?: undefined;
                12?: undefined;
                13?: undefined;
                4?: undefined;
                5?: undefined;
                6?: undefined;
                500?: undefined;
                501?: undefined;
                502?: undefined;
                503?: undefined;
                508?: undefined;
                509?: undefined;
                510?: undefined;
                511?: undefined;
                512?: undefined;
                513?: undefined;
                514?: undefined;
                515?: undefined;
                516?: undefined;
                521?: undefined;
                522?: undefined;
                525?: undefined;
                527?: undefined;
                528?: undefined;
                529?: undefined;
                530?: undefined;
                531?: undefined;
                2101?: undefined;
                2105?: undefined;
            };
            unit?: undefined;
        };
        native: {};
    } | {
        _id: string;
        type: string;
        common: {
            name: string;
            type: string;
            role: string;
            read: boolean;
            write: boolean;
            states: {
                11: string;
                12: string;
                13: string;
                0?: undefined;
                1?: undefined;
                2?: undefined;
                3?: undefined;
                4?: undefined;
                5?: undefined;
                6?: undefined;
                500?: undefined;
                501?: undefined;
                502?: undefined;
                503?: undefined;
                508?: undefined;
                509?: undefined;
                510?: undefined;
                511?: undefined;
                512?: undefined;
                513?: undefined;
                514?: undefined;
                515?: undefined;
                516?: undefined;
                521?: undefined;
                522?: undefined;
                525?: undefined;
                527?: undefined;
                528?: undefined;
                529?: undefined;
                530?: undefined;
                531?: undefined;
                2101?: undefined;
                2105?: undefined;
            };
            max?: undefined;
            unit?: undefined;
        };
        native: {};
    } | {
        _id: string;
        type: string;
        common: {
            name: string;
            type: string;
            role: string;
            read: boolean;
            write: boolean;
            max: number;
            states: {
                0: string;
                1: string;
                2: string;
                3: string;
                4: string;
                5: string;
                6: string;
                11?: undefined;
                12?: undefined;
                13?: undefined;
                500?: undefined;
                501?: undefined;
                502?: undefined;
                503?: undefined;
                508?: undefined;
                509?: undefined;
                510?: undefined;
                511?: undefined;
                512?: undefined;
                513?: undefined;
                514?: undefined;
                515?: undefined;
                516?: undefined;
                521?: undefined;
                522?: undefined;
                525?: undefined;
                527?: undefined;
                528?: undefined;
                529?: undefined;
                530?: undefined;
                531?: undefined;
                2101?: undefined;
                2105?: undefined;
            };
            unit?: undefined;
        };
        native: {};
    } | {
        _id: string;
        type: string;
        common: {
            name: string;
            type: string;
            role: string;
            read: boolean;
            write: boolean;
            max: number;
            states: {
                0: string;
                1: string;
                2: string;
                3?: undefined;
                11?: undefined;
                12?: undefined;
                13?: undefined;
                4?: undefined;
                5?: undefined;
                6?: undefined;
                500?: undefined;
                501?: undefined;
                502?: undefined;
                503?: undefined;
                508?: undefined;
                509?: undefined;
                510?: undefined;
                511?: undefined;
                512?: undefined;
                513?: undefined;
                514?: undefined;
                515?: undefined;
                516?: undefined;
                521?: undefined;
                522?: undefined;
                525?: undefined;
                527?: undefined;
                528?: undefined;
                529?: undefined;
                530?: undefined;
                531?: undefined;
                2101?: undefined;
                2105?: undefined;
            };
            unit?: undefined;
        };
        native: {};
    } | {
        _id: string;
        type: string;
        common: {
            name: string;
            type: string;
            role: string;
            read: boolean;
            write: boolean;
            states: {
                500: string;
                501: string;
                502: string;
                503: string;
                508: string;
                509: string;
                510: string;
                511: string;
                512: string;
                513: string;
                514: string;
                515: string;
                516: string;
                521: string;
                522: string;
                525: string;
                527: string;
                528: string;
                529: string;
                530: string;
                531: string;
                2101: string;
                2105: string;
                0?: undefined;
                1?: undefined;
                2?: undefined;
                3?: undefined;
                11?: undefined;
                12?: undefined;
                13?: undefined;
                4?: undefined;
                5?: undefined;
                6?: undefined;
            };
            max?: undefined;
            unit?: undefined;
        };
        native: {};
    } | {
        _id: string;
        type: string;
        common: {
            name: string;
            type: string;
            role: string;
            read: boolean;
            write: boolean;
            unit: string;
            max: number;
            states?: undefined;
        };
        native: {};
    } | {
        _id: string;
        type: string;
        common: {
            name: string;
            type: string;
            read: boolean;
            write: boolean;
            unit: string;
            role?: undefined;
            max?: undefined;
            states?: undefined;
        };
        native: {};
    } | {
        _id: string;
        type: string;
        common: {
            role: string;
            name: string;
            type: string;
            read: boolean;
            write: boolean;
            max?: undefined;
            states?: undefined;
            unit?: undefined;
        };
        native: {};
    } | {
        _id: string;
        type: string;
        common: {
            name: string;
            type: string;
            read: boolean;
            write: boolean;
            role?: undefined;
            max?: undefined;
            states?: undefined;
            unit?: undefined;
        };
        native: {};
    })[];
    stockConsumable: {
        channel: {
            _id: string;
            type: string;
            common: {
                name: string;
            };
            native: {};
        };
        list: {
            filter: {
                state: {
                    _id: string;
                    type: string;
                    common: {
                        name: string;
                        type: string;
                        role: string;
                        read: boolean;
                        write: boolean;
                        unit: string;
                    };
                    native: {};
                };
                button: {
                    _id: string;
                    type: string;
                    common: {
                        role: string;
                        name: string;
                        type: string;
                        def: boolean;
                        read: boolean;
                        write: boolean;
                    };
                    native: {};
                };
                calc: number;
            };
            main_brush: {
                state: {
                    _id: string;
                    type: string;
                    common: {
                        name: string;
                        type: string;
                        role: string;
                        read: boolean;
                        write: boolean;
                        unit: string;
                    };
                    native: {};
                };
                button: {
                    _id: string;
                    type: string;
                    common: {
                        role: string;
                        name: string;
                        type: string;
                        def: boolean;
                        read: boolean;
                        write: boolean;
                    };
                    native: {};
                };
                calc: number;
            };
            mop_pad: {
                state: {
                    _id: string;
                    type: string;
                    common: {
                        name: string;
                        type: string;
                        role: string;
                        read: boolean;
                        write: boolean;
                        unit: string;
                    };
                    native: {};
                };
                button: {
                    _id: string;
                    type: string;
                    common: {
                        role: string;
                        name: string;
                        type: string;
                        def: boolean;
                        read: boolean;
                        write: boolean;
                    };
                    native: {};
                };
                calc: number;
            };
            sensors: {
                state: {
                    _id: string;
                    type: string;
                    common: {
                        name: string;
                        type: string;
                        role: string;
                        read: boolean;
                        write: boolean;
                        unit: string;
                    };
                    native: {};
                };
                button: {
                    _id: string;
                    type: string;
                    common: {
                        role: string;
                        name: string;
                        type: string;
                        def: boolean;
                        read: boolean;
                        write: boolean;
                    };
                    native: {};
                };
                calc: number;
            };
            side_brush: {
                state: {
                    _id: string;
                    type: string;
                    common: {
                        name: string;
                        type: string;
                        role: string;
                        read: boolean;
                        write: boolean;
                        unit: string;
                    };
                    native: {};
                };
                button: {
                    _id: string;
                    type: string;
                    common: {
                        role: string;
                        name: string;
                        type: string;
                        def: boolean;
                        read: boolean;
                        write: boolean;
                    };
                    native: {};
                };
                calc: number;
            };
            water_filter: {
                state: {
                    _id: string;
                    type: string;
                    common: {
                        name: string;
                        type: string;
                        role: string;
                        read: boolean;
                        write: boolean;
                        unit: string;
                    };
                    native: {};
                };
                button: {
                    _id: string;
                    type: string;
                    common: {
                        name: string;
                        type: string;
                        role: string;
                        def: boolean;
                        read: boolean;
                        write: boolean;
                    };
                    native: {};
                };
                calc: number;
            };
            strainer: {
                state: {
                    _id: string;
                    type: string;
                    common: {
                        name: string;
                        type: string;
                        role: string;
                        read: boolean;
                        write: boolean;
                    };
                    native: {};
                };
                button: {
                    _id: string;
                    type: string;
                    common: {
                        role: string;
                        name: string;
                        type: string;
                        def: boolean;
                        read: boolean;
                        write: boolean;
                    };
                    native: {};
                };
            };
            cleaning_brush: {
                state: {
                    _id: string;
                    type: string;
                    common: {
                        name: string;
                        type: string;
                        role: string;
                        read: boolean;
                        write: boolean;
                    };
                    native: {};
                };
                button: {
                    _id: string;
                    type: string;
                    common: {
                        role: string;
                        name: string;
                        type: string;
                        def: boolean;
                        read: boolean;
                        write: boolean;
                    };
                    native: {};
                };
            };
            dust_collection: {
                state: {
                    _id: string;
                    type: string;
                    common: {
                        name: string;
                        type: string;
                        role: string;
                        read: boolean;
                        write: boolean;
                    };
                    native: {};
                };
                button: {
                    _id: string;
                    type: string;
                    common: {
                        role: string;
                        name: string;
                        type: string;
                        def: boolean;
                        read: boolean;
                        write: boolean;
                    };
                    native: {};
                };
            };
        };
    };
    stockControl: ({
        _id: string;
        type: string;
        common: {
            name: string;
            type?: undefined;
            role?: undefined;
            def?: undefined;
            read?: undefined;
            write?: undefined;
            desc?: undefined;
            max?: undefined;
            states?: undefined;
            smartName?: undefined;
            unit?: undefined;
            min?: undefined;
        };
        native: {};
    } | {
        _id: string;
        type: string;
        common: {
            name: string;
            type: string;
            role: string;
            def: boolean;
            read: boolean;
            write: boolean;
            desc: string;
            max?: undefined;
            states?: undefined;
            smartName?: undefined;
            unit?: undefined;
            min?: undefined;
        };
        native: {};
    } | {
        _id: string;
        type: string;
        common: {
            name: string;
            type: string;
            role: string;
            read: boolean;
            write: boolean;
            max: number;
            states: {
                5: string;
                10: string;
                15: string;
                20: string;
                25: string;
                30: string;
                35: string;
                38: string;
                40: string;
                45: string;
                50: string;
                55: string;
                60: string;
                65: string;
                70: string;
                75: string;
                77: string;
                80: string;
                85: string;
                90: string;
                95: string;
                100: string;
            };
            def?: undefined;
            desc?: undefined;
            smartName?: undefined;
            unit?: undefined;
            min?: undefined;
        };
        native: {};
    } | {
        _id: string;
        type: string;
        common: {
            name: string;
            type: string;
            def: string;
            read: boolean;
            write: boolean;
            desc: string;
            role?: undefined;
            max?: undefined;
            states?: undefined;
            smartName?: undefined;
            unit?: undefined;
            min?: undefined;
        };
        native: {};
    } | {
        _id: string;
        type: string;
        common: {
            name: string;
            type: string;
            role: string;
            def: boolean;
            read: boolean;
            write: boolean;
            desc: string;
            smartName: string;
            max?: undefined;
            states?: undefined;
            unit?: undefined;
            min?: undefined;
        };
        native: {};
    } | {
        _id: string;
        type: string;
        common: {
            name: string;
            type: string;
            role: string;
            read: boolean;
            write: boolean;
            unit: string;
            min: number;
            max: number;
            desc: string;
            def?: undefined;
            states?: undefined;
            smartName?: undefined;
        };
        native: {};
    })[];
    enableResumeZone: {
        _id: string;
        type: string;
        common: {
            name: string;
            type: string;
            role: string;
            def: boolean;
            read: boolean;
            write: boolean;
            desc: string;
        };
        native: {};
    }[];
    roomStates: {
        _id: string;
        type: string;
        common: {
            name: string;
            type: string;
            role: string;
            read: boolean;
            write: boolean;
        };
        native: {};
    }[];
    stockInfo: ({
        _id: string;
        type: string;
        common: {
            name: string;
            type: string;
            role: string;
            read: boolean;
            write: boolean;
            unit: string;
            max: number;
            states?: undefined;
        };
        native: {};
    } | {
        _id: string;
        type: string;
        common: {
            role: string;
            name: string;
            type: string;
            read: boolean;
            write: boolean;
            unit?: undefined;
            max?: undefined;
            states?: undefined;
        };
        native: {};
    } | {
        _id: string;
        type: string;
        common: {
            role: string;
            name: string;
            type: string;
            read: boolean;
            write: boolean;
            unit: string;
            max?: undefined;
            states?: undefined;
        };
        native: {};
    } | {
        _id: string;
        type: string;
        common: {
            name: string;
            type: string;
            role: string;
            read: boolean;
            write: boolean;
            max: number;
            states: {
                0: string;
                1: string;
                2: string;
                3: string;
                4: string;
                5: string;
                6: string;
                7: string;
                8: string;
                9: string;
                10: string;
                11: string;
                12: string;
                13: string;
                14: string;
                15: string;
                16: string;
                17: string;
                18: string;
                19: string;
                20: string;
                21: string;
                22: string;
                23: string;
                24: string;
                25: string;
                26: string;
                27: string;
                28: string;
                29: string;
                30: string;
                31: string;
                32: string;
                33: string;
                34: string;
                35: string;
                36: string;
                37: string;
                38: string;
                39: string;
                40: string;
                41: string;
                42: string;
                43: string;
                44: string;
                45: string;
                46: string;
                47: string;
                48: string;
                49: string;
                50: string;
                51: string;
                52: string;
                53: string;
                54: string;
                55: string;
                56: string;
                57: string;
                58: string;
                59: string;
                60: string;
                61: string;
                62: string;
                63: string;
                64: string;
                65: string;
                66: string;
                67: string;
                68: string;
                69: string;
                70: string;
                71: string;
                72: string;
                73: string;
                74: string;
                75: string;
                76: string;
                77: string;
                78: string;
                79: string;
                80: string;
                81: string;
                82: string;
                83: string;
                84: string;
                85: string;
                86: string;
                87: string;
                88: string;
                89: string;
                90: string;
                91: string;
                92: string;
                93: string;
                94: string;
            };
            unit?: undefined;
        };
        native: {};
    } | {
        _id: string;
        type: string;
        common: {
            name: string;
            type: string;
            role: string;
            read: boolean;
            write: boolean;
            max: number;
            states: {
                0: string;
                1: string;
                2: string;
                3: string;
                4: string;
                5: string;
                6: string;
                7: string;
                8: string;
                9: string;
                10: string;
                11: string;
                12: string;
                13: string;
                14: string;
                15: string;
                16: string;
                17: string;
                18: string;
                19: string;
                20: string;
                21: string;
                22: string;
                23: string;
                24: string;
                25: string;
                26: string;
                27: string;
                28: string;
                29: string;
                30: string;
                31: string;
                32: string;
                33: string;
                34: string;
                35: string;
                36?: undefined;
                37?: undefined;
                38?: undefined;
                39?: undefined;
                40?: undefined;
                41?: undefined;
                42?: undefined;
                43?: undefined;
                44?: undefined;
                45?: undefined;
                46?: undefined;
                47?: undefined;
                48?: undefined;
                49?: undefined;
                50?: undefined;
                51?: undefined;
                52?: undefined;
                53?: undefined;
                54?: undefined;
                55?: undefined;
                56?: undefined;
                57?: undefined;
                58?: undefined;
                59?: undefined;
                60?: undefined;
                61?: undefined;
                62?: undefined;
                63?: undefined;
                64?: undefined;
                65?: undefined;
                66?: undefined;
                67?: undefined;
                68?: undefined;
                69?: undefined;
                70?: undefined;
                71?: undefined;
                72?: undefined;
                73?: undefined;
                74?: undefined;
                75?: undefined;
                76?: undefined;
                77?: undefined;
                78?: undefined;
                79?: undefined;
                80?: undefined;
                81?: undefined;
                82?: undefined;
                83?: undefined;
                84?: undefined;
                85?: undefined;
                86?: undefined;
                87?: undefined;
                88?: undefined;
                89?: undefined;
                90?: undefined;
                91?: undefined;
                92?: undefined;
                93?: undefined;
                94?: undefined;
            };
            unit?: undefined;
        };
        native: {};
    })[];
    stockHistory: ({
        _id: string;
        type: string;
        common: {
            name: string;
            type?: undefined;
            role?: undefined;
            unit?: undefined;
            read?: undefined;
        };
        native: {};
    } | {
        _id: string;
        type: string;
        common: {
            name: string;
            type: string;
            role: string;
            unit: string;
            read: boolean;
        };
        native: {};
    } | {
        _id: string;
        type: string;
        common: {
            name: string;
            type: string;
            role: string;
            read: boolean;
            unit?: undefined;
        };
        native: {};
    })[];
    newfan_power: {
        type: string;
        common: {
            name: string;
            type: string;
            role: string;
            read: boolean;
            write: boolean;
            min: number;
            max: number;
            states: {
                101: string;
                102: string;
                103: string;
                104: string;
                106: string;
            };
        };
        native: {};
    };
    water_box: {
        type: string;
        common: {
            name: string;
            type: string;
            role: string;
            read: boolean;
            write: boolean;
        };
        native: {};
    };
    mop: {
        type: string;
        common: {
            name: string;
            type: string;
            role: string;
            read: boolean;
            write: boolean;
        };
        native: {};
    };
    mop_mode: {
        type: string;
        common: {
            name: string;
            type: string;
            role: string;
            read: boolean;
            write: boolean;
            min: number;
            max: number;
            states: {
                300: string;
                301: string;
                303: string;
            };
        };
        native: {};
    };
    water_box_mode: {
        type: string;
        common: {
            name: string;
            type: string;
            role: string;
            read: boolean;
            write: boolean;
            min: number;
            max: number;
            states: {
                200: string;
                201: string;
                202: string;
                203: string;
                204: string;
            };
        };
        native: {};
    };
    water_box_level: {
        type: string;
        common: {
            name: string;
            type: string;
            role: string;
            read: boolean;
            write: boolean;
            min: number;
            max: number;
        };
        native: {};
    };
    dock_status: {
        type: string;
        common: {
            name: string;
            type: string;
            role: string;
            read: boolean;
            write: boolean;
            min: number;
            max: number;
            states: {
                0: string;
                1: string;
                2: string;
                3: string;
                4: string;
                5: string;
                6: string;
                38: string;
                39: string;
            };
        };
        native: {};
    };
    carpet_mode: {
        type: string;
        common: {
            name: string;
            type: string;
            role: string;
            def: boolean;
            read: boolean;
            write: boolean;
            desc: string;
        };
        native: {};
    };
    dustCollect: {
        _id: string;
        type: string;
        common: {
            name: string;
            type: string;
            role: string;
            def: boolean;
            read: boolean;
            write: boolean;
            desc: string;
        };
        native: {};
    };
    washMop: {
        _id: string;
        type: string;
        common: {
            name: string;
            type: string;
            role: string;
            def: boolean;
            read: boolean;
            write: boolean;
            desc: string;
        };
        native: {};
    };
    mapObjects: ({
        _id: string;
        type: string;
        common: {
            name: string;
            type?: undefined;
            role?: undefined;
            read?: undefined;
            write?: undefined;
            desc?: undefined;
            states?: undefined;
            def?: undefined;
        };
        native: {};
    } | {
        _id: string;
        type: string;
        common: {
            name: string;
            type: string;
            role: string;
            read: boolean;
            write: boolean;
            desc: string;
            states?: undefined;
            def?: undefined;
        };
        native: {};
    } | {
        _id: string;
        type: string;
        common: {
            name: string;
            type: string;
            read: boolean;
            write: boolean;
            desc: string;
            role?: undefined;
            states?: undefined;
            def?: undefined;
        };
        native: {};
    } | {
        _id: string;
        type: string;
        common: {
            name: string;
            type: string;
            read: boolean;
            write: boolean;
            desc: string;
            states: {
                0: string;
                1: string;
                2: string;
                3: string;
            };
            role?: undefined;
            def?: undefined;
        };
        native: {};
    } | {
        _id: string;
        type: string;
        common: {
            name: string;
            type: string;
            role: string;
            def: boolean;
            read: boolean;
            write: boolean;
            desc: string;
            states?: undefined;
        };
        native: {};
    })[];
    settings: ({
        _id: string;
        type: string;
        common: {
            name: string;
            type: string;
            role: string;
            read: boolean;
            write: boolean;
            max: number;
            states: {
                0: string;
                1: string;
                2: string;
                3: string;
                11?: undefined;
                12?: undefined;
                13?: undefined;
            };
        };
        native: {};
    } | {
        _id: string;
        type: string;
        common: {
            name: string;
            type: string;
            role: string;
            read: boolean;
            write: boolean;
            states: {
                11: string;
                12: string;
                13: string;
                0?: undefined;
                1?: undefined;
                2?: undefined;
                3?: undefined;
            };
            max?: undefined;
        };
        native: {};
    })[];
    wash_base: {
        _id: string;
        type: string;
        common: {
            name: string;
            type: string;
            role: string;
            read: boolean;
            write: boolean;
            desc: string;
        };
        native: {};
    }[];
    wash_base_info: {
        _id: string;
        type: string;
        common: {
            name: string;
            type: string;
            role: string;
            read: boolean;
            write: boolean;
            min: number;
            max: number;
            states: {
                0: string;
                1: string;
                2: string;
                3: string;
                4: string;
                5: string;
                6: string;
            };
        };
        native: {};
    }[];
};
export = objects;

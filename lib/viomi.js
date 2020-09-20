'use strict';
let adapter = null;
const objects = require(__dirname + '/objects');

class ViomiManager {
    constructor(adapterInstance, Miio) {
        adapter = adapterInstance;
        adapter.log.debug('select viomi protocol....');

        this.ViomiDevices = [
            'dreame.vacuum.mc1808',
            'viomi.vacuum.v6',
            'viomi.vacuum.v7',
            'viomi.vacuum.v8'
        ];

        // result is for "get_prop" with PARAMS is:
        // [5,3,0,2105,100,0,"0",0,0,10,"0",0,1,1,12,1,1,0,0,0,0,1] 
        this.PARAMS = [
            'run_state',
            'suction_grade',
            'mode',
            'err_state',
            'battary_life',
            'start_time',
            'order_time',
            's_time',
            's_area',
            'v_state',
            'zone_data',
            'repeat_state',
            'remember_map',
            'has_map',
            'water_grade',
            'box_type',
            'mop_type',
            'is_mop',
            'light_state',
            'has_newmap',
            'is_charge',
            'is_work'
        ];


        this.ERROR_CODES = {
            '500': 'Radar timed out',
            '501': 'Wheels stuck',
            '502': 'Low battery',
            '503': 'Dust bin missing',
            '508': 'Uneven ground',
            '509': 'Cliff sensor error',
            '510': 'Collision sensor error',
            '511': 'Could not return to dock',
            '512': 'Could not return to dock',
            '513': 'Could not navigate',
            '514': 'Vacuum stuck',
            '515': 'Charging error',
            '516': 'Mop temperature error',
            '521': 'Water tank is not installed',
            '522': 'Mop is not installed',
            '525': 'Insufficient water in water tank',
            '527': 'Remove mop',
            '528': 'Dust bin missing',
            '529': 'Mop and water tank missing',
            '530': 'Mop and water tank missing',
            '531': 'Water tank is not installed',
            '2101': 'Unsufficient battery, continuing cleaning after recharge',
            '2105': 'No Error'
        };

        this.STATES = {
            '-1': 'Unknown',
            '0': 'IdleNotDocked ',
            '1': 'Idle',
            '2': 'Idle 2',
            '3': 'Cleaning',
            '4': 'Returning ',
            '5': 'Docked',
            '6': 'VacuumingAndMopping'
        };

        this.FANSPEED = {
            0: 'Silent',
            1: 'Standard',
            2: 'Medium',
            3: 'Turbo'
        };

        this.MODE = {
            0 : 'Vacuum',
            1 : 'VacuumAndMop',
            2 : 'Mop'
        };

    }

    /** Parses the answer of get_room_mapping */
    async initStates() {
        const that = this;
        adapter.setObject('control.fan_power', {
            type: 'state',
            common: {
                name: 'Suction power',
                type: 'number',
                role: 'level',
                read: true,
                write: true,
                min: 0,
                max: 3,
                states: that.FANSPEED
            },
            native: {}
        });
    }
    startClean(){
        return 'set_mode_withroom', [0, 1, 0];
    }

}
module.exports = ViomiManager;
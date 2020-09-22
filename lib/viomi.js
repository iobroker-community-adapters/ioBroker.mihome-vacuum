'use strict';

//const Miio = require("iobroker.mihome-vacuum/lib/miio");

let adapter = null;
const objects = require(__dirname + '/objects');
let getStateTimeout = null;
const lastProps = {};

class ViomiManager {
    constructor(adapterInstance, Miio) {
        this.Miio = Miio;
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
            'mop _type',
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

        this.main();
    }
    async main (){
        await this.initStates();

        this.getStates();

    }
    async getStates(){
        clearTimeout(getStateTimeout);
        let DeviceData;

        adapter.log.debug('get params for Viomi');
        try {
            DeviceData = await this.Miio.sendMessage('get_prop',this.PARAMS);
            adapter.log.debug('Recievded params for viomi: '+ JSON.stringify(DeviceData));
        } catch (error) {
            DeviceData = null;
        }

        if(DeviceData){

            const answer = DeviceData.result;
            answer.forEach((element,index) => {

                const objExist = objects.viomiObjects.find(element => element._id === this.PARAMS[index]);

                lastProps[this.PARAMS[index]] = element;

                if(typeof(objExist) !== 'undefined'){
                    if (objExist.common.type === 'boolean') {
                        adapter.setStateAsync('control.'+ this.PARAMS[index], {
                            val: element ? true : false,
                            ack: true
                        });
                    } else {
                        adapter.setStateAsync('control.'+ this.PARAMS[index], {
                            val: element,
                            ack: true
                        });
                    }
                }
            });
        }
        getStateTimeout = setTimeout(this.getStates.bind(this), adapter.config.pingInterval);
    }

    /** Parses the answer of get_room_mapping */
    async initStates() {
        objects.viomiObjects.map(o => adapter.setObjectNotExistsAsync( 'control.' + o._id, o));
    }

    async stateChange(id, state){
        if (!state || state.ack) {
            return;
        }
        const terms = id.split('.');
        const command = terms.pop();
        let data;
        let actionMode, method, params;

        try {
            switch (command) {
                case 'suction_grade':
                    data = await this.Miio.sendMessage('set_suction', [state.val]);

                    adapter.log.debug('change suction_grade');
                    if(data){
                        adapter.setStateAsync(id, {
                            val: state.val,
                            ack: true
                        });
                    }
                    break;
                case 'water_grade':
                    data = await this.Miio.sendMessage('set_suction', [state.val]);

                    adapter.log.debug('change water_grade');
                    if(data){
                        adapter.setStateAsync(id, {
                            val: state.val,
                            ack: true
                        });
                    }
                    break;
                case 'is_mop':
                    data = await this.Miio.sendMessage('set_mop', [state.val]);

                    adapter.log.debug('change mop');
                    if(data){
                        adapter.setStateAsync(id, {
                            val: state.val,
                            ack: true
                        });
                    }
                    break;
                case 'light_state':
                    data = await this.Miio.sendMessage('set_light', [state.val ? 1 : 0]);

                    adapter.log.debug('change light_state');
                    if(data){
                        adapter.setStateAsync(id, {
                            val: state.val,
                            ack: true
                        });
                    }
                    break;
                case 'start':

                    if(lastProps.mode === 4){
                    //i dont know now
                        return;
                    }
                    else{
                        if(lastProps.mode === 2){
                            actionMode = 2;
                        }
                        else{
                            if(lastProps.is_mop === 2){
                                actionMode = 3;
                            }
                            else{
                                actionMode = lastProps.is_mop;
                            }
                        }
                        if(lastProps.mode === 3){
                            method = 'set_mode';
                            params = [3,1];
                        }
                        else{
                            method = 'set_mode_withroom';
                            params = [actionMode, 1, 0];
                        }
                    }

                    data = await this.Miio.sendMessage(method,params);

                    adapter.log.debug('start with: '+ method + '  params:'+ params);

                    if(data){
                        adapter.setStateAsync(id, {
                            val: state.val,
                            ack: true
                        });
                    }
                    break;
                case 'pause':

                    if(lastProps.mode === 4){
                        //i dont know now
                        return;
                    }
                    else{
                        if(lastProps.mode === 2){
                            actionMode = 2;
                        }
                        else{
                            if(lastProps.is_mop === 2){
                                actionMode = 3;
                            }
                            else{
                                actionMode = lastProps.is_mop;
                            }
                        }
                        if(lastProps.mode === 3){
                            method = 'set_mode';
                            params = [3,3];
                        }
                        else{
                            method = 'set_mode_withroom';
                            params = [actionMode, 3 , 0];
                        }
                    }

                    data = await this.Miio.sendMessage(method,params);

                    adapter.log.debug('pause with: '+ method + '  params:'+ params);

                    if(data){
                        adapter.setStateAsync(id, {
                            val: state.val,
                            ack: true
                        });
                    }
                    break;
                case 'stop':
                    if(lastProps.mode === 3){
                        method = 'set_mode';
                        params = [3, 0];
                    }
                    else if(lastProps.is_mop === 4){
                        method = 'set_pointclean';
                        params = [0, 0, 0];
                    }
                    else{
                        method = 'set_mode';
                        params = [0];
                    }
                    data = await this.Miio.sendMessage(method,params);

                    adapter.log.debug('stop with: '+ method + '  params:'+ params);

                    if(data){
                        adapter.setStateAsync(id, {
                            val: state.val,
                            ack: true
                        });
                    }
                    break;
                case 'return_dock':
                    data = await this.Miio.sendMessage('set_charge', [1]);

                    adapter.log.debug('change mop');
                    if(data){
                        adapter.setStateAsync(id, {
                            val: state.val,
                            ack: true
                        });
                    }
                    break;
                default:
                    break;
            }

        } catch (error) {
            adapter.log.warn('Cant send command please try again'+ command );
        }
    }
    startClean(){
        return 'set_mode_withroom', [0, 1, 0];
    }


}
module.exports = ViomiManager;
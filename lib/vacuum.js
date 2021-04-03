'use strict';
const utils = require('@iobroker/adapter-core');
const { hostname } = require('os');
let adapter = null;
const objects = require('./objects');
const TimerManager = require('./timerManager.js');
const RoomManager = require('./roomManager');
const MapHelper = require('./maphelper');

global.systemDictionary = {};
require('../admin/words.js');

const lastProps = {};

const userLang = 'en';
// this parts will be translated
const i18n = {
	weekDaysFull: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
	notAvailable: 'not available',
	nextTimer: 'next timer',
	loadRooms: 'load rooms from robot',
	cleanRoom: 'clean Room',
	cleanMultiRooms: 'clean assigned rooms',
	addRoom: 'insert map Index or zone coordinates',
	waterBox_installed: 'water box installed',
	waterBox_filter: 'clean water Filter',
	waterBox_filter_reset: 'water filter reset',
	waitingPos: 'waiting position'
};
const errorTexts = {
	'0': 'No error',
	'1': 'Laser distance sensor error',
	'2': 'Collision sensor error',
	'3': 'Wheels on top of void, move robot',
	'4': 'Clean hovering sensors, move robot',
	'5': 'Clean main brush',
	'6': 'Clean side brush',
	'7': 'Main wheel stuck?',
	'8': 'Device stuck, clean area',
	'9': 'Dust collector missing',
	'10': 'Clean filter',
	'11': 'Stuck in magnetic barrier',
	'12': 'Low battery',
	'13': 'Charging fault',
	'14': 'Battery fault',
	'15': 'Wall sensors dirty, wipe them',
	'16': 'Place me on flat surface',
	'17': 'Side brushes problem, reboot me',
	'18': 'Suction fan problem',
	'19': 'Unpowered charging station',
};


class VacuumManager {
	constructor(adapterInstance, Miio) {
		this.Miio = Miio;
		adapter = adapterInstance;
		this.globalTimeouts = [];

		adapter.log.debug('select standard vacuum protocol....');

		this.main();

	}
	async main (){
		await this.initStates();
		await this.init();
		this.getStates();
	}

	async init(){
		//übersetzte Begriffe
		// adapter.log.debug(JSON.stringify(adapter.systemDictionary));
		// adapter.getForeignObjectAsync('system.config').then( systemConfig => {
		//     if (systemConfig && systemConfig.common && systemConfig.common.language && systemDictionary.Sunday[systemConfig.common.language]) {
		//         userLang = systemConfig.common.language;
		//         let obj;
		//         for (const i in i18n) {
		//             obj = i18n[i];
		//             if (typeof obj == 'string') {
		//                 i18n[i] = systemDictionary[obj][userLang];
		//             } else if (typeof obj == 'object') {
		//                 for (const o in obj) {
		//                     obj[o] = systemDictionary[obj[o]][userLang];
		//                 }
		//             }
		//         }
		//     }
		// });

		await Promise.all(objects.stockControl.map(async (o) => {
			const contents = await adapter.setObjectNotExistsAsync('control.' + o._id, o);
			adapter.log.debug('Create State for deviceInfo'+ JSON.stringify(contents));
		}));
		await Promise.all(objects.stockInfo.map(async (o) => {
			const contents = await adapter.setObjectNotExistsAsync('info.' + o._id, o);
			adapter.log.debug('Create State for stockInfo'+ JSON.stringify(contents));
		}));
		await Promise.all(objects.stockConsumable.map(async (o) => {
			const contents = await adapter.setObjectNotExistsAsync('consumable.' + o._id, o);
			adapter.log.debug('Create State for stockConsumable'+ JSON.stringify(contents));
		}));
		adapter.log.debug('Create State done!');
	}

	async getStates(){
		clearTimeout(this.globalTimeouts['getStates']);
		let DeviceData;

		adapter.log.debug('get params for stock Vacuum');
		try {
			//DeviceData = await this.Miio.sendMessage('get_map_v1');
			const statusObj = await this.setGetStatus(await this.Miio.sendMessage('get_status'));
			const soundObj = await this.setGetSoundVolume(await this.Miio.sendMessage('get_sound_volume'));
			const consumableObj = await this.setGetConsumable(await this.Miio.sendMessage('get_consumable'));
			const cleaningObj = this.Miio.sendMessage('get_clean_summary');

			// Promise.all([statusObj, soundObj, consumableObj,cleaningObj ]).then((values) => {
			//     adapter.log.debug(JSON.stringify( values));
			// }).catch(function(err) {
			//     adapter.log.error(err);
			// });

			Promise.all([statusObj, soundObj, consumableObj,cleaningObj ]).catch(function(err) {
				adapter.log.error(err);
			});

		} catch (error) {
			adapter.log.warn('ERROR'+ error);
		}
		this.globalTimeouts['getStates'] = setTimeout(this.getStates.bind(this), adapter.config.pingInterval);
	}
	async setGetCleanSummary(message){
		if(!message) return;
		const consumable = answer.result[0]; //parseConsumable(answer)
		adapter.setStateChanged('consumable.main_brush', 100 - (Math.round(consumable.main_brush_work_time / 3600 / 3)), true); // 300h
		adapter.setStateChanged('consumable.side_brush', 100 - (Math.round(consumable.side_brush_work_time / 3600 / 2)), true); // 200h
		adapter.setStateChanged('consumable.filter', 100 - (Math.round(consumable.filter_work_time / 3600 / 1.5)), true); // 150h
		adapter.setStateChanged('consumable.sensors', 100 - (Math.round(consumable.sensor_dirty_time / 3600 / 0.3)), true); // 30h
		features.water_box && adapter.setStateChanged('consumable.water_filter', 100 - (Math.round(consumable.filter_element_work_time / 3600)), true); // 100h
	}

	async parseCleaningSummary(response) {
		response = response.result;
		return {
			clean_time: response[0], // in seconds
			total_area: response[1], // in cm^2
			num_cleanups: response[2],
			cleaning_record_ids: response[3], // number[]
		};
	}

	async setGetSoundVolume(message){
		if(!message) return;
		adapter.setStateAsync('control.sound_volume', {
			val: message.result[0],
			ack: true
		});
	}
	async setGetConsumable(message){
		if(!message) return;
		const consumable = message.result[0]; //parseConsumable(answer)

		adapter.setStateAsync('consumable.main_brush', {
			val: 100 - (Math.round(consumable.main_brush_work_time / 3600 / 3)), // 300h
			ack: true
		});
		adapter.setStateAsync('consumable.side_brush', {
			val: 100 - (Math.round(consumable.side_brush_work_time / 3600 / 2)), //200h
			ack: true
		});
		adapter.setStateAsync('consumable.filter', {
			val: 100 - (Math.round(consumable.filter_work_time / 3600 / 1.5)), // 150h
			ack: true
		});
		adapter.setStateAsync('consumable.sensors', {
			val: 100 - (Math.round(consumable.sensor_dirty_time / 3600 / 0.3)), //30h
			ack: true
		});
		//features.water_box && adapter.setStateChanged('consumable.water_filter', 100 - (Math.round(consumable.filter_element_work_time / 3600)), true); // 100h
	}

	async setGetStatus(message){
		if(!message) return;
		const status = await this.parseStatus(message);
		adapter.log.debug('setGetStatus '+ JSON.stringify(status));

		//features.setNewSuctionValues(Math.round(status.fan_power));
		//features.setWaterBox(status.water_box_status);
		//features.setWaterBoxMode(status.water_box_mode);

		adapter.setStateAsync('info.battery', {
			val: status.battery,
			ack: true
		});
		adapter.setStateAsync('info.cleanedtime', {
			val: Math.round(status.clean_time / 60),
			ack: true
		});
		adapter.setStateAsync('info.cleanedarea', {
			val: Math.round(status.clean_area / 10000) / 100,
			ack: true
		});
		adapter.setStateAsync('control.fan_power', {
			val:  Math.round(status.fan_power),
			ack: true
		});
		adapter.setStateAsync('info.error', {
			val:  status.error_code,
			ack: true
		});
		adapter.setStateAsync('info.dnd', {
			val: status.dnd_enabled,
			ack: true
		});
	}


	async parseStatus(response) {
		response = response.result[0];
		response.dnd_enabled = response.dnd_enabled === 1;
		response.error_text = errorTexts[response.error_code];
		response.in_cleaning = response.in_cleaning === 1;
		response.map_present = response.map_present === 1;
		//response.state_text= statusTexts[response.state];
		return response;
	}

	/** Parses the answer of get_room_mapping */
	async initStates() {

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

	//Space for simular functions
	//----------------------------------------------


}
module.exports = VacuumManager;
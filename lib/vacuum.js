'use strict';
const utils = require('@iobroker/adapter-core');
const {
	hostname
} = require('os');
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
		this.logEntries = [];

		adapter.log.debug('select standard vacuum protocol....');
		this.features = new FeatureManager();

		this.main();

	}
	async main() {
		await this.initStates();
		await this.init();
		this.getStates();
	}

	async init() {
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
			adapter.log.debug('Create State for deviceInfo' + JSON.stringify(contents));
		}));
		await Promise.all(objects.stockInfo.map(async (o) => {
			const contents = await adapter.setObjectNotExistsAsync('info.' + o._id, o);
			adapter.log.debug('Create State for stockInfo' + JSON.stringify(contents));
		}));
		await Promise.all(objects.stockConsumable.map(async (o) => {
			const contents = await adapter.setObjectNotExistsAsync('consumable.' + o._id, o);
			adapter.log.debug('Create State for stockConsumable' + JSON.stringify(contents));
		}));
		await Promise.all(objects.stockHistory.map(async (o) => {
			const contents = await adapter.setObjectNotExistsAsync('history.' + o._id, o);
			adapter.log.debug('Create State for stockHistory' + JSON.stringify(contents));
		}));

		// check if resume Zoneclean is enabled
		!adapter.config.enableResumeZone && await Promise.all(objects.enableResumeZone.map(async (o) => {
			const contents = await adapter.setObjectNotExistsAsync('control.' + o._id, o);
			adapter.log.debug('Create State for enableResumeZone' + JSON.stringify(contents));
		}));

		adapter.config.enableResumeZone && objects.enableResumeZone.map(async o => await this.delObj('control.' + o._id))

		adapter.log.debug('Create State done!');
	}
	async delObj(id) {
        try {
            await adapter.delObjectAsync(id);
        } catch (error) {
            //... do nothing
        }
    }

	async getStates() {
		clearTimeout(this.globalTimeouts['getStates']);
		let DeviceData;

		adapter.log.debug('get params for stock Vacuum');
		try {
			//DeviceData = await this.Miio.sendMessage('get_map_v1');
			const statusObj = await this.setGetStatus(await this.Miio.sendMessage('get_status'));
			const soundObj = await this.setGetSoundVolume(await this.Miio.sendMessage('get_sound_volume'));
			const consumableObj = await this.setGetConsumable(await this.Miio.sendMessage('get_consumable'));
			const cleaningObj = await this.setGetCleanSummary(await this.Miio.sendMessage('get_clean_summary'));

			// Promise.all([statusObj, soundObj, consumableObj,cleaningObj ]).then((values) => {
			//     adapter.log.debug(JSON.stringify( values));
			// }).catch(function(err) {
			//     adapter.log.error(err);
			// });

			Promise.all([statusObj, soundObj, consumableObj, cleaningObj]).catch(function (err) {
				adapter.log.error(err);
			});

		} catch (error) {
			adapter.log.warn('ERROR' + error);
		}
		this.globalTimeouts['getStates'] = setTimeout(this.getStates.bind(this), adapter.config.pingInterval);
	}
	async setGetCleanSummary(message) {
		if (!message) return;
		const summary = await this.parseCleaningSummary(message);

		adapter.setStateAsync('history.total_time', {
			val: Math.round(summary.clean_time / 60),
			ack: true
		});
		adapter.setStateAsync('history.total_area', {
			val: Math.round(summary.total_area / 1000000),
			ack: true
		});
		adapter.setStateAsync('history.total_cleanups', {
			val: summary.num_cleanups,
			ack: true
		});
		if (!await this.isEquivalent(summary.cleaning_record_ids, this.logEntries)) {
			this.logEntries = summary.cleaning_record_ids;

			const cleanlogJson = await this.getLogEntries(this.logEntries)

			adapter.setStateAsync('history.allTableJSON', {
				val: JSON.stringify(cleanlogJson),
				ack: true
			});
			adapter.setStateAsync('history.allTableHTML', {
				val: await this.createHthmTable(cleanlogJson),
				ack: true
			});
		}

	}

	async parseCleaningSummary(response) {
		response = response.result;

		// {
		// 	"id": 9,
		// 	"result": {
		// 		"clean_time": 25075,
		// 		"clean_area": 376442500,
		// 		"clean_count": 10,
		// 		"dust_collection_count": 0,
		// 		"records": [1617553319, 1617470350, 1617380294, 1617374983, 1617370233, 1617356620, 1617209982, 1617201614, 1617165226, 1617121021]
		// 	},
		// 	"exe_time": 101
		// }
		// check if S7. Use different response
		if (response.clean_time) {
			return {
				clean_time: response.clean_time, // in seconds
				total_area: response.clean_area, // in cm^2
				num_cleanups: response.clean_count,
				cleaning_record_ids: response.records, // number[]
			}
		} else {
			return {
				clean_time: response[0], // in seconds
				total_area: response[1], // in cm^2
				num_cleanups: response[2],
				cleaning_record_ids: response[3], // number[]
			};
		}
	}

	async isEquivalent(a, b) {
		// Create arrays of property names
		const aProps = Object.getOwnPropertyNames(a);
		const bProps = Object.getOwnPropertyNames(b);

		// If number of properties is different,
		// objects are not equivalent
		if (aProps.length !== bProps.length) {
			return false;
		}

		for (let i = 0; i < aProps.length; i++) {
			const propName = aProps[i];

			// If values of same property are not equal,
			// objects are not equivalent
			if (a[propName] !== b[propName]) {
				return false;
			}
		}

		// If we made it this far, objects
		// are considered equivalent
		return true;
	}

	async getLogEntries(logarray) {
		if (!logarray || logarray.length === 0) return
		let cleanJSON = [];

		try {
			const start = async () => {
				await this.asyncForEach(logarray, async (num) => {
					let response = await this.Miio.sendMessage('get_clean_record', [num])
					const records = response.result.map(entry => {
						return {
							start_time: entry[0], // unix timestamp
							end_time: entry[1], // unix timestamp
							duration: entry[2], // in seconds
							area: entry[3], // in cm^2
							errors: entry[4], // ?
							completed: entry[5] === 1, // boolean
							start_type: entry[6], // ?? 1 = Roboter 2= app
							clean_type: entry[7] // ?? 1= fullClean 2=Zone 3 = roomclean
						};
					});

					records.forEach(record => {
						const dates = new Date();
						dates.setTime(record.start_time * 1000);

						cleanJSON.push({
							Datum: dates.getDate() + '.' + (dates.getMonth() + 1),
							Start: (dates.getHours() < 10 ? '0' : '') + dates.getHours() + ':' + (dates.getMinutes() < 10 ? '0' : '') + dates.getMinutes(),
							Saugzeit: Math.round(record.duration / 60) + ' min',
							Fläche: Math.round(record.area / 10000) / 100 + ' m²',
							Error: record.errors,
							Ende: record.completed
						});
					});
				});
				adapter.log.warn('finish logs all? ' + JSON.stringify(cleanJSON));
				return;
			}

			await start();
			return cleanJSON;


		} catch (error) {
			adapter.log.warn('Error at history: ' + error);
		}
	}

	async createHthmTable(cleanJSON) {
		// Tabelleneigenschaften
		// TODO: Translate
		const clean_log_html_attr = '<colgroup> <col width="50"> <col width="50"> <col width="80"> <col width="100"> <col width="50"> <col width="50"> </colgroup>';
		const clean_log_html_head = '<tr> <th>Datum</th> <th>Start</th> <th>Saugzeit</th> <th>Fläche</th> <th>???</th> <th>Ende</th></tr>';

		let lines = '';
		cleanJSON.forEach(line => {
			lines += '<tr>' + '<td>' + line.Datum + '</td>' + '<td>' + line.Start + '</td>' + '<td ALIGN="RIGHT">' + line.Saugzeit + '</td>' + '<td ALIGN="RIGHT">' + line['Fläche'] + '</td>' + '<td ALIGN="CENTER">' + line.Error + '</td>' + '<td ALIGN="CENTER">' + line.Ende + '</td>' + '</tr>';
		});
		return '<table>' + clean_log_html_attr + clean_log_html_head + lines + '</table>';
	}

	async asyncForEach(array, callback) {
		for (let index = 0; index < array.length; index++) {
			await callback(array[index], index, array);
		}
	}

	async setGetSoundVolume(message) {
		if (!message) return;
		adapter.setStateAsync('control.sound_volume', {
			val: message.result[0],
			ack: true
		});
	}
	async setGetConsumable(message) {
		if (!message) return;
		const consumable = message.result[0]; //parseConsumable(answer)

		consumable.water_filter && await this.features.setWaterFilter(); // set for Waterfilter if exist

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

		this.features.water_filter && adapter.setStateAsync('consumable.water_filter', {
			val: 100 - (Math.round(consumable.filter_element_work_time / 3600)), // 100h
			ack: true
		});

	}

	async setGetStatus(message) {
		if (!message) return;
		const status = await this.parseStatus(message);
		adapter.log.debug('setGetStatus ' + JSON.stringify(status));

		await this.features.setNewSuctionValues(Math.round(status.fan_power));
		await this.features.setWaterBox(status.water_box_status);
		await this.features.setWaterBoxMode(status.water_box_mode);

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
			val: Math.round(status.fan_power),
			ack: true
		});
		adapter.setStateAsync('info.error', {
			val: status.error_code,
			ack: true
		});
		adapter.setStateAsync('info.dnd', {
			val: status.dnd_enabled,
			ack: true
		});

		//fetures
		this.features.water_box && adapter.setStateAsync('info.water_box', {
			val: status.water_box_status,
			ack: true
		});
		this.features.water_box_mode && adapter.setStateAsync('control.water_box_mode', {
			val: Math.round(status.water_box_mode),
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

	async stateChange(id, state) {
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
					if (data) {
						adapter.setStateAsync(id, {
							val: state.val,
							ack: true
						});
					}
					break;
				case 'water_grade':
					data = await this.Miio.sendMessage('set_suction', [state.val]);

					adapter.log.debug('change water_grade');
					if (data) {
						adapter.setStateAsync(id, {
							val: state.val,
							ack: true
						});
					}
					break;
				case 'is_mop':
					data = await this.Miio.sendMessage('set_mop', [state.val]);

					adapter.log.debug('change mop');
					if (data) {
						adapter.setStateAsync(id, {
							val: state.val,
							ack: true
						});
					}
					break;
				case 'light_state':
					data = await this.Miio.sendMessage('set_light', [state.val ? 1 : 0]);

					adapter.log.debug('change light_state');
					if (data) {
						adapter.setStateAsync(id, {
							val: state.val,
							ack: true
						});
					}
					break;
				case 'start':

					if (lastProps.mode === 4) {
						//i dont know now
						return;
					} else {
						if (lastProps.mode === 2) {
							actionMode = 2;
						} else {
							if (lastProps.is_mop === 2) {
								actionMode = 3;
							} else {
								actionMode = lastProps.is_mop;
							}
						}
						if (lastProps.mode === 3) {
							method = 'set_mode';
							params = [3, 1];
						} else {
							method = 'set_mode_withroom';
							params = [actionMode, 1, 0];
						}
					}

					data = await this.Miio.sendMessage(method, params);

					adapter.log.debug('start with: ' + method + '  params:' + params);

					if (data) {
						adapter.setStateAsync(id, {
							val: state.val,
							ack: true
						});
					}
					break;
				case 'pause':

					if (lastProps.mode === 4) {
						//i dont know now
						return;
					} else {
						if (lastProps.mode === 2) {
							actionMode = 2;
						} else {
							if (lastProps.is_mop === 2) {
								actionMode = 3;
							} else {
								actionMode = lastProps.is_mop;
							}
						}
						if (lastProps.mode === 3) {
							method = 'set_mode';
							params = [3, 3];
						} else {
							method = 'set_mode_withroom';
							params = [actionMode, 3, 0];
						}
					}

					data = await this.Miio.sendMessage(method, params);

					adapter.log.debug('pause with: ' + method + '  params:' + params);

					if (data) {
						adapter.setStateAsync(id, {
							val: state.val,
							ack: true
						});
					}
					break;
				case 'stop':
					if (lastProps.mode === 3) {
						method = 'set_mode';
						params = [3, 0];
					} else if (lastProps.is_mop === 4) {
						method = 'set_pointclean';
						params = [0, 0, 0];
					} else {
						method = 'set_mode';
						params = [0];
					}
					data = await this.Miio.sendMessage(method, params);

					adapter.log.debug('stop with: ' + method + '  params:' + params);

					if (data) {
						adapter.setStateAsync(id, {
							val: state.val,
							ack: true
						});
					}
					break;
				case 'return_dock':
					data = await this.Miio.sendMessage('set_charge', [1]);

					adapter.log.debug('change mop');
					if (data) {
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
			adapter.log.warn('Cant send command please try again' + command);
		}
	}
	startClean() {
		return 'set_mode_withroom', [0, 1, 0];
	}

	//Space for simular functions
	//----------------------------------------------


}

class FeatureManager {

	constructor() {
		this.firmware = null;
		this.model = null;
		this.goto = false;
		this.zoneClean = false;
		this.mob = false;
		this.water_box = null;
		this.water_filter = null;
		this.water_box_mode = null;
		this.carpetMode = null;
		this.roomMapping = null;
		this.NewSuctionPower = null;
	}

	init() {
		//adapter.states
		//roomManager = new RoomManager(adapter, i18n);
		//timerManager = new TimerManager(adapter, i18n);

		adapter.getState('info.device_model', function (err, state) {
			state && state.val && features.setModel(state.val);
		});
		adapter.getState('info.device_fw', function (err, state) {
			state && state.val && features.setFirmware(state.val);
		});

		// we get miIO.info only, if the robot is connected to the internet, so we init with unavailable
		adapter.setState('info.wifi_signal', 'unavailable', true);



	}

	detect() {
		sendMsg(com.get_carpet_mode.method); // test, if supported
		sendMsg('get_room_mapping'); // test, if supported
	}

	async setNewSuctionValues(value) {

		if (this.NewSuctionPower === null && value > 100) {
			adapter.log.info('change states from State control.fan_power');

			this.NewSuctionPower = true;
			await adapter.setObjectAsync('control.fan_power', objects.newfan_power);

			if (this.mob) {
				adapter.log.info('extend state mop for State control.fan_power');
				await adapter.extendObjectAsync('control.fan_power', {
					common: {
						max: 105,
						states: {
							105: 'MOP' // no vacuum, only mop
						}
					}
				});
			}

		} else if (this.NewSuctionPower === null && value <= 100) this.NewSuctionPower = false;
	}

	setModel(model) {


		// First Viomi detection


		if (this.model != model) {

			adapter.setStateChanged('info.device_model', model, true);
			this.model = model;

			if (viomiManager.ViomiDevices.includes(model)) {
				adapter.log.info('Detect Viomi Device: ' + model);
				ViomiFlag = true;
				viomiManager.initStates();
			}


			this.mob = (model === 'roborock.vacuum.s5' || model === 'roborock.vacuum.s6' || model === 'roborock.vacuum.s5e');

		}
	}

	setCarpetMode(enabled) {
		if (this.carpetMode === null) {
			this.carpetMode = true;
			adapter.log.info('create state for carpet_mode');
			adapter.setObjectNotExists('control.carpet_mode', objects.carpet_mode);
		}
		adapter.setStateChanged('control.carpet_mode', enabled === 1, true);
	}

	async setWaterBox(water_box_status) {
		if (this.water_box === null) {
			this.water_box = !isNaN(water_box_status);
			if (this.water_box) {
				adapter.log.info('create states for water box');
				await adapter.setObjectNotExistsAsync('info.water_box', objects.water_box);
			}
		}

	}

	async setWaterFilter() {
		if (this.water_box === null) {
			this.water_box = true;
			adapter.log.info('create states for water box filter');
			await Promise.all(objects.water_filter.map(async (o) => {
				const contents = await adapter.setObjectNotExistsAsync('consumable.' + o._id, o);
				adapter.log.debug('Create State for water_filter ' + JSON.stringify(contents));
			}));
		}
	}

	async setWaterBoxMode(water_box_mode) {
		if (this.water_box_mode === null && water_box_mode) {
			this.water_box_mode = !isNaN(water_box_mode);
			if (this.water_box_mode) {
				adapter.log.info('create states for water box mode');
				await adapter.setObjectNotExistsAsync('control.water_box_mode', objects.water_box_mode);

			}
		}
	}
}

module.exports = VacuumManager;
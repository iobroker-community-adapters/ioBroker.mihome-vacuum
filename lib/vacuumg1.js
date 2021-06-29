'use strict';

//const Miio = require("iobroker.mihome-vacuum/lib/miio");

let adapter = null;
const objects = require('./objects');
let getStateTimeout = null;
const lastProps = {};

class ViomiManager {
	constructor(adapterInstance, Miio) {
		this.Miio = Miio;
		adapter = adapterInstance;
		adapter.log.debug('select vacuumg1 protocol....');

		// https://miot-spec.org/miot-spec-v2/instance?type=urn:miot-spec-v2:device:vacuum:0000A006:mijia-v1:1


		this.mapping = {
			battery: {
				siid: 3,
				piid: 1
			},
			'charge_state': {
				'siid': 3,
				'piid': 2
			},
			'error': {
				'siid': 2,
				'piid': 2
			},
			'state': {
				'siid': 2,
				'piid': 1
			},
			'fan_speed': {
				'siid': 2,
				'piid': 6
			},
			'operating_mode': {
				'siid': 2,
				'piid': 4
			},
			'mop_state': {
				'siid': 16,
				'piid': 1
			},
			'water_level': {
				'siid': 2,
				'piid': 5
			},
			'brush_life_level': {
				'siid': 14,
				'piid': 1
			},
			//  "brush_life_time": {"siid": 14, "piid": 2},
			'brush_life_level2': {
				'siid': 15,
				'piid': 1
			},
			//  "brush_life_time2": {"siid": 15, "piid": 2},
			'filter_life_level': {
				'siid': 11,
				'piid': 1
			},
			//  "filter_life_time": {"siid": 11, "piid": 2},
			'clean_area': {
				'siid': 9,
				'piid': 1
			},
			'clean_time': {
				'siid': 18,
				'piid': 5
			},
			'total_clean_count': {
				'siid': 9,
				'piid': 5
			},
			//  "total_clean_area": {"siid": 9, "piid": 3},
			//  "dnd_enabled": {"siid": 12, "piid": 2},
			//  "audio_volume": {"siid": 4, "piid": 2},
			//  "direction_key": {"siid": 8, "piid": 1}
		};


		this.ERROR_CODES = {
			'0': 'OK',
			'1': 'Left wheel error',
			'2': 'Right wheel error' ,
			'3': 'Cliff error',
			'4': 'Low attery error ',
			'5': 'Bump error',
			'6': 'Main brush error',
			'7': 'Side brush error',
			'8': 'Fan motor error',
			'9': 'Dustbin error',
			'10': 'Charging error',
			'11': 'No water error',
			'12': 'Pick up error'
		};

		this.STATES = {
			'1': 'Idle',
			'2': 'Sweeping',
			'3': 'Paused',
			'4': 'Error ',
			'5': 'Charging',
			'6': 'Going home'
		};

		this.FANSPEED = {
			0: 'Silent',
			1: 'Standard',
			2: 'Medium',
			3: 'Turbo'
		};

		this.MODE = {
			0: 'Vacuum',
			1: 'VacuumAndMop',
			2: 'Mop'
		};

		this.main();
	}

	async main() {
		await this.initStates();

		this.getStates();
	}

	async getStates() {
		clearTimeout(getStateTimeout);
		let DeviceData;

		adapter.log.debug('get params for Viomi');
		try {
			DeviceData = await this.Miio.sendMessage('get_prop', this.PARAMS);
			adapter.log.debug('Recievded params for viomi: ' + JSON.stringify(DeviceData));
		} catch (error) {
			DeviceData = null;
		}

		if (DeviceData) {

			const answer = DeviceData.result;
			answer.forEach((element, index) => {

				const objExist = objects.viomiObjects.find(element => element._id === this.PARAMS[index]);

				lastProps[this.PARAMS[index]] = element;

				if (typeof (objExist) !== 'undefined') {
					if (objExist.common.type === 'boolean') {
						adapter.setStateAsync('control.' + this.PARAMS[index], {
							val: !!element,
							ack: true
						});
					} else {
						adapter.setStateAsync('control.' + this.PARAMS[index], {
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
		objects.viomiObjects.map(o => adapter.setObjectNotExistsAsync('control.' + o._id, o));
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

					adapter.log.debug(`pause with: ${method}  params:${params}`);

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

					adapter.log.debug(`stop with: ${method}  params:${params}`);

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
		// return 'set_mode_withroom', [0, 1, 0];
	}


}
module.exports = ViomiManager;
'use strict';

let adapter = null;

const objects = require('./objects');

const DreameWaterVolumes = {
	UNKNOWN: -1,
	LOW: 1,
	MEDIUM: 2,
	HIGH: 3,
}

const DreameErrors = {
	UNKNOWN: -1,
	NO_ERROR: 0,
	DROP: 1,
	CLIFF: 2,
	BUMPER: 3,
	GESTURE: 4,
	BUMPER_REPEAT: 5,
	DROP_REPEAT: 6,
	OPTICAL_FLOW: 7,
	BOX: 8,
	TANKBOX: 9,
	WATERBOX_EMPTY: 10,
	BOX_FULL: 11,
	BRUSH: 12,
	SIDE_BRUSH: 13,
	FAN: 14,
	LEFT_WHEEL_MOTOR: 15,
	RIGHT_WHEEL_MOTOR: 16,
	TURN_SUFFOCATE: 17,
	FORWARD_SUFFOCATE: 18,
	CHARGER_GET: 19,
	BATTERY_LOW: 20,
	CHARGE_FAULT: 21,
	BATTERY_PERCENTAGE: 22,
	HEART: 23,
	CAMERA_OCCLUSION: 24,
	MOVE: 25,
	FLOW_SHIELDING: 26,
	INFRARED_SHIELDING: 27,
	CHARGE_NO_ELECTRIC: 28,
	BATTERY_FAULT: 29,
	FAN_SPEED_ERROR: 30,
	LEFTWHELL_SPEED: 31,
	RIGHTWHELL_SPEED: 32,
	BMI055_ACCE: 33,
	BMI055_GYRO: 34,
	XV7001: 35,
	LEFT_MAGNET: 36,
	RIGHT_MAGNET: 37,
	FLOW_ERROR: 38,
	INFRARED_FAULT: 39,
	CAMERA_FAULT: 40,
	STRONG_MAGNET: 41,
	WATER_PUMP: 42,
	RTC: 43,
	AUTO_KEY_TRIG: 44,
	P3V3: 45,
	CAMERA_IDLE: 46,
	BLOCKED: 47,
	LDS_ERROR: 48,
	LDS_BUMPER: 49,
	WATER_PUMP_2: 50,
	FILTER_BLOCKED: 51,
	EDGE: 54,
	CARPET: 55,
	LASER: 56,
	EDGE_2: 57,
	ULTRASONIC: 58,
	NO_GO_ZONE: 59,
	ROUTE: 61,
	ROUTE_2: 62,
	BLOCKED_2: 63,
	BLOCKED_3: 64,
	RESTRICTED: 65,
	RESTRICTED_2: 66,
	RESTRICTED_3: 67,
	REMOVE_MOP: 68,
	MOP_REMOVED: 69,
	MOP_REMOVED_2: 70,
	MOP_PAD_STOP_ROTATE: 71,
	MOP_PAD_STOP_ROTATE_2: 72,
	BIN_FULL: 101,
	BIN_OPEN: 102,
	BIN_OPEN_2: 103,
	BIN_FULL_2: 104,
	WATER_TANK: 105,
	DIRTY_WATER_TANK: 106,
	WATER_TANK_DRY: 107,
	DIRTY_WATER_TANK_2: 108,
	DIRTY_WATER_TANK_BLOCKED: 109,
	DIRTY_WATER_TANK_PUMP: 110,
	MOP_PAD: 111,
	WET_MOP_PAD: 112,
	CLEAN_MOP_PAD: 114,
	CLEAN_TANK_LEVEL: 116,
	DIRTY_TANK_LEVEL: 118,
	WASHBOARD_LEVEL: 119
}

const DreameState = {
	UNKNOWN: -1,
	SWEEPING: 1,
	IDLE: 2,
	PAUSED: 3,
	ERROR: 4,
	RETURNING: 5,
	CHARGING: 6,
	MOPPING: 7,
	DRYING: 8,
	WASHING: 9,
	RETURNING_WASHING: 10,
	BUILDING: 11,
	SWEEPING_AND_MOPPING: 12,
	CHARGING_COMPLETED: 13,
	UPGRADING: 14
}

const DreameWashBaseState = {
	IDLE: 0,
	WASHING: 1,
	DRYING: 2,
	RETURNING: 3,
	PAUSED: 4,
	CLEAN_ADD_WATER: 5,
	ADDING_WATER: 6
}

const DreameProperties = {
	STATE: {
		did: "", siid: 2, piid: 1, control: "info.state", control_mapping: {
			0: DreameState.UNKNOWN, 3: DreameState.IDLE, 5: [DreameState.SWEEPING_AND_MOPPING, DreameState.SWEEPING], 6: DreameState.RETURNING, 8: [DreameState.CHARGING, DreameState.CHARGING_COMPLETED], 10: DreameState.PAUSED, 12: DreameState.ERROR, 14: DreameState.UPGRADING, 26: DreameState.RETURNING_WASHING, 28: DreameState.DRYING, 29: DreameState.WASHING
		}, type: 'int'
	},
	ERROR: { did: "", siid: 2, piid: 2, control: "info.error", control_mapping: { 0: DreameErrors.NO_ERROR, 1: DreameErrors.LASER, 2: DreameErrors.BUMPER, 5: DreameErrors.BRUSH, 6: DreameErrors.SIDE_BRUSH, 8: DreameErrors.BLOCKED, 10: DreameErrors.FILTER_BLOCKED, 11: DreameErrors.STRONG_MAGNET, 12: DreameErrors.BATTERY_LOW, 13: DreameErrors.CHARGE_FAULT, 14: DreameErrors.BATTERY_FAULT, 17: DreameErrors.SIDE_BRUSH, 18: DreameErrors.FAN, 20: DreameErrors.REMOVE_MOP }, type: 'int' },
	BATTERY_LEVEL: { did: "", siid: 3, piid: 1, control: "info.battery" },
	CHARGING_STATUS: { did: "", siid: 3, piid: 2, control: "info.is_charging" },
	STATUS: { did: "", siid: 4, piid: 1 },
	CLEANING_TIME: { did: "", siid: 4, piid: 2, control: "info.cleanedtime" },
	CLEANED_AREA: { did: "", siid: 4, piid: 3, control: "info.cleanedarea" },
	SUCTION_LEVEL: { did: "", siid: 4, piid: 4, control: "setting.suction_grade" },
	WATER_VOLUME: {
		did: "", siid: 4, piid: 5, control: "setting.water_grade", control_mapping: { 11: DreameWaterVolumes.LOW, 12: DreameWaterVolumes.MEDIUM, 13: DreameWaterVolumes.HIGH }, type: 'int'
	},
	WATER_TANK: { did: "", siid: 4, piid: 6 },
	TASK_STATUS: { did: "", siid: 4, piid: 7 },
	CLEANING_START_TIME: { did: "", siid: 4, piid: 8 },
	CLEAN_LOG_FILE_NAME: { did: "", siid: 4, piid: 9 },
	CLEANING_PROPERTIES: { did: "", siid: 4, piid: 10 },
	RESUME_CLEANING: { did: "", siid: 4, piid: 11 },
	CARPET_BOOST: { did: "", siid: 4, piid: 12 },
	CLEAN_LOG_STATUS: { did: "", siid: 4, piid: 13 },
	SERIAL_NUMBER: { did: "", siid: 4, piid: 14 },
	REMOTE_CONTROL: { did: "", siid: 4, piid: 15 },
	MOP_CLEANING_REMAINDER: { did: "", siid: 4, piid: 16 },
	CLEANING_PAUSED: { did: "", siid: 4, piid: 17 },
	FAULTS: { did: "", siid: 4, piid: 18 },
	NATION_MATCHED: { did: "", siid: 4, piid: 19 },
	RELOCATION_STATUS: { did: "", siid: 4, piid: 20 },
	OBSTACLE_AVOIDANCE: { did: "", siid: 4, piid: 21 },
	AI_DETECTION: { did: "", siid: 4, piid: 22 },
	CLEANING_MODE: { did: "", siid: 4, piid: 23 },
	UPLOAD_MAP: { did: "", siid: 4, piid: 24 },
	SELF_WASH_BASE_STATUS: { did: "", siid: 4, piid: 25, control: "info.dock_state", type: 'int' },
	CUSTOMIZED_CLEANING: { did: "", siid: 4, piid: 26 },
	CHILD_LOCK: { did: "", siid: 4, piid: 27 },
	CARPET_SENSITIVITY: { did: "", siid: 4, piid: 28 },
	TIGHT_MOPPING: { did: "", siid: 4, piid: 29 },
	CLEANING_CANCEL: { did: "", siid: 4, piid: 30 },
	Y_CLEAN: { did: "", siid: 4, piid: 31 },
	WATER_ELECTROLYSIS: { did: "", siid: 4, piid: 32 },
	CARPET_RECOGNITION: { did: "", siid: 4, piid: 33 },
	SELF_CLEAN: { did: "", siid: 4, piid: 34 },
	WARN_STATUS: { did: "", siid: 4, piid: 35 },
	CARPET_AVOIDANCE: { did: "", siid: 4, piid: 36 },
	AUTO_ADD_DETERGENT: { did: "", siid: 4, piid: 37 },
	CAPABILITY: { did: "", siid: 4, piid: 38 },
	SAVE_WATER_TIPS: { did: "", siid: 4, piid: 39 },
	DRYING_TIME: { did: "", siid: 4, piid: 40 },
	NO_WATER_WARNING: { did: "", siid: 4, piid: 41 },
	AUTO_MOUNT_MOP: { did: "", siid: 4, piid: 45 },
	MOP_WASH_LEVEL: { did: "", siid: 4, piid: 46 },
	SCHEDULED_CLEAN: { did: "", siid: 4, piid: 47 },
	QUICK_COMMAND: { did: "", siid: 4, piid: 48 },
	INTELLIGENT_RECOGNITION: { did: "", siid: 4, piid: 49 },
	AUTO_SWITCH_SETTINGS: { did: "", siid: 4, piid: 50 },
	AUTO_WATER_REFILLING: { did: "", siid: 4, piid: 51 },
	MOP_IN_STATION: { did: "", siid: 4, piid: 52 },
	MOP_PAD_INSTALLED: { did: "", siid: 4, piid: 53 },
	COMBINED_DATA: { did: "", siid: 4, piid: 99 },
	DND: { did: "", siid: 5, piid: 1, control: "info.dnd", type: 'boolean' },
	DND_START: { did: "", siid: 5, piid: 2 },
	DND_END: { did: "", siid: 5, piid: 3 },
	DND_TASK: { did: "", siid: 5, piid: 4 },
	MAP_DATA: { did: "", siid: 6, piid: 1 },
	FRAME_INFO: { did: "", siid: 6, piid: 2 },
	OBJECT_NAME: { did: "", siid: 6, piid: 3 },
	MAP_EXTEND_DATA: { did: "", siid: 6, piid: 4 },
	ROBOT_TIME: { did: "", siid: 6, piid: 5 },
	RESULT_CODE: { did: "", siid: 6, piid: 6 },
	MULTI_FLOOR_MAP: { did: "", siid: 6, piid: 7 },
	MAP_LIST: { did: "", siid: 6, piid: 8 },
	RECOVERY_MAP_LIST: { did: "", siid: 6, piid: 9 },
	MAP_RECOVERY: { did: "", siid: 6, piid: 10 },
	MAP_RECOVERY_STATUS: { did: "", siid: 6, piid: 11 },
	OLD_MAP_DATA: { did: "", siid: 6, piid: 13 },
	BACKUP_MAP_STATUS: { did: "", siid: 6, piid: 14 },
	WIFI_MAP: { did: "", siid: 6, piid: 15 },
	VOLUME: { did: "", siid: 7, piid: 1, control: "control.sound_volume", type: 'int' },
	VOICE_PACKET_ID: { did: "", siid: 7, piid: 2 },
	VOICE_CHANGE_STATUS: { did: "", siid: 7, piid: 3 },
	VOICE_CHANGE: { did: "", siid: 7, piid: 4 },
	TIMEZONE: { did: "", siid: 8, piid: 1 },
	SCHEDULE: { did: "", siid: 8, piid: 2 },
	SCHEDULE_ID: { did: "", siid: 8, piid: 3 },
	SCHEDULE_CANCEL_REASON: { did: "", siid: 8, piid: 4 },
	CRUISE_SCHEDULE: { did: "", siid: 8, piid: 5 },
	MAIN_BRUSH_TIME_LEFT: { did: "", siid: 9, piid: 1 },
	MAIN_BRUSH_LEFT: { did: "", siid: 9, piid: 2, control: "consumable.main_brush", type: 'int' },
	SIDE_BRUSH_TIME_LEFT: { did: "", siid: 10, piid: 1 },
	SIDE_BRUSH_LEFT: { did: "", siid: 10, piid: 2, control: "consumable.side_brush", type: 'int' },
	FILTER_LEFT: { did: "", siid: 11, piid: 1, control: "consumable.filter", type: 'int' },
	FILTER_TIME_LEFT: { did: "", siid: 11, piid: 2 },
	FIRST_CLEANING_DATE: { did: "", siid: 12, piid: 1 },
	TOTAL_CLEANING_TIME: { did: "", siid: 12, piid: 2, control: "history.total_time" },
	CLEANING_COUNT: { did: "", siid: 12, piid: 3, control: "history.total_cleanups" },
	TOTAL_CLEANED_AREA: { did: "", siid: 12, piid: 4, control: "history.total_area" },
	MAP_SAVING: { did: "", siid: 13, piid: 1 },
	AUTO_DUST_COLLECTING: { did: "", siid: 15, piid: 1 },
	AUTO_EMPTY_FREQUENCY: { did: "", siid: 15, piid: 2 },
	DUST_COLLECTION: { did: "", siid: 15, piid: 3 },
	AUTO_EMPTY_STATUS: { did: "", siid: 15, piid: 5 },
	SENSOR_DIRTY_LEFT: { did: "", siid: 16, piid: 1, control: "consumable.sensors", type: 'int' },
	SENSOR_DIRTY_TIME_LEFT: { did: "", siid: 16, piid: 2 },
	MOP_PAD_LEFT: { did: "", siid: 18, piid: 1 },
	MOP_PAD_TIME_LEFT: { did: "", siid: 18, piid: 2 },
	SILVER_ION_TIME_LEFT: { did: "", siid: 19, piid: 1 },
	SILVER_ION_LEFT: { did: "", siid: 19, piid: 2 },
	DETERGENT_LEFT: { did: "", siid: 20, piid: 1 },
	DETERGENT_TIME_LEFT: { did: "", siid: 20, piid: 2 },
	STREAM_STATUS: { did: "", siid: 10001, piid: 1 },
	STREAM_AUDIO: { did: "", siid: 10001, piid: 2 },
	STREAM_RECORD: { did: "", siid: 10001, piid: 4 },
	TAKE_PHOTO: { did: "", siid: 10001, piid: 5 },
	STREAM_KEEP_ALIVE: { did: "", siid: 10001, piid: 6 },
	STREAM_FAULT: { did: "", siid: 10001, piid: 7 },
	CAMERA_BRIGHTNESS: { did: "", siid: 10001, piid: 9 },
	CAMERA_LIGHT: { did: "", siid: 10001, piid: 10 },
	STREAM_CRUISE_POINT: { did: "", siid: 10001, piid: 101 },
	STREAM_PROPERTY: { did: "", siid: 10001, piid: 99 },
	STREAM_TASK: { did: "", siid: 10001, piid: 103 },
	STREAM_UPLOAD: { did: "", siid: 10001, piid: 1003 },
	STREAM_CODE: { did: "", siid: 10001, piid: 1100 },
	STREAM_SET_CODE: { did: "", siid: 10001, piid: 1101 },
	STREAM_VERIFY_CODE: { did: "", siid: 10001, piid: 1102 },
	STREAM_RESET_CODE: { did: "", siid: 10001, piid: 1103 },
	STREAM_SPACE: { did: "", siid: 10001, piid: 2003 },
}

const DreameActions = {
	START: { did: "", siid: 2, aiid: 1, control: "control.start" },
	PAUSE: { did: "", siid: 2, aiid: 2, control: "control.pause" },
	CHARGE: { did: "", siid: 3, aiid: 1, control: "control.home" },
	START_CUSTOM: { did: "", siid: 4, aiid: 1 },
	STOP: { did: "", siid: 4, aiid: 2 },
	CLEAR_WARNING: { did: "", siid: 4, aiid: 3 },
	START_WASHING: { did: "", siid: 4, aiid: 4 },
	GET_PHOTO_INFO: { did: "", siid: 4, aiid: 6 },
	REQUEST_MAP: { did: "", siid: 6, aiid: 1 },
	UPDATE_MAP_DATA: { did: "", siid: 6, aiid: 2 },
	BACKUP_MAP: { did: "", siid: 6, aiid: 3 },
	WIFI_MAP: { did: "", siid: 6, aiid: 4 },
	LOCATE: { did: "7.1", siid: 7, aiid: 1, control: "control.find" },
	TEST_SOUND: { did: "", siid: 7, aiid: 2, control: "control.sound_volume_test" },
	DELETE_SCHEDULE: { did: "", siid: 8, aiid: 1 },
	DELETE_CRUISE_SCHEDULE: { did: "", siid: 8, aiid: 2 },
	RESET_MAIN_BRUSH: { did: "", siid: 9, aiid: 1, control: "consumable.main_brush_reset" },
	RESET_SIDE_BRUSH: { did: "", siid: 10, aiid: 1, control: "consumable.side_brush_reset" },
	RESET_FILTER: { did: "", siid: 11, aiid: 1, control: "consumable.filter_reset" },
	RESET_SENSOR: { did: "", siid: 16, aiid: 1, control: "consumable.sensors_reset" },
	START_AUTO_EMPTY: { did: "", siid: 15, aiid: 1 },
	RESET_MOP_PAD: { did: "", siid: 18, aiid: 1 },
	RESET_SILVER_ION: { did: "", siid: 19, aiid: 1 },
	RESET_DETERGENT: { did: "", siid: 20, aiid: 1 },
	STREAM_CAMERA: { did: "", siid: 10001, aiid: 1 },
	STREAM_AUDIO: { did: "", siid: 10001, aiid: 2 },
	STREAM_PROPERTY: { did: "", siid: 10001, aiid: 3 },
	STREAM_CODE: { did: "", siid: 10001, aiid: 4 },
}

const DreameBlockedObjects = [
	'carpet_mode',
	'clean_home',
	'clearQueue',
	'fan_power',
	'goTo',
	'pauseResume',
	'resumeRoomClean',
	'sound_volume_test',
	'spotclean',
	'zoneClean',
	'allTableHTML',
	'allTableJSON'
]

class DreameManager {
	constructor(adapterInstance, Miio) {
		this.Miio = Miio;
		adapter = adapterInstance;
		adapter.log.debug('select dreame protocol...');

		this.washBaseAvailable = false;

		this.globalTimeouts = {};

		this.PARAMS = [
			DreameProperties.STATE,
			DreameProperties.ERROR,
			DreameProperties.BATTERY_LEVEL,
			DreameProperties.CHARGING_STATUS,
			DreameProperties.CLEANED_AREA,
			DreameProperties.CLEANING_TIME,
			DreameProperties.VOLUME,
			DreameProperties.MAIN_BRUSH_LEFT,
			DreameProperties.SIDE_BRUSH_LEFT,
			DreameProperties.FILTER_LEFT,
			DreameProperties.SENSOR_DIRTY_LEFT,
			DreameProperties.SUCTION_LEVEL,
			DreameProperties.WATER_VOLUME,
			DreameProperties.DND,
			DreameProperties.TOTAL_CLEANING_TIME,
			DreameProperties.CLEANING_COUNT,
			DreameProperties.TOTAL_CLEANED_AREA,
		];

		let data = [{ did: "", siid: DreameProperties.SELF_WASH_BASE_STATUS.siid, piid: DreameProperties.SELF_WASH_BASE_STATUS.piid }];
		this.Miio.sendMessage('get_properties', data).then((result) => {
			if (result.result[0].code != -1) {
				this.washBaseAvailable = true;
				this.PARAMS.push(DreameProperties.SELF_WASH_BASE_STATUS);
				adapter.log.debug('Wash base found!');
			} else {
				adapter.log.debug('No wash base found!');
			}
		});

		this.main();
	}

	async init() {
		await Promise.all(objects.stockControl.map(async o => {
			if (!DreameBlockedObjects.includes(o._id)) {
				const contents = await adapter.setObjectAsync('control' + (o._id ? '.' + o._id : ''), o);
				contents && adapter.log.debug('Create State for control: ' + JSON.stringify(contents));
			}
		}));
		await Promise.all(objects.stockInfo.map(async o => {
			if (!DreameBlockedObjects.includes(o._id)) {
				const contents = await adapter.setObjectAsync('info' + (o._id ? '.' + o._id : ''), o);
				contents && adapter.log.debug('Create State for stockInfo: ' + JSON.stringify(contents));
			}
		}));
		await Promise.all(objects.settings.map(async o => {
			if (!DreameBlockedObjects.includes(o._id)) {
				const contents = await adapter.setObjectAsync('setting' + (o._id ? '.' + o._id : ''), o);
				contents && adapter.log.debug('Create State for settings: ' + JSON.stringify(contents));
			}
		}));
		await Promise.all(objects.stockConsumable.map(async o => {
			if (!DreameBlockedObjects.includes(o._id)) {
				const contents = await adapter.setObjectAsync('consumable' + (o._id ? '.' + o._id : ''), o);
				contents && adapter.log.debug('Create State for stockConsumable: ' + JSON.stringify(contents));
			}
		}));

		await Promise.all(objects.stockHistory.map(async o => {
			if (!DreameBlockedObjects.includes(o._id)) {
				const contents = await adapter.setObjectAsync('history' + (o._id ? '.' + o._id : ''), o);
				contents && adapter.log.debug('Create State for stockHistory: ' + JSON.stringify(contents));
			}
		}));

		adapter.log.debug('Get Status Wash Base to create objects.');
		if (this.washBaseAvailable) {
			await Promise.all(objects.wash_base.map(async o => {
				if (!DreameBlockedObjects.includes(o._id)) {
					const contents = await adapter.setObjectAsync('control' + (o._id ? '.' + o._id : ''), o);
					contents && adapter.log.debug('Create Wash Base State for control: ' + JSON.stringify(contents));
				}
			}));
			await Promise.all(objects.wash_base_info.map(async o => {
				if (!DreameBlockedObjects.includes(o._id)) {
					const contents = await adapter.setObjectAsync('info' + (o._id ? '.' + o._id : ''), o);
					contents && adapter.log.debug('Create Wash Base State for info: ' + JSON.stringify(contents));
				}
			}));
		}

		adapter.log.debug('Create State done!');
	}

	async main() {
		await this.init();
		this.getStates();

	}
	async getStates() {
		clearTimeout(this.globalTimeouts['getStates']);
		let DeviceData;

		adapter.log.debug('get params for Dreame');
		let chunkSize = 15;
		for (let i = 0; i < this.PARAMS.length; i += chunkSize) {
			try {
				let chunk = this.PARAMS.slice(i, i + chunkSize);
				let returnArray = [];
				chunk.forEach((element, index) => {
					returnArray.push({ did: "", siid: element.siid, piid: element.piid })
				});
				adapter.log.debug('get params for Dreame: ' + JSON.stringify(returnArray));
				DeviceData = await this.Miio.sendMessage('get_properties', returnArray);
				adapter.log.debug('Received params for dreame: ' + JSON.stringify(DeviceData));
			} catch (error) {
				DeviceData = null;
			}

			if (DeviceData && DeviceData.result) {

				const answer = DeviceData.result;
				answer.forEach((element, index) => {
					for (let property in DreameProperties) {
						// Skip all device properties which are not linked to any adapter value
						if (DreameProperties[property].control != undefined) {
							let propertyDefinition = DreameProperties[property];
							if (propertyDefinition.siid == element.siid && propertyDefinition.piid == element.piid) {
								this.updateObjectValue(DreameProperties[property], propertyDefinition.control, element);
							}
						}
					}
				});
			}
		}
		this.globalTimeouts['getStates'] = setTimeout(this.getStates.bind(this), adapter.config.pingInterval);
	}

	updateObjectValue(property, control, element) {
		let value = element.value;
		if (!this.getSpecialHandlingValues(property.control, value)) {
			value = this.mapDeviceValueToStateValue(value, property);

			adapter.log.debug("Chosen value = " + value + "!");

			// Cause some values are string instead of int/boolean, the adapter has to cast them
			if (property.type != undefined) {
				switch (property.type) {
					case 'int':
						value = parseInt(value);
						break;
					case 'boolean':
						value = Boolean(value);
						break;
				}
			}

			adapter.log.debug("Going to Set property (" + control + ") to " + value + "!");
			adapter.setStateAsync(control, { val: value, ack: true });
			adapter.log.debug("Set property (" + control + ") to " + value + "!");
		}
	}

	mapDeviceValueToStateValue(value, property) {
		if (property.control_mapping != undefined) {
			for (let mappingKey in property.control_mapping) {
				// If several device values represent the same adapter value
				if (Array.isArray(property.control_mapping[mappingKey])) {
					for (let newValue of property.control_mapping[mappingKey]) {
						if (newValue == value) {
							return mappingKey;
						}
					}
				} else {
					if (property.control_mapping[mappingKey] == value) {
						return mappingKey;
					}
				}
			}
		}
		return value;
	}

	getSpecialHandlingValues(control, dreameValue) {
		let value;
		switch (control) {
			case DreameProperties.CHARGING_STATUS.control:
				value = false;
				if (dreameValue == 1) {
					value = true;
				}
				break;
			default:
				return false;
		}
		adapter.log.debug("Set property (" + control + ") to " + value + " by special handling!");
		adapter.setStateAsync(control, { val: value, ack: true });
		return true;
	}

	async stateChange(id, state) {
		if (!state || state.ack) {
			return;
		}

		id = id.replace(adapter.namespace + ".", '');

		adapter.log.info('State changed: ' + id);

		if (await this.doCustomHandling(id, state)) {
			return;
		}

		let DeviceData;

		try {
			for (let property in DreameProperties) {
				let propertyDefinition = DreameProperties[property];
				if (propertyDefinition.control != undefined) {
					if (id == propertyDefinition.control) {
						DeviceData = await this.sendValueToDevice(propertyDefinition, state);
					}
				}
			}
			if (DeviceData && DeviceData.result) {
				await this.getStates();
				return;
			}

			for (let action in DreameActions) {
				let actionDefinition = DreameActions[action];
				if (actionDefinition.control != undefined) {
					if (id == actionDefinition.control) {
						DeviceData = await this.sendActionToDevice(actionDefinition);
					}
				}
			}
			if (DeviceData && DeviceData.result) {
				// Reset the button status in object explorer
				adapter.setStateAsync(id, { val: false, ack: true });
				this.getStates();
				return;
			}
		} catch (error) {
			adapter.log.warn('Can\'t send command please try again!');
			adapter.log.warn(error.stack);
		}
	}

	async doCustomHandling(id, state) {
		adapter.log.debug('Going to do custom handling...');
		let result = false;
		switch (id) {
			case 'control.washMop':
				result = await this.washMop();
				break;
			case 'control.pauseWashMop':
				result = await this.pauseWashMop();
				break;
			case 'control.startDrying':
				result = await this.dryMop();
				break;
			case 'control.stopDrying':
				result = await this.stopDryingMop();
				break;
			default:
				adapter.log.debug('No custom handling defined!');
				return false;
		}
		if (result) {
			adapter.log.debug('Custom handling successful. Going to reset state of button!');
			adapter.setStateAsync(id, { val: false, ack: true });
			this.getStates();
		} else {
			adapter.log.error('Custom handling error! Leave button/action unacknowledged.');
		}
		return true;
	}

	async washMop() {
		let isWashingPaused = false;
		let state = await adapter.getStateAsync('info.dock_state');

		if (state && state.val) {
			isWashingPaused = (state.val == DreameWashBaseState.PAUSED);
		}

		if (isWashingPaused) {
			adapter.log.debug('Washing of mop paused. Send resume action!');
			return this.callWashBaseAction("1,1");
		} else {
			adapter.log.debug('Washing of mop paused. Send wash action!');
			return this.callWashBaseAction("2,1");
		}
	}

	async pauseWashMop() {
		let isWashingMop = false;
		let state = await adapter.getStateAsync('info.dock_state');

		if (state && state.val) {
			isWashingMop = (state.val == DreameWashBaseState.WASHING);
		}

		if (isWashingMop) {
			adapter.log.debug('Washing mop. Send pause action!');
			return this.callWashBaseAction("1,0");
		}
		adapter.log.debug('Not Washing mop.');
		return false;
	}

	async dryMop() {
		let isDryingMop = false;
		let state = await adapter.getStateAsync('info.dock_state');

		if (state && state.val) {
			isDryingMop = (state.val != DreameWashBaseState.DRYING);
		}

		if (isDryingMop) {
			adapter.log.debug('Send dry action!');
			return this.callWashBaseAction("3,1");
		}

		return true;
	}

	async stopDryingMop() {
		let isDrying = false;
		let state = await adapter.getStateAsync('info.dock_state');

		if (state && state.val) {
			isDrying = (state.val == DreameWashBaseState.DRYING);
		}

		if (isDrying) {
			adapter.log.debug('Mop is drying. Send stop action!');
			return this.callWashBaseAction("3,0");
		}
		adapter.log.info('Can\'t stop drying because robot is not in status drying!');
		return true;
	}

	async callWashBaseAction(parameters) {
		parameters = [
			{
				piid: DreameProperties.CLEANING_PROPERTIES.piid,
				value: parameters
			}
		];
		adapter.log.debug('Send washbase action with parameters:' + JSON.stringify(parameters));
		if (!this.washBaseAvailable) return false;
		return await this.sendActionToDevice(DreameActions.START_WASHING, parameters);
	}

	async sendValueToDevice(propertyDefinition, state) {
		let value = state.val;
		if (propertyDefinition.control_mapping != undefined) {
			for (let mappingKey in propertyDefinition.control_mapping) {
				if (mappingKey == value) {
					value = propertyDefinition.control_mapping[mappingKey];
				}
			}
		}
		adapter.log.debug('Changing value of ' + propertyDefinition.control + ' to ' + String(value));
		let data = { did: propertyDefinition.did, siid: propertyDefinition.siid, piid: propertyDefinition.piid, value: value };
		return await this.Miio.sendMessage('set_properties', [data]);
	}

	async sendActionToDevice(actionDefinition, parameters = "[]") {
		let data = {
			did: actionDefinition.did, siid: actionDefinition.siid, aiid: actionDefinition.aiid, in: parameters
		};
		adapter.log.debug('Action:' + actionDefinition.control + ' with ' + JSON.stringify(data));
		let returnData = await this.Miio.sendMessage('action', data);
		if (returnData.result.code == -1) {
			adapter.log.debug('Action failed! MIOT Action not available or data sent not correct.');
			return false;
		}
		adapter.log.debug('Action successfull!');
		return true;
	}

	async close() {
		Object.keys(this.globalTimeouts).forEach(id => this.globalTimeouts[id] && clearTimeout(this.globalTimeouts[id]));
		this.globalTimeouts = {};
	}
}
module.exports = DreameManager;

'use strict';

/*
 * Created with @iobroker/create-adapter v1.27.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');
const dgram = require('dgram');
const com = require('./lib/comands');
const TimerManager = require('./lib/timerManager');
const RoomManager = require('./lib/roomManager');
const adapterName = require('./package.json').name.split('.').pop();
const MapHelper = require('./lib/maphelper');
const miio = require('./lib/miio');
const objects = require(__dirname + '/lib/objects');

const ViomiManager = require('./lib/viomi');
const VacuumManager = require('./lib/vacuum');

let DeviceModel;
let connected = false;
let Miio;
let vacuum = null;
let Map;

const deviceList = {
	'viomi.vacuum.v7': ViomiManager,
	'viomi.vacuum.v8': ViomiManager,
	'roborock.vacuum.s5' : VacuumManager,
	'roborock.vacuum.s6' : VacuumManager,
	'roborock.vacuum.m1s' : VacuumManager,
	'rockrobo.vacuum.v1' : VacuumManager,
	'roborock.vacuum.a10': VacuumManager,
	'roborock.vacuum.a15': VacuumManager

};

class MihomeVacuum extends utils.Adapter {

	/**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
	constructor(options) {
		super({
			...options,
			name: 'mihome-vacuum',
		});
		this.on('ready', this.onReady.bind(this));
		this.on('stateChange', this.onStateChange.bind(this));
		this.on('message', this.onMessage.bind(this));
		this.on('unload', this.onUnload.bind(this));
	}

	async main() {

		this.config.port = parseInt(this.config.port, 10) || 54321;
		this.config.ownPort = parseInt(this.config.ownPort, 10) || 53421;
		this.config.pingInterval = parseInt(this.config.pingInterval, 10) || 20000;

		// Abfrageintervall mindestens 10 sec.
		if (this.config.pingInterval < 10000) {
			this.config.pingInterval = 10000;
		}

		//create new miio class
		Miio = new miio(this);

		//create default States
		objects.deviceInfo.map(o => this.setObjectNotExistsAsync('deviceInfo.' + o._id, o));

		Miio.on('connect', () => {
			this.log.debug('MAIN: Connected to device, try to get model..');
			this.getModel();


		});

		//check if Self send Commands is enabled
		if (this.config.enableSelfCommands) {
			objects.customComands.map(o => this.setObjectNotExistsAsync('control.' + o._id, o));
		}
		else{
			objects.customComands.map(o => this.delObj('control.' + o._id));
		}

		//check if iotState is enabled
		if (this.config.enableAlexa) {
			objects.iotState.map(o => this.setObjectNotExistsAsync('control.' + o._id, o));
		}
		else{
			objects.iotState.map(o => this.delObj('control.' + o._id));
		}
	}

	/**
     * first communicaton to find out the model
     */
	async getModel() {
		//try to get from Config
		let configModel;
		try {
			configModel = JSON.parse(this.config.devices).model;
		} catch (e) {
			configModel = null;
		}
		const objModel = await this.getStateAsync('deviceInfo.model');
		this.log.debug('GETMODELFROMAPI: objModel: ' + JSON.stringify(objModel));

		let DeviceData;
		// try 5 times to get data
		for (let i = 0; i < 5; i++) {
			DeviceData = await this.getModelFromApi();
			this.log.debug('Get Device data..' + i);
			if (DeviceData) {
				this.log.debug('Get Device data from robot..');
				this.setModelInfoObject(DeviceData.result);
				DeviceModel = DeviceData.result.model;

				this.setConnrection(true);
				break;
			}
		}
		if (!DeviceData && objModel.val) {
			this.log.warn('No Answer for DeviceModel use old one');
			DeviceModel = objModel.val;
		}

		if (!DeviceData && configModel && objModel.val !== configModel) {
			this.log.warn('No Answer for DeviceModel use model from Config');
			DeviceModel = configModel;
			this.setModelInfoObject(JSON.parse(this.config.devices));
		}
		this.log.debug('DeviceModel selected to: ' + DeviceModel);

		//we get a model so we can select a protocoll
		if(deviceList[DeviceModel]){
			vacuum = new deviceList[DeviceModel](this,Miio);
		}
		else{
			this.log.warn('Model '+ DeviceModel+ ' not supported! Please open issue on git:  https://github.com/iobroker-community-adapters/ioBroker.mihome-vacuum/issues');
		}
	}

	/**
     * function to set DeviceInfo
     * @param {any} deviceInfo Modelname from Xiaomi eg: viomi.vacuum.v8
     */
	async setModelInfoObject(deviceInfo) {
		this.setStateAsync('deviceInfo.model', {
			val: deviceInfo.model,
			ack: true
		});
		this.setStateAsync('deviceInfo.fw_ver', {
			val: deviceInfo.fw_ver,
			ack: true
		});
		this.setStateAsync('deviceInfo.mac', {
			val: deviceInfo.mac,
			ack: true
		});
		return true;
	}

	/**
     * Function to set the connection indicator
     * @param {boolean} indicator could be true or false
     */
	async setConnrection(indicator) {
		connected = indicator;
		await this.setStateAsync('info.connection', {
			val: indicator,
			ack: true
		});
	}

	async getModelFromApi() {
		try {
			const DeviceData = await Miio.sendMessage('miIO.info');

			this.log.debug('GETMODELFROMAPI:Data: ' + JSON.stringify(DeviceData));
			return (DeviceData);

		} catch (error) {
			return null;
		}
	}

	/**
     * delete async function
     * @param {string} id
     */
	async delObj(id) {
		try {
			await this.delObjectAsync(id);
		} catch (error) {
			//... do nothing
		}
	}



	/**
     * Is called when databases are connected and adapter received configuration.
     */
	async onReady() {
		// Initialize your adapter here

		// Reset the connection indicator during startup
		this.setState('info.connection', false, true);
		this.subscribeStates('*');


		// examples for the checkPassword/checkGroup functions
		let result = await this.checkPasswordAsync('admin', 'iobroker');
		this.log.info('check user admin pw iobroker: ' + result);

		result = await this.checkGroupAsync('admin', 'admin');
		this.log.info('check group user admin group admin: ' + result);

		Map = new MapHelper(null, this);
		//MAP.Init(); // for Map

		this.main();
	}

	/**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
	onUnload(callback) {
		try {
			// Here you must clear all timeouts or intervals that may still be active
			// clearTimeout(timeout1);
			// clearTimeout(timeout2);
			// ...
			// clearInterval(interval1);

			callback();
		} catch (e) {
			callback();
		}
	}

	// If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
	// You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
	// /**
	//  * Is called if a subscribed object changes
	//  * @param {string} id
	//  * @param {ioBroker.Object | null | undefined} obj
	//  */
	// onObjectChange(id, obj) {
	//     if (obj) {
	//         // The object was changed
	//         this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
	//     } else {
	//         // The object was deleted
	//         this.log.info(`object ${id} deleted`);
	//     }
	// }

	/**
     * Is called if a subscribed state changes
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
	async onStateChange(id, state) {
		if (!state || state.ack) {
			return;
		}

		// Warning, state can be null if it was deleted
		//this.log.debug('stateChange ' + id + ' ' + JSON.stringify(state));

		// output to parser

		const terms = id.split('.');
		const command = terms.pop();

		// Send own commands
		if (command === 'X_send_command') {
			const values = (state.val || '').trim().split(';');
			let params = [''];
			if (values[1]) {
				try {
					params = JSON.parse(values[1]);
				} catch (e) {
					return this.setState('control.X_get_response', 'Could not send these params because its not in JSON format: ' + values[1] , true);
				}
				this.log.info('send message: Method: ' + values[0] + ' Params: ' + values[1]);
			} else {
				this.log.info('send message: Method: ' + values[0]);
			}
			this.setStateAsync(id, state.val, true);

			try {
				const DeviceData = await Miio.sendMessage(values[0], params);
				this.log.debug('Get self send data:' + JSON.stringify(DeviceData));
				this.setStateAsync('control.X_get_response', JSON.stringify(DeviceData.result), true);

			} catch (error) {
				this.setStateAsync('control.X_get_response', '['+error+']', true);
			}
		}
		vacuum.stateChange(id, state);
	}


	/**
     * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
     * Using this method requires "common.message" property to be set to true in io-package.json
     * @param {ioBroker.Message} obj
     */
	onMessage(obj) {
		if (typeof obj === 'object' && obj.message) {
			if (obj.command === 'send') {
				// e.g. send email or pushover or whatever
				this.log.info('send command');

				// Send response in callback if required
				if (obj.callback) this.sendTo(obj.from, obj.command, 'Message received', obj.callback);
			}
		}

		// responds to the adapter that sent the original message
		const respond = response =>{
			obj.callback && this.sendTo(obj.from, obj.command, response, obj.callback);
		};

		// handle the message
		if (obj) {
			let params;

			switch (obj.command) {
				case 'discovery':
					//adapter.log.info('discover' + JSON.stringify(obj))
					Map.getDeviceStatus(obj.message.username, obj.message.password, obj.message.server, '{"getVirtualModel":false,"getHuamiDevices":0}')
						.then(data => {
							this.log.debug('discover__' + JSON.stringify(data));
							respond(data);
						})
						.catch(err => {
							this.log.info('discover ' + err);
							respond({
								error: err
							});
						});
					return;

					// ======================================================================
				default:
					respond(predefinedResponses.ERROR_UNKNOWN_COMMAND);
					return;
			}
		}
	}

}

// @ts-ignore parent is a valid property on module
if (module.parent) {
	// Export the constructor in compact mode
	/**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
	module.exports = (options) => new MihomeVacuum(options);
} else {
	// otherwise start the instance directly
	new MihomeVacuum();
}
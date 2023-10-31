'use strict';

/*
 * Created with @iobroker/create-adapter v1.27.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');
const MapHelper = require('./lib/maphelper');
const miio = require('./lib/miio');
const objects = require('./lib/objects');

const ViomiManager = require('./lib/viomi');
const VacuumManager = require('./lib/vacuum');
const DreameManager = require('./lib/dreame');
//const VacuumManager2 = require('./lib/vacuumsaphire');

let DeviceModel;
// @ts-ignore
let Miio;
let vacuum = null;
let Map;
const deviceList = {
	//'mijia.vacuum.v2' : MiotVacuum, //  Modell: Xiaomi mijia g1
	//'dreame.vacuum.mc1808' : MiotVacuum, //  Modell: Xioami mijia 1c
	"viomi.vacuum.v7": ViomiManager,
	"viomi.vacuum.v8": ViomiManager,
	"viomi.vacuum.v19": ViomiManager, //test
	"viomi.vacuum.v13": ViomiManager, // added for test
	"roborock.vacuum.s4": VacuumManager, // Roborock S4
	"roborock.vacuum.s5": VacuumManager,
	"roborock.vacuum.s5e": VacuumManager, // Roborock S5 Max
	"roborock.vacuum.s6": VacuumManager,
	"roborock.vacuum.a08": VacuumManager, // Roborock S6 Pure
	"roborock.vacuum.m1s": VacuumManager,
	"rockrobo.vacuum.v1": VacuumManager,
	"roborock.vacuum.a10": VacuumManager, // Roborock S6 MaxV
	"roborock.vacuum.a15": VacuumManager, // Roborock S7
	"roborock.vacuum.a27": VacuumManager, // Roborock S7 MaxV
	"roborock.vacuum.a38": VacuumManager, // Roborock Q7 Max
	"roborock.vacuum.a51": VacuumManager, // Roborock S8
	"roborock.vacuum.a62": VacuumManager, // Roborock S7 Pro Ultra
	"roborock.vacuum.a70": VacuumManager, // Roborock S8 Ultra Pro
	"roborock.vacuum.a74": VacuumManager, // Roborock P10
	// 'roborock.sweeper.e2v3': VacuumManager2,
	// 'roborock.sweeper.e2v2': VacuumManager2,
	// 'roborock.vacuum.e2': VacuumManager2,
	// 'roborock.sweeper.c1v3': VacuumManager2,
	// 'roborock.sweeper.c1v2': VacuumManager2,
	// 'roborock.vacuum.c1': VacuumManager2,
	// 'roborock.vacuum.a01': VacuumManager2,
	// 'roborock.vacuum.a01v2': VacuumManager2,
	// 'roborock.vacuum.a01v3': VacuumManager2,
	// 'roborock.vacuum.a04': VacuumManager2,
	// 'roborock.vacuum.a04v2': VacuumManager2,
	// 'roborock.vacuum.a04v3': VacuumManager2
	"dreame.vacuum.r2205": DreameManager, // Dreame D10 Plus
	"dreame.vacuum.r2216o": DreameManager, // Dreame L10S Pro
	"dreame.vacuum.r2228o": DreameManager, // Dreame L10S Ultra
	"dreame.vacuum.p2008": DreameManager, // Dreame F9
	"dreame.vacuum.p2009": DreameManager, // Dreame D9
	"dreame.vacuum.p2027": DreameManager, // Dreame W10
	"dreame.vacuum.p2028": DreameManager, // Dreame Z10 Pro
	"dreame.vacuum.p2029": DreameManager, // Dreame L10 Pro
	"dreame.vacuum.p2036": DreameManager, // Trouver Finder LDS Cleaner
	"dreame.vacuum.p2041o": DreameManager, // Xiaomi Vacuum Mop 2 Pro+
	"dreame.vacuum.p2114a": DreameManager, // Xiaomi Robot Vacuum X10 Plus
	"dreame.vacuum.p2148o": DreameManager, // Xiaomi Mijia Ultra Slim
	"dreame.vacuum.p2156o": DreameManager, // MOVA Z500
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
		this.unsupportedFeatures = '|';
		this.on('ready', this.onReady.bind(this));
		this.on('stateChange', this.onStateChange.bind(this));
		this.on('message', this.onMessage.bind(this));
		this.on('unload', this.onUnload.bind(this));
	}

	async main() {

		// @ts-ignore
		this.config.port = parseInt(this.config.port, 10) || 54321;
		// @ts-ignore
		this.config.ownPort = parseInt(this.config.ownPort, 10) || 53421;
		// @ts-ignore
		this.config.pingInterval = parseInt(this.config.pingInterval, 10) || 20000;

		// Abfrageintervall mindestens 10 sec.
		// @ts-ignore
		if (this.config.pingInterval < 10000) {
			// @ts-ignore
			this.config.pingInterval = 10000;
		}

		// @ts-ignore
		if (!this.config.token) {
			this.log.warn('Token not specified!');
			return;
		}
		// create default States
		await Promise.all(objects.deviceInfo.map(async o => {
			// @ts-ignore
			await this.setObjectNotExistsAsync('deviceInfo' + (o._id ? '.' + o._id : ''), o);
			this.log.debug('Create State for deviceInfo' + o._id);
		}));

		//create new miio class
		Miio = new miio(this);

		Miio.on('connect', async () => {
			this.log.debug('MAIN: Connected to device, try to get model..');
			await this.getModel();
			this.subscribeStates('*');
		});

		//check if Self send Commands is enabled
		// @ts-ignore
		if (this.config.enableSelfCommands) {
			// @ts-ignore
			objects.customCommands.map(async o => await this.setObjectNotExistsAsync('control' + (o._id ? '.' + o._id : ''), o));
		} else {
			objects.customCommands.map(o => this.delObj('control' + (o._id ? '.' + o.id : '')));
		}

		//check if iotState is enabled
		// @ts-ignore
		// eslint-disable-next-line no-constant-condition
		if (true || this.config.enableAlexa) {
			this.log.info('IOT enabled, create state');
			// @ts-ignore
			objects.iotState.map(o => this.setObjectNotExistsAsync('control' + (o._id ? '.' + o._id : ''), o));
		} else {
			this.log.info('IOT disabled, delete state');
			objects.iotState.map(async o => await this.delObj('control' + (o._id ? '.' + o.id : '')));
		}

		this.getStateAsync('deviceInfo.unsupported').then((obj) => {
			if (obj && typeof obj.val == 'string') {
				this.unsupportedFeatures = obj.val;
				if (!this.unsupportedFeatures.endsWith('|'))
					this.unsupportedFeatures.concat('|');
				if (!this.unsupportedFeatures.startsWith('|'))
					this.unsupportedFeatures = '|' + this.unsupportedFeatures;
			}
		});
	}

	isUnsupportedFeature(key) {
		return this.unsupportedFeatures.indexOf('|' + key + '|') >= 0;
	}
	setUnsupportedFeature(key) {
		if (this.unsupportedFeatures.indexOf('|' + key + '|') == -1) {
			this.unsupportedFeatures += key + '|';
			this.setStateAsync('deviceInfo.unsupported', this.unsupportedFeatures, true);
		}
	}


	/**
	 * first communication to find out the model
	 */
	async getModel() {
		//try to get from Config
		let configModel;
		try {
			// @ts-ignore
			configModel = JSON.parse(this.config.devices).model;
		} catch (e) {
			configModel = null;
		}
		const objModel = await this.getStateAsync('deviceInfo.model');
		this.log.debug('GETMODELFROMAPI: objModel: ' + JSON.stringify(objModel).replace(/"token":"(.{10}).+"/g, '"token":"$1XXXXXX"'));

		let DeviceData;
		// try 5 times to get data
		for (let i = 0; i < 5; i++) {
			DeviceData = await this.getModelFromApi();
			this.log.debug('Get Device data..' + i);
			if (DeviceData) {
				this.log.debug(`Get Device data from robot.. ${JSON.stringify(DeviceData.result).replace(/"token":"(.{10}).+"/g, '"token":"$1XXXXXX"')}`);
				await this.setModelInfoObject(DeviceData.result);
				DeviceModel = DeviceData.result.model;

				await this.setConnection(true);
				break;
			}
		}
		if (!DeviceData && objModel && objModel.val) {
			this.log.error('YOUR DEVICE IS CONNECTED BUT DID NOT ANSWER YET - CONNECTION CAN TAKE UP TO 10 MINUTES - PLEASE BE PATIENT AND DO NOT TURN THE ADAPTER OFF');
			this.log.warn('No Answer for DeviceModel use old one');
			DeviceModel = objModel.val;
		}

		if (!DeviceData && configModel) {
			this.log.warn('No Answer for DeviceModel use model from Config');
			DeviceModel = configModel;
			// @ts-ignore
			await this.setModelInfoObject(JSON.parse(this.config.devices));
		}
		this.log.debug('DeviceModel selected to: ' + DeviceModel);

		//we get a model so we can select a protocol
		if (deviceList[DeviceModel]) {
			this.device = DeviceModel;
			vacuum = new deviceList[DeviceModel](this, Miio, Map);
		} else {
			if (typeof DeviceModel !== 'undefined') {
				this.log.warn(`Model ${DeviceModel} not supported! Please open issue on git:  https://github.com/iobroker-community-adapters/ioBroker.mihome-vacuum/issues`);

				//try to get stock Model maybe it is working
				const FirstDevMod = DeviceModel.split('.')[0];
				this.device = DeviceModel;

				if (FirstDevMod === 'viomi') {
					vacuum = new ViomiManager(this, Miio);
				} else if (FirstDevMod === 'roborock') {
					vacuum = new VacuumManager(this, Miio, Map);
				} else if (FirstDevMod === 'dreame') {
					vacuum = new DreameManager(this, Miio, Map);
				}
			} else {
				this.log.warn('Cant detect Device please select Device form Devicelist or enable the cloud of thr robot to get device infos');
				this.log.warn('Fallback to Stock miio Protocol');
				vacuum = new VacuumManager(this, Miio, Map);
			}
		}
	}

	/**
	 * function to set DeviceInfo
	 * @param {any} deviceInfo Model name from Xiaomi eg: viomi.vacuum.v8
	 */
	async setModelInfoObject(deviceInfo) {
		await this.setStateAsync('deviceInfo.model', {
			val: deviceInfo.model,
			ack: true
		});
		await this.setStateAsync('deviceInfo.fw_ver', {
			val: deviceInfo.fw_ver,
			ack: true
		});
		await this.setStateAsync('deviceInfo.mac', {
			val: deviceInfo.mac,
			ack: true
		});
		return true;
	}

	/**
	 * Function to set the connection indicator
	 * @param {boolean} indicator could be true or false
	 */
	async setConnection(indicator) {
		await this.setStateAsync('info.connection', {
			val: indicator,
			ack: true
		});
	}

	async getModelFromApi() {
		try {
			const DeviceData = await Miio.sendMessage('miIO.info');

			this.log.debug('GETMODELFROMAPI:Data: ' + JSON.stringify(DeviceData).replace(/"token":"(.{10}).+"/g, '"token":"$1XXXXXX"'));
			return DeviceData.result ? DeviceData : null;
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
		// Reset the connection indicator during startup
		this.setConnection(false);

		Map = new MapHelper(null, this);
		//MAP.Init(); // for Map

		this.main();
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	async onUnload(callback) {
		try {
			if (vacuum) {
				await vacuum.close();
			}
			if (Miio) {
				Miio.close(callback);
			} else {
				callback();
			}
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

		// output to parser
		const terms = id.split('.');
		const command = terms.pop();

		// Send own commands
		if (command === 'X_send_command') {
			const values = (state.val || '').toString().trim().split(';');
			let params = [''];
			if (values[1]) {
				try {
					params = JSON.parse(values[1]);
				} catch (e) {
					return this.setState('control.X_get_response', 'Could not send these params because its not in JSON format: ' + values[1], true);
				}
				this.log.info(`send message: Method: ${values[0]} Params: ${values[1]}`);
			} else {
				this.log.info(`send message: Method: ${values[0]}`);
			}
			this.setStateAsync(id, state.val, true);

			try {
				const DeviceData = await Miio.sendMessage(values[0], params);
				this.log.debug('Get self send data: ' + JSON.stringify(DeviceData));
				this.setStateAsync('control.X_get_response', JSON.stringify(DeviceData.result), true);

			} catch (error) {
				this.setStateAsync('control.X_get_response', `[${error}]`, true);
			}
		}
		vacuum && vacuum.stateChange(id, state);
	}


	/**
	 * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
	 * Using this method requires "common.message" property to be set to true in io-package.json
	 * @param {ioBroker.Message} obj
	 */
	async onMessage(obj) {
		if (typeof obj === 'object' && obj.message) {
			if (obj.command === 'send') {
				// e.g. send email or pushover or whatever
				this.log.info('send command');

				// Send response in callback if required
				obj.callback && this.sendTo(obj.from, obj.command, 'Message received', obj.callback);
			}
		}
		// responds to the adapter that sent the original message
		const respond = response =>
			obj.callback && this.sendTo(obj.from, obj.command, response, obj.callback);

		// handle the message
		if (obj) {

			switch (obj.command) {
				case 'discovery':
					//adapter.log.info('discover' + JSON.stringify(obj))
					// @ts-ignore
					Map && Map.getDeviceStatus(obj.message.username, obj.message.password, obj.message.server)
						.then(data => {
							this.log.debug('discover__' + JSON.stringify(data));
							respond(data);
						})
						.catch(err => {
							this.log.info('discover ' + err);
							respond({ error: err });
						});
					return;

				// ======================================================================
				default:
					//respond(predefinedResponses.ERROR_UNKNOWN_COMMAND);
					//await vacuum.onMessage(obj)
					//this.log.warn('gottosent vacuu '+ JSON.stringify(obj))
					if (!vacuum) {
						return respond({
							error: new Error('Not initialized')
						});
					}
					respond(await vacuum.onMessage(obj));
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

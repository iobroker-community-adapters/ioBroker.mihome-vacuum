module.exports = {
	'deviceInfo': [{
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
	'iotState': [{
		_id: 'clean_home',
		type: 'state',
		common: {
			name: 'Start/Home',
			type: 'boolean',
			role: 'state',
			read: true,
			write: true,
			desc: 'Start and go home',
			smartName: 'Staubsauger'
		},
		native: {}
	}],
	'customComands': [{
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
	],
	'viomiObjects': [{
		_id: 'suction_grade',
		type: 'state',
		common: {
			name: 'Suction power',
			type: 'number',
			role: 'level',
			read: true,
			write: true,
			max: 3,
			states: {
				0: 'Silent',
				1: 'Standard',
				2: 'Medium',
				3: 'Turbo'
			}
		},
		native: {}
	},
	{
		_id: 'water_grade',
		type: 'state',
		common: {
			name: 'Suction power',
			type: 'number',
			role: 'level',
			read: true,
			write: true,
			states: {
				11: 'low',
				12: 'normal',
				13: 'high'
			}
		},
		native: {}
	},
	{
		_id: 'run_state',
		type: 'state',
		common: {
			name: 'run state',
			type: 'number',
			role: 'level',
			read: true,
			write: false,
			max: 6,
			states: {
				0: 'IdleNotDocked ',
				1: 'Idle',
				2: 'Idle 2',
				3: 'Cleaning',
				4: 'Returning ',
				5: 'Docked',
				6: 'VacuumingAndMopping'
			}
		},
		native: {}
	},
	{
		_id: 'is_mop',
		type: 'state',
		common: {
			name: 'is mop',
			type: 'number',
			role: 'level',
			read: true,
			write: true,
			max: 2,
			states: {
				0: 'Vacuum',
				1: 'VacuumAndMop',
				2: 'Mop'
			}
		},
		native: {}
	},
	{
		_id: 'err_state',
		type: 'state',
		common: {
			name: 'error state',
			type: 'number',
			role: 'level',
			read: true,
			write: false,
			states: {
				500: 'Radar timed out',
				501: 'Wheels stuck',
				502: 'Low battery',
				503: 'Dust bin missing',
				508: 'Uneven ground',
				509: 'Cliff sensor error',
				510: 'Collision sensor error',
				511: 'Could not return to dock',
				512: 'Could not return to dock',
				513: 'Could not navigate',
				514: 'Vacuum stuck',
				515: 'Charging error',
				516: 'Mop temperature error',
				521: 'Water tank is not installed',
				522: 'Mop is not installed',
				525: 'Insufficient water in water tank',
				527: 'Remove mop',
				528: 'Dust bin missing',
				529: 'Mop and water tank missing',
				530: 'Mop and water tank missing',
				531: 'Water tank is not installed',
				2101: 'Unsufficient battery, continuing cleaning after recharge',
				2105: 'No Error'
			}
		},
		native: {}
	},
	{
		_id: 'battary_life',
		type: 'state',
		common: {
			name: 'battary life',
			type: 'number',
			read: true,
			write: false,
			unit: '%',
			max: 100
		},
		'native': {}
	},
	{
		_id: 's_area',
		type: 'state',
		common: {
			name: 'Cleaned area',
			type: 'number',
			read: true,
			write: false,
			unit: 'm²'
		},
		native: {}
	},
	{
		_id: 's_time',
		type: 'state',
		common: {
			name: 'Cleaning time',
			type: 'number',
			read: true,
			write: false,
			unit: 'min'
		},
		native: {}
	},
	{
		_id: 'find',
		type: 'state',
		common: {
			role: 'button',
			name: 'Find',
			type: 'boolean',
			read: false,
			write: true
		},
		native: {}
	},
	{
		_id: 'start',
		type: 'state',
		common: {
			role: 'button',
			name: 'start',
			type: 'boolean',
			read: false,
			write: true
		},
		native: {}
	},
	{
		_id: 'pause',
		type: 'state',
		common: {
			role: 'button',
			name: 'pause',
			type: 'boolean',
			read: false,
			write: true
		},
		native: {}
	},
	{
		_id: 'return_dock',
		type: 'state',
		common: {
			role: 'button',
			name: 'return to dock',
			type: 'boolean',
			read: false,
			write: true
		},
		native: {}
	},
	{
		_id: 'dock',
		type: 'state',
		common: {
			role: 'button',
			name: 'return to dock',
			type: 'boolean',
			read: false,
			write: true
		},
		native: {}
	},
	{
		_id: 'light_state',
		type: 'state',
		common: {
			role: 'switch',
			name: 'light state',
			type: 'boolean',
			read: true,
			write: true
		},
		native: {}
	},
	{
		_id: 'is_charge',
		type: 'state',
		common: {
			role: 'switch',
			name: 'is charge',
			type: 'boolean',
			read: true,
			write: false
		},
		native: {}
	},
	{
		_id: 'is_work',
		type: 'state',
		common: {
			role: 'switch',
			name: 'is work',
			type: 'boolean',
			read: true,
			write: false
		},
		native: {}
	},
	{
		_id: 'mode',
		type: 'state',
		common: {
			name: 'mode',
			type: 'number',
			role: 'level',
			read: true,
			write: false
		},
		native: {}
	},
	{
		_id: 'box_type',
		type: 'state',
		common: {
			name: 'box type',
			type: 'number',
			read: true,
			write: false
		},
		'native': {}
	},
	// TODO don't know what v_state is
	{
		_id: 'v_state',
		type: 'state',
		common: {
			name: 'v state???',
			type: 'number',
			read: true,
			write: false
		},
		'native': {}
	},
	// TODO don't know what zone_data is
	{
		_id: 'zone_data',
		type: 'state',
		common: {
			name: 'zone_data???',
			type: 'string',
			role: 'text',
			read: true,
			write: false
		},
		'native': {}
	},
	],
	'stockConsumable': [{
		_id: 'filter',
		type: 'state',
		common: {
			name: 'Filter lifetime',
			type: 'number',
			role: 'level',
			read: true,
			write: false,
			unit: '%'
		},
		native: {}
	},
	{
		_id: 'filter_reset',
		type: 'state',
		common: {
			role: 'button',
			name: 'Filter lifetime reset',
			type: 'boolean',
			read: false,
			write: true
		},
		native: {}
	},
	{
		_id: 'main_brush',
		type: 'state',
		common: {
			name: 'main brush lifetime',
			type: 'number',
			role: 'level',
			read: true,
			write: false,
			unit: '%'
		},
		native: {}
	},
	{
		_id: 'main_brush_reset',
		type: 'state',
		common: {
			role: 'button',
			name: 'main brush lifetime reset',
			type: 'boolean',
			read: false,
			write: true
		},
		native: {}
	},
	{
		_id: 'sensors',
		type: 'state',
		common: {
			name: 'sensors lifetime',
			type: 'number',
			role: 'level',
			read: true,
			write: false,
			unit: '%'
		},
		native: {}
	},
	{
		_id: 'sensors_reset',
		type: 'state',
		common: {
			role: 'button',
			name: 'sensors lifetime reset',
			type: 'boolean',
			read: false,
			write: true
		},
		native: {}
	},
	{
		_id: 'side_brush',
		type: 'state',
		common: {
			name: 'side brush lifetime',
			type: 'number',
			role: 'level',
			read: true,
			write: false,
			unit: '%'
		},
		native: {}
	},
	{
		_id: 'side_brush_reset',
		type: 'state',
		common: {
			role: 'button',
			name: 'side brush lifetime reset',
			type: 'boolean',
			read: false,
			write: true
		},
		native: {}
	}
	],
	'extendConsumable': [{
		_id: 'water_filter',
		type: 'state',
		common: {
			name: 'water filter lifetime',
			type: 'number',
			role: 'level',
			read: true,
			write: false,
			unit: '%'
		},
		native: {}
	},
	{
		_id: 'water_filter_reset',
		type: 'state',
		common: {
			role: 'button',
			name: 'water filter lifetime reset',
			type: 'boolean',
			read: false,
			write: true
		},
		native: {}
	}
	],
	'stockControl': [{
		_id: 'carpet_mode',
		type: 'state',
		common: {
			name: 'Carpet mode',
			type: 'boolean',
			role: 'switch',
			read: true,
			write: true,
			desc: 'Fanspeed is Max on carpets',
		},
		native: {}
	},
	{
		_id: 'clean_home',
		type: 'state',
		common: {
			name: 'Start/Home',
			type: 'boolean',
			role: 'state',
			read: true,
			write: true,
			desc: 'Start and go home',
			smartName: 'Staubsauger'
		},
		native: {}
	},
	{
		_id: 'clearQueue',
		type: 'state',
		common: {
			name: 'clear cleaning queue',
			type: 'boolean',
			role: 'button',
			read: false,
			write: true,
			desc: 'Clear cleaning queue, but not current job',
		},
		native: {}
	},
	{
		_id: 'fan_power',
		type: 'state',
		common: {
			name: 'Suction power',
			type: 'number',
			role: 'level',
			read: true,
			write: true,
			max: 100,
			states: {
				'5': '5%',
				'10': '10%',
				'15': '15%',
				'20': '20%',
				'25': '25%',
				'30': '30%',
				'35': '35%',
				'38': 'QUIET',
				'40': '40%',
				'45': '45%',
				'50': '50%',
				'55': '55%',
				'60': 'BALANCED',
				'65': '65%',
				'70': '70%',
				'75': '75%',
				'77': 'TURBO',
				'80': '80%',
				'85': '85%',
				'90': 'MAXIMUM',
				'95': '95%',
				'100': '100%'
			}
		},
		'native': {}
	},
	{
		_id: 'find',
		type: 'state',
		common: {
			name: 'Find Robot',
			type: 'boolean',
			role: 'button',
			read: false,
			write: true,
			desc: 'let the robot say something',
		},
		native: {}
	},
	{
		_id: 'home',
		type: 'state',
		common: {
			name: 'Go home',
			type: 'boolean',
			role: 'button',
			read: false,
			write: true,
			desc: 'let the robot return to dock',
		},
		native: {}
	},
	{
		_id: 'pause',
		type: 'state',
		common: {
			name: 'Puse vacuum',
			type: 'boolean',
			role: 'button',
			read: false,
			write: true,
			desc: 'Pause the actual cleaning',
		},
		native: {}
	},
	{
		_id: 'resumeRoomClean',
		type: 'state',
		common: {
			name: 'Resume paused roomClean',
			type: 'boolean',
			role: 'button',
			read: false,
			write: true,
			desc: 'Resume paused roomClean',
		},
		native: {}
	},
	{
		_id: 'goTo',
		type: 'state',
		common: {
			name: 'Go to point',
			type: 'string',
			read: true,
			write: true,
			desc: 'let the vacuum go to a point on the map',
		},
		native: {}
	},
	{
		_id: 'spotclean',
		type: 'state',
		common: {
			name: 'Spot Cleaning',
			type: 'boolean',
			role: 'button',
			read: false,
			write: true,
			desc: 'Start Spot Cleaning',
			smartName: 'Spot clean'
		},
		native: {}
	},
	{
		_id: 'sound_volume_test',
		type: 'state',
		common: {
			name: 'sound volume test',
			type: 'boolean',
			role: 'button',
			read: false,
			write: true,
			desc: 'let the speaker play sound'
		},
		native: {}
	},
	{
		_id: 'start',
		type: 'state',
		common: {
			name: 'start robot',
			type: 'boolean',
			role: 'button',
			read: false,
			write: true,
			desc: 'Button to start'
		},
		native: {}
	},
	{
		_id: 'sound_volume',
		type: 'state',
		common: {
			name: 'sound volume',
			type: 'number',
			role: 'level',
			read: true,
			write: true,
			unit: '%',
			min: 30,
			max: 100,
			desc: 'Sound volume of the Robot'
		},
		native: {}
	},
	{
		_id : 'goTo',
		type: 'state',
		common: {
			name: 'Go to point',
			type: 'string',
			read: true,
			write: true,
			desc: 'let the vacuum go to a point on the map',
		},
		native: {}
	},
	{
		_id: 'zoneClean',
		type: 'state',
		common: {
			name: 'Clean a zone',
			type: 'string',
			read: true,
			write: true,
			desc: 'let the vacuum go to a point and clean a zone',
		},
		native: {}
	}
	],
	'enableResumeZone':[
		{
			_id:'resumeZoneClean',
			type: 'state',
			common: {
				name: 'Resume paused zoneClean',
				type: 'boolean',
				role: 'button',
				read: false,
				write: true,
				desc: 'resume zoneClean that has been paused before',
			},
			native: {}
		},
		{
			_id:'resumeRoomClean',
			type: 'state',
			common: {
				name: 'Resume paused roomClean',
				type: 'boolean',
				role: 'button',
				read: false,
				write: true,
				desc: 'resume roomClean that has been paused before',
			},
			native: {}
		}

	],
	'roomStates': [{
		_id: 'queue',
		type: 'state',
		common: {
			name: 'Cleaning Queue',
			type: 'object',
			role: 'info',
			read: true,
			write: false
		},
		native: {}
	},
	{
		_id: 'clearQueue',
		type: 'state',
		common: {
			name: 'clear cleaning queue',
			type: 'boolean',
			role: 'button',
			read: false,
			write: true,
			desc: 'Clear cleaning queue, but not current job',
		},
		native: {}
	}
	],
	'stockInfo': [{
		_id: 'battery',
		type: 'state',
		common: {
			name: 'Battery status',
			type: 'number',
			read: true,
			write: false,
			unit: '%',
			max: 100
		},
		native: {}
	}, {
		_id: 'cleanedarea',
		type: 'state',
		common: {
			name: 'Cleaned area',
			type: 'number',
			read: true,
			write: false,
			unit: 'm²'
		},
		native: {}
	}, {
		_id: 'cleanedtime',
		type: 'state',
		common: {
			name: 'Cleaning time',
			type: 'number',
			read: true,
			write: false,
			unit: 'min'
		},
		native: {}
	},
	{
		_id: 'dnd',
		type: 'state',
		common: {
			name: 'DnD aktiv',
			type: 'boolean',
			role: 'indicator',
			read: true,
			write: false
		},
		native: {}
	},
	{
		_id: 'error',
		type: 'state',
		common: {
			name: 'Error',
			type: 'number',
			read: true,
			write: false,
			max: 30,
			states: {
				0: 'No error',
				1: 'Laser distance sensor error',
				2: 'Collision sensor error',
				3: 'Wheels on top of void, move robot',
				4: 'Clean hovering sensors, move robot',
				5: 'Clean main brush',
				6: 'Clean side brush',
				7: 'Main wheel stuck?',
				8: 'Device stuck, clean area',
				9: 'Dust collector missing',
				10: 'Clean filter',
				11: 'Stuck in magnetic barrier',
				12: 'Low battery',
				13: 'Charging fault',
				14: 'Battery fault',
				15: 'Wall sensors dirty, wipe them',
				16: 'Place me on flat surface',
				17: 'Side brushes problem, reboot me',
				18: 'Suction fan problem',
				19: 'Unpowered charging station'
			}
		},
		native: {}
	},
	{
		_id: 'state',
		type: 'state',
		common: {
			name: 'Vacuum state',
			type: 'number',
			read: true,
			write: false,
			max: 30,
			states: {
				0: 'Unknown',
				1: 'Initiating',
				2: 'Sleeping',
				3: 'Waiting',
				4: '?',
				5: 'Cleaning',
				6: 'Back to home',
				7: 'Manuell mode',
				8: 'Charging',
				9: 'Charging Erro',
				10: 'Pause',
				11: 'Spot Cleaning',
				12: 'In Error',
				13: 'Shutting down',
				14: 'Updating',
				15: 'Docking',
				16: 'Going to Spot',
				17: 'Zone cleaning',
				18: 'Room cleaning'
			}
		},
		native: {}
	}
	],
	'stockHistory': [{
		_id: 'total_time',
		type: 'state',
		common: {
			name: 'Total time ',
			type: 'number',
			role: 'history',
			unit: 'min.',
			read: true
		},
		native: {}
	}, {
		_id: 'total_cleanups',
		type: 'state',
		common: {
			name: 'Total cleanups ',
			type: 'number',
			role: 'history',
			read: true
		},
		native: {}
	}, {
		_id: 'total_area',
		type: 'state',
		common: {
			name: 'Total area ',
			type: 'number',
			role: 'history',
			unit: 'm²',
			read: true
		},
		native: {}
	},
	{
		_id: 'allTableJSON',
		type: 'state',
		common: {
			name: 'History of clean as JSON',
			type: 'object',
			role: 'history',
			read: true
		},
		native: {}
	}, {
		_id: 'allTableHTML',
		type: 'state',
		common: {
			name: 'History of clean as HTML',
			type: 'string',
			role: 'history',
			read: true
		},
		native: {}
	}
	],
	'newfan_power': { //only for modifying obj..
		type: 'state',
		common: {
			name: 'Suction power',
			type: 'number',
			role: 'level',
			read: true,
			write: true,
			min: 101,
			max: 106,
			states: {
				101: 'QUIET',
				102: 'BALANCED',
				103: 'TURBO',
				104: 'MAXIMUM',
				106: 'CUSTOM' // setting for rooms will be used
			}
		},
		native: {}
	},
	'water_box': {
		type: 'state',
		common: {
			name: 'waterBox_installed',
			type: 'string',
			role: 'info',
			read: true,
			write: false
		},
		native: {}
	},
	'water_filter':[
		{
			_id :'water_filter',
			type: 'state',
			common: {
				name: 'waterBox_filter',
				type: 'number',
				role: 'level',
				read: true,
				write: false,
				unit: '%'
			},
			native: {}
		},
		{
			_id: 'water_filter_reset',
			type: 'state',
			common: {
				name: 'waterBox_filter_reset',
				type: 'boolean',
				role: 'button',
				read: false,
				write: true,
				unit: '%'
			},
			native: {}
		}
	],
	'water_box_mode': {
		type: 'state',
		common: {
			name: 'Water Box mode',
			type: 'number',
			role: 'level',
			read: true,
			write: true,
			min: 200,
			max: 204,
			states: {
				200: 'OFF',
				201: 'LOW',
				202: 'MEDIUM',
				203: 'HIGH',
				204: 'CUSTOM' // setting for rooms will be used
			}
		},
		native: {}
	},
	'carpet_mode':{
		type: 'state',
		common: {
			name: 'Carpet mode',
			type: 'boolean',
			role: 'switch',
			read: true,
			write: true,
			desc: 'Fanspeed is Max on carpets',
		},
		native: {}
	},
	'mapObjects':[
		{
			_id: 'map64',
			type: 'state',
			common: {
				name: 'Map64',
				type: 'string',
				read: true,
				write: false,
				desc: 'Map in a decoded Base64 PNG',
			},
			native: {}
		},
		{
			_id: 'mapURL',
			type: 'state',
			common: {
				name: 'MapURL',
				type: 'string',
				read: true,
				write: false,
				desc: 'Path to actual PNG File',
			},
			native: {}
		},
		{
			_id : 'loadMap',
			type: 'state',
			common: {
				name: 'load Map',
				type: 'boolean',
				role: 'button',
				read: false,
				write: true,
				desc: 'load the current Map',
			},
			native: {}
		}
	]

};
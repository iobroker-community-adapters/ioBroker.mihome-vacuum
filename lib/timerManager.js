'use strict';
let adapter = null;
let timerManager = null;
let i18n = null;

class TimerManager {
	constructor(adapterInstance, i18nInstance) {
		adapter= adapterInstance;
		i18n= i18nInstance;
		timerManager= this;
		this.nextTimerId = null;
		this.nextProcessTime = null;

		setTimeout(() => {
			adapter.setObjectNotExists('info.nextTimer', {
				type: 'state',
				common: {
					name: i18n.nextTimer,
					type: 'string',
					role: 'info',
					read: true,
					write: false
				},
				native: {}
			});
			this.calcNextProcess();
		},500);
	}

	check() {
		//adapter.log.warn('Timer Check... this.nextProcessTime: '+ this.nextProcessTime + ' this.nextProcessTime: '+  this.nextProcessTime);
		if (this.nextProcessTime > 0 && this.nextProcessTime < new Date()) {
			const diff = new Date() - this.nextProcessTime;
			if (diff > 3600000) {
				adapter.log.info('timer was to old, skipped');
				timerManager.calcNextProcess();
			} else {
				adapter.log.debug('timer will trigger soon...');
				this.nextProcessTime = new Date(this.nextProcessTime.getTime() + 3600000);

				setTimeout(() => {
					adapter.log.info('start cleaning by timer ' + timerManager.nextTimerId);
					adapter.setForeignState(timerManager.nextTimerId, TimerManager.START, false,  (err, obj) =>
					// obj not exist anymore, so we need recalc, otherwise it would be triggered by stateChange
						!obj && timerManager.calcNextProcess());
				}, adapter.config.pingInterval - diff);
			}
		}
	}

	// calculate the nexttime, when the timer (state) should running
	_calcNextProcessTime(timerObj, now, onlyCalc) {
		let nextProcessTime = timerObj.native.nextProcessTime ? new Date(timerObj.native.nextProcessTime) : 0;
		if (!nextProcessTime || nextProcessTime < now) {
			const terms = timerObj._id.split('.').pop().split('_');
			const minute = parseInt(terms[2], 10);
			const hour = parseInt(terms[1], 10);
			const day = terms[0].split('');
			if (!day.length) {
				nextProcessTime = 0;
			} else {
				nextProcessTime = new Date(now);
				nextProcessTime.setHours(hour, minute, 0, 0);
				if (hour < now.getHours() || (hour === now.getHours() && minute < now.getMinutes()))
					nextProcessTime.setDate(nextProcessTime.getDate() + 1);
				const nowDay = nextProcessTime.getDay();
				let dayDiff = -99;
				for (let i = day.length - 1; i >= 0 && day[i] >= nowDay; i--)
					dayDiff = day[i] - nowDay;
				if (dayDiff < 0)
					dayDiff = (day[0] - nowDay) + 7;
				dayDiff && nextProcessTime.setDate(nextProcessTime.getDate() + dayDiff);
			}

			if (nextProcessTime != timerObj.native.nextProcessTime && !onlyCalc) {
				timerObj.native.nextProcessTime = nextProcessTime;
				timerObj.common.states['1'] = i18n.weekDaysFull[nextProcessTime.getDay()] + ' ' + adapter.formatDate(nextProcessTime, 'hh:mm');
				let name = '';
				if (day.length > 0 || timerObj.native.channels) {
					for (const d in day) {
						name += i18n.weekDaysFull[day[d]].substr(0, 2) + ' ';
					}
				} else {
					name += i18n.weekDaysFull[day[0]] + ' ';
				}
				name += '0'.concat(hour).slice(-2) + ':' + '0'.concat(minute).slice(-2);
				timerObj.common.name = name;

				if (timerObj.native.channels) {
					name += ' >';
					adapter.getChannelsOf('rooms', function (err, roomObjs) {
						let channels= '';
						for (const r in roomObjs) {
							if (timerObj.native.channels.indexOf(roomObjs[r]._id.split('.').pop()) >= 0)
								channels += ',' + roomObjs[r].common.name;
						}
						timerObj.common.name += ' >' + channels.slice(1);
						adapter.setObject(timerObj._id, timerObj);
					});
				} else {
					adapter.setObject(timerObj._id, timerObj);
				}
				adapter.log.info('calculate new processtime (' + timerObj.common.states['1'] + ') for timer ' + timerObj._id);
			}
		}
		return nextProcessTime;
	}

	calcNextProcess() {
		const now = new Date(new Date().getTime() + 60000); //some time to calculate ...
		timerManager.nextProcessTime = new Date(now.getTime() + 604800000); // we start latest 1 week later...
		timerManager.nextTimerId = null;
		adapter.getStatesOf('timer', (err, timerObjects) => {
			try {
				const timers = {};
				for (const t in timerObjects) {
					timers[timerObjects[t]._id] = {
						obj: timerObjects[t],
						time: timerManager._calcNextProcessTime(timerObjects[t], now)
					};
				}

				adapter.getStates('timer.*', function (err, timerStates) {
					let timerState;
					for (const t in timerStates) {
						if (timerStates[t] !== null &&(timerStates[t].val != TimerManager.DISABLED)) {
							if (timerStates[t].val == TimerManager.SKIP)
								timers[t].time = timerManager._calcNextProcessTime(timers[t].obj, new Date(timers[t].time.setMinutes(1)),true);
							if (timers[t].time < timerManager.nextProcessTime) {
								timerManager.nextProcessTime = timers[t].time;
								timerManager.nextTimerId = t;
							}
						}
					}
					const nextTimerName = timerManager.nextTimerId ? i18n.weekDaysFull[timerManager.nextProcessTime.getDay()] + ' ' + adapter.formatDate(timerManager.nextProcessTime, 'hh:mm') : i18n.notAvailable;
					const timerFolder = {
						id: adapter.namespace + '.timer', type: 'channel', native: {},
						common: { name: i18n.nextTimer + ': ' + nextTimerName}
					};
					timerManager.nextProcessTime = new Date(timerManager.nextProcessTime.getTime() - adapter.config.pingInterval);
					adapter.setObject('timer', timerFolder);
					adapter.setState('info.nextTimer', nextTimerName, true);
					adapter.log.info('settest ' + timerFolder.common.name);
				});
			} catch (error) {
				adapter.log.warn('Could not calculate next timer ' + error);
				if (adapter.supportsFeature && adapter.supportsFeature('PLUGINS')) {
					const sentryInstance = adapter.getPluginInstance('sentry');
					if (sentryInstance) {
						sentryInstance.getSentryObject().captureException(error);
					}
				}
			}
		});
	}
}

TimerManager.DISABLED = -1;
TimerManager.SKIP = 0;
TimerManager.ENABLED = 1;
TimerManager.START = 2;

module.exports= TimerManager;
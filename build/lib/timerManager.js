"use strict";
class TimerManager {
    adapter;
    i18n;
    static DISABLED = -1;
    static SKIP = 0;
    static ENABLED = 1;
    static START = 2;
    timeouts = new Set();
    nextTimerId = null;
    nextProcessTime = null;
    closed = false;
    constructor(adapter, i18n) {
        this.adapter = adapter;
        this.i18n = i18n;
        this._setTimeout(() => {
            this.adapter.setObjectNotExists('info.nextTimer', {
                type: 'state',
                common: {
                    name: this.i18n.nextTimer,
                    type: 'string',
                    role: 'info',
                    read: true,
                    write: false,
                },
                native: {},
            });
            this.calcNextProcess();
        }, 500);
    }
    _setTimeout(callback, delay) {
        const timeout = this.adapter.setTimeout(() => {
            if (timeout !== undefined) {
                this.timeouts.delete(timeout);
            }
            if (!this.closed) {
                callback();
            }
        }, delay);
        if (timeout !== undefined) {
            this.timeouts.add(timeout);
        }
        return timeout;
    }
    close() {
        if (this.closed) {
            return;
        }
        this.closed = true;
        this.timeouts.forEach(timeout => this.adapter.clearTimeout(timeout));
        this.timeouts.clear();
    }
    check() {
        if (this.closed ||
            !this.nextProcessTime ||
            !(this.nextProcessTime.getTime() > 0 && this.nextProcessTime < new Date())) {
            return;
        }
        const diff = Date.now() - this.nextProcessTime.getTime();
        if (diff > 3_600_000) {
            this.adapter.log.warn('Timer is more than one hour overdue and was skipped');
            this.calcNextProcess();
            return;
        }
        this.adapter.log.debug('timer will trigger soon...');
        this.nextProcessTime = new Date(this.nextProcessTime.getTime() + 3_600_000);
        this._setTimeout(() => {
            const timerId = this.nextTimerId;
            this.adapter.log.info(`start cleaning by timer ${timerId}`);
            this.adapter.setForeignState(timerId, TimerManager.START, false, (_error, object) => {
                if (!object) {
                    this.calcNextProcess();
                }
            });
        }, this.adapter.config.pingInterval - diff);
    }
    _calcNextProcessTime(timerObject, now, onlyCalculate = false) {
        let nextProcessTime = timerObject.native.nextProcessTime
            ? new Date(timerObject.native.nextProcessTime)
            : 0;
        if (nextProcessTime && !(nextProcessTime < now)) {
            return nextProcessTime;
        }
        const terms = timerObject._id.split('.').pop()?.split('_') ?? [];
        const minute = Number.parseInt(terms[2], 10);
        const hour = Number.parseInt(terms[1], 10);
        const days = (terms[0] ?? '').split('').map(Number);
        if (!days.length) {
            nextProcessTime = 0;
        }
        else {
            nextProcessTime = new Date(now);
            nextProcessTime.setHours(hour, minute, 0, 0);
            if (hour < now.getHours() || (hour === now.getHours() && minute < now.getMinutes())) {
                nextProcessTime.setDate(nextProcessTime.getDate() + 1);
            }
            const currentDay = nextProcessTime.getDay();
            let dayDifference = -99;
            for (let index = days.length - 1; index >= 0 && days[index] >= currentDay; index--) {
                dayDifference = days[index] - currentDay;
            }
            if (dayDifference < 0) {
                dayDifference = days[0] - currentDay + 7;
            }
            if (dayDifference) {
                nextProcessTime.setDate(nextProcessTime.getDate() + dayDifference);
            }
        }
        if (nextProcessTime && nextProcessTime != timerObject.native.nextProcessTime && !onlyCalculate) {
            timerObject.native.nextProcessTime = nextProcessTime;
            timerObject.common.states['1'] =
                `${this.i18n.weekDaysFull[nextProcessTime.getDay()]} ${this.adapter.formatDate(nextProcessTime, 'hh:mm')}`;
            let name = '';
            if (days.length > 0 || timerObject.native.channels) {
                for (const day of days) {
                    name += `${this.i18n.weekDaysFull[day].substring(0, 2)} `;
                }
            }
            else {
                name += `${this.i18n.weekDaysFull[days[0]]} `;
            }
            name += `${'0'.concat(hour.toString()).slice(-2)}:${'0'.concat(minute.toString()).slice(-2)}`;
            timerObject.common.name = name;
            if (timerObject.native.channels) {
                name += ' >';
                this.adapter.getChannelsOf('rooms', (_error, roomObjects) => {
                    let channels = '';
                    for (const roomObject of roomObjects) {
                        if (timerObject.native.channels?.includes(roomObject._id.split('.').pop() ?? '')) {
                            channels += `,${roomObject.common.name}`;
                        }
                    }
                    timerObject.common.name += ` >${channels.slice(1)}`;
                    this.adapter.extendObject(timerObject._id, timerObject);
                });
            }
            else {
                this.adapter.extendObject(timerObject._id, timerObject);
            }
            this.adapter.log.debug(`calculate new process time (${timerObject.common.states['1']}) for timer ${timerObject._id}`);
        }
        return nextProcessTime;
    }
    calcNextProcess() {
        if (this.closed) {
            return;
        }
        const now = new Date(Date.now() + 60_000);
        this.nextProcessTime = new Date(now.getTime() + 604_800_000);
        this.nextTimerId = null;
        this.adapter.getStatesOf('timer', (_error, timerObjects) => {
            if (this.closed) {
                return;
            }
            try {
                const timers = {};
                for (const timerObject of timerObjects) {
                    timers[timerObject._id] = {
                        obj: timerObject,
                        time: this._calcNextProcessTime(timerObject, now),
                    };
                }
                this.adapter.getStates('timer.*', (_stateError, timerStates) => {
                    if (this.closed) {
                        return;
                    }
                    this.selectNextTimer(timers, timerStates);
                });
            }
            catch (error) {
                this.adapter.log.warn(`Could not calculate next timer ${String(error)}`);
                if (this.adapter.supportsFeature?.('PLUGINS')) {
                    this.adapter.getPluginInstance?.('sentry')?.getSentryObject().captureException(error);
                }
            }
        });
    }
    selectNextTimer(timers, timerStates) {
        for (const [id, state] of Object.entries(timerStates)) {
            if (state !== null && state.val != TimerManager.DISABLED) {
                if (state.val == TimerManager.SKIP) {
                    timers[id].time = this._calcNextProcessTime(timers[id].obj, new Date(timers[id].time.setMinutes(1)), true);
                }
                if (timers[id].time < this.nextProcessTime) {
                    this.nextProcessTime = timers[id].time;
                    this.nextTimerId = id;
                }
            }
        }
        const nextTimerName = this.nextTimerId && this.nextProcessTime
            ? `${this.i18n.weekDaysFull[this.nextProcessTime.getDay()]} ${this.adapter.formatDate(this.nextProcessTime, 'hh:mm')}`
            : this.i18n.notAvailable;
        const timerFolder = {
            id: `${this.adapter.namespace}.timer`,
            type: 'channel',
            native: {},
            common: { name: `${this.i18n.nextTimer}: ${nextTimerName}` },
        };
        this.nextProcessTime = new Date(this.nextProcessTime.getTime() - this.adapter.config.pingInterval);
        this.adapter.extendObject('timer', timerFolder);
        this.adapter.setState('info.nextTimer', nextTimerName, true);
        this.adapter.log.debug(`Next timer: ${nextTimerName}`);
    }
}
module.exports = TimerManager;
//# sourceMappingURL=timerManager.js.map
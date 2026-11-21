const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { COMMANDS, HELP } = require('../build/lib/help');
const stockCommands = require('../build/lib/stockCommands');

/** The commands of the switch of a method: from the method to the next method of the class */
function casesOf(file, method, nextMethod) {
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', file), 'utf8');
    const start = source.indexOf(`async ${method}(obj) {`);
    const end = source.indexOf(nextMethod, start);
    assert.ok(start > 0 && end > start, `${method} in ${file}`);
    return [...source.slice(start, end).matchAll(/^\s*case '([^']+)':/gm)].map(m => m[1]);
}

/** Every command the instance answers: main.ts, the Roborock manager and the stock commands it falls back to */
function handledCommands() {
    return [
        ...casesOf('main.ts', 'onMessage', '\n}\n'),
        ...casesOf('lib/vacuum.ts', 'onMessage', 'async setRemoteState('),
        ...Object.keys(stockCommands),
    ];
}

const named = (text, command) => new RegExp(`(^|[^\\w.])${command}(?![\\w])`).test(text);

describe('help', () => {
    it('lists exactly the commands the instance answers, each once', () => {
        const listed = COMMANDS.map(c => c.command);
        assert.deepEqual([...new Set(listed)].sort(), [...listed].sort());
        assert.deepEqual([...listed].sort(), [...new Set(handledCommands())].sort());
    });

    it('names every command', () => {
        for (const { command } of COMMANDS.filter(c => c.command !== 'help')) {
            assert.ok(named(HELP, command), command);
        }
    });

    it('marks the commands that need the request of the user as write', () => {
        const rules = HELP.slice(HELP.indexOf('How to talk to the user:'));
        for (const { command, write } of COMMANDS) {
            if (named(rules, command)) {
                assert.equal(write, true, command);
            }
        }
        for (const command of ['getStatus', 'getConsumableStatus', 'getCleaningSummary', 'getCleaningRecord']) {
            assert.equal(COMMANDS.find(c => c.command === command).write, false, command);
        }
    });

    it('keeps the lines short', () => {
        for (const line of HELP.split('\n')) {
            assert.ok(line.length <= 120, line);
        }
    });
});

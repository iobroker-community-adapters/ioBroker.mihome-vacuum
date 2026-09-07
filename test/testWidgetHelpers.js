const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// The pure helper modules of the VIS 2 widget are plain TypeScript without React. They are
// transpiled on the fly so the tests run against the sources without a separate build step.
const widgetLib = path.join(__dirname, '..', 'src-widgets', 'src', 'lib');
const extensions = require.extensions;
const previousLoader = extensions['.ts'];
extensions['.ts'] = (module, filename) => {
    const source = fs.readFileSync(filename, 'utf8');
    const output = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
        fileName: filename,
    });
    /** @type {{ _compile: (code: string, filename: string) => void }} */ (
        /** @type {unknown} */ (module)
    )._compile(output.outputText, filename);
};

const history = require(path.join(widgetLib, 'history.ts'));
const format = require(path.join(widgetLib, 'format.ts'));
const autofill = require(path.join(widgetLib, 'autofill.ts'));
const rooms = require(path.join(widgetLib, 'rooms.ts'));
const i18n = require(path.join(widgetLib, 'i18n.ts'));

after(() => {
    if (previousLoader) {
        extensions['.ts'] = previousLoader;
    } else {
        delete extensions['.ts'];
    }
});

describe('VIS 2 widget history parsing', () => {
    it('accepts the German adapter columns and the English aliases', () => {
        const raw = JSON.stringify([
            { Datum: '01.09.2026', Start: '10:00', Saugzeit: '25 min', 'Fläche': '33 m²', Ende: true, Error: 0 },
            { date: '02.09.2026', start: '11:00', duration: '5 min', area: '4 m²', completed: false, error: 12 },
        ]);

        assert.deepEqual(history.parseHistory(raw), [
            { date: '01.09.2026', start: '10:00', duration: '25 min', area: '33 m²', completed: true, error: 0 },
            { date: '02.09.2026', start: '11:00', duration: '5 min', area: '4 m²', completed: false, error: 12 },
        ]);
    });

    it('never throws on malformed input', () => {
        assert.deepEqual(history.parseHistory('{not json'), []);
        assert.deepEqual(history.parseHistory('{"a":1}'), []);
        assert.deepEqual(history.parseHistory(null), []);
        assert.deepEqual(history.parseHistory([null, 5, { Datum: 7 }]), [
            { date: '7', start: '—', duration: '—', area: '—', completed: false, error: 0 },
        ]);
    });
});

describe('VIS 2 widget formatting', () => {
    const en = i18n.createText('en');
    const de = i18n.createText('de');

    it('prefers the translation by code, then the adapter catalogue, then the fallback', () => {
        const catalog = { 5: 'Cleaning', 99: 'Firmware special' };

        assert.equal(format.formatState(5, catalog, 'de', de), 'Reinigt');
        assert.equal(format.formatState(99, catalog, 'de', de), 'Firmware special');
        assert.equal(format.formatState(6, undefined, 'en', en), 'Returning to dock');
        assert.equal(format.formatState(4, { 4: '?' }, 'en', en), 'Unknown (4)');
        assert.equal(format.formatState('', undefined, 'en', en), 'Unknown');
        assert.equal(format.formatState('docked', undefined, 'en', en), 'docked');
    });

    it('classifies errors and keeps firmware codes readable', () => {
        assert.deepEqual(format.formatError(0, undefined, 'de', de), { label: 'Kein Fehler', isError: false });
        assert.deepEqual(format.formatError(5, undefined, 'de', de), { label: 'Hauptbürste reinigen', isError: true });
        assert.deepEqual(format.formatError(40, { 40: 'HEART' }, 'en', en), { label: 'HEART', isError: true });
        assert.deepEqual(format.formatError(123, undefined, 'en', en), { label: 'Unknown error (123)', isError: true });
        assert.deepEqual(format.formatError('No error', undefined, 'en', en), { label: 'No error', isError: false });
    });

    it('builds the fan levels from the adapter catalogue with translated names', () => {
        const options = format.buildFanOptions(
            { 104: 'MAXIMUM', 101: 'QUIET', 102: 'BALANCED', 106: 'CUSTOM' },
            { quiet: 1, balanced: 2, turbo: 3 },
            'de',
            de,
        );

        assert.deepEqual(options, [
            { value: 101, label: 'Leise' },
            { value: 102, label: 'Ausgeglichen' },
            { value: 104, label: 'Maximum' },
            { value: 106, label: 'Benutzerdefiniert' },
        ]);
        assert.deepEqual(format.buildFanOptions(undefined, { quiet: 1, balanced: 2, turbo: 3 }, 'en', en), [
            { value: 1, label: 'Quiet' },
            { value: 2, label: 'Balanced' },
            { value: 3, label: 'Turbo' },
        ]);
    });

    it('formats metrics and consumable levels', () => {
        assert.equal(format.formatMetric(33.456, 'm²'), '33.46 m²');
        assert.equal(format.formatMetric('12', '%'), '12 %');
        assert.equal(format.formatMetric(undefined, 'min'), '—');
        assert.equal(format.formatMetric('n/a', ''), 'n/a');
        assert.equal(format.percent('150'), 100);
        assert.equal(format.percent(null), 0);
        assert.equal(format.consumableLevel(10), 'critical');
        assert.equal(format.consumableLevel(35), 'warning');
        assert.equal(format.consumableLevel(36), 'good');
    });
});

describe('VIS 2 widget instance auto-fill', () => {
    it('derives the instance from any adapter state', () => {
        assert.equal(autofill.instanceBaseFromId('mihome-vacuum.3.info.state'), 'mihome-vacuum.3');
        assert.equal(autofill.instanceBaseFromId('mihome-vacuum.0.rooms.room1.roomClean'), 'mihome-vacuum.0');
        assert.equal(autofill.instanceBaseFromId('hm-rpc.0.state'), '');
        assert.equal(autofill.instanceBaseFromId(undefined), '');
    });

    it('fills empty and default attributes but keeps user choices and missing states', () => {
        const data = {
            stateOid: 'mihome-vacuum.2.info.state',
            mapOid: '',
            batteryOid: 'mihome-vacuum.0.info.battery',
            fanOid: 'other.0.custom.fan',
            findOid: 'mihome-vacuum.2.control.find',
        };
        const existing = new Set([
            'mihome-vacuum.2.cleanmap.map64',
            'mihome-vacuum.2.info.battery',
            'mihome-vacuum.2.control.fan_power',
            'mihome-vacuum.2.control.find',
        ]);

        const changes = autofill.collectInstanceChanges(data, 'mihome-vacuum.2', id => existing.has(id));

        assert.deepEqual(changes, {
            mapOid: 'mihome-vacuum.2.cleanmap.map64',
            batteryOid: 'mihome-vacuum.2.info.battery',
        });
        assert.deepEqual(autofill.collectInstanceChanges(data, '', () => true), {});
    });

    it('fills empty and undefined attributes for the default instance without touching complete ones', () => {
        const data = { batteryOid: 'mihome-vacuum.0.info.battery', areaOid: '' };
        const changes = autofill.collectInstanceChanges(data, 'mihome-vacuum.0', () => true);

        assert.equal(changes.areaOid, 'mihome-vacuum.0.info.cleanedarea');
        assert.equal('batteryOid' in changes, false);
        assert.equal(Object.keys(changes).length, autofill.AUTO_FILL_FIELDS.length - 1);
    });
});

describe('VIS 2 widget room discovery', () => {
    it('builds rooms from the adapter channels and only uses existing fan states', () => {
        const channels = [
            { _id: 'mihome-vacuum.0.rooms.room17', type: 'channel', common: { name: { en: 'Kitchen', de: 'Küche' } } },
            { _id: 'mihome-vacuum.0.rooms.room16', type: 'channel', common: { name: 'Bedroom' } },
            { _id: 'mihome-vacuum.0.rooms.room99', type: 'channel', common: { name: 'No clean state' } },
            { _id: 'mihome-vacuum.0.rooms.room16.nested', type: 'channel', common: { name: 'Too deep' } },
        ];
        const states = [
            'mihome-vacuum.0.rooms.room17.roomClean',
            'mihome-vacuum.0.rooms.room17.roomFanPower',
            'mihome-vacuum.0.rooms.room16.roomClean',
            'mihome-vacuum.0.rooms.loadRooms',
        ];

        assert.deepEqual(rooms.roomsFromObjects('mihome-vacuum.0', channels, states, 'de'), [
            {
                key: 'mihome-vacuum.0.rooms.room16',
                name: 'Bedroom',
                startOid: 'mihome-vacuum.0.rooms.room16.roomClean',
                fanOid: '',
            },
            {
                key: 'mihome-vacuum.0.rooms.room17',
                name: 'Küche',
                startOid: 'mihome-vacuum.0.rooms.room17.roomClean',
                fanOid: 'mihome-vacuum.0.rooms.room17.roomFanPower',
            },
        ]);
    });

    it('reads the manual room attributes and skips incomplete rows', () => {
        const data = {
            room1Name: 'Living room',
            room1StartOid: 'a.roomClean',
            room1FanOid: 'a.roomFanPower',
            room2Name: '',
            room2StartOid: 'b.roomClean',
            room3Name: 'No start',
            room3StartOid: '',
        };

        assert.deepEqual(rooms.roomsFromAttributes(data), [
            { key: 'room1', name: 'Living room', startOid: 'a.roomClean', fanOid: 'a.roomFanPower' },
        ]);
    });
});

describe('VIS 2 widget translations', () => {
    it('falls back to English for unknown languages and keeps unknown keys visible', () => {
        assert.equal(i18n.createText('xx')('dashboard'), 'Dashboard');
        assert.equal(i18n.createText('de')('dashboard'), i18n.optionalText('de', 'dashboard'));
        assert.equal(i18n.createText('en')('definitely-missing-key'), 'definitely-missing-key');
        assert.equal(i18n.resolveName({ en: 'Kitchen', de: 'Küche' }, 'de'), 'Küche');
        assert.equal(i18n.resolveName({ en: 'Kitchen' }, 'fr'), 'Kitchen');
        assert.equal(i18n.resolveName(undefined, 'de'), '');
    });
});

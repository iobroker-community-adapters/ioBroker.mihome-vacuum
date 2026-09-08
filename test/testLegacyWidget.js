const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Renders the VIS 1 EJS template (widgets/mihome-vacuum.html) with a minimal VIS 1 runtime stub, so
// template syntax errors and the model-dependent sections are caught without a VIS installation.

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'widgets', 'mihome-vacuum.html'), 'utf8');
const languages = ['de', 'en', 'es', 'fr', 'it', 'nl', 'pl', 'pt', 'ru', 'uk', 'zh-cn'];

const bindScript = /<script type="text\/javascript">([\s\S]*?)<\/script>/.exec(source)[1];
// The template tag spans several lines and its data-vis-prev attribute contains a `>`; the tag
// closes with a `>` on its own line.
const tagStart = source.indexOf('id="tplMihomeVacuumControl"');
const tagEnd = source.indexOf('\n>', tagStart) + 2;
const templateEnd = source.lastIndexOf('</script>');
const attributeDefinition = /data-vis-attrs="([^"]*)"/.exec(source.slice(tagStart, tagEnd))[1];
const template = source.slice(tagEnd, templateEnd);

const dictionaries = Object.fromEntries(
    languages.map(language => [
        language,
        JSON.parse(fs.readFileSync(path.join(root, 'admin', 'i18n', `${language}.json`), 'utf8')),
    ]),
);
const systemDictionary = Object.fromEntries(
    Object.keys(dictionaries.en).map(key => [
        key,
        Object.fromEntries(languages.map(language => [language, dictionaries[language][key]])),
    ]),
);

/** Attribute defaults as VIS 1 derives them from `name[default]/type`. */
function defaultData() {
    const data = {};
    for (const entry of attributeDefinition.split(';').filter(Boolean)) {
        const match = /^([^[/]+)(?:\[([^\]]*)\])?\/(\w+)/.exec(entry);
        const [, name, fallback, type] = match;
        if (fallback === undefined) {
            data[name] = '';
        } else if (type === 'checkbox') {
            data[name] = fallback === 'true';
        } else if (type === 'number') {
            data[name] = Number(fallback);
        } else {
            data[name] = fallback;
        }
    }
    return data;
}

/**
 * Compiles the VIS 1 flavour of EJS (`<% %>`, `<%= %>` escaped, `<%== %>` raw) to a function body.
 *
 * @param {string} text - template source
 */
function compile(text) {
    let code = 'var __out = "";\n';
    const pattern = /<%(==|=)?([\s\S]*?)%>/g;
    let last = 0;
    let match;
    while ((match = pattern.exec(text))) {
        code += `__out += ${JSON.stringify(text.slice(last, match.index))};\n`;
        if (match[1] === '==') {
            code += `__out += String(${match[2]});\n`;
        } else if (match[1] === '=') {
            code += `__out += __esc(${match[2]});\n`;
        } else {
            code += `${match[2]}\n`;
        }
        last = pattern.lastIndex;
    }
    code += `__out += ${JSON.stringify(text.slice(last))};\nreturn __out;`;
    return code;
}

const templateCode = compile(template);

/**
 * Creates a VIS 1 stub, loads the widget binds into it and renders the template.
 *
 * @param {object} options - test setup
 * @param {Record<string, unknown>} [options.data] - widget attributes overriding the defaults
 * @param {Record<string, unknown>} [options.states] - state values by ID
 * @param {Record<string, object>} [options.objects] - objects by ID (`vis.objects`)
 * @param {string} [options.language] - system language
 * @param {boolean} [options.editMode] - VIS edit mode
 */
function render({ data = {}, states = {}, objects = {}, language = 'en', editMode = false } = {}) {
    const written = [];
    const vis = {
        binds: {},
        editMode,
        objects,
        views: { main: { widgets: { w1: { data: {} } } } },
        widgets: { w1: { data: {} } },
        states: { attr: id => states[id.replace(/\.val$/, '')] },
        setValue: (id, value) => written.push([id, value]),
    };
    const context = vm.createContext({ vis, window: {}, console, systemDictionary, systemLang: language });
    vm.runInContext(bindScript, context);
    const widgetData = { ...defaultData(), ...data };
    widgetData.attr = name => (name === 'wid' ? 'w1' : name === 'class' ? '' : widgetData[name]);
    const escape = value =>
        String(value).replace(
            /[&<>"]/g,
            character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character],
        );
    const fn = vm.runInContext(`(function (__esc) {\n${templateCode}\n})`, context);
    const html = fn.call({ data: widgetData }, escape);
    return { html, vis, written, data: widgetData };
}

const base = 'mihome-vacuum.0';
const configured = {
    'oid-state': `${base}.info.state`,
    'oid-error': `${base}.info.error`,
    'oid-connected': `${base}.info.connection`,
    'oid-battery': `${base}.info.battery`,
    'oid-power-level': `${base}.control.fan_power`,
    'oid-filter': `${base}.consumable.filter`,
    'oid-filter-reset': `${base}.consumable.filter_reset`,
    'oid-history-json': `${base}.history.allTableJSON`,
};

describe('VIS 1 widget template', () => {
    it('renders the dashboard with translated state, error and consumable texts', () => {
        const { html } = render({
            data: configured,
            states: {
                [`${base}.info.state`]: 5,
                [`${base}.info.error`]: 5,
                [`${base}.info.connection`]: true,
                [`${base}.info.battery`]: 87,
                [`${base}.control.fan_power`]: 102,
                [`${base}.consumable.filter`]: 12,
            },
            language: 'de',
        });

        assert.match(html, /Reinigt/);
        assert.match(html, /Hauptbürste reinigen/);
        assert.match(html, /mihome-vacuum-health has-error/);
        assert.match(html, /87 %/);
        assert.match(html, /<option value="102" selected>Ausgeglichen<\/option>/);
        assert.match(html, /mihome-vacuum-consumable critical/);
        assert.match(html, /Austausch empfohlen|Ersatz empfohlen|empfohlen/);
        assert.match(html, /is-online/);
    });

    it('uses SVG icons instead of Unicode glyphs', () => {
        const { html } = render({ data: configured, states: { [`${base}.info.state`]: 8 } });

        assert.equal((html.match(/<svg class="mihome-vacuum-icon/g) || []).length > 10, true);
        assert.doesNotMatch(html, /[◈≋✣⌁▱▦▣◉●⌂◷◇▰⌗▶Ⅱ⌖⚙↻◴]/);
        assert.doesNotMatch(template, /[◈≋✣⌁▱▦▣◉●⌂◷◇▰⌗▶Ⅱ⌖⚙↻◴]/);
    });

    it('shows the cleaning settings, dock and schedule only for configured states', () => {
        const without = render({ data: configured });
        assert.doesNotMatch(without.html, /mihome-vacuum-strip/);

        const objects = {
            [`${base}.control.water_box_mode`]: {
                common: { states: { 200: 'OFF', 201: 'LOW', 202: 'MEDIUM', 203: 'HIGH', 204: 'CUSTOM' } },
            },
        };
        const { html } = render({
            data: {
                ...configured,
                'oid-water': `${base}.control.water_box_mode`,
                'oid-carpet': `${base}.control.carpet_mode`,
                'oid-dock-status': `${base}.info.dock_status`,
                'oid-dust-collect': `${base}.control.dustCollect`,
                'oid-dnd': `${base}.info.dnd`,
                'oid-next-timer': `${base}.info.nextTimer`,
            },
            states: {
                [`${base}.control.water_box_mode`]: 201,
                [`${base}.control.carpet_mode`]: true,
                [`${base}.info.dock_status`]: 39,
                [`${base}.info.dnd`]: true,
                [`${base}.info.nextTimer`]: 'Mittwoch 18:30',
            },
            objects,
            language: 'de',
        });

        assert.match(html, /<option value="201" selected>Niedrig<\/option>/);
        assert.doesNotMatch(html, /mopRoute|Wischmodus/);
        assert.match(html, /mihome-vacuum-switch[\s\S]*checked/);
        assert.match(html, /mihome-vacuum-dock critical/);
        assert.match(html, /Schmutzwassertank voll/);
        assert.match(html, /Staubbehälter leeren/);
        assert.match(html, /mihome-vacuum-chip is-active/);
        assert.match(html, /Nächster Timer: Mittwoch 18:30/);
    });

    it('falls back to the Roborock water levels when the object is not loaded and hides the schedule on request', () => {
        const { html } = render({
            data: {
                ...configured,
                'oid-water': `${base}.control.water_box_mode`,
                'oid-dnd': `${base}.info.dnd`,
                'show-schedule': false,
            },
            states: { [`${base}.control.water_box_mode`]: 999 },
        });

        assert.match(html, /<option value="203">High<\/option>/);
        assert.match(html, /<option value="999" selected>Current \(999\)<\/option>/);
        assert.doesNotMatch(html, /mihome-vacuum-schedule/);
    });

    it('offers the map selector for multi-map robots and the reload button', () => {
        const objects = {
            [`${base}.cleanmap.actualMap`]: { common: { states: { 0: 'Ground floor', 1: 'Upstairs' } } },
        };
        const single = render({
            data: { ...configured, 'oid-map-select': `${base}.cleanmap.actualMap` },
            objects: { [`${base}.cleanmap.actualMap`]: { common: { states: { 0: 'Only map' } } } },
        });
        assert.doesNotMatch(single.html, /mihome-vacuum-map-tools/);

        const { html } = render({
            data: {
                ...configured,
                'oid-map-select': `${base}.cleanmap.actualMap`,
                'oid-map-reload': `${base}.cleanmap.loadMap`,
            },
            states: { [`${base}.cleanmap.actualMap`]: 1 },
            objects,
        });
        assert.match(html, /mihome-vacuum-map-tools/);
        assert.match(html, /<option value="1" selected>Upstairs<\/option>/);
        assert.match(html, /aria-label="Reload map"/);
    });

    it('limits the history to the configured number of runs', () => {
        const rows = Array.from({ length: 20 }, (_row, index) => ({
            Datum: `0${(index % 9) + 1}.09.2026`,
            Start: '10:00',
            Saugzeit: '20 min',
            Fläche: '30 m²',
            Ende: true,
            Error: 0,
        }));
        const { html } = render({
            data: { ...configured, 'history-limit': 3 },
            states: { [`${base}.history.allTableJSON`]: JSON.stringify(rows) },
        });

        assert.equal((html.match(/<article><div><strong>0\d\.09\.2026/g) || []).length, 3);
    });

    it('never throws on broken history or unknown codes', () => {
        const { html } = render({
            data: configured,
            states: {
                [`${base}.info.state`]: 4,
                [`${base}.info.error`]: 40,
                [`${base}.history.allTableJSON`]: '{not json',
            },
        });

        assert.match(html, /Unknown \(4\)/);
        assert.match(html, /HEART/);
        assert.match(html, /No cleaning history available/);
    });

    it('auto-fills the attributes from the selected instance with manager-specific alternatives', () => {
        const objects = {
            'mihome-vacuum.1.info.state': {},
            'mihome-vacuum.1.setting.water_grade': {},
            'mihome-vacuum.1.setting.suction_grade': {},
            'mihome-vacuum.1.info.dock_state': {},
            'mihome-vacuum.1.control.carpet_mode': {},
        };
        const { vis } = render({ objects, editMode: true });
        vis.views.main.widgets.w1.data['oid-carpet'] = 'custom.carpet';

        const changed = vis.binds['mihome-vacuum'].changedId(
            'w1',
            'main',
            'mihome-vacuum.1.info.state',
            'oid-state',
            false,
            '',
        );

        // The bind runs in its own vm realm, so copy the array before the strict comparison.
        assert.deepEqual([...changed].sort(), ['oid-dock-status', 'oid-power-level', 'oid-state', 'oid-water']);
        assert.equal(vis.views.main.widgets.w1.data['oid-water'], 'mihome-vacuum.1.setting.water_grade');
        assert.equal(vis.views.main.widgets.w1.data['oid-dock-status'], 'mihome-vacuum.1.info.dock_state');
        assert.equal(vis.views.main.widgets.w1.data['oid-carpet'], 'custom.carpet');
        assert.equal(
            vis.binds['mihome-vacuum'].changedId('w1', 'main', 'mihome-vacuum.1.info.state', 'oid-state', false, 'old'),
            false,
        );
    });

    it('writes numbers, booleans and button triggers through the binds', () => {
        const { vis, written } = render({});
        const binds = vis.binds['mihome-vacuum'];
        const element = attributes => ({
            getAttribute: name => (name in attributes ? attributes[name] : null),
            ...attributes,
        });

        binds.setValue(element({ 'data-oid': 'a.b.start' }));
        binds.setSelectValue(element({ 'data-oid': 'a.b.fan', value: '102' }));
        binds.setToggle(element({ 'data-oid': 'a.b.carpet', checked: true }));
        binds.setValue(element({ 'data-oid': '' }));

        assert.deepEqual(written, [
            ['a.b.start', true],
            ['a.b.fan', 102],
            ['a.b.carpet', true],
        ]);
    });
});

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const source = path.join(projectRoot, 'src-widgets', 'build');
const target = path.join(projectRoot, 'widgets', 'mihome-vacuum');
const generatedAssets = path.join(target, 'assets');
const translationsTarget = path.join(target, 'js', 'translations.js');
const languages = ['de', 'en', 'es', 'fr', 'it', 'nl', 'pl', 'pt', 'ru', 'uk', 'zh-cn'];

if (!target.startsWith(path.join(projectRoot, 'widgets') + path.sep)) {
    throw new Error(`Refusing to write widgets outside the project: ${target}`);
}

fs.rmSync(generatedAssets, { recursive: true, force: true });
fs.rmSync(path.join(target, 'customWidgets.js'), { force: true });
fs.mkdirSync(target, { recursive: true });
fs.cpSync(path.join(source, 'assets'), generatedAssets, { recursive: true });
fs.copyFileSync(path.join(source, 'customWidgets.js'), path.join(target, 'customWidgets.js'));

const dictionaries = Object.fromEntries(
    languages.map(language => {
        const file = path.join(projectRoot, 'admin', 'i18n', language, 'translations.json');
        return [language, JSON.parse(fs.readFileSync(file, 'utf8'))];
    }),
);
const englishKeys = Object.keys(dictionaries.en).sort();
for (const language of languages) {
    const keys = Object.keys(dictionaries[language]).sort();
    if (JSON.stringify(keys) !== JSON.stringify(englishKeys)) {
        throw new Error(`Translation keys in ${language} do not match the English source`);
    }
}
const legacyDictionary = Object.fromEntries(
    englishKeys.map(key => [
        key,
        Object.fromEntries(languages.map(language => [language, dictionaries[language][key]])),
    ]),
);
fs.mkdirSync(path.dirname(translationsTarget), { recursive: true });
fs.writeFileSync(
    translationsTarget,
    `/* Generated from admin/i18n by scripts/copy-widgets.cjs. */\n` +
        `'use strict';\n` +
        `if (typeof systemDictionary !== 'undefined') {\n` +
        `    $.extend(true, systemDictionary, ${JSON.stringify(legacyDictionary, null, 4)});\n` +
        `}\n`,
);

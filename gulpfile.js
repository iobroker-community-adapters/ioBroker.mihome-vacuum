/*!
 * ioBroker gulpfile
 * Date: 2019-01-28
 */
'use strict';

const gulp = require('gulp');
const fs = require('fs');
const pkg = require('./package.json');
const iopackage = require('./io-package.json');
const version = pkg && pkg.version ? pkg.version : iopackage.common.version;
const fileName = 'words.js';
const EMPTY = '';
const translate = require('./lib/tools').translateText;
const languages = {
    en: {},
    de: {},
    ru: {},
    pt: {},
    nl: {},
    fr: {},
    it: {},
    es: {},
    pl: {},
    'zh-cn': {},
};

function lang2data(lang) {
    let str = '{\n';
    let count = 0;
    for (const w in lang) {
        count++;
        const key = `    "${w.replace(/"/g, '\\"')}": `;
        str += `${key}"${lang[w].replace(/"/g, '\\"')}",\n`;
    }
    if (!count) {
        return '{\n}';
    }
    return `${str.substring(0, str.length - 2)}\n}`;
}

function readWordJs(src) {
    try {
        let words;
        if (fs.existsSync(`${src}js/${fileName}`)) {
            words = fs.readFileSync(`${src}js/${fileName}`).toString();
        } else {
            words = fs.readFileSync(src + fileName).toString();
        }
        words = words.substring(words.indexOf('{'), words.length);
        words = words.substring(0, words.lastIndexOf(';'));

        const resultFunc = new Function(`return ${words};`);

        return resultFunc();
    } catch (e) {
        console.log(`readWordJs: ${e}`);
        return null;
    }
}

function padRight(text, totalLength) {
    return text + (text.length < totalLength ? new Array(totalLength - text.length).join(' ') : '');
}

function writeWordJs(data, src) {
    let text = '';
    text += '/*global systemDictionary:true */\n';
    text += "'use strict';\n\n";
    text += 'systemDictionary = {\n';
    for (const word in data) {
        text += `    ${padRight(`"${word.replace(/"/g, '\\"')}": {`, 50)}`;
        let line = '';
        for (const lang in data[word]) {
            line += `"${lang}": "${padRight(`${data[word][lang].replace(/"/g, '\\"')}",`, 50)} `;
        }
        if (line) {
            line = line.trim();
            line = line.substring(0, line.length - 1);
        }
        text += `${line}},\n`;
    }
    text += '};';
    if (fs.existsSync(`${src}js/${fileName}`)) {
        fs.writeFileSync(`${src}js/${fileName}`, text);
    } else {
        fs.writeFileSync(`${src}${fileName}`, text);
    }
}

function words2languages(src) {
    const langs = Object.assign({}, languages);
    const data = readWordJs(src);
    if (data) {
        for (const word in data) {
            for (const lang in data[word]) {
                langs[lang][word] = data[word][lang];
                //  pre-fill all other languages
                for (const j in langs) {
                    langs[j][word] = langs[j][word] || EMPTY;
                }
            }
        }
        if (!fs.existsSync(`${src}i18n/`)) {
            fs.mkdirSync(`${src}i18n/`);
        }
        for (const l in langs) {
            const keys = Object.keys(langs[l]);
            keys.sort();
            const obj = {};
            for (let k = 0; k < keys.length; k++) {
                obj[keys[k]] = langs[l][keys[k]];
            }
            if (!fs.existsSync(`${src}i18n/${l}`)) {
                fs.mkdirSync(`${src}i18n/${l}`);
            }

            fs.writeFileSync(`${src}i18n/${l}/translations.json`, lang2data(obj));
        }
    } else {
        console.error(`Cannot read or parse ${fileName}`);
    }
}

function languages2words(src) {
    const dirs = fs.readdirSync(`${src}i18n/`);
    const langs = {};
    const bigOne = {};
    const order = Object.keys(languages);
    dirs.sort(function (a, b) {
        const posA = order.indexOf(a);
        const posB = order.indexOf(b);
        if (posA === -1 && posB === -1) {
            if (a > b) {
                return 1;
            }
            if (a < b) {
                return -1;
            }
            return 0;
        } else if (posA === -1) {
            return -1;
        } else if (posB === -1) {
            return 1;
        }
        if (posA > posB) {
            return 1;
        }
        if (posA < posB) {
            return -1;
        }
        return 0;
    });
    for (const lang of dirs) {
        if (lang === 'flat.txt') {
            continue;
        }
        langs[lang] = fs.readFileSync(`${src}i18n/${lang}/translations.json`).toString();
        langs[lang] = JSON.parse(langs[lang]);
        const words = langs[lang];
        for (const word in words) {
            bigOne[word] = bigOne[word] || {};
            if (words[word] !== EMPTY) {
                bigOne[word][lang] = words[word];
            }
        }
    }
    // read actual words.js
    const aWords = readWordJs(src);

    const temporaryIgnore = ['flat.txt'];
    if (aWords) {
        // Merge words together
        for (const w in aWords) {
            if (!bigOne[w]) {
                console.warn(`Take from actual words.js: ${w}`);
                bigOne[w] = aWords[w];
            }
            dirs.forEach(function (lang) {
                if (temporaryIgnore.indexOf(lang) !== -1) {
                    return;
                }
                if (!bigOne[w][lang]) {
                    console.warn(`Missing "${lang}": ${w}`);
                }
            });
        }
    }

    writeWordJs(bigOne, src);
}

async function translateNotExisting(obj, baseText, yandex) {
    let t = obj['en'];
    if (!t) {
        t = baseText;
    }

    if (t) {
        for (const l in languages) {
            if (!obj[l]) {
                const time = new Date().getTime();
                obj[l] = await translate(t, l, yandex);
                console.log(`en -> ${l} ${new Date().getTime() - time} ms`);
            }
        }
    }
}

//TASKS

gulp.task('adminWords2languages', function (done) {
    words2languages('./admin/');
    done();
});

gulp.task('adminLanguages2words', function (done) {
    languages2words('./admin/');
    done();
});

gulp.task('updatePackages', function (done) {
    iopackage.common.version = pkg.version;
    iopackage.common.news = iopackage.common.news || {};
    if (!iopackage.common.news[pkg.version]) {
        const news = iopackage.common.news;
        const newNews = {};

        newNews[pkg.version] = {
            en: 'news',
            de: 'neues',
            ru: 'новое',
            pt: 'novidades',
            nl: 'nieuws',
            fr: 'nouvelles',
            it: 'notizie',
            es: 'noticias',
            pl: 'nowości',
            'zh-cn': '新',
        };
        iopackage.common.news = Object.assign(newNews, news);
    }
    fs.writeFileSync('io-package.json', JSON.stringify(iopackage, null, 4));
    done();
});

gulp.task('updateReadme', function (done) {
    const readme = fs.readFileSync('README.md').toString();
    const pos = readme.indexOf('## Changelog\n');
    if (pos !== -1) {
        const readmeStart = readme.substring(0, pos + '## Changelog\n'.length);
        const readmeEnd = readme.substring(pos + '## Changelog\n'.length);

        if (readme.indexOf(version) === -1) {
            const timestamp = new Date();
            const date = `${timestamp.getFullYear()}-${`0${(timestamp.getMonth() + 1).toString(10)}`.slice(-2)}-${`0${timestamp.getDate().toString(10)}`.slice(
                -2,
            )}`;

            let news = '';
            if (iopackage.common.news && iopackage.common.news[pkg.version]) {
                news += `* ${iopackage.common.news[pkg.version].en}`;
            }

            fs.writeFileSync(
                'README.md',
                `${readmeStart}### ${version} (${date})\n${news ? `${news}\n\n` : '\n'}${readmeEnd}`,
            );
        }
    }
    done();
});

gulp.task('translate', async function () {
    let yandex;
    const i = process.argv.indexOf('--yandex');
    if (i > -1) {
        yandex = process.argv[i + 1];
    }

    if (iopackage && iopackage.common) {
        if (iopackage.common.news) {
            console.log('Translate News');
            for (const k in iopackage.common.news) {
                console.log(`News: ${k}`);
                const nw = iopackage.common.news[k];
                await translateNotExisting(nw, null, yandex);
            }
        }
        if (iopackage.common.titleLang) {
            console.log('Translate Title');
            await translateNotExisting(iopackage.common.titleLang, iopackage.common.title, yandex);
        }
        if (iopackage.common.desc) {
            console.log('Translate Description');
            await translateNotExisting(iopackage.common.desc, null, yandex);
        }

        if (iopackage.messages) {
            console.log('Translate Messages');
            for (const msg of iopackage.messages) {
                if (msg.title) {
                    await translateNotExisting(msg.title, null, yandex);
                }
                if (msg.text) {
                    console.log(msg.text.en);
                    await translateNotExisting(msg.text, null, yandex);
                }
            }
        }

        if (fs.existsSync('./admin/i18n/en/translations.json')) {
            const enTranslations = require('./admin/i18n/en/translations.json');
            for (const l in languages) {
                console.log(`Translate Text: ${l}`);
                let existing = {};
                if (fs.existsSync(`./admin/i18n/${l}/translations.json`)) {
                    existing = require(`./admin/i18n/${l}/translations.json`);
                }
                for (const t in enTranslations) {
                    if (!existing[t]) {
                        existing[t] = await translate(enTranslations[t], l, yandex);
                    }
                }
                if (!fs.existsSync(`./admin/i18n/${l}/`)) {
                    fs.mkdirSync(`./admin/i18n/${l}/`);
                }
                fs.writeFileSync(`./admin/i18n/${l}/translations.json`, JSON.stringify(existing, null, 4));
            }
        }
    }
    fs.writeFileSync('io-package.json', JSON.stringify(iopackage, null, 4));
});

gulp.task('translateAndUpdateWordsJS', gulp.series('translate', 'adminLanguages2words', 'adminWords2languages'));

gulp.task('default', gulp.series('updatePackages', 'updateReadme'));

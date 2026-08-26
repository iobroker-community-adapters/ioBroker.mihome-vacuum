const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function readProjectFile(file) {
    return fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
}

describe('Sensitive command logging', () => {
    it('does not log custom state-command parameters or full responses', () => {
        const source = readProjectFile('src/main.ts');

        assert.doesNotMatch(source, /Params:\s*\$\{values\[1\]\}/);
        assert.doesNotMatch(source, /Get self send data:\s*\$\{JSON\.stringify\(DeviceData\)\}/);
        assert.doesNotMatch(source, /JSON\.stringify\(DeviceData(?:\.result)?\)\.replace/);
        assert.doesNotMatch(source, /JSON\.stringify\(await this\.xiaomiApi\.getDevices/);
        assert.match(source, /Cloud device discovery completed/);
    });

    it('does not log complete adapter message payloads', () => {
        const source = readProjectFile('src/lib/vacuum.ts');

        assert.doesNotMatch(source, /We are in onMessage:\$\{JSON\.stringify\(obj\)\}/);
    });

    it('does not log the serialized miIO request payload', () => {
        const source = readProjectFile('src/lib/miio.ts');

        assert.doesNotMatch(source, /Message=\s*\$\{messageStr\}/);
        assert.doesNotMatch(source, /adapter\.config\.token\.substr/);
        assert.doesNotMatch(source, /MIIO RECIVE:\s*\$\{JSON\.stringify\(answer\)\}/);
        assert.doesNotMatch(source, /CANT PARSE ANSWER:\s*\$\{plainData\}/);
        assert.doesNotMatch(source, /Ios Token decrypted/);
    });
});

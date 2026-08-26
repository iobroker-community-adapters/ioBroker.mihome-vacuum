const assert = require('node:assert/strict');
const carpetModeProtocol = require('../build/lib/carpetModeProtocol');

describe('Generic carpet-mode protocol runtime', () => {
    it('parses enabled and disabled settings including model-specific fields', () => {
        const responses = [
            { result: [{ enable: 1, current_integral: 450, stall_time: 10, decay_start_time: 3 }] },
            { result: [{ enable: 0, current_integral: 500 }] },
        ];

        const enabled = carpetModeProtocol.parseCarpetMode(responses[0]);
        const disabled = carpetModeProtocol.parseCarpetMode(responses[1]);
        assert.ok(enabled);
        assert.ok(disabled);
        assert.equal(enabled.enabled, true);
        assert.equal(disabled.enabled, false);
        assert.equal(enabled.settings.current_integral, 450);
        assert.equal(disabled.settings.current_integral, 500);
        assert.equal(carpetModeProtocol.isCarpetModeSupported(responses[0]), true);
        assert.equal(carpetModeProtocol.isCarpetModeSupported(responses[1]), true);
    });

    it('preserves the original settings-object reference', () => {
        const settings = { enable: 1, synthetic: true };
        const parsed = carpetModeProtocol.parseCarpetMode({ result: [settings] });

        assert.ok(parsed);
        assert.equal(parsed.settings, settings);
    });

    it('preserves differing support and value-validation tolerance', () => {
        const responses = [
            { result: [{ enable: 2 }] },
            { result: [{ enable: true }] },
            { result: [] },
            { result: 'unknown_method' },
            {},
            { result: null },
        ];

        assert.deepEqual(
            responses.map(response => carpetModeProtocol.isCarpetModeSupported(response)),
            [true, true, true, false, false, false],
        );
        assert.equal(carpetModeProtocol.parseCarpetMode(responses[0]), null);
        assert.equal(carpetModeProtocol.parseCarpetMode(responses[1]), null);
        assert.throws(() => carpetModeProtocol.parseCarpetMode(responses[2]), TypeError);
    });
});

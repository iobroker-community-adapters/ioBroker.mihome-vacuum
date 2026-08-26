const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const proxyquire = require('proxyquire').noCallThru().noPreserveCache();

function runRenderer(modulePath) {
    const events = [];
    const normalize = value => {
        if (value instanceof Image) {
            return ['image', value.width, value.height];
        }
        if (value && value.__canvas) {
            return ['canvas', value.width, value.height];
        }
        return value;
    };
    const context = new Proxy(
        {
            getImageData: (...args) => {
                events.push(['getImageData', ...args]);
                return { syntheticImageData: args };
            },
        },
        {
            get(target, property) {
                if (property in target) {
                    return target[property];
                }
                return (...args) => events.push([String(property), ...args.map(normalize)]);
            },
            set(target, property, value) {
                events.push(['set', String(property), value]);
                target[property] = value;
                return true;
            },
        },
    );
    const createCanvas = (width, height) => {
        events.push(['createCanvas', width, height]);
        return { __canvas: true, width, height, getContext: () => context };
    };
    class Image {
        constructor() {
            this.width = 32;
            this.height = 32;
        }
    }
    const MapCreator = proxyquire(modulePath, { canvas: { createCanvas, Image } });
    const map = {
        image: {
            dimensions: { width: 3, height: 3 },
            position: { left: 1, top: 2 },
            pixels: {
                floor: [0, 1, 4],
                obstacle: [2],
                obstacle_strong: [],
                segments: [(1 << 21) | 0, (1 << 21) | 1],
                carpet: [4],
            },
        },
        currently_cleaned_blocks: [1],
        currently_cleaned_zones: [[100, 200, 300, 400]],
        path: { points: [[100, 200], [200, 300]], current_angle: 90 },
        mop_path: new Array(16).fill(1),
        charger: [100, 200],
        robot: [200, 300],
    };
    const result = MapCreator.CanvasMap(
        map,
        { FLOORCOLOR: '#111111', WALLCOLOR: '#222222', PATHCOLOR: '#333333', newmap: true, ROBOT: 'tank' },
        { log: { debug: message => events.push(['debug', message]) } },
    );
    const rotated = MapCreator.rotateCanvas(new Image(), 45);

    return {
        events,
        result: [result.width, result.height],
        rotated: [rotated.width, rotated.height],
    };
}

describe('MapCreator TypeScript runtime subsystem', () => {
    it('matches the complete synthetic render and canvas call fixture', () => {
        const rendered = runRenderer('../build/lib/mapCreator');
        const eventDigest = crypto.createHash('sha256').update(JSON.stringify(rendered.events)).digest('hex');

        assert.equal(eventDigest, '2c053bc4ae7f2a24f385b4f64f21ec85ac9fe13f6eb78e4a65e7a5760afc575e');
        assert.equal(rendered.events.length, 71);
        assert.deepEqual(rendered.result, [128, 124]);
        assert.deepEqual(rendered.rotated, [100, 100]);
        assert.equal(rendered.events.some(event => event[0] === 'strokeRect'), true);
        assert.equal(rendered.events.some(event => event[0] === 'putImageData'), true);
    });
});

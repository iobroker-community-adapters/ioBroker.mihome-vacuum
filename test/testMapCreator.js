const assert = require('node:assert/strict');
const proxyquire = require('proxyquire').noCallThru().noPreserveCache();

describe('MapCreator canvas dimensions', () => {
    it('creates every canvas with explicit dimensions and preserves the crop size', () => {
        const createCalls = [];
        const context = {
            beginPath() {},
            clearRect() {},
            closePath() {},
            drawImage() {},
            fill() {},
            fillRect() {},
            getImageData: (...args) => ({ args }),
            lineTo() {},
            moveTo() {},
            putImageData() {},
            rect() {},
            rotate() {},
            stroke() {},
            strokeRect() {},
            translate() {},
        };
        const createCanvas = (width, height) => {
            createCalls.push([width, height]);
            return { width, height, getContext: () => context };
        };
        class Image {
            constructor() {
                this.width = 32;
                this.height = 32;
            }
        }
        const MapCreator = proxyquire('../build/lib/mapCreator', { canvas: { createCanvas, Image } });
        const map = {
            image: {
                dimensions: { width: 1, height: 1 },
                position: { left: 0, top: 0 },
                pixels: { floor: [0], obstacle: [], segments: [] },
            },
        };

        const result = MapCreator.CanvasMap(map, {}, { log: { debug() {} } });
        const rotated = MapCreator.rotateCanvas(new Image(), 90);

        assert.deepEqual(createCalls, [
            [100, 100],
            [4096, 4096],
            [120, 120],
            [100, 100],
        ]);
        assert.equal(result.width, 120);
        assert.equal(result.height, 120);
        assert.equal(rotated.width, 100);
        assert.equal(rotated.height, 100);
    });
});

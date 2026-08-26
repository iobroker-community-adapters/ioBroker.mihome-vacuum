'use strict';

const startAdapter = require('./build/main.js');

if (require.main !== module) {
    module.exports = startAdapter;
} else {
    // @ts-expect-error The compiled adapter replaces module.exports with its compact-mode factory.
    startAdapter();
}

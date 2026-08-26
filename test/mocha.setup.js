// Don't silently swallow unhandled rejections
process.on('unhandledRejection', (e) => {
	throw e;
});

// enable the should interface with sinon
// and load chai-as-promised and sinon-chai by default
const sinonChai = require('sinon-chai');
const chaiAsPromised = require('chai-as-promised');
const { should, use } = require('chai');

should();
// Chai 5 plugins are ESM modules, while older compatible releases are CommonJS.
use(sinonChai.default || sinonChai);
use(chaiAsPromised.default || chaiAsPromised);

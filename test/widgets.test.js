// End-to-end test of the VIS 2 widget set with the official ioBroker widget testing helper.
// It installs js-controller, web and vis-2 into a temporary directory, starts a headless browser,
// creates a project and adds every widget of this set once. Run it with `npm run test:widgets`
// after `npm run build`; it needs network access for the installation and is therefore not part of
// the default `npm test` gate.
const helper = require('@iobroker/vis-2-widgets-testing');
const { name } = require('../package.json');

const adapterName = name.split('.').pop() ?? '';

describe(`${adapterName} VIS 2 widgets`, () => {
    let page;
    let browser;

    before(async function () {
        this.timeout(240_000);
        await helper.startIoBroker({ widgetsSetName: adapterName });
        const result = await helper.startBrowser(true);
        browser = result.browser;
        page = result.page;
        await helper.createProject(page);
        await helper.palette.openWidgetSet(page, adapterName);
        await helper.screenshot(page, '02_widgets_opened');
    });

    it('adds every widget of the set without a crash', async function () {
        this.timeout(120_000);
        const widgets = await helper.palette.getListOfWidgets(page, adapterName);
        if (!widgets.length) {
            throw new Error(`No widgets found for widget set ${adapterName}`);
        }
        for (const widgetName of widgets) {
            const wid = await helper.palette.addWidget(page, widgetName);
            await helper.screenshot(page, `10_${widgetName}`);
            await helper.view.deleteWidget(page, wid);
        }
    });

    after(async function () {
        this.timeout(20_000);
        if (browser) {
            await helper.stopBrowser(browser);
        }
        await helper.stopIoBroker();
    });
});

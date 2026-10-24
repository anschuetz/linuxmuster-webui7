import { createApp } from 'vue';
import StockSettings from './StockSettings.vue';
import { createSettings } from './settings.mjs';

/** Explicit stock route mount for the future shell; no production entry imports this. */
export function mountStockSettings(element, aj, { path = '/view/settings', machine = aj.identity.machine, customization = {} } = {}) {
    if (path !== '/view/settings') throw new Error(`Not a stock settings route: ${path}`);
    const model = createSettings(aj, { machine });
    const app = createApp(StockSettings, { model, customization });
    app.provide('aj', aj); app.config.globalProperties.$gettext = aj.gettext; app.mount(element);
    return { model, dispose: () => app.unmount() };
}

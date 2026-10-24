import { createApp, reactive } from 'vue';
import SchoolSettings from './SchoolSettings.vue';
import GlobalSettings from './GlobalSettings.vue';
import { readCustomization, watchSidebar } from './shell.mjs';

export function mount(element, aj) {
    const global = element.dataset.view === 'global';
    const layout = reactive({ sidebar: true });
    const stop = watchSidebar(value => { layout.sidebar = value; });
    const app = createApp(global ? GlobalSettings : SchoolSettings, { layout, ...(global ? { customization: readCustomization() } : {}) });
    app.provide('aj', aj);
    app.config.globalProperties.$gettext = aj.gettext;
    app.mount(element);
    return () => { app.unmount(); stop(); };
}

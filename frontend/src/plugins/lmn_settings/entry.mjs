import { createApp } from 'vue';
import SchoolSettings from './SchoolSettings.vue';
import GlobalSettings from './GlobalSettings.vue';
import { readCustomization } from './shell.mjs';

export function mount(element, aj) {
    const global = element.dataset.view === 'global';
    const app = createApp(global ? GlobalSettings : SchoolSettings, global ? { customization: readCustomization() } : {});
    app.provide('aj', aj);
    app.config.globalProperties.$gettext = aj.gettext;
    app.mount(element);
    return () => app.unmount();
}

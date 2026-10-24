import { createApp, defineComponent, h } from 'vue';
import SchoolSettings from './SchoolSettings.vue';
import GlobalSettings from './GlobalSettings.vue';
import { useShell } from '../../shell/capability.mjs';

export function mount(element, aj) {
    const global = element.dataset.view === 'global';
    const app = createApp(defineComponent({
        setup() {
            const shell = useShell(aj);
            return () => h(global ? GlobalSettings : SchoolSettings, { layout: shell.layout, customization: shell.customization });
        },
    }));
    app.provide('aj', aj);
    app.config.globalProperties.$gettext = aj.gettext;
    app.mount(element);
    return () => { app.unmount(); };
}

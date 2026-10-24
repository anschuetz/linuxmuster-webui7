import { createApp } from 'vue';
import SchoolSwitcher from './components/SchoolSwitcher.vue';

function mountComponent(Component, element, aj) {
    const app = createApp(Component);
    app.provide('aj', aj);
    app.config.globalProperties.$gettext = aj.gettext;
    app.mount(element);
    return () => app.unmount();
}

/** Mount the change-school route with the injected backend adapter. */
export function mount(element, aj) {
    return mountComponent(SchoolSwitcher, element, aj);
}

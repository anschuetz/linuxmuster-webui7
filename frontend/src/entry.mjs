import { createApp } from 'vue';
import Demo from './components/Demo.vue';

/**
 * @param {Element} element
 * @param {import('./adapter/aj.mjs').Aj} aj
 * @returns {() => void} Unmount callback for the host lifecycle.
 */
export function mount(element, aj) {
    const app = createApp(Demo);
    app.provide('aj', aj);
    app.config.globalProperties.$gettext = aj.gettext;
    app.mount(element);
    return () => app.unmount();
}

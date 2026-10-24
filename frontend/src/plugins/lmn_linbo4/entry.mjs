import { createApp } from 'vue';
import LinboPage from './LinboPage.vue';

export function mount(element, aj) {
    const app = createApp(LinboPage);
    app.provide('aj', aj);
    app.mount(element);
    return () => app.unmount();
}

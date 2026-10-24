import { createApp } from 'vue';
import Administration from './Administration.vue';

export function mount(element, aj) {
    const app = createApp(Administration);
    app.provide('aj', aj);
    app.mount(element);
    return () => app.unmount();
}

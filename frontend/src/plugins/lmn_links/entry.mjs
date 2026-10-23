import { createApp } from 'vue';
import Links from './components/Links.vue';

/** Mount the links view using only the backend-neutral adapter. */
export function mount(element, aj) {
    const app = createApp(Links);
    app.provide('aj', aj);
    app.mount(element);
    return () => app.unmount();
}

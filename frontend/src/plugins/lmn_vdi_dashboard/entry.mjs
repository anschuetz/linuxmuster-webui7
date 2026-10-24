import { createApp } from 'vue';
import Dashboard from './Dashboard.vue';

export function mount(element, aj) {
    const app = createApp(Dashboard);
    app.provide('aj', aj);
    app.mount(element);
    return () => app.unmount();
}

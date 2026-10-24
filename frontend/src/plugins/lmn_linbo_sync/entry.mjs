import { createApp } from 'vue';
import LinboSync from './components/LinboSync.vue';
export function mount(element, aj) {
    const app = createApp(LinboSync);
    app.provide('aj', aj);
    app.mount(element);
    return () => app.unmount();
}

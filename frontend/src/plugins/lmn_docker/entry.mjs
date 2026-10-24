import { createApp } from 'vue';
import Docker from './components/Docker.vue';

export function mount(element, aj) {
    const app = createApp(Docker);
    app.provide('aj', aj);
    app.mount(element);
    return () => app.unmount();
}

import { createApp } from 'vue';
import Clients from './Clients.vue';

export function mount(element, aj) {
    const app = createApp(Clients);
    app.provide('aj', aj);
    app.mount(element);
    return () => app.unmount();
}

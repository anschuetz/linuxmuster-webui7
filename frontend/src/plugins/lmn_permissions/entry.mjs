import { createApp } from 'vue';
import Permissions from './components/Permissions.vue';

export function mount(element, aj) {
    const app = createApp(Permissions);
    app.provide('aj', aj);
    app.mount(element);
    return () => app.unmount();
}

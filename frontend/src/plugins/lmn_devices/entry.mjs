import { createApp } from 'vue';
import Devices from './Devices.vue';
export function mount(element, aj) {
    const app = createApp(Devices);
    app.provide('aj', aj);
    app.mount(element);
    return () => app.unmount();
}

import { createApp } from 'vue';
import DeviceManager from './DeviceManager.vue';
export function mount(element, aj) {
    const app = createApp(DeviceManager);
    app.provide('aj', aj);
    app.mount(element);
    return () => app.unmount();
}

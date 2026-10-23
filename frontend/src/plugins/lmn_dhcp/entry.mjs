import { createApp } from 'vue';
import Dhcp from './Dhcp.vue';
export function mount(element, aj) {
    const app = createApp(Dhcp);
    app.provide('aj', aj);
    app.mount(element);
    return () => app.unmount();
}

import { createApp } from 'vue';
import Wireguard from './components/Wireguard.vue';
export function mount(element, aj) {
    const app = createApp(Wireguard);
    app.provide('aj', aj);
    app.mount(element);
    return () => app.unmount();
}

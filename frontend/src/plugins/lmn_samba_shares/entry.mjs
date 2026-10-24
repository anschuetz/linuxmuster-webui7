import { createApp } from 'vue';
import SambaShares from './SambaShares.vue';

export function mount(element, aj) {
    const app = createApp(SambaShares);
    app.provide('aj', aj);
    app.mount(element);
    return () => app.unmount();
}

import { createApp } from 'vue';
import Quotas from './Quotas.vue';
export function mount(element, aj) {
    const app = createApp(Quotas);
    app.provide('aj', aj);
    app.mount(element);
    return () => app.unmount();
}

import { createApp } from 'vue';
import SambaDns from './components/SambaDns.vue';

export function mount(element, aj) {
    const app = createApp(SambaDns);
    app.provide('aj', aj);
    app.mount(element);
    return () => app.unmount();
}

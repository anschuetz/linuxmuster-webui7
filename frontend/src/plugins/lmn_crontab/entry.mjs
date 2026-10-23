import { createApp } from 'vue';
import Crontab from './components/Crontab.vue';

export function mount(element, aj) {
    const app = createApp(Crontab);
    app.provide('aj', aj);
    app.mount(element);
    return () => app.unmount();
}

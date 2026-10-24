import { createApp } from 'vue';
import Nextcloud from './components/Nextcloud.vue';

export function mount(element, aj) {
    const app = createApp(Nextcloud);
    app.provide('aj', aj);
    app.mount(element);
    return () => app.unmount();
}

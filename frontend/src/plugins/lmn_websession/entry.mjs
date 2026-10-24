import { createApp } from 'vue';
import Websession from './components/Websession.vue';

export function mount(element, aj) {
    const app = createApp(Websession);
    app.provide('aj', aj);
    app.mount(element);
    return () => app.unmount();
}

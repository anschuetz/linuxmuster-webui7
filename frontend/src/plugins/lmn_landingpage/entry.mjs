import { createApp } from 'vue';
import Landingpage from './Landingpage.vue';
export function mount(element, aj) {
    const app = createApp(Landingpage);
    app.provide('aj', aj);
    app.mount(element);
    return () => app.unmount();
}

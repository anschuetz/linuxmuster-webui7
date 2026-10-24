import { createApp } from 'vue';
import LinboPage from './LinboPage.vue';

// Buildable local harness entry; intentionally absent from plugin.yml until part 5.
export function mount(element, aj) {
    const app = createApp(LinboPage);
    app.provide('aj', aj);
    app.mount(element);
    return () => app.unmount();
}

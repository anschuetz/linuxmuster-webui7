import { createApp } from 'vue';
import SessionsList from './SessionsList.vue';
import SessionPage from './SessionPage.vue';
export { getSessionStore } from './sessionStore.mjs';

// Fixture-mount only until all five parts are ready; plugin.yml stays Angular.
export function mount(element, aj) {
    const app = createApp(SessionsList); app.provide('aj', aj); app.mount(element);
    return () => app.unmount();
}

// Detail is exposed only for the isolated oracle mount, never the Angular route.
export function mountDetail(element, aj) {
    const app = createApp(SessionPage); app.provide('aj', aj); app.mount(element);
    return () => app.unmount();
}

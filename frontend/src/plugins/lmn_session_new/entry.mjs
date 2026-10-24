import { createApp } from 'vue';
import SessionsList from './SessionsList.vue';
export { getSessionStore } from './sessionStore.mjs';

// Fixture-mount only until all five parts are ready; plugin.yml stays Angular.
export function mount(element, aj) {
    const app = createApp(SessionsList); app.provide('aj', aj); app.mount(element);
    return () => app.unmount();
}

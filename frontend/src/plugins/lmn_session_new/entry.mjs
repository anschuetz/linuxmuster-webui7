import { createApp } from 'vue';
import SessionsList from './SessionsList.vue';
import SessionPage from './SessionPage.vue';
export { getSessionStore } from './sessionStore.mjs';

// Angular owns both routes; the entry selects the corresponding Vue page.
export function mount(element, aj) {
    const app = createApp(window.location.pathname.replace(/\/$/, '') === '/view/lmn/session' ? SessionPage : SessionsList); app.provide('aj', aj); app.mount(element);
    return () => app.unmount();
}

// Retained for the preceding isolated part oracles.
export function mountDetail(element, aj) {
    const app = createApp(SessionPage); app.provide('aj', aj); app.mount(element);
    return () => app.unmount();
}

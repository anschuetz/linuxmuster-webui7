import { createApp } from 'vue';
import SessionsList from './SessionsList.vue';
import SessionPage from './SessionPage.vue';
export { getSessionStore, resetSession } from './sessionStore.mjs';

// The native host supplies a view; the retained Angular host uses the URL.
export function mount(element, aj) {
    const app = createApp((element.dataset.view ? element.dataset.view === 'detail' : window.location.pathname.replace(/\/$/, '').endsWith('/view/lmn/session')) ? SessionPage : SessionsList); app.provide('aj', aj); app.mount(element);
    return () => app.unmount();
}

// Retained for the preceding isolated part oracles.
export function mountDetail(element, aj) {
    const app = createApp(SessionPage); app.provide('aj', aj); app.mount(element);
    return () => app.unmount();
}

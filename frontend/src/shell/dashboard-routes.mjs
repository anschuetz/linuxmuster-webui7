import { createApp } from 'vue';
import Dashboard from './Dashboard.vue';
import SessionList from './SessionList.vue';
import { createDashboard } from './dashboard.mjs';
import { createSessionList } from './session-list.mjs';

/** Stock dashboard/session routes with one cleanup function per mount. */
export function mountDashboardRoute(element, { aj, path, initialConfig, customization }) {
    let component, model;
    if (path === '/view/dashboard') { component = Dashboard; model = createDashboard(aj, { customization }); }
    else if (path === '/view/session_list') { component = SessionList; model = createSessionList(aj, initialConfig); }
    else throw new Error('Unknown dashboard route');
    const app = createApp(component, { model }); app.provide('aj', aj); app.mount(element); void model.start();
    return () => app.unmount();
}

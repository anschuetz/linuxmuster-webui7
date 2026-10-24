import { pluginResource } from './plugin-resources.mjs';
import { createRouter, createWebHistory } from 'vue-router';

const plugin = (path, name, attrs = {}) => ({ path, component: {}, meta: { kind: 'plugin', sourcePlugin: pluginResource(name).id, plugin: name.replace(/\W/g, '_'), attrs } });
const stock = (path, kind) => ({ path, component: {}, meta: { kind } });
// Explicit register replaces ngRoute's plugin-module registration. Paths match the shipped routes.
export const shellRoutes = [
    { path: '/', redirect: '/view/lmn/landingpage' },
    { path: '/view/', redirect: '/view/lmn/landingpage' },
    stock('/view/login/:mode', 'auth'), stock('/view/login/:mode/:nextPage(.*)*', 'auth'),
    stock('/view/reset_password_send', 'auth'), stock('/view/reset_password/:serial', 'auth'),
    stock('/view/ui-test', 'ui-test'), stock('/view/totp', 'auth'),
    ...['dashboard', 'session_list', 'settings', 'plugins'].map(name => stock(`/view/${name}`, name)),
    ...[
        ['links', 'links'], ['quotas', 'quotas'], ['wireguard', 'wireguard'], ['devices', 'devices'],
        ['change-password', 'auth'], ['websession', 'websession'], ['landingpage', 'landingpage'],
        ['home', 'samba_shares'], ['docker', 'docker'], ['linbo_sync', 'linbo_sync'],
        ['nextcloud', 'nextcloud'], ['linbo4', 'linbo4'], ['dhcp', 'dhcp'],
        ['change-school', 'common'], ['groupmembership', 'groupmembership'],
        ['device-manager', 'device-manager'], ['samba_dns', 'samba_dns'], ['crontab', 'crontab'],
    ].map(([path, name]) => plugin(`/view/lmn/${path}`, `lmn_${name}`)),
    stock('/view/lmn/quotas-disabled', 'quotas-disabled'),
    ...['students', 'teachers', 'staff', 'parents', 'extra-students', 'extra-courses', 'globaladmins', 'schooladmins', 'listmanagement', 'print-passwords']
        .map(view => plugin(`/view/lmn/users/${view}`, 'lmn_users', { view })),
    ...['welcome', 'school', 'account', 'externalservices', 'summary', 'done', 'setup']
        .map(step => plugin(`/view/lmn/init/${step}`, 'lmn_setup_wizard', { 'data-step': step })),
    plugin('/view/lmn_clients', 'lmn_clients'), plugin('/view/permissions', 'lmn_permissions'),
    plugin('/view/lmn_vdi_dashboard', 'lmn_vdi_dashboard'), plugin('/view/lmn_vdi_administration', 'lmn_vdi_administration'),
    plugin('/view/lmn/sessionsList', 'lmn_session_new', { 'data-view': 'list' }),
    plugin('/view/lmn/session', 'lmn_session_new', { 'data-view': 'detail' }),
    plugin('/view/lmn/schoolsettings', 'lmn_settings', { 'data-view': 'school' }),
    plugin('/view/lmn/globalsettings', 'lmn_settings', { 'data-view': 'global' }),
];

export function createShellRouter({ prefix = '', history = createWebHistory(prefix || '/'), plugins, onRoute }) {
    const guards = new Set();
    const router = createRouter({ history, routes: [...shellRoutes.filter(route => !plugins || !route.meta?.sourcePlugin || plugins.includes(route.meta.sourcePlugin)), stock('/:pathMatch(.*)*', '404')] });
    const removeGuard = router.beforeEach(() => { for (const guard of guards) if (guard() === false) return false; });
    const removeAfter = router.afterEach((to, from, failure) => { if (!failure) onRoute?.(to, from); });
    const stripPrefix = path => prefix && (path === prefix || path.startsWith(`${prefix}/`)) ? path.slice(prefix.length) || '/' : path;
    return {
        router, navigate: (path, options) => router[options?.replace ? 'replace' : 'push'](stripPrefix(path)),
        guardLeave(fn) { guards.add(fn); return () => guards.delete(fn); },
        clearGuards: () => guards.clear(), reload: () => onRoute?.(router.currentRoute.value, router.currentRoute.value),
        dispose() { removeGuard(); removeAfter(); guards.clear(); history.destroy(); },
    };
}

// @vitest-environment node
import { createServer } from 'node:http';
import { once } from 'node:events';
import { expect, it } from 'vitest';
import { createSession } from './session.mjs';
import { createDashboard } from './dashboard.mjs';
import { createSessionList } from './session-list.mjs';

it('uses prefixed real HTTP with fixture-only writes and enforces UID 0 session data for all four roles', async () => {
    let uid = 0, failure = 0;
    let config = { other: 'keep', dashboard: { tabs: [{ name: 'Admin', width: 2,
        widgetsLeft: [{ id: 's', typeId: 'sessions' }, { id: 'd', typeId: 'datetime', config: { format: '%H:%M' } }], widgetsRight: [] }] } };
    const requests = [], notices = [], dialogs = [];
    const rows = { synthetic: { identity: 'fixture-admin', timestamp: 1700000000, client_info: { address: '192.0.2.3' } } };
    const server = createServer(async (req, res) => {
        const chunks = []; for await (const chunk of req) chunks.push(chunk);
        const body = Buffer.concat(chunks).toString(), data = body ? JSON.parse(body) : undefined;
        requests.push([req.method, req.url, data]); res.setHeader('Content-Type', 'application/json');
        let response;
        switch (req.url) {
            case '/panel/api/core/identity': response = { identity: { user: `fixture-${uid}`, effective: uid, profile: {} } }; break;
            case '/panel/api/core/user-config':
                if (req.method === 'POST') config = data;
                response = config; break;
            case '/panel/api/dashboard/widgets': response = [{ id: 'sessions', name: 'Sessions' }, { id: 'datetime', name: 'Date Time', config_template: '/fixture' }]; break;
            case '/panel/api/dashboard/widgets-values':
                if (failure) { res.statusCode = failure; response = 'fixture failure'; }
                else response = data.map(w => ({ id: w.id, data: w.typeId === 'sessions' ? true : '17:30' }));
                break;
            case '/panel/api/session_list/sessions':
                if (uid !== 0) { res.statusCode = 403; response = ''; } else response = rows;
                break;
            default: res.statusCode = 404; response = 'unexpected fixture request';
        }
        res.end(JSON.stringify(response));
    });
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}`;
    const session = createSession({ prefix: '/panel', path: () => '/panel/view/dashboard', navigate() {}, gettext: x => x,
        fetch: (url, options) => fetch(base + url, options),
        notify: { error: message => notices.push(message) }, messagebox: { show: options => { dialogs.push(options); return Promise.resolve(); } } });
    const aj = { http: session.http, identity: session.identity, gettext: x => x, pageTitle: { set() {} } };
    const owners = [];
    try {
        await session.identity.refresh(); expect(aj.identity.isSuperuser).toBe(true);
        const dashboard = createDashboard(aj); owners.push(dashboard); await dashboard.start(); await dashboard.refresh();
        expect(dashboard.state.values.d).toBe('17:30'); expect(dashboard.state.sessions.s).toEqual(rows);
        dashboard.configureWidget('d'); dashboard.updateWidgetConfig('format', '%d.%m.%Y'); await dashboard.saveWidgetConfig();
        expect(config.other).toBe('keep'); expect(config.dashboard.tabs[0].widgetsLeft[1].config).toEqual({ format: '%d.%m.%Y' });
        failure = 500; await dashboard.refresh(); expect(dialogs).toHaveLength(1); expect(dashboard.state.values.d).toBe('17:30'); failure = 0;
        const list = createSessionList(aj, { session_max_time: 3600 }); owners.push(list); await list.start(); expect(list.state.sessions).toEqual(rows);
        // Synthetic global-admin, school-admin and teacher are all non-UID-0 to this endpoint.
        for (uid of [1000, 1001, 1002]) {
            await session.identity.refresh(); expect(aj.identity.isSuperuser).toBe(false);
            const denied = createSessionList(aj); owners.push(denied); await denied.start(); expect(denied.state.sessions).toBeUndefined();
            const deniedWidget = createDashboard(aj); owners.push(deniedWidget); await deniedWidget.start(); await deniedWidget.refresh(); expect(deniedWidget.state.sessions.s).toBeUndefined();
            denied.dispose(); deniedWidget.dispose();
        }
        expect(notices).toHaveLength(6);
        expect(requests.filter(([method]) => method === 'POST').every(([,url]) => ['/panel/api/core/user-config','/panel/api/dashboard/widgets-values'].includes(url))).toBe(true);
        expect(requests.find(([,url]) => url.endsWith('widgets-values'))[2]).toEqual([
            { id: 's', typeId: 'sessions', config: {} }, { id: 'd', typeId: 'datetime', config: { format: '%H:%M' } },
        ]);
    } finally {
        owners.forEach(owner => owner.dispose()); session.dispose(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    }
});

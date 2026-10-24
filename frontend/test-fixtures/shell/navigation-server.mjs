import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { result } from '../../e2e/fixtures/users_3.mjs';
import { responses } from '../../src/plugins/lmn_settings/fixtures.test-data.mjs';

// The fixtures read the shipped role grants. They do not emulate aj.auth or LDAP.
const grants = readFileSync('../usr/lib/linuxmuster-webui/plugins/lmn_users/permissions.yml', 'utf8');
export function permission(role, key) {
    const section = grants.split(`${role}:\n`)[1]?.split(/\n[^-\s]/)[0] ?? '';
    return section.includes(`- '${key}: true'`);
}
export async function navigationServer(role, { holdCheck = false } = {}) {
    const requests = [], held = [], config = responses();
    const all = ['students', 'globaladmins'].map(view => ({ id: view, name: view === 'students' ? 'Students' : 'Global-Admins',
        icon: 'user', url: `/view/lmn/users/${view}`, weight: view === 'students' ? 15 : 21, children: [] }));
    const server = createServer(async (req, res) => {
        const chunks = []; for await (const chunk of req) chunks.push(chunk);
        const body = Buffer.concat(chunks).toString(), data = body ? JSON.parse(body) : undefined;
        requests.push([req.method, req.url, data]); res.setHeader('Content-Type', 'application/json');
        const url = decodeURI(req.url.slice('/panel'.length));
        let response = null;
        if (url === '/api/core/identity') response = { identity: { user: `fixture-${role}`, effective: role === 'globaladministrator' ? 0 : 1000,
            profile: { school: 'default-school', activeSchool: 'default-school', school_show: role !== 'student' } }, machine: { name: 'fixture-server' } };
        else if (url === '/api/core/sidebar') response = { sidebar: { children: [{ name: 'User Management', children: all.filter(item => permission(role, `sidebar:view:${item.url}`)) }] } };
        else if (url.startsWith('/api/core/navbox/')) response = all.filter(item => item.name.toLowerCase().includes(url.split('/').at(-1).trim().toLowerCase()))
            .map(item => ({ title: item.name, url: item.url, icon: item.icon }));
        else if (url === '/api/lmn/users/students' || url === '/api/lmn/users/lists/check' || url === '/api/lmn/users/lists/apply') {
            const key = url.endsWith('students') ? 'lm:users:students:read' : url.endsWith('check') ? 'lm:users:check' : 'lm:users:apply';
            if (!permission(role, key)) { res.statusCode = 403; response = 'fixture denied'; }
            else if (url.endsWith('check')) {
                if (holdCheck) { held.push(res); return; }
                response = result();
            } else response = [];
        } else if (url.startsWith('/api/lmn/log')) response = 'fixture final log\n';
        else if (url in config) response = config[url];
        else { res.statusCode = 404; response = 'unexpected fixture endpoint'; }
        res.end(JSON.stringify(response));
    });
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}`;
    return { requests, fetch: (url, cfg) => fetch(base + url, cfg),
        releaseCheck(data) { held.splice(0).forEach(res => res.end(JSON.stringify(data))); },
        async close() { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); },
    };
}

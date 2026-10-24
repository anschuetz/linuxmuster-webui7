// Identical synthetic boundaries for both complete shells; no write reaches the VM.
export async function shellFixtures(page, role, { authenticated = false, prefix = '' } = {}) {
    const root = ['global-admin', 'school-admin'].includes(role.name);
    const s = { user: authenticated ? role.login : null, nonce: 'fixture-nonce', attempts: 0, requests: [], school: 'school-a', coreWrites: [] };
    const profile = () => ({ schoolname: s.school, activeSchool: s.school, school_show: true, permissions: {} });
    const identity = () => ({ identity: { user: s.user, effective: root ? 0 : 1000, profile: profile() }, machine: { name: 'fixture-server', hostname: 'fixture.test' }, color: 'blue' });
    const item = (name, url) => ({ name, url, icon: 'cog', children: [] });
    const sidebar = { children: [{ name: 'Fixtures', children: [item('Links', '/view/lmn/links'), item('Dashboard', '/view/dashboard'), item('Schools', '/view/lmn/change-school')] }] };
    if (prefix) await page.route(`**${prefix}/**`, async route => {
        const url = new URL(route.request().url()); url.pathname = url.pathname.slice(prefix.length);
        const response = await route.fetch({ url: url.href });
        if (route.request().resourceType() === 'document') {
            const text = (await response.text()).replace("prefix: ''", `prefix: '${prefix}'`);
            return route.fulfill({ response, body: text });
        }
        return route.fulfill({ response });
    });
    await page.route('**/', route => {
        if (route.request().resourceType() === 'document' && new URL(route.request().url()).pathname === '/') return route.fulfill({ status: 302, headers: { location: `${prefix}/view/` } });
        return route.fallback();
    });
    // Fixtures do not connect a synthetic identity to a real server socket.
    await page.route('**/socket.io/**', route => route.abort());
    await page.route('**/resources/all.locale.js?*', route => route.fulfill({ json: {} }));
    await page.route('**/api/**', async route => {
        const req = route.request(), path = new URL(req.url()).pathname.replace(prefix, ''), method = req.method();
        const payload = req.postData() && req.headers()['content-type']?.includes('application/json') ? req.postDataJSON() : undefined;
        // Record only path/method; authentication fields never enter test reports.
        s.requests.push([method, path]);
        let data;
        if (path === '/api/core/identity') data = identity();
        else if (path === '/api/core/sidebar') data = { sidebar };
        else if (path === '/api/core/session-time') data = 3600;
        else if (path === '/api/core/auth') {
            if (payload.mode === 'sudo') { s.user = payload.username; s.sudo = true; data = { success: true }; }
            else if (payload.mode === 'normal') data = { success: true, totp: true, totp_random: s.nonce };
            else {
                s.attempts++;
                if (payload.password !== `123456#${s.nonce}`) data = { success: false, error: 'fixture-code' };
                else { s.user = role.login; data = { success: true }; }
            }
        } else if (path === '/api/core/logout') { s.user = null; data = {}; }
        else if (path === '/api/core/languages') data = ['en'];
        else if (path === '/api/lmn/setup-wizard/setup') data = {};
        else if (path === '/api/lmn/setup-wizard/is-configured') data = true;
        else if (path === '/api/core/tasks/request-update') data = {};
        else if (path === '/api/core/user-config') data = { dashboard: { tabs: [{ name: 'Fixture tab', width: 2, widgetsLeft: [], widgetsRight: [] }] } };
        else if (path === '/api/dashboard/widgets' || path === '/api/dashboard/widgets-values') data = [];
        else if (path === '/api/session_list/sessions') {
            if (!root) return route.fulfill({ status: 403, json: 'fixture denied' }); data = {};
        } else if (path === '/api/core/totps') data = [];
        else if (path === '/api/core/config') {
            if (!root) return route.fulfill({ status: 403, json: 'fixture denied' });
            if (method === 'POST') { s.coreConfig = structuredClone(payload); s.coreWrites.push(structuredClone(payload)); }
            s.coreConfig ??= { language: 'en', name: 'fixture-server', color: 'blue', session_max_time: 3600,
                ssl: { certificate: '/tmp/fixture.pem' }, auth: { provider: 'fixture' }, trusted_proxies: ['192.0.2.1'], bind: { mode: 'tcp', host: '0.0.0.0', port: 443 } };
            data = s.coreConfig;
        } else if (path === '/api/passwds') data = [{ name: 'root' }];
        else if (path === '/api/core/authentication-providers') data = [{ id: 'fixture', name: 'Fixture' }];
        else if (path === '/api/core/smtp-config') data = {};
        else if (path === '/api/core/tfa-config') data = {};
        else if (path === '/api/plugins/installed' || path === '/api/plugins/pypi/ajenti-plugins') data = [];
        else if (path === '/api/plugins/pypi/installed') data = {};
        else if (path === '/api/plugins/core/check-upgrade') data = '2.2.17';
        else if (path === '/api/lmn/display_options') data = {};
        else if (/^\/api\/lmn\/users\/[^/]+\/customfields$/.test(path)) data = [];
        else if (path.startsWith('/api/lmn/quota/user/')) data = {};
        else if (path.startsWith('/api/filesystem/list/')) data = { items: [], parent: null };
        else if (path === '/api/lmn/activeschool') data = s.school;
        else if (path === '/api/lmn/list-schools') data = [{ school: 'school-b', schoolname: 'Other fixture school' }];
        else if (path === '/api/lmn/get-schoolname') data = s.school;
        else if (path === '/api/lmn/change-school') { s.school = payload.school; data = true; }
        else if (path === '/api/p112/expired') { s.user = null; return route.fulfill({ status: 401, json: 'fixture expired' }); }
        else if (path === '/api/master/check_password_serial') return route.fulfill({ status: 400, json: 'fixture invalid serial' });
        else if (path.startsWith('/api/lmn/landingpage') || path.startsWith('/api/lmn/links')) data = [];
        else { s.unexpected = [...s.unexpected || [], [method, path]]; return route.abort(); }
        return route.fulfill({ json: data });
    });
    return s;
}
export async function go(page, path) {
    await page.evaluate(path => { const a = document.createElement('a'); a.href = path; document.body.append(a); a.click(); a.remove(); }, path);
}
export async function fixturePlugin(page) {
    await page.evaluate(() => {
        window.__p112 = { mounts: 0, stops: 0, ticks: 0, dirty: false };
        window.LmnVue_lmn_links = { mount(el, aj) {
            const s = window.__p112; s.aj = aj; s.mounts++;
            el.innerHTML = '<h2>Route fixture</h2><button class="fixture-message">Message</button><button class="fixture-modal">Modal</button>';
            const timer = setInterval(() => s.ticks++, 100);
            const off = aj.guardLeave(() => !s.dirty);
            const offPush = aj.push?.subscribe('p112', () => {});
            el.querySelector('.fixture-message').onclick = () => { void aj.messagebox.show({ title: 'Fixture dialog', positive: 'OK' }).catch(() => {}); };
            el.querySelector('.fixture-modal').onclick = () => { void aj.modal.open({ render() { return null; } }).catch(() => {}); };
            return () => { s.stops++; clearInterval(timer); off(); offPush?.(); };
        } };
    });
}

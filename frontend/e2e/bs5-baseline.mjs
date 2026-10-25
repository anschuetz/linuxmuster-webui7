/** P138. Run ONLY after the coordinator has read and approved this file.
 * ego-browser nodejs -e 'await (await import("file:///ABS/FORK/frontend/e2e/bs5-baseline.mjs")).run(["--out","/ABS/logs/bs5-vorher","--role","global-admin"])'
 * One invocation per role; --only accepts comma-separated page IDs. Existing PNGs resume.
 * node frontend/e2e/bs5-baseline.mjs --generate / --dry-run (no browser).
 * Only local runtime locale/instrumentation changes; no config saves or response fixtures.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, access, open, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const roles = ['global-admin', 'pgmadmin', 'zem', 'serdarje'];
const viewports = [[1440, 900], [768, 1024], [390, 844]];
const safeState = (id, open, close, ready) => ({ id, open, close, ready });
const tabStates = count => Array.from({ length: count }, (_, i) => safeState(`tab-${i + 1}`, `.shell-content .nav-tabs > li:nth-child(${i + 1}) > a`));
const specialStates = {
    '/view/lmn/landingpage': [safeState('profile', '.profile-button', '.profile-button', '.navbar .dropdown-menu'),
        safeState('mobile-navigation', '.mobile-navigation', '.mobile-navigation', '.overlay-sidebar')],
    '/view/lmn/linbo4': [...tabStates(2), safeState('create-menu', '[data-action="create"]', '[data-action="create"]', '.dropdown-menu')],
    '/view/lmn/quotas': tabStates(6),
    '/view/lmn/globalsettings': tabStates(8).filter(s => !['tab-5', 'tab-6'].includes(s.id)),
    '/view/lmn/schoolsettings': tabStates(7),
    '/view/lmn_clients': tabStates(2),
    '/view/lmn_vdi_administration': tabStates(2),
    '/view/lmn/users/listmanagement': tabStates(5),
};
const exclusions = {
    '/view/lmn/session': 'SessionPage mount invokes createWorkingDirectory even before redirect; detail/files/exam require a write fixture.',
    '/view/lmn/init/setup': 'Mount immediately starts provisioning; wizard write step is excluded.',
    '/view/reset_password/:serial': 'A valid reset serial requires sending mail; excluded. Invalid synthetic serial is read-only.',
};
const omittedStates = [
    'No save/send/delete/apply/import/upload/provision/restart/lock/password or membership action.',
    'TOTP add/QR/key generation and global settings API-key/2FA tabs excluded (secrets).',
    'Wizard Next/Start/Close excluded: writes setup/provision/restart; only direct read-only forms.',
    'Data-dependent dialogs without an existing fixture/control are explicitly not testable; never fabricate data.',
    'No certificate generation, check/apply results or print-passwords submission.',
];
const routerHash = () => createHash('sha256').update(readFileSync(new URL('../src/shell/router.mjs', import.meta.url))).digest('hex');
export function createManifest(shellRoutes) {
    const pages = shellRoutes.flatMap(route => {
        const pattern = route.path;
        const urls = pattern.includes(':mode') ? [pattern.replace(':mode', 'normal').replace('/:nextPage(.*)*', '/view/lmn/landingpage'),
            pattern.replace(':mode', 'sudo:global-admin').replace('/:nextPage(.*)*', '/view/lmn/landingpage')]
            : [pattern.replace(':serial', 'p138-invalid-no-mail')];
        return urls.map(url => {
            let states = [{ id: 'standard' }, ...(specialStates[url] ?? [])];
            if (/\/users\/(students|teachers|staff|parents)$/.test(url)) states = [...states,
                safeState('sort-menu', '[data-action="sort-menu"]', '[data-action="sort-menu"]', '.dropdown-menu'),
                safeState('rows-menu', '[data-action="rows-menu"]', '[data-action="rows-menu"]', '.dropdown-menu')];
            if (/\/users\/(globaladmins|schooladmins)$/.test(url)) states = [...states,
                safeState('add-admin-dialog', '[data-action="add"]', '.modal [data-action="cancel"]', '.modal'),
                safeState('rows-menu', '[data-action="rows"]', '[data-action="rows"]', '.dropdown-menu')];
            return { id: url.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, ''), route: pattern, url,
                plugin: route.meta?.sourcePlugin ?? 'core', attrs: route.meta?.attrs ?? {}, roles,
                access: 'Observe direct navigation for every role; record actual denial, never infer from sidebar.',
                redirect: route.redirect ?? null, anonymous: route.meta?.kind === 'auth' && url !== '/view/totp',
                languages: route.meta?.kind === 'auth' || route.meta?.sourcePlugin === 'lmn_auth' || ['/', '/view/lmn/landingpage', '/view/settings', '/view/lmn/globalsettings', '/view/lmn/schoolsettings'].includes(url) ? ['de', 'en'] : ['de'],
                states, viewports, excluded: ['/view/lmn/session', '/view/lmn/init/setup'].includes(url),
                reason: exclusions[pattern] ?? null, omittedStates };
        });
    });
    return { version: 1, source: 'frontend/src/shell/router.mjs:shellRoutes', routerSha256: routerHash(), baseline: '0ab8434efcb7b9ec690b00f43e8fa93bd45b1b64',
        fixture: 'Satz E / E1-bereit / default-school / synthetic appliance accounts / no projects', roles, viewports,
        browsers: 'Capture: installed Ego Lite Chromium (version recorded per run). Target Chrome/Edge/Safari current + Firefox ESR; other engines not exercised by A0.',
        pages: [...pages, ...[
            { route: '404', url: '/view/p138-nonexistent', excluded: false, reason: null },
            { route: 'configuration-error', url: '/view/lmn/init/welcome', excluded: true, reason: 'Requires failing core config response; no real outage or response mock introduced.' },
        ].map(p => ({ ...pages[0], ...p, id: p.route, redirect: null, anonymous: false, states: [{ id: 'standard' }], languages: ['de'] }))] };
}
export function validateManifest(manifest, routes) {
    if (manifest.routerSha256 !== routerHash() || (routes && JSON.stringify(manifest) !== JSON.stringify(createManifest(routes)))) throw new Error('Manifest drift: regenerate and review before running.');
    if (new Set(manifest.pages.map(p => p.id)).size !== manifest.pages.length) throw new Error('Duplicate page ID');
    for (const p of manifest.pages) {
        if (/:serial|:mode|:nextPage/.test(p.url) || !p.url.startsWith('/')) throw new Error('Unresolved route');
        for (const s of p.states) if (s.open && !s.close && !s.id.startsWith('tab-')) throw new Error('Missing close action');
    }
}
export function casesFor(manifest, { role, only } = {}) {
    if (!roles.includes(role)) throw new Error('Use --role global-admin|pgmadmin|zem|serdarje');
    const ids = only?.split(',');
    if (ids?.some(id => !manifest.pages.some(p => p.id === id))) throw new Error('Unknown --only page ID');
    return manifest.pages.filter(p => !ids || ids.includes(p.id)).flatMap(p => p.languages.flatMap(language =>
        p.states.flatMap(state => p.viewports.map(viewport => ({ ...p, language, state, viewport, role,
            key: `${role}/${p.id}-${language}-${state.id}-${viewport.join('x')}` })))));
}
function options(args) {
    const result = {};
    for (let i = 0; i < args.length; i += 2) {
        if (!['--out', '--role', '--only'].includes(args[i]) || !args[i + 1]) throw new Error('Expected --out, --role, --only with values');
        result[args[i].slice(2)] = args[i + 1];
    }
    if (!result.out?.startsWith('/')) throw new Error('--out must be absolute');
    return result;
}

// Installed before shell bootstrap: keep the real owner for runtime-only locale selection;
// trace pending read requests and reject accidental write requests (no response mocking).
export function isAllowedSmbList({ method, path, body, user, shareUser, sharePaths = [] }) {
    if (method !== 'POST' || path !== '/api/lmn/smbclient/list' || !user || user !== shareUser
        || !body || Object.keys(body).length !== 1 || typeof body.path !== 'string') return false;
    const normalized = value => value.replaceAll('\\', '/').replace(/\/+$/, '');
    const target = normalized(body.path);
    if (target.split('/').some(part => part === '.' || part === '..')) return false;
    return sharePaths.some(path => typeof path === 'string' && (target === normalized(path) || target.startsWith(normalized(path) + '/')));
}
export function isAllowedSchoolName({ method, path, body, user, schoolUser, activeSchool }) {
    return method === 'POST' && path === '/api/lmn/get-schoolname' && !!user && user === schoolUser
        && !!body && Object.keys(body).length === 1 && typeof body.school === 'string'
        && body.school.length > 0 && body.school === activeSchool;
}
function instrument(isAllowedSmbList, isAllowedSchoolName) {
    let shell;
    Object.defineProperty(window, 'LmnVueShell', { configurable: true, get: () => shell, set(value) {
        shell = { ...value, mountShell(...args) { const owner = value.mountShell(...args); window.__bs5Owner = owner; return owner; } };
    } });
    window.__bs5 = { pending: 0, last: Date.now(), failures: [], blocked: [] };
    const original = window.fetch.bind(window);
    const readPosts = ['/api/core/auth', '/api/core/logout', '/api/core/tasks/request-update', '/api/dashboard/widgets-values',
        '/api/master/check_password_serial', '/api/plugins/core/check-upgrade', '/api/lmn/device-manager/getdevices', '/api/lmn/schoolsettings/determine-encoding'];
    window.fetch = async (url, opts = {}) => {
        const path = new URL(url, location.href).pathname, method = (opts.method ?? 'GET').toUpperCase(), state = window.__bs5;
        // Wireguard's proxy uses POST even for reads; allow only these two list/status URLs, never restart/config/key endpoints.
        const payload = method === 'POST' && ['/api/lmn/wireguard', '/api/lmn/smbclient/list', '/api/lmn/get-schoolname'].includes(path) ? JSON.parse(opts.body ?? '{}') : null;
        const proxy = path === '/api/lmn/wireguard' ? payload : null;
        const schoolRead = isAllowedSchoolName({ method, path, body: payload, user: window.__bs5Owner?.session.identity.user, schoolUser: state.schoolUser, activeSchool: state.activeSchool });
        const smbRead = isAllowedSmbList({ method, path, body: payload, user: window.__bs5Owner?.session.identity.user, shareUser: state.shareUser, sharePaths: state.sharePaths });
        const proxyRead = proxy?.method === 'GET' && ['/api/wireguard/peers', '/api/wireguard/peers/status'].includes(proxy.url);
        if (!['GET', 'HEAD'].includes(method) && !readPosts.includes(path) && !proxyRead && !smbRead && !schoolRead) {
            state.blocked.push({ path, method }); throw new Error('P138 read-only guard blocked ' + method + ' ' + path);
        }
        // Long-lived task poll is not page loading; never log auth payloads or response bodies.
        const tracked = !path.includes('/api/core/tasks/');
        if (tracked) state.pending++;
        try {
            const response = await original(url, opts);
            if (tracked && !response.ok) state.failures.push({ path, status: response.status });
            const user = window.__bs5Owner?.session.identity.user;
            if (response.ok && user && method === 'GET' && path === `/api/lmn/smbclient/shares/${user}`) {
                const shares = await response.clone().json();
                state.shareUser = user; state.sharePaths = Array.isArray(shares) ? shares.filter(s => s.name != null).map(s => s.path) : [];
            }
            if (response.ok && user && method === 'GET' && path === '/api/lmn/activeschool') {
                state.schoolUser = user; state.activeSchool = await response.clone().json();
            }
            return response;
        } finally { if (tracked) { state.pending--; state.last = Date.now(); } }
    };
}
async function exists(path) {
    try { await access(path); return true; }
    catch (error) { if (error.code !== 'ENOENT') throw error; return false; }
}
async function navigate(page, url) {
    // Invalidate only our instrumentation handle so a wait cannot pass on the old document.
    await page.evaluate(() => { window.__bs5Owner = undefined; });
    await page.goto(url);
    await settle(page);
}
export async function run(args, { resumeSpace, spaceName } = {}) {
    const opts = options(args);
    await mkdir(opts.out, { recursive: true });
    // A terminated CLI client can leave ego's script running: never start overlapping loops.
    const path = resolve(opts.out, 'capture.lock'), lock = await open(path, 'wx');
    try { return await capture(opts, resumeSpace, spaceName); }
    finally { await lock.close(); await unlink(path); }
}
async function settle(page) {
    await page.waitForFunction(() => window.__bs5Owner?.aj && window.__bs5?.pending === 0 && Date.now() - window.__bs5.last > 400,
        undefined, { timeout: 20000 });
    await page.evaluate(async () => { await document.fonts.ready; });
}
async function locale(page, language) {
    await page.evaluate(async lang => { await window.__bs5Owner.aj.locale.setLanguage(lang); }, language);
    await settle(page);
}
async function visible(page, selector) {
    return page.evaluate(s => [...document.querySelectorAll(s)].filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').length, selector);
}
async function click(page, selector) {
    // Ground truth from current DOM, then choose the unique visible target; never blind clicks.
    const matches = await page.evaluate(s => [...document.querySelectorAll(s)].filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden')
        .map(e => ({ tag: e.tagName, text: e.textContent.trim().slice(0, 80), disabled: e.disabled })), selector);
    if (matches.length !== 1 || matches[0].disabled) throw new Error(`Control unavailable/ambiguous: ${selector}`);
    await page.click(`loc=css:${selector}`, { label: 'Open baseline view state' });
    await settle(page);
}
async function observation(page) {
    return page.evaluate(() => {
        const visible = e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden';
        const content = document.querySelector('.shell-content') ?? document.body;
        const text = content.innerText;
        return { url: location.pathname, user: window.__bs5Owner?.session.identity.user ?? null, failures: window.__bs5.failures, blocked: window.__bs5.blocked,
            denied: /Superuser access required|Security error|Permission denied|Access denied|Forbidden|Zugriff verweigert|Sicherheitsfehler|Keine Berechtigung/i.test(document.body.innerText),
            loading: [...document.querySelectorAll('.progress-spinner,[role="progressbar"]:not(.progress-bar),.fa-spin')].some(visible),
            empty: !text.trim() && !content.querySelector('input,button,table,iframe,.alert'), notFound: /Page not found|Seite nicht gefunden/i.test(text) };
    });
}
export async function observeAfterOpen(open, read) {
    await open();
    const observed = await read();
    return { observed, denied: observed.denied || observed.failures.some(f => f.status === 403) };
}
export function validateObservation(c, observed) {
    if (!c.anonymous && observed.user !== c.role) throw new Error(`Capture integrity: identity ${observed.user} instead of ${c.role}`);
    if (observed.url !== (c.redirect ?? c.url)) throw new Error(`Capture integrity: route ${observed.url} instead of ${c.redirect ?? c.url}`);
}
export function prepareScreenshot() {
    const style = document.createElement('style'); style.dataset.bs5 = '';
    style.textContent = '*{animation:none!important;transition:none!important;caret-color:transparent!important}.sessiontime,time,[data-countdown]{visibility:hidden!important}';
    document.head.append(style);
    // Mask actual secrets without changing application state; no TOTP creation is attempted.
    const labels = [window.__bs5Owner.aj.gettext('Uptime'), 'Date Time'];
    const clocks = [...document.querySelectorAll('.widget-header')].filter(h => labels.includes(h.textContent.trim()))
        .map(h => h.parentElement.querySelector('.widget-value')).filter(Boolean);
    for (const el of [...document.querySelectorAll('input[name*="secret"],img[alt*="QR"],.auth-dialog input[name="code"]'), ...clocks]) {
        el.dataset.bs5Visibility = el.style.visibility; el.style.visibility = 'hidden';
    }
}
async function screenshot(page, path) {
    await page.evaluate(prepareScreenshot);
    try { await page.screenshot({ path }); }
    finally {
        await page.evaluate(() => {
            document.querySelectorAll('style[data-bs5]').forEach(e => e.remove());
            document.querySelectorAll('[data-bs5-visibility]').forEach(e => { e.style.visibility = e.dataset.bs5Visibility; delete e.dataset.bs5Visibility; });
        });
    }
}
async function capture(opts, resumeSpace, spaceName) {
    const manifest = JSON.parse(await readFile(new URL('./bs5-pages.json', import.meta.url)));
    validateManifest(manifest);
    const cases = casesFor(manifest, opts), out = resolve(opts.out), indexPath = resolve(out, 'index.json');
    await mkdir(resolve(out, opts.role), { recursive: true });
    let index;
    try { index = JSON.parse(await readFile(indexPath, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; index = { baseline: manifest.baseline, fixture: manifest.fixture, runs: [], cases: {} }; }
    if (index.baseline !== manifest.baseline) throw new Error('Output baseline mismatch');
    const fork = fileURLToPath(new URL('../../', import.meta.url));
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: fork, encoding: 'utf8' }).trim();
    // Real browser command: exactly one task space for all four roles, never another profile.
    const task = resumeSpace ? await takeOverTaskSpace(resumeSpace) : await taskSpace(spaceName ?? 'P138 BS3 baseline Satz E');
    const pages = await task.pages();
    const page = pages.length ? task.page(pages[0].label) : await task.newPage();
    console.log({ spaceId: task.spaceId, page: page.label, role: opts.role, cases: cases.length });
    await page.cdp('Security.setIgnoreCertificateErrors', { ignore: true });
    await page.cdp('Page.addScriptToEvaluateOnNewDocument', { source: `(${instrument.toString()})(${isAllowedSmbList.toString()}, ${isAllowedSchoolName.toString()})` });
    const browser = await page.evaluate(() => ({ userAgent: navigator.userAgent, platform: navigator.platform }));
    index.runs.push({ role: opts.role, spaceId: task.spaceId, commit, browser, time: new Date().toISOString(), only: opts.only ?? null });
    const save = () => writeFile(indexPath, JSON.stringify(index, null, 2) + '\n');
    let authenticated = false;
    try {
        // Explicit logout through UI when resuming a previous role. Never clear profile storage.
        await navigate(page, 'https://localhost:8443/view/lmn/landingpage');
        if (await visible(page, '.profile-button')) { await click(page, '.profile-button'); await click(page, 'a.logout'); }
        for (const c of cases.sort((a, b) => Number(b.anonymous) - Number(a.anonymous))) {
            if (await exists(resolve(out, 'STOP'))) throw new Error('P138 STOP requested; capture stopped.');
            const path = resolve(out, c.key + '.png');
            try { await access(path); if (index.cases[c.key]?.file === path) continue; } catch (e) { if (e.code !== 'ENOENT') throw e; }
            const record = { role: c.role, route: c.route, url: c.url, language: c.language, state: c.state.id, viewport: c.viewport, time: new Date().toISOString() };
            if (c.excluded) { index.cases[c.key] = { ...record, status: 'not-testable', reason: c.reason }; await save(); continue; }
            try {
                if (!c.anonymous && !authenticated) {
                    await navigate(page, 'https://localhost:8443/view/login/normal');
                    await page.fill('input[name="username"]', opts.role);
                    await page.fill('input[name="password"]', 'Muster!'); // Public appliance test credential, notes/vm-zugang.md.
                    await page.click('button[type="submit"]', { label: 'Sign in test account' });
                    await page.waitForSelector('.profile-button', { state: 'visible', timeout: 20000 });
                    authenticated = true;
                }
                await page.cdp('Emulation.setDeviceMetricsOverride', { width: c.viewport[0], height: c.viewport[1], deviceScaleFactor: 1, mobile: false });
                await navigate(page, 'https://localhost:8443' + c.url); await locale(page, c.language);
                validateObservation(c, await observation(page));
                let observed = await observation(page);
                if (observed.blocked.length) throw new Error('Read-only guard: ' + JSON.stringify(observed.blocked));
                let denied = observed.denied || observed.failures.some(f => f.status === 403);
                if (c.state.open && !denied) {
                    ({ observed, denied } = await observeAfterOpen(async () => {
                        await click(page, c.state.open);
                        if (c.state.ready && !await visible(page, c.state.ready)) throw new Error('Opened state did not become visible');
                    }, () => observation(page)));
                } else if (c.state.open && denied) throw new Error('State inaccessible on denied route');
                if (observed.blocked.length) throw new Error('Read-only guard: ' + JSON.stringify(observed.blocked));
                if (observed.loading || observed.empty) throw new Error('Unsettled/empty content; no success screenshot');
                if (observed.failures.some(f => f.status >= 500 || f.status === 404) && !denied) throw new Error('Missing/failing service: ' + JSON.stringify(observed.failures));
                if (observed.notFound && c.route !== '404') throw new Error('Plugin route not installed');
                validateObservation(c, observed);
                await screenshot(page, path);
                index.cases[c.key] = { ...record, status: denied ? 'denied' : 'captured', file: path, observed };
                if (c.state.close) await click(page, c.state.close);
            } catch (error) {
                index.cases[c.key] = { ...record, status: 'not-testable', reason: error.message };
                if (error.message.startsWith('Capture integrity:')) { await save(); throw error; }
                const blocked = await page.evaluate(() => window.__bs5?.blocked ?? []);
                if (blocked.length) {
                    index.cases[c.key] = { ...record, status: 'not-testable', reason: 'Read-only guard: ' + JSON.stringify(blocked), blocked };
                    await save(); throw new Error(index.cases[c.key].reason); // CHAT #166: never continue after blocked, including settle errors.
                }
            }
            await save();
        }
    } finally { await save(); await page.close(); }
    console.log({ role: opts.role, counts: Object.values(index.cases).filter(c => c.role === opts.role).reduce((a, c) => ({ ...a, [c.status]: (a[c.status] ?? 0) + 1 }), {}) });
    if (opts.role === roles.at(-1)) await task.finish({ keep: [] });
}

function manifestText(manifest) {
    return '{\n' + Object.entries(manifest).map(([key, value]) => `  ${JSON.stringify(key)}: ${key === 'pages' ? '[\n' + value.map(p => '    ' + JSON.stringify(p)).join(',\n') + '\n  ]' : JSON.stringify(value)}`).join(',\n') + '\n}\n';
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    if (process.argv.includes('--generate')) await writeFile(new URL('./bs5-pages.json', import.meta.url), manifestText(createManifest((await import('../src/shell/router.mjs')).shellRoutes)));
    else if (process.argv.includes('--dry-run')) {
        const manifest = JSON.parse(await readFile(new URL('./bs5-pages.json', import.meta.url))); validateManifest(manifest, (await import('../src/shell/router.mjs')).shellRoutes);
        console.log({ pages: manifest.pages.length, cases: Object.fromEntries(roles.map(role => [role, casesFor(manifest, { role }).length])) });
    } else throw new Error('Use ego-browser nodejs and exported run([...]); --generate or --dry-run needs no browser.');
}

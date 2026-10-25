// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { shellRoutes } from '../src/shell/router.mjs';
import { createManifest, validateManifest, casesFor } from './bs5-baseline.mjs';

describe('BS5 read-only baseline', () => {
    it('covers every real route, concrete parameters, role and viewport without write steps', async () => {
        const manifest = JSON.parse(await readFile(new URL('./bs5-pages.json', import.meta.url)));
        expect(manifest).toEqual(createManifest(shellRoutes));
        expect(() => validateManifest(manifest, shellRoutes)).not.toThrow();
        expect(new Set(manifest.pages.map(p => p.route))).toEqual(new Set([...shellRoutes.map(r => r.path), '404', 'configuration-error']));
        for (const role of manifest.roles) {
            const cases = casesFor(manifest, { role });
            expect(new Set(cases.map(c => c.route))).toEqual(new Set(manifest.pages.map(p => p.route)));
            expect(new Set(cases.map(c => c.viewport.join('x')))).toEqual(new Set(['1440x900', '768x1024', '390x844']));
            expect(cases.every(c => !/:mode|:serial|:nextPage/.test(c.url) && c.roles.includes(role))).toBe(true);
        }
        expect(manifest.pages.find(p => p.url === '/view/lmn/init/setup').reason).toMatch(/provision/i);
        expect(manifest.pages.find(p => p.url === '/view/lmn/session').reason).toMatch(/createWorkingDirectory/);
        expect(manifest.pages.find(p => p.route === 'configuration-error')).toMatchObject({ url: '/view/lmn/init/welcome', excluded: true });
        expect(manifest.pages.find(p => p.url === '/view/lmn/change-password').languages).toContain('en');
        expect(manifest.pages.filter(p => p.languages.includes('en')).length).toBeGreaterThanOrEqual(8);
    });
});

it('stops on a lost role session or a screenshot from the wrong route', async () => {
    const { validateObservation } = await import('./bs5-baseline.mjs');
    const c = { role: 'global-admin', url: '/view/dashboard', anonymous: false };
    expect(() => validateObservation(c, { user: 'global-admin', url: c.url })).not.toThrow();
    expect(() => validateObservation(c, { user: 'zem', url: c.url })).toThrow(/Capture integrity: identity/);
    expect(() => validateObservation(c, { user: null, url: '/view/login/normal' })).toThrow(/Capture integrity:/);
    expect(() => validateObservation(c, { user: 'global-admin', url: '/view/lmn/landingpage' })).toThrow(/Capture integrity: route/);
    expect(() => validateObservation({ ...c, url: '/', redirect: '/view/lmn/landingpage' }, { user: 'global-admin', url: '/view/lmn/landingpage' })).not.toThrow();
});

it('allows SMB listing only beneath shares returned for the current user', async () => {
    const { isAllowedSmbList } = await import('./bs5-baseline.mjs');
    const r = { method: 'POST', path: '/api/lmn/smbclient/list', body: { path: '\\\\server\\home\\zem' }, user: 'zem', shareUser: 'zem', sharePaths: ['\\\\server\\home\\zem'] };
    expect(isAllowedSmbList(r)).toBe(true);
    expect(isAllowedSmbList({ ...r, body: { path: '//server/home/zem/transfer' } })).toBe(true);
    for (const change of [
        { shareUser: 'pgmadmin' }, { sharePaths: [] }, { body: { path: '//server/home/zem2' } },
        { body: { path: '//server/home/zem/../other' } }, { body: { path: '//server/home/zem', action: 'save' } },
        { path: '/api/lmn/smbclient/unlink' }, { method: 'PUT' },
    ]) expect(isAllowedSmbList({ ...r, ...change })).toBe(false);
});

it('allows school-name lookup only for the current user active school, never switching', async () => {
    const { isAllowedSchoolName } = await import('./bs5-baseline.mjs');
    const r = { method: 'POST', path: '/api/lmn/get-schoolname', body: { school: 'default-school' }, user: 'zem', schoolUser: 'zem', activeSchool: 'default-school' };
    expect(isAllowedSchoolName(r)).toBe(true);
    for (const change of [{ schoolUser: 'global-admin' }, { activeSchool: undefined }, { body: { school: 'other' } },
        { body: { school: 'default-school', save: true } }, { body: { school: 3 } }, { path: '/api/lmn/change-school' }]) {
        expect(isAllowedSchoolName({ ...r, ...change })).toBe(false);
    }
});

it('classifies a denial arriving after opening a previously allowed tab', async () => {
    const { observeAfterOpen } = await import('./bs5-baseline.mjs');
    const initial = { denied: false, failures: [] };
    const after = { denied: false, failures: [{ path: '/api/lmn/users/lists/parents', status: 403 }] };
    let current = initial;
    const result = await observeAfterOpen(async () => { current = after; }, async () => current);
    expect(result).toEqual({ observed: after, denied: true });
    expect(initial.failures).toEqual([]);
});

it('masks translated uptime and datetime values while preserving labels and other widgets', async () => {
    const { JSDOM } = await import('jsdom');
    const { prepareScreenshot } = await import('./bs5-baseline.mjs');
    const dom = new JSDOM('<div class="uptime"><div class="widget-header">Laufzeit</div><div class="widget-value">00:22:02</div></div><div class="date"><div class="widget-header">Date Time</div><div class="widget-value">2026-10-25</div></div><div class="host"><div class="widget-header">Rechnername</div><div class="widget-value">fixture-server</div></div>', { runScripts: 'outside-only' });
    dom.window.__bs5Owner = { aj: { gettext: text => text === 'Uptime' ? 'Laufzeit' : text } };
    dom.window.eval('(' + prepareScreenshot.toString() + ')()');
    expect(dom.window.document.querySelector('.uptime .widget-value').style.visibility).toBe('hidden');
    expect(dom.window.document.querySelector('.date .widget-value').style.visibility).toBe('hidden');
    expect(dom.window.document.querySelector('.host .widget-value').style.visibility).toBe('');
    expect(dom.window.document.querySelector('.uptime .widget-header').textContent).toBe('Laufzeit');
    dom.window.close();
});

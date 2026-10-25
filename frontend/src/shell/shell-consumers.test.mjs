import { afterEach, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { navigationOracle } from '../../test-fixtures/shell/navigation.mjs';
import { createMockAj } from '../adapter/mock.mjs';
import { createNavigation } from './navigation.mjs';
import { mount as mountSettings } from '../plugins/lmn_settings/entry.mjs';
import { mount as mountNextcloud } from '../plugins/lmn_nextcloud/entry.mjs';
import { flushPromises } from '@vue/test-utils';
import { responses } from '../plugins/lmn_settings/fixtures.test-data.mjs';

const cleanups = [];
afterEach(() => { cleanups.splice(0).reverse().forEach(fn => fn()); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it('uses the native capability without Angular and updates the Settings toolbar/customization across entry mounts', async () => {
    vi.stubGlobal('angular', undefined);
    const aj = createMockAj({ identity: { user: 'fixture', profile: { school: 'default-school', school_show: true } }, http: async r => ({ data: responses()[r.url] }) });
    const nav = createNavigation({ aj, storage: {}, navigate() {}, logout() {}, customization: { plugins: { settings: { hideLanguageSettings: true, hideSSLSettings: true, hideProxiesSettings: true } } } });
    cleanups.push(nav.dispose);
    aj.shell = nav;
    const host = document.createElement('div'); document.body.append(host); host.dataset.view = 'global';
    const stop = mountSettings(host, aj); cleanups.push(() => { stop(); host.remove(); }); await flushPromises();
    expect(host.querySelector('floating-toolbar .col-md-9')).not.toBeNull();
    nav.toggleNavigation(); await nextTick(); expect(host.querySelector('floating-toolbar .col-md-12')).not.toBeNull();
    const language = [...host.querySelectorAll('.c12-field')].find(el => el.textContent.includes('Language'));
    expect(language.style.display).toBe('none');
    expect(host.querySelector('hr').style.display).toBe('none');
    const ssl = [...host.querySelectorAll('div')].find(el => el.getAttribute('style') === 'display: none;' && el.textContent.includes('SSL'));
    expect(ssl).toBeDefined();
});
it('Nextcloud uses the contract toggles on each response and never restores on unmount', async () => {
    vi.stubGlobal('angular', undefined); vi.spyOn(window, 'open').mockImplementation(() => null);
    const storage = {}, aj = createMockAj({ identity: { user: 'fixture' }, http: async () => ({ data: [200, 'https://fixture.invalid', true, false] }) });
    const nav = createNavigation({ aj, storage, navigate() {}, logout() {} }); cleanups.push(nav.dispose); aj.shell = nav;
    const host = document.createElement('div');
    const stop = mountNextcloud(host, aj); await flushPromises();
    expect(storage).toEqual({ showSidebar: false, isWidescreen: true });
    aj.identity.user = 'second'; await flushPromises(); expect(storage).toEqual({ showSidebar: true, isWidescreen: false });
    stop(); expect(storage).toEqual({ showSidebar: true, isWidescreen: false });
});

it.each([false, true])('matches all hide*Settings flags with the original Angular template: %s', async hidden => {
    const old = navigationOracle(); cleanups.push(old.close);
    const flags = { hideLanguageSettings: hidden, hideSSLSettings: hidden, hideProxiesSettings: hidden };
    const data = responses(), expected = old.settingsVisibility(flags, data['/api/core/config']);
    const aj = createMockAj({ http: async r => ({ data: data[r.url] }) });
    aj.shell = createNavigation({ aj, storage: {}, navigate() {}, logout() {}, customization: { plugins: { settings: flags } } });
    cleanups.push(aj.shell.dispose);
    const host = document.createElement('div'); host.dataset.view = 'global'; document.body.append(host);
    const stop = mountSettings(host, aj); cleanups.push(() => { stop(); host.remove(); }); await flushPromises();
    const group = label => [...host.querySelectorAll('.c12-field')].find(el => el.querySelector('label')?.textContent.trim() === label);
    expect(group('Language').style.display !== 'none').toBe(expected.Language);
    expect(group('SSL certificate file').parentElement.style.display !== 'none').toBe(expected.SSL);
    expect(group('Trusted domains').style.display !== 'none').toBe(expected.Proxies);
});

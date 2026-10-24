import { afterEach, expect, it, vi } from 'vitest';
import { h, nextTick } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import * as Vue from 'vue';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createMockAj } from '../adapter/mock.mjs';
import { presentationOracle } from '../../test-fixtures/shell/presentation.mjs';
import { createLocale } from './locale.mjs';

const opened = [];
afterEach(() => opened.splice(0).forEach(oracle => oracle.close()));
function oracle() { const value = presentationOracle(); opened.push(value); return value; }

it('loads the actual locale JSON URL, updates mounted translations and leaves persistence to config save like core', async () => {
    const old = oracle(), calls = [];
    let data = { Hello: 'Hallo', Count: ['Einzahl', 'Mehrzahl'], Empty: '', Context: { verb: 'Verb' } };
    const http = { get: vi.fn(async url => { calls.push(url); return { data: url === '/api/core/languages' ? ['de', 'en'] : data }; }) };
    const locale = createLocale({ http, initialConfig: { language: 'de' } });
    const plugin = mount({ render: () => h('p', locale.gettext('Hello')) });
    expect(plugin.text()).toBe('Hello');
    old.respond(data); await old.locale.setLanguage('de'); await locale.start(); await nextTick();
    expect(calls).toEqual(['/api/core/languages', '/resources/all.locale.js?lang=de']);
    expect(locale.state.languages).toEqual(['de', 'en']); expect(plugin.text()).toBe('Hallo');
    for (const text of ['Hello', 'Count', 'Empty', 'Context', 'Missing', 'constructor']) expect(locale.gettext(text)).toBe(old.catalog.getString(text));
    data = { Hello: 'Hello again' }; old.respond(data);
    await old.locale.setLanguage('en'); await locale.setLanguage('en'); await nextTick();
    expect(plugin.text()).toBe(old.catalog.getString('Hello'));
    expect(old.requests.every(([method]) => method === 'GET')).toBe(true);
    expect(http.get).toHaveBeenCalledTimes(3); plugin.unmount(); locale.dispose();
});
it.each(['de-DE', 'de_DE', 'ar', 'sl', 'jv', 'mnk'])('preserves singular selection, regional fallback and catalog merging for %s', async language => {
    const old = oracle(); let data;
    const locale = createLocale({ http: { get: async () => ({ data }) } });
    for (const [lang, catalog] of [['de', { Fallback: 'Basis' }], [language, { Word: ['zero', 'one', 'two'], Plain: 'text' }], [language, { Added: 'added', Plain: { verb: 'context' } }]]) {
        data = catalog; old.respond(catalog); await old.locale.setLanguage(lang); await locale.setLanguage(lang);
    }
    for (const key of ['Word', 'Plain', 'Added', 'Fallback']) expect(locale.gettext(key)).toBe(old.catalog.getString(key));
    locale.dispose();
});
it('keeps the previous language/catalog when loading fails, propagates errors and stops publishing after disposal', async () => {
    let answer = Promise.resolve({ data: { Hi: 'Hallo' } });
    const locale = createLocale({ http: { get: () => answer } });
    await locale.setLanguage('de'); answer = Promise.reject(new Error('offline'));
    await expect(locale.setLanguage('en')).rejects.toThrow('offline'); expect(locale.gettext('Hi')).toBe('Hallo');
    let finish; answer = new Promise(resolve => { finish = resolve; });
    const pending = locale.setLanguage('en'); locale.dispose(); finish({ data: { Hi: 'Hello' } }); await pending;
    expect(locale.state.language).toBe('de');
    await expect(locale.setLanguage('en')).rejects.toThrow('disposed');
});
it('defaults to English without a configured language and reports language-list failures', async () => {
    const get = vi.fn().mockResolvedValue({ data: {} });
    const locale = createLocale({ http: { get } }); await locale.start();
    expect(get).toHaveBeenCalledWith('/resources/all.locale.js?lang=en'); locale.dispose();
    get.mockRejectedValue(new Error('languages failed'));
    get.mockImplementation(async url => {
        if (url === '/api/core/languages') throw new Error('languages failed');
        return { data: { Hello: 'Loaded' } };
    });
    const failed = createLocale({ http: { get } });
    await expect(failed.start()).rejects.toThrow('languages failed');
    expect(failed.gettext('Hello')).toBe('Loaded'); failed.dispose();
});
it('does not publish the catalog or language list after unmount during startup', async () => {
    const pending = []; const get = vi.fn(() => new Promise(done => { pending.push(done); }));
    const locale = createLocale({ http: { get } }); const started = locale.start();
    locale.dispose(); pending[0]({ data: ['de'] }); pending[1]({ data: { Hello: 'Late' } }); await started;
    expect(locale.state.languages).toEqual([]); expect(locale.gettext('Hello')).toBe('Hello');
});

it('updates an already mounted, unchanged Links IIFE without remounting or reloading its data', async () => {
    const context = { Vue };
    runInNewContext(readFileSync('../usr/lib/linuxmuster-webui/plugins/lmn_links/resources/vue/lmn_links.js', 'utf8'), context);
    const locale = createLocale({ http: { get: async () => ({ data: { Open: 'Öffnen' } }) } });
    const http = vi.fn(async () => ({ data: { status: 'success', data: { example: {
        title: 'Synthetic', link: '/example', permissions: { teacher: true },
    } } } }));
    const aj = createMockAj({ gettext: locale.gettext, http, identity: { user: 'test', profile: { sophomorixRole: 'teacher' } } });
    const host = document.createElement('div'); document.body.append(host);
    const unmount = context.LmnVue_lmn_links.mount(host, aj);
    try {
        await flushPromises(); expect(host.textContent).toContain('Open');
        await locale.setLanguage('de'); await nextTick();
        expect(host.textContent).toContain('Öffnen'); expect(http).toHaveBeenCalledTimes(1);
    } finally { unmount(); host.remove(); locale.dispose(); }
});

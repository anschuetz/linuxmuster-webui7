import { afterEach, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import Clients from './Clients.vue';
import { mount as mountClients } from './entry.mjs';
import { createMockAj } from '../../adapter/mock.mjs';
const script = { name: 'sessionstart.sh', path: '/synthetic/linux/sessionstart.sh', content: '\n# original\n' };
const scripts = { path: '/synthetic', linux: [script], windows: [{ name: 'logon.bat', path: '/synthetic/windows/logon.bat', content: 'rem test' }] };
const drive = { uid: 'uid', disabled: false, properties: { label: 'Home', useLetter: true, letter: 'H', path: '\\\\server\\home' } };
const letters = [{ letter: 'G', active: false }, { letter: 'H', active: true }, { letter: 'I', active: true }];
const clone = (v) => structuredClone(v);
const button = (w, name) => w.findAll('button, a').find((b) => b.text() === name);
const tab = async (w, name) => { await button(w, name).trigger('click'); await flushPromises(); };
const wrappers = [];
afterEach(() => { for (const w of wrappers.splice(0)) w.unmount(); vi.unstubAllGlobals(); });
async function setup(options = {}) {
    const http = vi.fn(async ({ url }) => ({ data: clone(url.endsWith('/scripts') ? scripts : [[drive], letters]) }));
    const notify = vi.fn();
    const aj = createMockAj({ http, notify, identity: { user: 'global-admin', profile: { sophomorixRole: 'globaladministrator' } }, ...options });
    const w = mount(Clients, { global: { provide: { aj } } });
    wrappers.push(w);
    await flushPromises();
    return { w, aj, http, notify };
}
const post = (http) => http.mock.calls.filter(([r]) => r.method === 'post').at(-1)?.[0];
it('loads scripts in response order, sets title; drives reload only on tab click', async () => {
    const set = vi.fn();
    const { w, http } = await setup({ pageTitle: { set } });
    expect(set.mock.calls).toEqual([['Lmn_clients']]);
    expect(http.mock.calls).toEqual([[{ method: 'get', url: '/api/lmn/clients/scripts', data: undefined, cfg: undefined }]]);
    expect(w.findAll('.list-group-item').map((li) => li.text())).toEqual(['sessionstart.sh', 'logon.bat']);
    await tab(w, 'Drives');
    expect(http.mock.calls.at(-1)[0]).toEqual({ method: 'get', url: '/api/lmn/samba/drives', data: undefined, cfg: undefined });
    expect(w.get('td').text()).toBe('Home');
    await tab(w, 'Custom scripts');
    await tab(w, 'Drives');
    expect(http).toHaveBeenCalledTimes(3);
});
it('keeps close edits locally without POST; saves exact untrimmed script envelope', async () => {
    const { w, http, notify } = await setup();
    await w.get('.list-group-item button').trigger('click');
    const content = '\n  # P33 text  \n\n';
    await w.get('textarea').setValue(content);
    await button(w, 'Close').trigger('click');
    expect(w.find('[role=dialog]').exists()).toBe(false);
    expect(post(http)).toBeUndefined();
    await w.get('.list-group-item button').trigger('click');
    expect(w.get('textarea').element.value).toBe(content);
    await button(w, 'Save').trigger('click');
    await flushPromises();
    expect(post(http)).toEqual({ method: 'post', url: '/api/lmn/clients/scripts', data: { path: script.path, content }, cfg: undefined });
    expect(w.find('[role=dialog]').exists()).toBe(false);
    expect(notify.mock.calls).toEqual([['success', 'Script saved !', undefined]]);
    expect(scripts.linux[0]).toEqual(script);
});
it('edits the Windows script while leaving Linux content unchanged', async () => {
    const { w, http } = await setup();
    await w.findAll('.list-group-item button')[1].trigger('click');
    await w.get('textarea').setValue('  rem Windows\r\n');
    await button(w, 'Save').trigger('click');
    await flushPromises();
    // Textarea normalizes CRLF, as Ace does; whitespace is otherwise retained.
    expect(post(http).data).toEqual({ path: scripts.windows[0].path, content: '  rem Windows\n' });
    await w.get('.list-group-item button').trigger('click');
    expect(w.get('textarea').element.value).toBe(script.content);
});
it('keeps the editor open on failed script save with original notification', async () => {
    const { w, notify } = await setup({ http: async ({ method }) => {
        if (method === 'post') throw new Error('write failed');
        return { data: clone(scripts) };
    } });
    await w.get('.list-group-item button').trigger('click');
    await button(w, 'Save').trigger('click');
    await flushPromises();
    expect(w.get('textarea').element.value).toBe(script.content);
    expect(notify.mock.calls).toEqual([['error', 'Error while saving script', undefined]]);
});
it('filters letters, updates flags and checkboxes; saves every drive field', async () => {
    const { w, http, notify } = await setup();
    await tab(w, 'Drives');
    expect(w.findAll('select option').map((o) => o.text())).toEqual(['G', 'H']);
    await w.get('select').setValue('G');
    expect(w.findAll('select option').map((o) => o.text())).toEqual(['G', 'H']);
    await w.findAll('[checkbox]')[0].trigger('click');
    await w.findAll('[checkbox]')[1].trigger('keydown', { key: ' ' });
    await button(w, 'Save').trigger('click');
    await flushPromises();
    expect(post(http)).toEqual({ method: 'post', url: '/api/lmn/samba/drives', data: { drives: [{ ...drive, disabled: true, properties: { ...drive.properties, letter: 'G', useLetter: false } }] }, cfg: undefined });
    expect(notify.mock.calls).toEqual([['success', 'Saved !', undefined]]);
    expect(drive.properties.letter).toBe('H');
});
it('releases the previous letter for other drives without sorting', async () => {
    const { w } = await setup({ http: async ({ url }) => ({ data: clone(url.endsWith('/scripts') ? scripts : [[drive, { ...drive, uid: 'two', properties: { ...drive.properties, letter: 'I' } }], letters]) }) });
    await tab(w, 'Drives');
    expect(w.findAll('select')[1].findAll('option').map((o) => o.text())).toEqual(['G', 'I']);
    await w.findAll('select')[0].setValue('G');
    expect(w.findAll('select')[1].findAll('option').map((o) => o.text())).toEqual(['H', 'I']);
});
it('reports the server message when drive save fails', async () => {
    const { w, notify } = await setup({ http: async ({ method, url }) => {
        if (method === 'post') throw { data: { message: 'server failure' } };
        return { data: clone(url.endsWith('/scripts') ? scripts : [[drive], letters]) };
    } });
    await tab(w, 'Drives');
    await button(w, 'Save').trigger('click');
    await flushPromises();
    expect(notify.mock.calls).toEqual([['error', 'server failure', undefined]]);
});
it('waits for identity; no empty warning during loading or after rejection', async () => {
    const http = vi.fn(async () => { throw new Error('HTTP 403'); });
    const { w, aj } = await setup({ identity: { user: null }, http });
    expect(http.mock.calls).toEqual([]);
    expect(w.findAll('.list-group-item')).toHaveLength(0);
    aj.identity.profile = { sophomorixRole: 'teacher' };
    aj.identity.user = 'teacher';
    await flushPromises();
    await tab(w, 'Drives');
    expect(w.find('.alert-warning').exists()).toBe(false);
    expect(w.find('table').exists()).toBe(false);
    expect(w.find('floating-toolbar').exists()).toBe(false);
});
it('shows missing Drives.xml only after a loaded empty response', async () => {
    const { w } = await setup({ http: async ({ url }) => ({ data: url.endsWith('/scripts') ? scripts : [[], letters] }) });
    await tab(w, 'Drives');
    expect(w.get('.alert-warning').text()).toBe('Unable to find a Drives.xml in your policy directory. Does the file really exists ?');
    expect(w.find('floating-toolbar').exists()).toBe(false);
});
it('uses samba role truthiness rather than admin role gating', async () => {
    const { w, aj } = await setup();
    for (const role of ['schooladministrator', 'teacher', 'student']) {
        aj.identity.profile = { sophomorixRole: role };
        await nextTick();
        expect(w.find('.nav-tabs').exists()).toBe(true);
    }
    aj.identity.profile = {};
    await nextTick();
    expect(w.find('.nav-tabs').exists()).toBe(false);
    expect(w.text()).toContain('You should not use WebUI as root user!');
    expect(w.get('a').attributes('href')).toBe('/view/lmn/init/welcome');
});
it('uses Ace without trimming and destroys the editor on close', async () => {
    let changed;
    let content;
    const editor = { setValue: vi.fn((v) => { content = v; }), getValue: () => content,
        on: vi.fn((_, callback) => { changed = callback; }), off: vi.fn(), destroy: vi.fn(),
        setOptions: vi.fn(), session: { setUseWrapMode: vi.fn() } };
    vi.stubGlobal('ace', { edit: vi.fn(() => editor), config: { set: vi.fn() } });
    const { w, http } = await setup();
    await w.get('.list-group-item button').trigger('click');
    expect(editor.setValue.mock.calls).toEqual([[script.content, -1]]);
    content = '\n  # exact Ace value \n';
    changed();
    await button(w, 'Save').trigger('click');
    await flushPromises();
    expect(post(http).data).toEqual({ path: script.path, content });
    expect(editor.off.mock.calls).toEqual([['change', changed]]);
    expect(editor.destroy).toHaveBeenCalledTimes(1);
});
it('mounts through the entry, translates and unmounts', async () => {
    const host = document.createElement('div');
    const unmount = mountClients(host, createMockAj({ gettext: (s) => `DE:${s}` }));
    await flushPromises();
    expect(host.textContent).toContain('DE:Custom scripts');
    unmount();
    expect(host.textContent).toBe('');
});

it('places active tab state on BS5 nav-links and keeps editor cancel free of writes', async () => {
    const { w, http } = await setup();
    expect(w.findAll('.nav-tabs > .nav-item > .nav-link')).toHaveLength(2);
    expect(w.get('.nav-link.active').attributes('aria-selected')).toBe('true');
    await tab(w, 'Drives');
    expect(w.get('.nav-link.active').text()).toBe('Drives');
    expect(w.find('.nav-item.active').exists()).toBe(false);
    await tab(w, 'Custom scripts');
    await w.get('.list-group-item button').trigger('click');
    expect(w.get('.modal-footer button').classes()).toContain('c3-button');
    await button(w, 'Close').trigger('click');
    expect(post(http)).toBeUndefined();
});

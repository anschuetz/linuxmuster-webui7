import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { resolve } from 'node:path';
import { flushPromises, mount } from '@vue/test-utils';
import { createMockAj } from '../../adapter/mock.mjs';
import SambaShares from './SambaShares.vue';

const home = '//server/home';
const shares = [{ name: 'Home', path: home, icon: 'fa fa-home' }, { name: null, path: '//removed' }, { name: 'Other', path: '//server/other', icon: 'fa fa-folder' }];
const file = (name, extra = {}) => ({ name, path: `${home}/${name}`, isFile: true, isDir: false, size: 1024, filetype: 'text', download_url: btoa(`${home}/${name}`), ...extra });
const directory = name => file(name, { isFile: false, isDir: true });
let wrapper;
function setup({ items = [file('z.txt'), directory('transfer'), directory('.upload'), directory('Bdir'), file('A.txt')], handler, identity = { user: 'zem', profile: { sophomorixRole: 'teacher' } }, messagebox } = {}) {
    const http = vi.fn(async request => {
        if (handler) { const response = handler(request); if (response !== undefined) return response; }
        return { data: request.url.includes('/shares/') ? structuredClone(shares) : request.url.endsWith('/list') ? { items: structuredClone(items) } : null };
    });
    const notify = vi.fn(), title = vi.fn();
    const aj = createMockAj({ http, notify, identity, messagebox, pageTitle: { set: title } });
    wrapper = mount(SambaShares, { global: { provide: { aj }, stubs: { SmbUpload: { props: ['uploadpath'], template: '<div><slot :browse-ref="() => {}" :progress="[]" /><button data-upload @click="$emit(\'uploaded\')">Upload</button></div>' } } } });
    return { http, notify, aj, title };
}
const row = name => wrapper.findAll('.list-group-item').find(item => item.attributes('test-bind-item') === name);
const click = async text => { const button = wrapper.findAll('.btn').find(item => item.text() === text && item.isVisible()); expect(button, text).toBeTruthy(); await button.trigger('click'); await flushPromises(); };
const select = async name => { await row(name).get('[checkbox]').trigger('click'); await flushPromises(); };
const calls = http => http.mock.calls.map(([request]) => request);
afterEach(() => { wrapper?.unmount(); localStorage.clear(); vi.restoreAllMocks(); });

it('waits for identity, preserves initial loading and root denial without requests', async () => {
    const { aj, http, title } = setup({ identity: { user: null, profile: {} } });
    await flushPromises(); expect(http).not.toHaveBeenCalled();
    expect(wrapper.get('.shares-spinner').isVisible()).toBe(true);
    expect(wrapper.findAll('.list-group-item')).toEqual([]);
    expect(title).toHaveBeenCalledWith('Samba shares');
    aj.identity.user = 'root'; await flushPromises();
    expect(http).not.toHaveBeenCalled(); expect(wrapper.get('.root-access-blocker').text()).toContain('root');
});
it.each(['globaladministrator', 'schooladministrator', 'teacher', 'student'])('loads %s shares, Home, original ordering and protected controls', async role => {
    const { http } = setup({ identity: { user: 'testuser', profile: { sophomorixRole: role } } });
    await flushPromises();
    expect(calls(http)).toEqual([
        { method: 'get', url: '/api/lmn/smbclient/shares/testuser', data: undefined, cfg: undefined },
        { method: 'post', url: '/api/lmn/smbclient/list', data: { path: home }, cfg: undefined },
    ]);
    expect(wrapper.findAll('.share-button').map(x => x.text())).toEqual(['Home', 'Other']);
    expect(wrapper.findAll('[test-bind-item]').map(x => x.attributes('test-bind-item'))).toEqual(['.upload', 'Bdir', 'transfer', 'A.txt', 'z.txt']);
    for (const name of ['transfer', '.upload']) expect(row(name).findAll('a:has(.fa-trash), a:has(.fa-pen), [checkbox]')).toEqual([]);
    expect(row('A.txt').text()).toContain('1.0 KB');
    expect(row('A.txt').get('.fa-file-alt').exists()).toBe(true);
});
it('navigates breadcrumbs and shares, retaining the legacy non-Home .upload protection', async () => {
    const { http } = setup({ handler: r => r.url.endsWith('/list') && r.data.path === '//server/other'
        ? { data: { items: ['transfer', '.upload'].map(name => ({ ...directory(name), path: `//server/other/${name}` })) } } : undefined }); await flushPromises();
    await row('Bdir').get('a.list-group-main').trigger('click'); await flushPromises();
    expect(calls(http).at(-1).data).toEqual({ path: `${home}/Bdir` });
    expect(wrapper.get('.breadcrumb').text()).toContain('Bdir');
    await wrapper.get('.breadcrumb a').trigger('click'); await flushPromises();
    await wrapper.findAll('.share-button')[1].trigger('click'); await flushPromises();
    expect(calls(http).at(-1).data).toEqual({ path: '//server/other' });
    expect(row('transfer').findAll('[checkbox]')).toHaveLength(1);
    expect(row('.upload').findAll('[checkbox]')).toEqual([]);
});
it('keeps loading when shares reject and hides spinner after failed list without fabricated rows', async () => {
    const { notify } = setup({ handler: r => r.url.endsWith('/list') ? Promise.reject({ data: { message: 'denied' } }) : undefined });
    await flushPromises();
    expect(wrapper.findAll('[test-bind-item]')).toEqual([]);
    expect(wrapper.get('.shares-spinner').isVisible()).toBe(false);
    expect(notify).toHaveBeenCalledWith('error', 'Could not load directory : ', 'denied');
    wrapper.unmount();
    setup({ handler: r => r.url.includes('/shares/') ? Promise.reject({ data: { message: 'shares denied' } }) : undefined });
    await flushPromises(); expect(wrapper.get('.shares-spinner').isVisible()).toBe(true);
});
it.each([[false, 'New file', 'Could not create file', '/file'], [true, 'New directory', 'Could not create directory', '/directory']])('creates with ngTrim and preserves internal spaces (%s)', async (directory, label, failure, endpoint) => {
    const { http, notify } = setup(); await flushPromises();
    await click(label);
    await click('Create'); expect(calls(http).filter(r => r.url.endsWith(endpoint))).toEqual([]);
    const input = wrapper.get('dialog input');
    input.element.focus();
    for (const character of ' synthetic name ') { input.element.value += character; await input.trigger('input'); }
    expect(input.element.value).toContain('synthetic name');
    await input.trigger('keydown', { key: 'Enter' }); await flushPromises();
    expect(calls(http).find(r => r.url.endsWith(endpoint)).data).toEqual({ path: `${home}/synthetic name` });
    expect(wrapper.find('dialog').exists()).toBe(false);
    await click(label); await click('Cancel'); expect(wrapper.find('dialog').exists()).toBe(false);
    wrapper.unmount();
    setup({ handler: r => r.url.endsWith(endpoint) ? Promise.reject({ data: { message: 'denied' } }) : undefined });
    await flushPromises(); await click(label); await wrapper.get('dialog input').setValue('x'); await click('Create');
    expect(wrapper.find('dialog').exists()).toBe(true);
    // Notification payload is checked separately from the successful instance.
    expect(notify).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain(label);
});
it('renames through shared SMB move and reports both legacy success notifications', async () => {
    const prompt = vi.fn().mockResolvedValue({ value: 'new name.txt' });
    const { http, notify } = setup({ messagebox: { prompt } }); await flushPromises();
    await row('A.txt').get('a:has(.fa-pen)').trigger('click'); await flushPromises();
    expect(prompt).toHaveBeenCalledWith('New name :', 'A.txt');
    expect(calls(http).find(r => r.url.endsWith('/move')).data).toEqual({ src: `${home}/A.txt`, dst: `${home}/new name.txt` });
    expect(notify.mock.calls).toEqual([['success', `${home}/A.txt moved!`, undefined], ['success', `${home}/A.txt renamed to ${home}/new name.txt`, undefined]]);
});
it('cancels rename/delete and preserves the original state', async () => {
    const messagebox = { prompt: vi.fn().mockRejectedValue(undefined), show: vi.fn().mockRejectedValue(undefined) };
    const { http } = setup({ messagebox }); await flushPromises();
    await row('A.txt').get('a:has(.fa-pen)').trigger('click'); await row('A.txt').get('a:has(.fa-trash)').trigger('click'); await flushPromises();
    expect(calls(http).filter(r => /\/(move|unlink)$/.test(r.url))).toEqual([]);
    expect(row('A.txt').exists()).toBe(true);
});
it.each([['A.txt', '/unlink', 'file'], ['Bdir', '/rmdir', 'directory']])('confirms individual deletion of %s with exact payload', async (name, endpoint, kind) => {
    const show = vi.fn().mockResolvedValue({});
    const { http, notify } = setup({ messagebox: { show } }); await flushPromises();
    await row(name).get('a:has(.fa-trash)').trigger('click'); await flushPromises();
    expect(show).toHaveBeenCalledWith({ text: `Do you really want to delete this ${kind}?`, positive: 'Delete', negative: 'Cancel' });
    expect(calls(http).find(r => r.url.endsWith(endpoint)).data).toEqual({ path: `${home}/${name}` });
    expect(notify).toHaveBeenCalledWith('success', `${home}/${name} deleted !`, undefined);
});
it('reports create and deletion errors without closing the dialog or reloading', async () => {
    const { http, notify } = setup({ handler: r => /\/(file|directory|unlink|rmdir)$/.test(r.url) ? Promise.reject({ data: { message: 'denied' } }) : undefined });
    await flushPromises();
    for (const label of ['New file', 'New directory']) {
        await click(label); await wrapper.get('dialog input').setValue('x'); await click('Create');
        expect(wrapper.find('dialog').exists()).toBe(true); await click('Cancel');
    }
    for (const name of ['A.txt', 'Bdir']) { await row(name).get('a:has(.fa-trash)').trigger('click'); await flushPromises(); }
    expect(calls(http).filter(r => r.url.endsWith('/list'))).toHaveLength(1);
    expect(notify.mock.calls).toEqual([
        ['error', 'Could not create file', 'denied'], ['error', 'Could not create directory', 'denied'],
        ['error', 'Error during deleting : ', 'denied'], ['error', 'Error during deleting : ', 'denied'],
    ]);
});
it('persists, replaces and removes clipboard entries, with conflict prompt and exact copy/move payloads', async () => {
    const prompt = vi.fn().mockResolvedValue({ value: 'copy.txt' });
    const { http } = setup({ items: [file('A.txt'), file('z.txt', { isFile: false, isDir: false, isLink: true })], messagebox: { prompt } }); await flushPromises();
    await select('A.txt'); await click('Copy'); await select('A.txt'); await click('Cut');
    const stored = JSON.parse(localStorage.getItem('ngStorage-sambaSharesClipboard'));
    expect(stored.map(({ mode, item }) => [mode, item.path])).toEqual([['move', `${home}/A.txt`]]);
    await select('z.txt'); await click('Copy');
    await wrapper.get('[data-clipboard]').trigger('click'); await flushPromises();
    expect(wrapper.get('dialog').text()).toContain('Clipboard');
    // The legacy template renders a file/dir icon only when that flag is true.
    expect(wrapper.get('dialog').findAll('.fa-file-o')).toHaveLength(1);
    await wrapper.get('dialog a:has(.fa-times)').trigger('click'); await click('Close');
    await click('Paste here');
    expect(prompt).toHaveBeenCalledWith('A file/directory with this name already exists, please give a new name :', 'z.txt');
    expect(calls(http).find(r => r.url.endsWith('/copy')).data).toEqual({ src: `${home}/z.txt`, dst: `${home}/copy.txt` });
    expect(JSON.parse(localStorage.getItem('ngStorage-sambaSharesClipboard'))).toEqual([]);
});
it('pastes into another directory and clears clipboard, selection and dialog', async () => {
    const { http } = setup(); await flushPromises();
    await select('A.txt'); await click('Cut'); await select('z.txt'); await click('Copy');
    await row('Bdir').get('a.list-group-main').trigger('click'); await flushPromises();
    await click('Paste here');
    expect(calls(http).filter(r => /\/(move|copy)$/.test(r.url)).map(r => [r.url, r.data])).toEqual([
        ['/api/lmn/smbclient/move', { src: `${home}/A.txt`, dst: `${home}/Bdir/A.txt` }],
        ['/api/lmn/smbclient/copy', { src: `${home}/z.txt`, dst: `${home}/Bdir/z.txt` }],
    ]);
    expect(wrapper.find('[data-clipboard]').exists()).toBe(false);
    await select('A.txt'); await click('Copy'); await wrapper.get('[data-clipboard]').trigger('click'); await click('Remove all items');
    expect(wrapper.find('dialog').exists()).toBe(false);
});
it('deletes mixed selection via correct endpoints and retains the last-promise refresh behavior', async () => {
    let resolveFirst;
    const { http } = setup({ handler: r => r.url.endsWith('/unlink') ? new Promise(resolve => { resolveFirst = resolve; }) : undefined });
    await flushPromises(); await select('A.txt'); await select('Bdir'); await click('Delete');
    expect(calls(http).filter(r => /\/(unlink|rmdir)$/.test(r.url)).map(r => [r.url, r.data])).toEqual([
        ['/api/lmn/smbclient/rmdir', { path: `${home}/Bdir` }], ['/api/lmn/smbclient/unlink', { path: `${home}/A.txt` }],
    ]);
    // Source order is z, transfer, .upload, Bdir, A; A is last and still pending.
    expect(calls(http).filter(r => r.url.endsWith('/list'))).toHaveLength(1);
    resolveFirst({ data: null }); await flushPromises();
    expect(calls(http).filter(r => r.url.endsWith('/list'))).toHaveLength(2);
});
it('uses the unchanged base64 download descriptor for HEAD then window.open and reloads after upload', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => {});
    const { http } = setup(); await flushPromises();
    await row('A.txt').get('a:has(.fa-download)').trigger('click'); await flushPromises();
    const url = `/api/lmn/smbclient/download?path=${btoa(`${home}/A.txt`)}`;
    expect(calls(http).find(r => r.url.includes('/download'))).toEqual({ method: 'head', url, data: undefined, cfg: undefined });
    expect(open.mock.calls).toEqual([[url]]);
    await wrapper.get('[data-upload]').trigger('click'); await flushPromises();
    expect(calls(http).filter(r => r.url.endsWith('/list'))).toHaveLength(2);
});
it('reports missing download, preserving its original error text', async () => {
    const { notify } = setup({ handler: r => r.url.includes('/download') ? Promise.reject({ data: { message: 'missing' } }) : undefined });
    await flushPromises(); await row('A.txt').get('a:has(.fa-download)').trigger('click'); await flushPromises();
    expect(notify).toHaveBeenCalledWith('error', 'File not found, may be due to special chars in the file name.', undefined);
});

it('keeps clipboard after a cancelled conflict prompt and preserves swallowed SMB move errors', async () => {
    const prompt = vi.fn().mockRejectedValue(undefined);
    const { http, notify } = setup({ messagebox: { prompt }, handler: r => r.url.endsWith('/move') ? Promise.reject({ data: { message: 'move denied' } }) : undefined });
    await flushPromises(); await select('A.txt'); await click('Copy'); await click('Paste here');
    expect(calls(http).filter(r => r.url.endsWith('/copy'))).toEqual([]);
    expect(JSON.parse(localStorage.getItem('ngStorage-sambaSharesClipboard')).map(x => x.mode)).toEqual(['copy']);
    prompt.mockResolvedValue({ value: 'renamed.txt' });
    await row('A.txt').get('a:has(.fa-pen)').trigger('click'); await flushPromises();
    expect(notify.mock.calls).toEqual([['error', 'move denied', undefined], ['success', `${home}/A.txt renamed to ${home}/renamed.txt`, undefined]]);
});
it('keeps both floating toolbars aligned when the shell sidebar toggles', async () => {
    setup(); await flushPromises(); await select('A.txt');
    expect(wrapper.findAll('.toolbar-content').map(x => x.classes().includes('col-md-9'))).toEqual([true, true]);
    window.dispatchEvent(new CustomEvent('lmn-samba-shares-sidebar', { detail: false })); await flushPromises();
    expect(wrapper.findAll('.toolbar-content').map(x => x.classes().includes('col-md-12'))).toEqual([true, true]);
});

it('keeps the legacy ngStorage cache synchronized so shell writes cannot restore a stale clipboard', async () => {
    const key = 'ngStorage-sambaSharesClipboard';
    const storage = { sambaSharesClipboard: [] };
    const flushLegacy = () => localStorage.setItem(key, JSON.stringify(storage.sambaSharesClipboard));
    flushLegacy();
    let factory, destroy;
    const module = { config: () => module, directive: (_name, provider) => { factory = provider; return module; } };
    const source = readFileSync(resolve('../usr/lib/linuxmuster-webui/plugins/lmn_samba_shares/resources/js/routing.es'), 'utf8');
    runInNewContext(source, { angular: { module: () => module }, window, CustomEvent });
    factory(storage).link({ $watch: () => () => {}, $on: (_event, callback) => { destroy = callback; } });
    try {
        setup(); await flushPromises(); await select('A.txt'); await click('Copy');
        // ngStorage 0.3 writes all cached keys when an unrelated shell preference changes.
        flushLegacy(); wrapper.unmount(); setup(); await flushPromises();
        expect(JSON.parse(localStorage.getItem(key)).map(x => [x.mode, x.item.path])).toEqual([['copy', `${home}/A.txt`]]);
        expect(wrapper.get('[data-clipboard]').text()).toBe('1');
    } finally { destroy(); }
});

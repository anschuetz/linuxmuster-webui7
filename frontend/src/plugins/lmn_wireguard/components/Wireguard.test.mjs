import { afterEach, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import Wireguard from './Wireguard.vue';
import ImportDialog from './ImportDialog.vue';
import ConfigDialog from './ConfigDialog.vue';
import { createMockAj } from '../../../adapter/mock.mjs';
const peer = { name: 'synthetic', public_key: 'key', ip: '192.0.2.41', routes: ['192.0.2.0/24'] };
const wrappers = [];
afterEach(() => wrappers.splice(0).forEach(w => w.unmount()));
const body = (url, method = 'GET', data) => ({ url: '/api/wireguard/' + url, method, ...(data === undefined ? {} : { data }) });
async function setup(options = {}, Component = Wireguard, props = {}) {
    const http = vi.fn(({ data, url }) => ({ data: url.endsWith('/students') ? [{ sAMAccountName: 'new', givenName: 'New', sn: 'User' }] : url.endsWith('/teachers') ? [{ sAMAccountName: 'existing' }] : data.url.endsWith('/status') ? { synthetic: { status: 'connected', endpoint: 'test:123', latest_handshake_difference: 12.6, transfer: { received: 1.234, send: 2.5 } } } : data.url.endsWith('/config') ? { data: '<synthetic>' } : data.url.endsWith('/qr/b64') ? 'png' : [peer] }));
    const notify = vi.fn(), show = vi.fn(() => Promise.resolve()), open = vi.fn(() => Promise.resolve()), prompt = vi.fn(() => Promise.resolve({ value: 'new peer' }));
    const aj = createMockAj({ http, notify, messagebox: { show, prompt }, modal: { open }, ...options });
    const w = mount(Component, { props, global: { provide: { aj } } }); wrappers.push(w); await flushPromises();
    return { w, http, notify, show, open, prompt };
}
const click = async (w, text) => { await w.findAll('button').find(b => b.text() === text).trigger('click'); await flushPromises(); };
it('loads peers then status with exact envelopes and formats connected fields', async () => {
    const { w, http } = await setup();
    expect(http.mock.calls.map(([r]) => r)).toEqual([body('peers'), body('peers/status')].map(data => ({ method: 'post', url: '/api/lmn/wireguard', data, cfg: undefined })));
    expect(w.get('floating-toolbar').exists()).toBe(true);
    expect(w.text()).toContain('test:123'); expect(w.text()).toContain('13 seconds ago'); expect(w.text()).toContain('1.23 MiB'); expect(w.text()).toContain('2.50 MiB');
    await click(w, 'Query status'); expect(http.mock.calls.at(-1)[0].data).toEqual(body('peers/status'));
});
it.each([false, 'pending', 'rejected'])('keeps original connection warning for %s', async kind => {
    const { w } = await setup({ http: () => kind === 'pending' ? new Promise(() => {}) : kind === 'rejected' ? Promise.reject({}) : { data: false } });
    expect(w.find('.alert-warning').exists()).toEqual(true); expect(w.find('floating-toolbar').exists()).toEqual(false);
});
it('empty peers retain toolbar; disconnected status and status rejection have no connected detail', async () => {
    const { w } = await setup({ http: ({ data }) => data.url.endsWith('/status') ? Promise.reject({}) : { data: [peer] } });
    expect(w.text()).not.toContain('seconds ago'); expect(w.get('.list-group-item').attributes('style')).toContain('red');
    const empty = await setup({ http: () => ({ data: [] }) }); expect(empty.w.find('button:has(.fa-plus)').exists()).toEqual(true);
});
it.each(['config', 'qr/b64'])('opens %s through adapter modal', async suffix => {
    const { w, http, open } = await setup(); await click(w, suffix === 'config' ? 'Configuration' : 'Show QR-Code');
    expect(http.mock.calls.at(-1)[0].data).toEqual(body('peers/synthetic/' + suffix));
    expect(open.mock.calls).toEqual([[ConfigDialog, { peer: 'synthetic', config: suffix === 'config' ? '<synthetic>' : undefined, qr: suffix === 'config' ? undefined : 'png' }]]);
});
it('renders configuration as text and QR as an image', async () => {
    const { w } = await setup({}, ConfigDialog, { peer: 'synthetic', config: '<synthetic>' });
    expect(w.get('pre').text()).toEqual('<synthetic>'); expect(w.find('synthetic').exists()).toEqual(false);
    await w.setProps({ config: undefined, qr: 'png' }); expect(w.get('img').attributes('src')).toEqual('data:image/png;base64,png');
});
it.each(['create', 'delete', 'restart'])('exact %s mutation, success notification and reload', async action => {
    const { w, http, notify, show, prompt } = await setup();
    await (action === 'create' ? w.get('button:has(.fa-plus)').trigger('click') : click(w, action === 'delete' ? 'Delete' : 'Restart')); await flushPromises();
    const mutations = http.mock.calls.map(([r]) => r.data);
    expect(mutations).toEqual([body('peers'), body('peers/status'), ...(action === 'create' ? [body('peers', 'POST', { name: 'new peer' })] : action === 'delete' ? [body('peers/synthetic', 'DELETE')] : []), ...(action === 'restart' ? [] : [body('peers'), body('peers/status')]), body('restart'), body('peers'), body('peers/status')]);
    expect(notify.mock.calls.map(c => c.slice(0, 2))).toEqual(action === 'restart' ? [['success', 'Restarted succesfully!']] : [['success', action === 'create' ? 'Created succesfully!' : 'Deleted succesfully!'], ['success', 'Restarted succesfully!']]);
    if (action === 'create') expect(prompt.mock.calls).toEqual([['Name: ']]);
    expect(show.mock.calls[0][0]).toEqual({ text: action === 'restart' ? 'Do you really want to restart the wireguard server? All clients have to reconnected!' : action === 'delete' ? 'Do you really want to delete this peer?' : 'The configuration has changed. Do you want to restart the server?', positive: action === 'delete' ? 'Delete' : 'Restart', negative: 'Cancel' });
});
it.each(['create', 'delete', 'restart'])('cancel %s never sends mutation', async action => {
    const { w, http } = await setup({ messagebox: { show: () => Promise.reject(), prompt: () => Promise.reject() } });
    if (action === 'create') await w.get('button:has(.fa-plus)').trigger('click'); else await click(w, action === 'delete' ? 'Delete' : 'Restart');
    await flushPromises(); expect(http.mock.calls.map(([r]) => r.data)).toEqual([body('peers'), body('peers/status')]);
});
it('HTTP failures do not notify success or open dialogs', async () => {
    let fail = false;
    const { w, notify, open } = await setup({ http: () => fail ? Promise.reject({}) : { data: [peer] } }); fail = true;
    for (const text of ['Configuration', 'Show QR-Code', 'Delete', 'Restart']) await click(w, text);
    await w.get('button:has(.fa-plus)').trigger('click'); await flushPromises();
    expect(notify.mock.calls).toEqual([]); expect(open.mock.calls).toEqual([]);
});
it.each([true, false, 'cancel'])('import close=%s preserves original inverted restart decision', async result => {
    const open = vi.fn(() => result === 'cancel' ? Promise.reject() : Promise.resolve(result));
    const { w, show, http } = await setup({ modal: { open } });
    await w.get('button:has(.fa-upload)').trigger('click'); await flushPromises();
    expect(open).toHaveBeenCalledWith(ImportDialog, { peers: [peer] }, { backdrop: 'static', keyboard: true });
    expect(show.mock.calls.length).toEqual(result === true ? 1 : 0);
    if (result === 'cancel') expect(http.mock.calls.length).toEqual(2);
});
const peers = [peer, { name: 'lmn-user_existing' }, { name: 'lmn-user_orphan' }, { name: 'x_lmn-user_stale' }];
it('compares users in arrival order and preserves substring deletion matching', async () => {
    const { w, http } = await setup({}, ImportDialog, { peers });
    expect(http.mock.calls.map(([r]) => r)).toEqual(['students', 'teachers'].map(name => ({ method: 'get', url: '/api/lmn/sophomorixUsers/' + name, data: undefined, cfg: undefined })));
    expect(w.get('button').text()).toEqual('Check users');
    await click(w, 'Check users');
    expect(w.findAll('tbody tr').map(r => r.text())).toEqual(['newNewUser', 'lmn-user_orphan', 'x_lmn-user_stale']);
    await click(w, 'Close'); expect(w.emitted('close')).toEqual([[true]]);
});
it.each([true, false])('runs import only=%s and updates progress, closing after run suppresses restart', async only => {
    const { w, http } = await setup({}, ImportDialog, { peers }); await click(w, 'Check users');
    await click(w, only ? 'Import' : 'Import + Delete');
    expect(http.mock.calls.slice(2).map(([r]) => r.data)).toEqual([body('peers', 'POST', { name: 'lmn-user_new' }), ...(only ? [] : [body('peers/lmn-user_orphan', 'DELETE'), body('peers/x_lmn-user_stale', 'DELETE')])]);
    expect(w.get('.progress-bar').text()).toEqual(only ? '1 / 1' : '3 / 3');
    await click(w, 'Close'); expect(w.emitted('close')).toEqual([[false]]);
});
it('failed user loads keep empty users; failed import remains without progress and close asks restart', async () => {
    const { w } = await setup({ http: () => Promise.reject({}) }, ImportDialog, { peers });
    await click(w, 'Check users'); expect(w.get('button.btn-success').attributes('disabled')).toEqual('');
    await click(w, 'Import + Delete'); expect(w.find('.progress').exists()).toEqual(false);
    await click(w, 'Close'); expect(w.emitted('close')).toEqual([[true]]);
});
it('false config response retains original literal undefined text; false mutation still reports success', async () => {
    let fail = false;
    const { w, open, notify } = await setup({ http: () => ({ data: fail ? false : [peer] }) }); fail = true;
    await click(w, 'Configuration');
    expect(open.mock.calls).toEqual([[ConfigDialog, { peer: 'synthetic', config: 'undefined', qr: undefined }]]);
    await click(w, 'Delete');
    expect(notify.mock.calls.map(c => c.slice(0, 2))).toEqual([['success', 'Deleted succesfully!'], ['success', 'Restarted succesfully!']]);
});
it('toolbar follows the shell sidebar; entry mounts and disposes through adapter', async () => {
    const { mount: mountWireguard } = await import('../entry.mjs');
    const element = document.createElement('div'); document.body.append(element);
    const aj = createMockAj({ http: async () => ({ data: [] }) });
    const dispose = mountWireguard(element, aj);
    await flushPromises(); expect(element.querySelector('floating-toolbar .aj-theme-toolbar-main') !== null).toEqual(true);
    aj.shell.layout.sidebar = false; await flushPromises();
    expect(element.querySelector('floating-toolbar .aj-theme-toolbar-full') !== null).toEqual(true);
    dispose(); expect(element.textContent).toEqual(''); element.remove();
});

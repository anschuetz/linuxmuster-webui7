import { afterEach, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import LinboSync from './LinboSync.vue';
import { createMockAj } from '../../../adapter/mock.mjs';
import { groups, parameters } from '../../../../e2e/fixtures/linboSync.mjs';
const wrappers = [];
afterEach(() => wrappers.splice(0).forEach(w => w.unmount()));
async function setup(httpImpl, options = {}) {
    const http = vi.fn(httpImpl ?? (({ url }) => ({ data: url.endsWith('activeschool') ? 'default-school' : groups() })));
    const notify = vi.fn(), set = vi.fn();
    const w = mount(LinboSync, { global: { provide: { aj: createMockAj({ http, notify, pageTitle: { set }, ...options }) } } });
    wrappers.push(w); await flushPromises(); return { w, http, notify, set };
}
const click = async (w, text) => { await w.findAll('button, a.btn').find(b => b.text() === text).trigger('click'); await flushPromises(); };
it('loads only school/groups through adapter, preserves response order and translates labels/title', async () => {
    const language = ref('de');
    const { w, http, set } = await setup(undefined, { gettext: s => `${language.value}:${s}` });
    expect(http.mock.calls.map(([r]) => r)).toEqual(['/api/lmn/activeschool', '/api/lmn/linbosync/last_syncs'].map(url => ({ method: 'get', url, data: undefined, cfg: undefined })));
    expect(set.mock.calls).toEqual([['de:Linbo synchronization']]);
    expect(w.findAll('[role="tab"]').map(t => t.text())).toEqual(['p52group', 'second']);
    expect(w.text()).toContain('de:No date found.'); expect(w.text()).toContain('de:Last sync');
    expect(w.findAll('button').filter(b => b.text() === 'New' && b.isVisible()).length).toEqual(1);
    language.value = 'fr'; await flushPromises(); expect(w.text()).toContain('fr:To apply a linbo-remote command');
    await w.findAll('[role="tab"]')[1].trigger('click'); expect(w.get('.tab-pane.active h1').text()).toEqual('second');
});
it.each(['pending', 'rejected', 'empty'])('retains blank groups during %s, with no invented empty/error message', async kind => {
    const { w, notify } = await setup(({ url }) => url.endsWith('activeschool') ? { data: 'default-school' } : kind === 'pending' ? new Promise(() => {}) : kind === 'rejected' ? Promise.reject({}) : { data: {} });
    expect(w.findAll('[role="tab"]')).toEqual([]); expect(w.findAll('.alert')).toEqual([]); expect(notify.mock.calls).toEqual([]);
});
it('preserves the backend none sentinel as a tab, without adding an empty message', async () => {
    const { w } = await setup(({ url }) => ({ data: url.endsWith('activeschool') ? 'default-school' : ['none'] }));
    expect(w.get('[role="tab"]').text()).toEqual('0');
    expect(w.get('.tab-pane.active h1').text()).toEqual('0');
});
it('preview is local; run wraps exact parameters, keeps new mismatch and original notifications', async () => {
    let result = { status: 0, msg: 'synthetic' };
    const { w, http, notify } = await setup(({ method, url }) => ({ data: method === 'post' ? result : url.endsWith('activeschool') ? 'default-school' : groups() }));
    await click(w, 'New'); await w.findAll('.tab-pane.active input[type="checkbox"]')[1].trigger('click');
    expect(w.get('pre').text()).toEqual('/usr/sbin/linbo-remote -i 192.0.2.1 -c new:1');
    expect(http.mock.calls.length).toEqual(2); await click(w, 'Apply');
    expect(http.mock.calls.at(-1)[0]).toEqual({ method: 'post', url: '/api/lmn/linbosync/run', data: { cmd_parameters: parameters() }, cfg: undefined });
    result = { status: 1, msg: 'synthetic error' }; await click(w, 'Apply');
    expect(notify.mock.calls.map(c => c.slice(0, 2))).toEqual([['success', 'Command successfully sent: synthetic'], ['error', 'synthetic error']]);
});
it('online checks are manual, update status icon/class, and cover all hosts in order', async () => {
    let response = 'OS Linux';
    const { w, http } = await setup(({ url }) => ({ data: url.includes('isOnline') ? response : url.endsWith('activeschool') ? 'default-school' : groups() }));
    await click(w, 'Up ?'); expect(w.get('.btn-success').text()).toEqual('OS Linux'); expect(w.find('.fab.fa-linux').exists()).toEqual(true);
    response = 'No response'; await click(w, 'Check online');
    expect(http.mock.calls.slice(2).map(([r]) => r.url)).toEqual(['p52client1', 'p52client1', 'p52client2', 'p52client3'].map(h => '/api/lmn/linbosync/isOnline/' + h));
    expect(w.findAll('a.btn-danger').map(a => a.text())).toEqual(['No response', 'No response', 'No response']);
});
it('number editing stays editable, WOL-only has no command, min-invalid omits timeout and empty sends null as Angular does', async () => {
    const { w, http } = await setup();
    await click(w, 'Wake on lan'); await w.findAll('.tab-pane.active input[type="checkbox"]')[1].trigger('click');
    expect(w.find('pre').exists()).toEqual(false);
    await click(w, 'Sync'); const input = w.get('input[type="number"]');
    await input.setValue('12'); expect(input.element.value).toEqual('12'); expect(w.get('pre').text()).toContain(' -w 12');
    await input.setValue('0'); expect(w.get('pre').text()).toContain(' -w undefined');
    await click(w, 'Apply'); const { timeout, ...withoutTimeout } = parameters(); expect(JSON.parse(JSON.stringify(http.mock.calls.at(-1)[0].data))).toEqual({ cmd_parameters: withoutTimeout });
    await input.setValue(''); expect(w.get('pre').text()).toContain(' -w null');
    await click(w, 'Apply'); expect(JSON.parse(JSON.stringify(http.mock.calls.at(-1)[0].data))).toEqual({ cmd_parameters: { ...parameters(), timeout: null } });
});
it('partition toggles command but original checkbox stays unchecked; start is exclusive and power toggles', async () => {
    const { w } = await setup();
    await w.findAll('.tab-pane.active input[type="checkbox"]')[0].trigger('click');
    await click(w, 'Partition'); expect(w.get('pre').text()).toEqual('/usr/sbin/linbo-remote -g p52group -c  partition,format');
    expect(w.findAll('button').find(b => b.text() === 'Partition').get('input').element.checked).toEqual(false);
    await click(w, 'Partition'); expect(w.find('pre').exists()).toEqual(false);
    await click(w, 'Halt'); await click(w, 'Halt'); expect(w.find('pre').exists()).toEqual(false);
});
it('HTTP failures retain original statuses/previews and do not report successful execution', async () => {
    let fail = false;
    const { w, notify } = await setup(({ url }) => fail ? Promise.reject({}) : { data: url.endsWith('activeschool') ? 'default-school' : groups() });
    await click(w, 'New'); await w.findAll('.tab-pane.active input[type="checkbox"]')[1].trigger('click'); fail = true;
    await click(w, 'Apply'); await click(w, 'Check online');
    expect(notify.mock.calls).toEqual([]); expect(w.get('pre').text()).toContain('new:1'); expect(w.findAll('a.btn-primary').length).toEqual(3);
});
it('entry mounts through adapter and unmounts cleanly', async () => {
    const { mount: mountPlugin } = await import('../entry.mjs');
    const element = document.createElement('div'); document.body.append(element);
    const dispose = mountPlugin(element, createMockAj({ http: () => ({ data: {} }) })); await flushPromises();
    expect(element.querySelector('.c9-field') !== null).toEqual(true); dispose(); expect(element.textContent).toEqual(''); element.remove();
});

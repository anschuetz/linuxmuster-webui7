import { expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { nextTick } from 'vue';
import SambaDns from './SambaDns.vue';
import { createMockAj } from '../../../adapter/mock.mjs';
import { mount as mountDns } from '../entry.mjs';

const a = { host: 'p32-a', type: 'A', value: '192.0.2.32', ttl: 900 };
const mx = { host: 'p32-mx', type: 'MX', value: 'mail.example.test', priority: 17, ttl: 900 };
const fixture = () => [{ root: [{ type: 'NS', value: 'ns.example.test', ttl: 900 }], sub: [{ ...a }, { ...mx }] }, 'example.test'];
async function setup(options = {}) {
    const http = vi.fn(async ({ method }) => ({ data: method === 'get' ? fixture() : false }));
    const notify = vi.fn();
    const show = vi.fn(() => Promise.resolve());
    const aj = createMockAj({ identity: { user: 'global-admin' }, http, notify, messagebox: { show }, ...options });
    const wrapper = mount(SambaDns, { global: { provide: { aj } } });
    await flushPromises();
    return { w: wrapper, http, notify, show, aj };
}
const button = (w, name) => w.findAll('button, a').find((b) => b.text() === name);
const call = (http) => http.mock.calls.at(-1)[0];

it('loads zone, ordered root/sub tables and MX priority without sorting or empty notices', async () => {
    const { w, http } = await setup();
    expect(call(http)).toEqual({ method: 'get', url: '/api/lmn/dns', data: undefined, cfg: undefined });
    expect(w.findAll('h3').map((h) => h.text())).toEqual(['Zone informations (example.test)', 'Subdomains']);
    expect(w.findAll('table').map((table) => table.findAll('td').map((td) => td.text()))).toEqual([
        ['NS', '900', 'ns.example.test'],
        ['p32-a', 'A', '900', '192.0.2.32', '', '', 'p32-mx (17)', 'MX', '900', 'mail.example.test', '', ''],
    ]);
    w.unmount();
});

it.each(['A', 'AAAA', 'PTR', 'CNAME', 'NS', 'MX', 'TXT'])('adds %s with trimmed text, exact envelope/default TTL and no reload', async (type) => {
    const { w, http, notify } = await setup();
    await button(w, 'Add an entry').trigger('click');
    expect(w.get('[name=type]').element.value).toBe('A');
    expect(w.get('[name=priority]').element.style.display).toEqual('none');
    await w.get('[name=host]').setValue(' p32-new ');
    await w.get('[name=type]').setValue(type);
    await w.get('[name=value]').setValue(' value \n');
    if (type === 'MX') {
        expect(w.get('[name=priority]').element.style.display).toEqual('');
        await w.get('[name=priority]').setValue(' 23 ');
    }
    await button(w, 'Save').trigger('click');
    await flushPromises();
    expect(call(http)).toEqual({ method: 'put', url: '/api/lmn/dns', data: { sub: { host: 'p32-new', type, value: 'value', ttl: 900, ...(type === 'MX' ? { priority: '23' } : {}) } }, cfg: undefined });
    expect(w.text()).toContain('p32-new');
    expect(w.find('[role=dialog]').exists()).toBe(false);
    expect(http).toHaveBeenCalledTimes(2);
    expect(notify.mock.calls).toEqual([['success', 'Entry saved !', undefined]]);
    w.unmount();
});

it('discards cancelled new entries and resets defaults; empty fields remain empty strings', async () => {
    const { w, http } = await setup();
    await button(w, 'Add an entry').trigger('click');
    await w.get('[name=host]').setValue('cancelled');
    await button(w, 'Close').trigger('click');
    expect(http).toHaveBeenCalledTimes(1);
    await button(w, 'Add an entry').trigger('click');
    expect(w.get('[name=host]').element.value).toBe('');
    await button(w, 'Save').trigger('click');
    await flushPromises();
    expect(call(http).data).toEqual({ sub: { host: '', type: 'A', value: '', ttl: 900 } });
    w.unmount();
});

it('edits live, keeps edits on Close, copies old on reopen and closes before POST resolves', async () => {
    let resolve;
    const http = vi.fn(({ method }) => method === 'post' ? new Promise((yes) => { resolve = yes; }) : Promise.resolve({ data: fixture() }));
    const { w, notify } = await setup({ http });
    await w.findAll('[title="Modify this entry"]')[1].trigger('click');
    expect(w.get('[name=host]').attributes('disabled')).toBeDefined();
    expect(w.get('[name=type]').attributes('disabled')).toBeDefined();
    expect(w.find('.modal-header h4').exists()).toBe(false); // Original uses undefined updateDNS.
    await w.get('[name=value]').setValue(' mail.changed.test ');
    await w.get('[name=priority]').setValue(' 25 ');
    await button(w, 'Close').trigger('click');
    expect(w.text()).toContain('mail.changed.test');
    expect(http).toHaveBeenCalledTimes(1);
    await w.findAll('[title="Modify this entry"]')[1].trigger('click');
    await w.get('[name=value]').setValue(' mail.final.test ');
    await button(w, 'Update').trigger('click');
    expect(w.find('[role=dialog]').exists()).toBe(false);
    expect(call(http).data).toEqual({ old: { ...mx, value: 'mail.changed.test', priority: '25' }, new: { ...mx, value: 'mail.final.test', priority: '25' } });
    resolve({ data: false });
    await flushPromises();
    expect(notify.mock.calls).toEqual([['success', 'Entry updated !', undefined]]);
    w.unmount();
});

it.each([a, mx])('confirms deletion with original %s PATCH value and removes only after success', async (sub) => {
    let resolve;
    const http = vi.fn(({ method }) => method === 'patch' ? new Promise((yes) => { resolve = yes; }) : Promise.resolve({ data: fixture() }));
    const { w, show, notify } = await setup({ http });
    await w.findAll('[title="Delete this entry"]')[sub.type === 'MX' ? 1 : 0].trigger('click');
    await flushPromises();
    expect(show.mock.calls).toEqual([[{ text: 'Do you really want to delete this entry?', positive: 'Delete', negative: 'Cancel' }]]);
    expect(call(http)).toEqual({ method: 'patch', url: '/api/lmn/dns', data: { sub: sub.host, type: sub.type, value: sub.type === 'MX' ? `${sub.value}\\ ${sub.priority}` : sub.value }, cfg: undefined });
    expect(w.findAll('[title="Delete this entry"]')).toHaveLength(2);
    resolve({ data: false });
    await flushPromises();
    expect(w.findAll('[title="Delete this entry"]')).toHaveLength(1);
    expect(w.text()).not.toContain(sub.host);
    expect(notify.mock.calls).toEqual([['success', 'Entry deleted !', undefined]]);
    w.unmount();
});

it('cancelled delete never sends PATCH or changes the list', async () => {
    const { w, http } = await setup({ messagebox: { show: () => Promise.reject(new Error('cancel')) } });
    await w.get('[title="Delete this entry"]').trigger('click');
    await flushPromises();
    expect(http).toHaveBeenCalledTimes(1);
    expect(w.findAll('[title="Delete this entry"]')).toHaveLength(2);
    w.unmount();
});

it.each(['put', 'post', 'patch'])('failed %s leaves original local state and no success notification', async (method) => {
    const { w, notify } = await setup({ http: async ({ method: requested }) => {
        if (requested === method) throw new Error('HTTP 500');
        return { data: fixture() };
    } });
    if (method === 'put') {
        await button(w, 'Add an entry').trigger('click');
        await w.get('[name=host]').setValue('failed');
        await button(w, 'Save').trigger('click');
    } else if (method === 'post') {
        await w.get('[title="Modify this entry"]').trigger('click');
        await w.get('[name=value]').setValue('failed');
        await button(w, 'Update').trigger('click');
    } else await w.get('[title="Delete this entry"]').trigger('click');
    await flushPromises();
    expect(w.findAll('[title="Delete this entry"]')).toHaveLength(2);
    expect(w.text().includes('failed')).toBe(method === 'post');
    expect(notify.mock.calls).toEqual([]);
    w.unmount();
});

it('waits for identity; loading and failed GET leave tables unset without empty notices', async () => {
    let reject;
    const http = vi.fn(() => new Promise((_, no) => { reject = no; }));
    const { w, aj } = await setup({ identity: { user: null }, http });
    expect(http).not.toHaveBeenCalled();
    aj.identity.user = 'teacher';
    await nextTick();
    expect(w.findAll('td')).toHaveLength(0);
    expect(w.find('.alert').exists()).toBe(false);
    reject(new Error('HTTP 403'));
    await flushPromises();
    expect(w.findAll('td')).toHaveLength(0);
    expect(w.find('.alert').exists()).toBe(false);
    w.unmount();
});

it('entry sets translated title and unmounts all dialogs', async () => {
    const set = vi.fn();
    const host = document.createElement('div');
    const unmount = mountDns(host, createMockAj({ pageTitle: { set }, gettext: (s) => `DE:${s}` }));
    expect(set.mock.calls).toEqual([['DE:Samba_dns']]);
    unmount();
    expect(host.textContent).toBe('');
});

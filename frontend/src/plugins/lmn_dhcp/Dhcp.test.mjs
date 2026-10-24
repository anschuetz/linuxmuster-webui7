import { afterEach, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import Dhcp from './Dhcp.vue';
import AddDialog from './AddDialog.vue';
import ApplyDialog from '../lmn_devices/ApplyDialog.vue';
import { mount as entry } from './entry.mjs';

const known = { mac: '02:00:00:00:00:AA', ip: '10.0.0.10', hostname: 'pc01' };
const lease = { mac: '02:00:00:00:00:02', ip: '10.0.0.20', starts: 'start', ends: 'end' };
const payload = { room: '', mac: lease.mac, ip: '', hostname: '', group: '', pxeFlag: '0',
    officeKey: '', windowsKey: '', dhcpOptions: '', sophomorixRole: 'staffcomputer',
    lmnReserved10: '', lmnReserved12: '', lmnReserved13: '', lmnReserved14: '', sophomorixComment: '' };
const wrappers = [];
function setup(Component = Dhcp, props = {}, overrides = {}) {
    const aj = { gettext: (s) => s, pageTitle: { set: vi.fn() },
        http: { get: vi.fn(async () => ({ data: [[{ ...lease, mac: known.mac.toLowerCase() }, lease], [known]] })), post: vi.fn(async () => ({})) },
        notify: { success: vi.fn(), error: vi.fn() }, modal: { open: vi.fn(async () => ({})) }, ...overrides };
    const w = mount(Component, { attachTo: document.body, props, global: { provide: { aj } } });
    wrappers.push(w); return { w, aj };
}
const button = (w, text) => w.findAll('button').find((b) => b.text() === text);
const dialog = (used = [known], overrides = {}) => setup(AddDialog, { mac: lease.mac, used, onRegistered: vi.fn() }, overrides);
async function fill(w, values) {
    for (const [i, value] of values.entries()) await w.findAll('input')[i].setValue(value);
}
afterEach(() => { wrappers.splice(0).forEach((w) => w.unmount()); document.body.innerHTML = ''; vi.restoreAllMocks(); });
it('loads leases in order, marks case-insensitive registered MACs and opens the add dialog', async () => {
    const { w, aj } = setup();
    expect(w.findAll('tr')).toHaveLength(1);
    await flushPromises();
    expect(aj.http.get.mock.calls).toEqual([['/api/lmn/dhcp/leases']]);
    expect(aj.pageTitle.set.mock.calls).toEqual([['DHCP']]);
    expect(w.findAll('tr').slice(1).map((r) => r.findAll('td').slice(1).map((c) => c.text()))).toEqual([
        [lease.ip, lease.starts, lease.ends, ''], [lease.ip, lease.starts, lease.ends, ''],
    ]);
    expect(w.findAll('button')).toHaveLength(1);
    expect(w.text()).toContain('Already registered!');
    await w.find('button').trigger('click');
    expect(aj.modal.open.mock.calls[0][0]).toBe(AddDialog);
    expect(aj.modal.open.mock.calls[0][1].mac).toBe(lease.mac);
    aj.modal.open.mock.calls[0][1].onRegistered(known);
    await flushPromises();
    expect(aj.modal.open.mock.calls[0][1].used).toEqual([known]);
    expect(w.findAll('button')).toHaveLength(1); // Legacy callback re-adds a known MAC.
    aj.modal.open.mock.calls[0][1].onRegistered(lease); await flushPromises();
    expect(w.findAll('button')).toHaveLength(0);
});
it('leaves initial and failed loads without empty messages; dismissing the dialog is harmless', async () => {
    const { w } = setup(Dhcp, {}, { http: { get: vi.fn(async () => { throw Error('denied'); }) } });
    await flushPromises(); expect(w.findAll('tr')).toHaveLength(1); expect(w.text()).toBe('DHCP LeasesMac addressIPStartEnd');
    const second = setup(Dhcp, {}, { modal: { open: vi.fn(async () => { throw Error('cancel'); }) } });
    await flushPromises(); await second.w.find('button').trigger('click'); await flushPromises();
});
it('uses original defaults and all role/PXE options, exact trimmed payload, and the legacy last-used registration bug', async () => {
    const { w, aj } = dialog();
    expect(w.findAll('input').map((i) => i.element.value)).toEqual(['', lease.mac, '', '', '']);
    expect(w.findAll('select').map((s) => s.element.value)).toEqual(['0', 'staffcomputer']);
    expect(w.findAll('select')[0].findAll('option')).toHaveLength(4);
    expect(w.findAll('select')[1].findAll('option')).toHaveLength(15);
    await fill(w, [' r36 ', ` ${lease.mac} `, ' 10.0.0.36 ', ' pc36 ', ' group36 ']);
    await w.findAll('select')[0].setValue('2'); await w.findAll('select')[1].setValue('server');
    await button(w, 'Save').trigger('click'); await flushPromises();
    expect(aj.http.post.mock.calls).toEqual([['/api/lmn/dhcp/register', { device: { ...payload, room: 'r36', ip: '10.0.0.36', hostname: 'pc36', group: 'group36', pxeFlag: '2', sophomorixRole: 'server' } }]]);
    expect(aj.notify.success.mock.calls).toEqual([['Device successfully saved in devices.csv!']]);
    expect(w.emitted('close')).toEqual([[]]);
    expect(w.props('onRegistered').mock.calls).toEqual([[known]]);
});
it('shows duplicate hints but permits a single duplicate like original validation; rejects two duplicates', async () => {
    const { w, aj } = dialog([known, { mac: '02:00:00:00:00:03', ip: '10.0.0.3', hostname: 'other' }]);
    await fill(w, ['', lease.mac, known.ip, known.hostname, '']);
    expect(w.findAll('td.has-error')).toHaveLength(2);
    await button(w, 'Save').trigger('click'); await flushPromises();
    expect(aj.http.post.mock.calls).toEqual([['/api/lmn/dhcp/register', { device: { ...payload, ip: known.ip, hostname: known.hostname } }]]);
    expect(w.props('onRegistered').mock.calls).toEqual([[known]]);
    const second = dialog([known, { ...known }]);
    await fill(second.w, ['', lease.mac, known.ip, known.hostname, '']);
    await button(second.w, 'Save').trigger('click'); await flushPromises();
    expect(second.aj.http.post.mock.calls).toEqual([]);
    expect(second.aj.notify.error.mock.calls).toEqual([[known.ip + ' is not valid or duplicated'], [known.hostname + ' does not contain valid chars, is duplicated or too long (>15 chars)']]);
});
it('validates IP/host on Save and still opens the shared import dialog on invalid Save & import', async () => {
    const { w, aj } = dialog();
    await fill(w, ['', lease.mac, 'bad', 'bad host', '']);
    await button(w, 'Save & import').trigger('click'); await flushPromises();
    expect(aj.http.post.mock.calls).toEqual([]);
    expect(aj.notify.error.mock.calls).toEqual([['bad is not valid or duplicated'], ['bad host does not contain valid chars, is duplicated or too long (>15 chars)']]);
    expect(aj.modal.open.mock.calls).toEqual([[ApplyDialog, {}, { static: true }]]);
    expect(w.emitted('close')).toBeUndefined();
    await button(w, 'Cancel').trigger('click'); expect(w.emitted('close')).toEqual([[]]);
});
it('starts import before register completes; failed saving keeps the form open without a success', async () => {
    let reject;
    const { w, aj } = dialog([known], { http: { post: vi.fn(() => new Promise((_, no) => { reject = no; })) }, modal: { open: vi.fn(async () => { throw Error('cancel'); }) } });
    await fill(w, ['', lease.mac, '10.0.0.36', 'pc36', '']);
    await button(w, 'Save & import').trigger('click');
    expect(aj.modal.open.mock.calls).toEqual([[ApplyDialog, {}, { static: true }]]);
    reject(Error('failed')); await flushPromises();
    expect(aj.notify.success.mock.calls).toEqual([]); expect(w.emitted('close')).toBeUndefined();
});
it('mounts and unmounts through the plugin entry', async () => {
    const { aj } = setup(); const host = document.createElement('div');
    const unmount = entry(host, aj); await flushPromises();
    expect(host.textContent).toContain('DHCP Leases'); unmount(); expect(host.innerHTML).toBe('');
});

it('preserves success-without-close and the console error when the original global device is unset', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { w, aj } = dialog([]);
    await fill(w, ['', lease.mac, '10.0.0.36', 'pc36', '']);
    await button(w, 'Save').trigger('click'); await flushPromises();
    expect(aj.notify.success.mock.calls).toEqual([['Device successfully saved in devices.csv!']]);
    expect(error.mock.calls.map(([e]) => [e.name, e.message])).toEqual([['ReferenceError', 'device is not defined']]);
    expect(w.emitted('close')).toBeUndefined();
});
it('uses trimmed catalog keys for the translated form labels', () => {
    const catalog = { 'Room:': 'Raum:', 'Mac:': 'MAC:', Hostname: 'Hostname', 'Group:': 'Gruppe:', 'PXE Boot:': 'PXE-Boot:', 'Sophomorix role:': 'Sophomorix-Rolle:' };
    const { w } = dialog([known], { gettext: (key) => catalog[key] ?? key });
    expect(w.findAll('td > span').map((label) => label.text())).toEqual(['Raum:', 'MAC:', 'Gruppe:', 'PXE-Boot:', 'Sophomorix-Rolle:']);
});

it('keeps spaces while typing text but sends the trimmed Angular model', async () => {
    const { w, aj } = dialog();
    await fill(w, ['r36', lease.mac, '10.0.0.36', 'pc36', '']);
    const group = w.findAll('input')[4]; group.element.focus();
    for (const character of ' group 36 ') {
        group.element.value += character;
        await group.trigger('input');
    }
    expect(group.element.value).toBe(' group 36 ');
    await button(w, 'Save').trigger('click'); await flushPromises();
    expect(aj.http.post.mock.calls).toEqual([['/api/lmn/dhcp/register', { device: { ...payload, room: 'r36', ip: '10.0.0.36', hostname: 'pc36', group: 'group 36' } }]]);
});

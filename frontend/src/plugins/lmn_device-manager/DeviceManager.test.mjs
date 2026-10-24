import { afterEach, describe, expect, it, vi } from 'vitest';
import { shallowRef } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { createMockAj } from '../../adapter/mock.mjs';
import DeviceManager from './DeviceManager.vue';
import LinboRemote from './LinboRemote.vue';
import Processes from './Processes.vue';
import Prestart from './Prestart.vue';
import BulkAction from './BulkAction.vue';
import { mount as mountEntry } from './entry.mjs';
const base = '/api/lmn/device-manager/';
const device = { room: 'R1', hostname: 'pc01', school: 'default-school', os: 'Unknown', online: 'Unknown', remoteBlock: false, checked: false };
let wrappers = [];
afterEach(() => { wrappers.forEach(w => w.unmount()); wrappers = []; vi.useRealTimers(); });
function setup(Component, { responses = {}, props = {}, ...options } = {}) {
    const requests = [], notices = [];
    const aj = createMockAj({ identity: { user: 'admin', profile: {} }, notify: (...n) => notices.push(n), http: async req => {
        requests.push(JSON.parse(JSON.stringify(req)));
        const value = responses[req.url.split('/').pop()];
        if (value instanceof Error) throw value;
        return { data: typeof value === 'function' ? await value(req) : value };
    }, ...options });
    aj.shell = { layout: { sidebar: true } };
    const w = mount(Component, { props, global: { provide: { aj } } }); wrappers.push(w);
    return { w, aj, requests, notices };
}
describe('device manager legacy contract', () => {
    it('waits for identity/load; keeps failed device load blank', async () => {
        const { w, aj, requests } = setup(DeviceManager, { identity: { user: null, profile: {} }, responses: { activeschool: 'default-school', getdevices: new Error('offline') } });
        expect(w.find('#deviceList').exists()).toBe(false); expect(requests).toEqual([]);
        aj.identity.user = 'admin'; await flushPromises();
        expect(requests).toEqual([{ method: 'get', url: '/api/lmn/activeschool' }, { method: 'post', url: base + 'getdevices', data: { filepath: '/etc/linuxmuster/sophomorix/default-school/devices.csv', school: 'default-school' } }]);
        expect(w.find('#deviceList').exists()).toBe(false);
    });
    it('filters rooms, status payloads, stale selection and timer match controller', async () => {
        vi.useFakeTimers();
        const { w, requests, aj } = setup(DeviceManager, { responses: { activeschool: 'school2', getdevices: [device, { ...device, room: 'R2', hostname: 'pc02' }], checkOnline: 'down', checkOS: 'Linbo', getrunninglinboremotecommands: [], getPrestartCommands: [] } });
        await flushPromises(); expect(aj.identity.profile.activeSchool).toBe('school2');
        expect(requests[1].data).toEqual({ filepath: '/etc/linuxmuster/sophomorix/school2/school2.devices.csv', school: 'school2' });
        expect(w.find('#deviceList').text()).toBe('Please select a room to display devices!');
        await w.find('#sideBar .room input').setValue(true); await flushPromises();
        expect(w.findAll('.lmp_deviceBoxSM')).toHaveLength(1);
        expect(requests.filter(r => r.url.endsWith('checkOnline')).map(r => r.data)).toEqual([{ device }]);
        await w.find('.lmp_deviceBoxSM input').setValue(true);
        expect(w.find('floating-toolbar').text()).toContain('0 devices selected');
        await w.find('floating-toolbar .pull-right').trigger('click');
        expect(w.find('floating-toolbar').text()).toContain('1 devices selected');
        await w.find('#sideBar .room input').setValue(false); await flushPromises();
        expect(w.find('floating-toolbar').text()).toContain('Start'); // Original retains checked-list across room changes.
        await w.find('#sideBar .room input').setValue(true); await flushPromises();
        await w.find('[data-auto]').setValue(true); await w.find('[type=number]').setValue(1); await w.find('[data-set]').trigger('click');
        const before = requests.length; await vi.advanceTimersByTimeAsync(2000); await flushPromises(); expect(requests.length).toBe(before + 4);
        w.unmount(); wrappers = []; expect(vi.getTimerCount()).toBe(0);
    });
    it('single HTTP success ignores false status; HTTP failure notifies', async () => {
        vi.useFakeTimers();
        const { w, requests, notices } = setup(DeviceManager, { responses: { activeschool: 'default-school', getdevices: [device], checkOnline: 'down', checkOS: 'Linux', start: { status: false }, shutdown: new Error('offline') } });
        await flushPromises(); await w.find('.room input').setValue(true); await flushPromises();
        await w.find('[data-action=start]').trigger('click'); await flushPromises();
        await w.find('[data-action=shutdown]').trigger('click'); await flushPromises();
        expect(notices.map(n => n.slice(0, 2))).toEqual([['success', 'Device start successful initiated!'], ['error', 'Device shutdown failed!']]);
        expect(requests.find(r => r.url.endsWith('/start')).data).toEqual({ device: { ...device, os: 'Linux', online: 'down' } });
        const before = requests.length; await vi.advanceTimersByTimeAsync(3000); await flushPromises(); expect(requests.length).toBe(before + 4);
    });
    it('remoteBlock/status controls match original, including Linbo remote exception', async () => {
        const { w } = setup(DeviceManager, { responses: { activeschool: 'default-school', getdevices: [{ ...device, remoteBlock: true }], checkOnline: 'down', checkOS: 'Linbo' } });
        await flushPromises(); await w.find('.room input').setValue(true); await flushPromises();
        expect(w.find('[data-action=start]').exists()).toBe(false);
        expect(w.find('[data-action=shutdown]').exists()).toBe(false);
        expect(w.find('[data-action=remote]').exists()).toBe(true);
        expect(w.find('[data-action=prestart]').exists()).toBe(false);
    });
});
describe('dialogs', () => {
    it('builds ordered command and retains last-sync on device, clears flags on Cancel', async () => {
        const selected = { ...device };
        const { w, requests } = setup(LinboRemote, { props: { device: selected, prestart: true, refreshPrestart: vi.fn(), refreshProcesses: vi.fn() }, responses: { getlinboconfig: [{ BaseImage: 'a' }, { BaseImage: 'b' }], getlastsync: { date: 'Never', status: 'danger' } } });
        await flushPromises(); expect(requests.map(r => r.data)).toEqual([{ device }, { device: { ...device, linboconfig: [{ BaseImage: 'a' }, { BaseImage: 'b' }] }, image: 'a' }, { device: { ...device, linboconfig: [{ BaseImage: 'a' }, { BaseImage: 'b' }] }, image: 'b' }]);
        await w.find('[data-global=format]').trigger('click'); await w.find('[data-global=partition]').trigger('click'); await w.find('[data-global=initcache]').trigger('click'); await w.find('[data-global=disablegui]').trigger('click');
        await w.find('[data-image="1-sync"]').trigger('click');
        expect(w.find('.alert-info').text()).toBe('linbo-remote -s default-school -i pc01 -d -p format,partition,initcache,sync:2');
        await w.find('[data-cancel]').trigger('click'); expect(w.emitted('close')).toEqual([[]]);
    });
    it('run failure preserves command; success prestart refreshes and closes', async () => {
        const refresh = vi.fn(); let fail = true;
        const { w, requests, notices } = setup(LinboRemote, { props: { device, prestart: true, refreshPrestart: refresh, refreshProcesses: vi.fn() }, responses: { getlinboconfig: [], run: () => { if (fail) throw Error('404'); return null; } } });
        await flushPromises(); await w.find('[data-global=format]').trigger('click'); await w.find('[data-run]').trigger('click'); await flushPromises();
        expect(notices[0].slice(0, 2)).toEqual(['error', 'Command failed!']); expect(w.find('.alert-info').exists()).toBe(true);
        fail = false; await w.find('[data-run]').trigger('click'); await flushPromises();
        expect(requests.at(-1).data).toEqual({ command: 'linbo-remote -s default-school -i pc01 -p format' });
        expect(refresh).toHaveBeenCalledOnce(); expect(w.emitted('close')).toEqual([[]]);
    });
    it('running command polls logs and releases timer', async () => {
        vi.useFakeTimers(); const refresh = vi.fn();
        const { w, requests } = setup(LinboRemote, { props: { device, refreshPrestart: vi.fn(), refreshProcesses: refresh }, responses: { getlinboconfig: [], run: null, getlinboremotelog: 'hello' } });
        await flushPromises(); await w.find('[data-global=partition]').trigger('click'); await w.find('[data-run]').trigger('click'); await flushPromises();
        expect(w.find('textarea').element.value).toBe('Linbo is running...'); await vi.advanceTimersByTimeAsync(1000); await flushPromises();
        expect(w.find('textarea').element.value).toBe('hello'); expect(refresh).toHaveBeenCalledOnce(); expect(requests.at(-1).url).toBe(base + 'getlinboremotelog');
        await w.find('[data-cancel]').trigger('click'); expect(vi.getTimerCount()).toBe(0);
    });
    it('process log starts after 1s, first host remains selected, Kill does nothing', async () => {
        vi.useFakeTimers(); const refresh = vi.fn();
        const processes = [{ id: '1', hostname: 'a' }, { id: '2', hostname: 'b' }];
        const { w, requests } = setup(Processes, { props: { processes, refresh }, responses: { getlinboremotelog: 'log' } });
        await w.findAll('[data-show]')[0].trigger('click'); await w.findAll('[data-show]')[1].trigger('click'); expect(requests).toEqual([]);
        await vi.advanceTimersByTimeAsync(1000); await flushPromises(); expect(requests.map(r => r.data)).toEqual([{ device: { hostname: 'a' } }]);
        expect(w.find('textarea').element.value).toBe('log'); await w.find('[data-kill]').trigger('click'); expect(requests).toHaveLength(1);
        await w.find('[data-refresh]').trigger('click'); expect(refresh).toHaveBeenCalledOnce();
    });
    it('prestart uses prompt result without extra trim, refreshes even false status', async () => {
        const command = { name: 'pc01', path: '/srv/linbo/linbocmd/pc01.cmd', content: 'sync:1' }, refresh = vi.fn();
        const { w, requests, notices } = setup(Prestart, { props: { commands: [command], refresh }, messagebox: { prompt: vi.fn(async () => ({ value: 'sync:1,start:1' })) }, responses: { editPrestartCommands: { status: false, message: 'bad' }, removePrestartCommands: { status: true } } });
        await w.find('[data-edit]').trigger('click'); await flushPromises(); await w.find('[data-delete]').trigger('click'); await flushPromises();
        expect(requests.map(r => ({ url: r.url, data: r.data }))).toEqual([{ url: base + 'editPrestartCommands', data: { preStartCommand: command, newCommand: 'sync:1,start:1' } }, { url: base + 'removePrestartCommands', data: { preStartCommand: command } }]);
        expect(notices.map(n => n.slice(0, 2))).toEqual([['error', 'Failed to edit: bad'], ['success', 'Command deleted successfully!']]); expect(refresh).toHaveBeenCalledTimes(2);
    });
    it('bulk counts false statuses while HTTP failures leave Close disabled', async () => {
        const { w } = setup(BulkAction, { props: { devices: [device, { ...device, hostname: 'pc02' }], action: 'reboot' }, responses: { reboot: req => ({ status: req.data.device.hostname === 'pc01', message: 'bad' }) } });
        await flushPromises(); expect(w.text()).toContain('2 / 2'); expect(w.text()).toContain('pc02: bad'); expect(w.find('button').attributes('disabled')).toBeUndefined();
        const failed = setup(BulkAction, { props: { devices: [device], action: 'start' }, responses: { start: new Error('offline') } });
        await flushPromises(); expect(failed.w.text()).toContain('0 / 1'); expect(failed.w.find('button').attributes('disabled')).toBeDefined();
    });
});

it('entry mounts without Angular; toolbar selection and all five modal paths use aj', async () => {
    const element = document.createElement('div'); document.body.append(element);
    const aj = createMockAj(); aj.shell = { layout: { sidebar: true } }; const stop = mountEntry(element, aj); stop(); element.remove();
    const open = vi.fn(async () => undefined);
    const { w } = setup(DeviceManager, { modal: { open }, responses: { activeschool: 'default-school', getdevices: [device], checkOS: 'Linbo', checkOnline: 'down', getrunninglinboremotecommands: [], getPrestartCommands: [] } });
    await flushPromises(); await w.find('.room input').setValue(true); await flushPromises();
    await w.find('floating-toolbar .pull-right').trigger('click');
    expect(w.find('floating-toolbar').text()).toContain('1 devices selected');
    await w.find('floating-toolbar button').trigger('click');
    await w.find('[data-action=remote]').trigger('click'); await w.find('[data-action=prestart]').trigger('click');
    await w.findAll('#sideBar button')[0].trigger('click'); await w.findAll('#sideBar button')[1].trigger('click'); await flushPromises();
    expect(open.mock.calls.map(c => c[0])).toEqual([BulkAction, LinboRemote, LinboRemote, Processes, Prestart]);
    expect(open.mock.calls.map(c => c[2])).toEqual(Array(5).fill({ backdrop: 'static' }));
    await w.find('floating-toolbar .pull-right').trigger('click'); expect(w.find('floating-toolbar').text()).toContain('0 devices selected');
    await w.find('.lmp_deviceBoxSM button:has(.fa-bars)').trigger('click');
    expect(w.find('.input-group-btn.open').exists()).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); await flushPromises();
    expect(w.find('.input-group-btn.open').exists()).toBe(false);
});
it('prestart cancel/HTTP error preserve list; delete status false reports backend message', async () => {
    const command = { name: 'pc01', content: 'sync:1' }, refresh = vi.fn();
    let cancel = true;
    const { w, notices, requests } = setup(Prestart, { props: { commands: [command], refresh }, messagebox: { prompt: async () => { if (cancel) throw Error('cancel'); return { value: 'sync:1' }; } }, responses: { editPrestartCommands: new Error('offline'), removePrestartCommands: { status: false, message: 'bad' } } });
    await w.find('[data-edit]').trigger('click'); await flushPromises(); expect(requests).toEqual([]);
    cancel = false; await w.find('[data-edit]').trigger('click'); await flushPromises(); expect(refresh).not.toHaveBeenCalled();
    await w.find('[data-delete]').trigger('click'); await flushPromises();
    expect(notices.map(n => n.slice(0,2))).toEqual([['error', 'Failed to delete: bad']]);
    await w.find('.modal-footer button:last-child').trigger('click'); expect(w.emitted('close')).toEqual([[]]);
});

it('Linbo dialog shares status updates with the device list while open', async () => {
    const shared = shallowRef({ ...device });
    const { w, requests } = setup(LinboRemote, { props: { device: shared, prestart: true, updateDevice: d => { shared.value = d; }, refreshPrestart: vi.fn() }, responses: { getlinboconfig: [], run: null } });
    await flushPromises();
    shared.value = { ...shared.value, online: 'up', os: 'Linbo' }; await flushPromises();
    await w.find('[data-global=format]').trigger('click');
    expect(shared.value).toEqual({ ...device, linboconfig: [], online: 'up', os: 'Linbo', format: true });
    await w.find('[data-run]').trigger('click'); await flushPromises();
    expect(requests.at(-1).data).toEqual({ command: 'linbo-remote -s default-school -i pc01 -p format' });
});

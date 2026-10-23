import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { mount, flushPromises } from '@vue/test-utils';
import { createModalService } from '../../adapter/modal.mjs';
import Devices from './Devices.vue';
import ApplyDialog from './ApplyDialog.vue';
import AddDialog from './AddDialog.vue';
import { mount as mountEntry } from './entry.mjs';

const device = (changes = {}) => ({ room: 'r100', hostname: 'pc01', group: 'ubuntu', mac: '02:00:00:00:00:01', ip: '10.0.0.10', pxeFlag: '0', sophomorixRole: 'classroom-studentcomputer', ...changes });
const comment = { room: '# P17 comment' };
let wrappers = [];
function setup(data = [comment, device()], overrides = {}) {
    const aj = {
        gettext: (s) => s, identity: { user: 'admin', profile: {} },
        pageTitle: { set: vi.fn() }, reload: vi.fn(),
        http: { get: vi.fn(async (url) => ({ data: url.endsWith('/groups') ? ['ubuntu', 'win'] : url.endsWith('/activeschool') ? 'default-school' : structuredClone(data) })), post: vi.fn(async () => ({})) },
        notify: { success: vi.fn(), error: vi.fn() }, ...overrides,
    };
    aj.modal = createModalService(() => aj);
    const wrapper = mount(Devices, { attachTo: document.body, global: { provide: { aj } } });
    wrappers.push(wrapper);
    return { wrapper, aj };
}
const button = (w, text) => w.findAll('button, a.btn').find((b) => b.text() === text);
const rows = (w) => w.findAll('tr.device-row');
const cell = (w, name, row = 0) => rows(w)[row].find(`[data-field="${name}"] input`);
afterEach(() => { wrappers.forEach((w) => w.unmount()); wrappers = []; document.body.innerHTML = ''; vi.restoreAllMocks(); vi.useRealTimers(); });

describe('devices original view contract', () => {
    it('loads school and groups, hides comments, titles the page and filters across fields', async () => {
        const { wrapper: w, aj } = setup([comment, device(), device({ hostname: 'pc02', mac: '02:00:00:00:00:02', ip: '10.0.0.2' })]);
        expect(w.find('[role="progressbar"]').exists()).toBe(true);
        await flushPromises();
        expect(aj.pageTitle.set).toHaveBeenCalledWith('Devices');
        expect(aj.identity.profile.activeSchool).toBe('default-school');
        expect(rows(w)).toHaveLength(2);
        await cell(w, 'group').setValue('ub');
        expect(w.findAll('.group-options a').map((x) => x.text())).toEqual(['ubuntu']);
        await w.find('.group-options a').trigger('mousedown');
        expect(cell(w, 'group').element.value).toBe('ubuntu');
        await cell(w, 'group').setValue('w');
        await cell(w, 'group').trigger('keydown', { key: 'ArrowDown' });
        await cell(w, 'group').trigger('keydown', { key: 'ArrowUp' });
        await cell(w, 'group').trigger('keydown', { key: 'Enter' });
        expect(cell(w, 'group').element.value).toBe('win');
        await cell(w, 'group').setValue('ub');
        await cell(w, 'group').trigger('keydown', { key: 'Escape' });
        expect(w.find('.group-options').exists()).toBe(false);
        await cell(w, 'group').setValue('missing');
        await cell(w, 'group').trigger('keydown', { key: 'Enter' });
        await cell(w, 'group').trigger('blur');
        await w.find('input[type="search"]').setValue('pc02');
        expect(rows(w)).toHaveLength(1);
        expect(cell(w, 'hostname').element.value).toBe('pc02');
        await w.find('input[type="search"]').setValue('no-match');
        expect(rows(w)).toHaveLength(0);
    });
    it('sorts numeric IPs, pages and preserves the original total count including comments', async () => {
        const data = Array.from({ length: 12 }, (_, i) => device({ hostname: `pc${i}`, group: i === 0 ? '-g' : i === 1 ? '_g' : 'ubuntu', ip: `10.0.0.${12 - i}` }));
        const { wrapper: w } = setup([comment, ...data]); await flushPromises();
        await button(w, 'Room').trigger('click');
        await w.find('[data-sort="group"]').trigger('click');
        expect(cell(w, 'group').element.value).toBe('-g');
        await button(w, 'Group').trigger('click');
        await w.find('[data-sort="ip"]').trigger('click');
        expect(cell(w, 'ip').element.value).toBe('10.0.0.1');
        await button(w, 'Rows').trigger('click');
        await w.find('[data-size="10"]').trigger('click');
        expect(rows(w)).toHaveLength(10);
        await w.find('[data-page="2"]').trigger('click');
        expect(rows(w)).toHaveLength(2);
        await button(w, 'Fields').trigger('click');
        await w.find('input[data-visible="officeKey"]').setValue(true);
        expect(w.find('[data-field="officeKey"] input').exists()).toBe(true);
    });
    it('blocks invalid and empty rendered cells and sends the complete CSV payload after correction', async () => {
        const { wrapper: w, aj } = setup(); await flushPromises();
        await cell(w, 'mac').setValue('invalid'); await cell(w, 'mac').trigger('blur');
        await button(w, 'Save').trigger('click');
        await button(w, 'Save & import').trigger('click');
        expect(aj.http.post).not.toHaveBeenCalled();
        expect(w.find('#error_messages').text()).toContain('invalid is not valid or duplicated');
        await w.find('input[type="search"]').setValue('no-match');
        expect(w.find('#error_messages').text()).toContain('invalid is not valid or duplicated');
        await w.find('input[type="search"]').setValue('');
        await cell(w, 'hostname').setValue(''); await cell(w, 'hostname').trigger('blur');
        expect(w.find('#error_messages').text()).toContain('empty cells');
        await cell(w, 'hostname').setValue('pc01'); await cell(w, 'hostname').trigger('blur');
        await cell(w, 'mac').setValue('02:00:00:00:00:01'); await cell(w, 'mac').trigger('blur');
        await button(w, 'Save').trigger('click'); await flushPromises();
        expect(aj.http.post).toHaveBeenCalledWith('/api/lmn/devices', [comment, device()]);
        expect(aj.notify.success).toHaveBeenCalledWith('Saved');
        expect(w.find('#error_messages').exists()).toBe(false);
    });
    it('keeps legacy visible-page-only validation and pristine-before-response behavior', async () => {
        const { wrapper: w, aj } = setup([device(), device({ hostname: 'bad', mac: 'invalid', ip: '10.0.0.2' })]); await flushPromises();
        await w.find('input[type="search"]').setValue('pc01');
        aj.http.post.mockRejectedValueOnce(new Error('backend'));
        await cell(w, 'room').setValue('r101'); await cell(w, 'room').trigger('blur');
        await button(w, 'Save').trigger('click'); await flushPromises();
        expect(aj.http.post).toHaveBeenCalledOnce();
        const confirm = vi.spyOn(window, 'confirm');
        window.dispatchEvent(new Event('lmn-devices-leave', { cancelable: true }));
        expect(confirm).not.toHaveBeenCalled();
        expect(aj.notify.success).not.toHaveBeenCalled();
    });
    it('adds, duplicates and removes using dialogs without mutating the source row', async () => {
        const { wrapper: w } = setup(); await flushPromises();
        await button(w, 'Add a device').trigger('click'); await flushPromises();
        let dialog = document.querySelector('[role="dialog"]');
        const inputs = dialog.querySelectorAll('input');
        ['r200', 'pc02', 'ubuntu', '02:00:00:00:00:02', '10.0.0.20'].forEach((value, i) => { inputs[i].value = value; inputs[i].dispatchEvent(new Event('input')); });
        [...dialog.querySelectorAll('button')].find((b) => b.textContent === 'Add').click(); await flushPromises();
        expect(rows(w)).toHaveLength(2);
        await rows(w)[0].find('[title="Duplicate"]').trigger('click'); await flushPromises();
        dialog = document.querySelector('[role="dialog"]');
        expect(dialog.querySelectorAll('input')[1].value).toBe('pc02');
        [...dialog.querySelectorAll('button')].find((b) => b.textContent === 'Add').click(); await flushPromises();
        expect(rows(w)).toHaveLength(3);
        await rows(w)[0].find('[title="Remove"]').trigger('click');
        expect(rows(w)).toHaveLength(2);
    });
    it('opens school-specific CSV editor and backups; reloads only after editor success', async () => {
        const { wrapper: w, aj } = setup(); await flushPromises();
        aj.modal.open = vi.fn().mockResolvedValue('csv');
        await button(w, 'Edit CSV').trigger('click'); await flushPromises();
        expect(aj.modal.open.mock.calls[0][1].path).toBe('/etc/linuxmuster/sophomorix/default-school/devices.csv');
        expect(aj.reload).toHaveBeenCalledOnce();
        await w.find('[title="Backups"]').trigger('click'); await flushPromises();
        expect(aj.modal.open.mock.calls[1][1].path).toContain('/devices.csv');
        aj.http.get.mockImplementation(async (url) => ({ data: url.endsWith('/groups') ? [] : url.endsWith('/activeschool') ? 'school2' : [] }));
        w.unmount(); wrappers = [];
        const second = mount(Devices, { global: { provide: { aj } } }); wrappers.push(second); await flushPromises();
        aj.modal.open.mockRejectedValueOnce(new Error('cancel'));
        await button(second, 'Edit CSV').trigger('click'); await flushPromises();
        expect(aj.modal.open.mock.calls[2][1].path).toBe('/etc/linuxmuster/sophomorix/school2/school2.devices.csv');
        expect(aj.reload).toHaveBeenCalledOnce();
    });
    it('handles Ctrl S/I/B and cancels leaving dirty forms, removing handlers on unmount', async () => {
        const { wrapper: w, aj } = setup(); await flushPromises();
        aj.modal.open = vi.fn().mockResolvedValue();
        await cell(w, 'room').setValue('r102'); await cell(w, 'room').trigger('blur');
        const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
        const leave = new Event('lmn-devices-leave', { cancelable: true }); window.dispatchEvent(leave);
        expect(leave.defaultPrevented).toBe(true);
        confirm.mockReturnValue(true);
        const accepted = new Event('lmn-devices-leave', { cancelable: true }); window.dispatchEvent(accepted);
        expect(accepted.defaultPrevented).toBe(false);
        for (const key of ['s', 'i', 'b']) { window.dispatchEvent(new KeyboardEvent('keydown', { key, ctrlKey: true, cancelable: true })); await flushPromises(); }
        expect(aj.http.post).toHaveBeenCalledTimes(2);
        expect(aj.modal.open.mock.calls[0][0]).toBe(ApplyDialog);
        expect(aj.modal.open).toHaveBeenCalledTimes(2);
        w.unmount(); wrappers = [];
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }));
        expect(aj.http.post).toHaveBeenCalledTimes(2);
    });
    it('applies the original hostname length exceptions for special roles', async () => {
        const { wrapper: w, aj } = setup([device({ sophomorixRole: 'server', hostname: 'very-long-server-hostname' })]); await flushPromises();
        expect(w.findAll('.has-error-new')).toHaveLength(0);
        await button(w, 'Save').trigger('click'); await flushPromises();
        expect(aj.http.post).toHaveBeenCalledOnce();
        const role = rows(w)[0].find('select');
        await role.setValue('classroom-studentcomputer');
        expect(w.findAll('.has-error-new')).toHaveLength(1);
    });
    it('normalizes MAC input using the same visible-row index as the legacy validator', async () => {
        const { wrapper: w } = setup([device({ mac: '021700000002' })]); await flushPromises();
        expect(cell(w, 'mac').element.value).toBe('02:17:00:00:00:02');
        await cell(w, 'mac').setValue('021700000001'); await cell(w, 'mac').trigger('blur');
        expect(cell(w, 'mac').element.value).toBe('02:17:00:00:00:01');
        await cell(w, 'group').setValue('other');
        expect(cell(w, 'group').element.value).toBe('other');
        window.dispatchEvent(new CustomEvent('lmn-devices-sidebar', { detail: false })); await flushPromises();
        expect(w.find('floating-toolbar .col-md-12').exists()).toBe(true);
    });
    it('keeps the spinner on failed load and does not render an empty table', async () => {
        const { wrapper: w } = setup([], { http: { get: vi.fn().mockRejectedValue(new Error('HTTP')), post: vi.fn() } });
        await flushPromises(); expect(w.find('[role="progressbar"]').exists()).toBe(true); expect(w.find('table').exists()).toBe(false);
    });
    it('opens a large static-backdrop import dialog after saving and keeps it open on backdrop click', async () => {
        const { wrapper: w, aj } = setup(); await flushPromises();
        await button(w, 'Save & import').trigger('click'); await flushPromises();
        expect(aj.http.post.mock.calls.map(([url]) => url)).toEqual(['/api/lmn/devices', '/api/lmn/devices/import']);
        const dialog = document.querySelector('.modal');
        expect(dialog.querySelector('.modal-lg')).not.toBeNull();
        dialog.dispatchEvent(new MouseEvent('click', { bubbles: true })); await flushPromises();
        expect(document.querySelector('.modal')).toBe(dialog);
        [...dialog.querySelectorAll('a')].find((a) => a.textContent === 'Close').click(); await flushPromises();
        expect(document.querySelector('.modal')).toBeNull();
    });
    it('mount entry unmounts the complete view', async () => {
        const { wrapper: w, aj } = setup(); await flushPromises(); w.unmount(); wrappers = [];
        const host = document.createElement('div'); document.body.append(host);
        const dispose = mountEntry(host, aj); await flushPromises();
        expect(host.querySelector('table')).not.toBeNull(); dispose(); expect(host.innerHTML).toBe('');
    });
});

describe('device dialogs', () => {
    it('cancels adding without returning a device and copies duplicate inputs', async () => {
        const aj = { gettext: (s) => s };
        const source = device(); const w = mount(AddDialog, { props: { device: source }, global: { provide: { aj } } }); wrappers.push(w);
        await w.find('input').setValue('other'); expect(source.room).toBe('r100');
        await button(w, 'Cancel').trigger('click'); expect(w.emitted('cancel')).toHaveLength(1);
    });
    it('shows import log, completion and toggles details', async () => {
        vi.useFakeTimers();
        const aj = { gettext: (s) => s, http: { post: vi.fn().mockResolvedValue({}), get: vi.fn().mockResolvedValue({ data: 'P17 log' }) }, notify: { success: vi.fn(), error: vi.fn() } };
        const w = mount(ApplyDialog, { global: { provide: { aj } } }); wrappers.push(w);
        expect(w.find('[role="progressbar"]').exists()).toBe(true); await flushPromises();
        expect(aj.http.post).toHaveBeenCalledWith('/api/lmn/devices/import');
        await vi.advanceTimersByTimeAsync(1000); await flushPromises();
        expect(w.text()).toContain('P17 log'); expect(aj.notify.success).toHaveBeenCalledWith('Import complete');
        await button(w, 'Hide details').trigger('click'); expect(button(w, 'Details')).toBeDefined();
        await button(w, 'Details').trigger('click'); await button(w, 'Close').trigger('click'); expect(w.emitted('close')).toHaveLength(1);
    });
    it('reports import rejection and flips details like the old controller', async () => {
        const aj = { gettext: (s) => s, http: { post: vi.fn().mockRejectedValue({ data: { message: 'failed' } }), get: vi.fn().mockResolvedValue({ data: '' }) }, notify: { success: vi.fn(), error: vi.fn() } };
        const w = mount(ApplyDialog, { global: { provide: { aj } } }); wrappers.push(w); await flushPromises();
        expect(aj.notify.error).toHaveBeenCalledWith('Import failed', 'failed'); expect(button(w, 'Details')).toBeDefined(); expect(button(w, 'Close')).toBeDefined();
    });
});


describe('Angular shell glue', () => {
    it('cancels location changes through the local Vue event and removes scope watches', () => {
        let directive; let route;
        const module = { config: (fn) => fn({ when: (path, config) => { route = { path, config }; } }), directive: (_, fn) => { directive = fn(); } };
        vm.runInNewContext(readFileSync('../usr/lib/linuxmuster-webui/plugins/lmn_devices/resources/js/routing.es', 'utf8'), { angular: { module: () => module }, window, Event, CustomEvent });
        expect(route.path).toBe('/view/lmn/devices');
        expect(route.config.controller).toBeUndefined();
        const events = {}; const off = vi.fn(); const offWatch = vi.fn();
        const scope = { $on: (name, fn) => { events[name] = fn; return off; }, $watch: (_, fn) => { fn(false); return offWatch; } };
        const cancel = (e) => e.preventDefault(); window.addEventListener('lmn-devices-leave', cancel);
        directive.link(scope);
        const event = { preventDefault: vi.fn() }; events.$locationChangeStart(event);
        expect(event.preventDefault).toHaveBeenCalledOnce();
        window.removeEventListener('lmn-devices-leave', cancel);
        events.$destroy(); expect(off).toHaveBeenCalledOnce(); expect(offWatch).toHaveBeenCalledOnce();
    });
});

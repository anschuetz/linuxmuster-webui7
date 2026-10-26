import { afterEach, describe, expect, it, vi } from 'vitest';
import { reactive } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { createModalService } from '../../shell/modal.mjs';
import Devices from './Devices.vue';
import ApplyDialog from './ApplyDialog.vue';
import AddDialog from './AddDialog.vue';
import { mount as mountEntry } from './entry.mjs';

const device = (changes = {}) => ({ room: 'r100', hostname: 'pc01', group: 'ubuntu', mac: '02:00:00:00:00:01', ip: '10.0.0.10', pxeFlag: '0', sophomorixRole: 'classroom-studentcomputer', ...changes });
const comment = { room: '# P17 comment' };
let wrappers = [];
function setup(data = [comment, device()], overrides = {}) {
    const guards = [], offLeave = vi.fn();
    const aj = {
        shell: reactive({ layout: { sidebar: true } }),
        guardLeave: fn => { guards.push(fn); return offLeave; },
        gettext: (s) => s, identity: { user: 'admin', profile: {} },
        pageTitle: { set: vi.fn() }, reload: vi.fn(),
        http: { get: vi.fn(async (url) => ({ data: url.endsWith('/groups') ? ['ubuntu', 'win'] : url.endsWith('/activeschool') ? 'default-school' : structuredClone(data) })), post: vi.fn(async () => ({})) },
        notify: { success: vi.fn(), error: vi.fn() }, ...overrides,
    };
    aj.modal = createModalService(() => aj);
    const wrapper = mount(Devices, { attachTo: document.body, global: { provide: { aj } } });
    wrappers.push(wrapper);
    return { wrapper, aj, guards, offLeave };
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
    it('trims dialog and table text inputs in the saved payload', async () => {
        const { wrapper: w, aj } = setup([]); await flushPromises();
        await button(w, 'Add a device').trigger('click'); await flushPromises();
        const dialog = document.querySelector('[role="dialog"]');
        [' r100 ', ' pc01 ', ' ubuntu ', ' 02:00:00:00:00:01 ', ' 10.0.0.10 '].forEach((value, i) => {
            const input = dialog.querySelectorAll('input')[i];
            input.value = value; input.dispatchEvent(new Event('input'));
        });
        [...dialog.querySelectorAll('button')].find((b) => b.textContent === 'Add').click(); await flushPromises();
        await button(w, 'Save').trigger('click'); await flushPromises();
        expect(aj.http.post.mock.calls[0][1][0]).toMatchObject(device());
        await cell(w, 'hostname').setValue(' pc01 '); await cell(w, 'hostname').trigger('blur');
        await cell(w, 'group').setValue(' ubuntu ');
        await button(w, 'Save').trigger('click'); await flushPromises();
        expect(aj.http.post.mock.calls[1][1][0]).toMatchObject(device());
    });
    it('preserves a character-by-character room name with an inner space in the add dialog', async () => {
        const { wrapper: w } = setup([]); await flushPromises();
        await button(w, 'Add a device').trigger('click'); await flushPromises();
        const dialog = document.querySelector('[role="dialog"]');
        const input = dialog.querySelector('input');
        input.value = '';
        input.focus();
        for (const character of 'Room West') {
            input.value += character;
            input.dispatchEvent(new Event('input'));
            await flushPromises();
        }
        expect(input.value).toBe('Room West');
        [...dialog.querySelectorAll('button')].find((b) => b.textContent === 'Add').click();
        await flushPromises();
        expect(cell(w, 'room').element.value).toBe('Room West');
    });
    it('shows all ten matching typeahead groups', async () => {
        const groups = Array.from({ length: 10 }, (_, i) => `group${i}`);
        const { wrapper: w } = setup([device()], { http: {
            get: vi.fn(async (url) => ({ data: url.endsWith('/groups') ? groups : url.endsWith('/activeschool') ? 'default-school' : [device()] })),
            post: vi.fn(),
        } }); await flushPromises();
        await cell(w, 'group').setValue('group');
        expect(w.findAll('[role="option"]').map((option) => option.text())).toEqual(groups);
    });
    it('negates the filter across the whole device like Angular expression strings', async () => {
        const { wrapper: w } = setup([comment, device(), device({ hostname: 'pc02' })]); await flushPromises();
        await w.find('input[type="search"]').setValue('!pc01');
        expect(rows(w)).toHaveLength(1);
        expect(cell(w, 'hostname').element.value).toBe('pc02');
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
        const { wrapper: w, aj, guards } = setup([device(), device({ hostname: 'bad', mac: 'invalid', ip: '10.0.0.2' })]); await flushPromises();
        await w.find('input[type="search"]').setValue('pc01');
        aj.http.post.mockRejectedValueOnce(new Error('backend'));
        await cell(w, 'room').setValue('r101'); await cell(w, 'room').trigger('blur');
        await button(w, 'Save').trigger('click'); await flushPromises();
        expect(aj.http.post).toHaveBeenCalledOnce();
        const confirm = vi.spyOn(window, 'confirm');
        // The native guard sees the pristine state after the save starts.
        expect(guards[0]()).toBe(true);
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
        expect(w.find('button:has(.fa-history)').attributes('title')).toBeUndefined();
        await w.find('button:has(.fa-history)').trigger('click'); await flushPromises();
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
        const { wrapper: w, aj, guards, offLeave } = setup(); await flushPromises();
        aj.modal.open = vi.fn().mockResolvedValue();
        await cell(w, 'room').setValue('r102'); await cell(w, 'room').trigger('blur');
        const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
        expect(guards[0]()).toBe(false);
        confirm.mockReturnValue(true);
        expect(guards[0]()).toBe(true);
        for (const key of ['s', 'i', 'b']) { window.dispatchEvent(new KeyboardEvent('keydown', { key, ctrlKey: true, cancelable: true })); await flushPromises(); }
        expect(aj.http.post).toHaveBeenCalledTimes(2);
        expect(aj.modal.open.mock.calls[0][0]).toBe(ApplyDialog);
        expect(aj.modal.open).toHaveBeenCalledTimes(2);
        w.unmount(); wrappers = []; expect(offLeave).toHaveBeenCalledOnce();
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }));
        expect(aj.http.post).toHaveBeenCalledTimes(2);
    });
    it('applies the original hostname length exceptions for special roles', async () => {
        const { wrapper: w, aj } = setup([device({ sophomorixRole: 'server', hostname: 'very-long-server-hostname' })]); await flushPromises();
        expect(w.findAll('.c3-unchecked-error')).toHaveLength(0);
        await button(w, 'Save').trigger('click'); await flushPromises();
        expect(aj.http.post).toHaveBeenCalledOnce();
        const role = rows(w)[0].find('select');
        await role.setValue('classroom-studentcomputer');
        expect(w.findAll('.c3-unchecked-error')).toHaveLength(1);
    });
    it('normalizes MAC input using the same visible-row index as the legacy validator', async () => {
        const { wrapper: w, aj } = setup([device({ mac: '021700000002' })]); await flushPromises();
        expect(cell(w, 'mac').element.value).toBe('02:17:00:00:00:02');
        await cell(w, 'mac').setValue('021700000001'); await cell(w, 'mac').trigger('blur');
        expect(cell(w, 'mac').element.value).toBe('02:17:00:00:00:01');
        await cell(w, 'group').setValue('other');
        expect(cell(w, 'group').element.value).toBe('other');
        aj.shell.layout.sidebar = false; await flushPromises();
        expect(w.find('floating-toolbar .aj-theme-toolbar-full').exists()).toBe(true);
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
        const aj = { gettext: (s) => `translated:${s}` };
        const source = device(); const w = mount(AddDialog, { props: { device: source }, global: { provide: { aj } } }); wrappers.push(w);
        expect(w.findAll('tr')[4].find('span').text()).toBe('IP:');
        await w.find('input').setValue('other'); expect(source.room).toBe('r100');
        await button(w, 'translated:Cancel').trigger('click'); expect(w.emitted('cancel')).toHaveLength(1);
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

it('uses scoped BS5 controls, visible menus and actual invalid input states', async () => {
    const { wrapper: w } = setup([device({ hostname: '' })]);
    await flushPromises();
    expect(w.find('.c3-devices-scroll > .lm-table').exists()).toBe(true);
    await w.get('.c3-menu-control button').trigger('click');
    expect(w.find('.dropdown-menu.show .dropdown-item').exists()).toBe(true);
    await w.get('[data-sort=room]').trigger('click');
    expect(w.find('.dropdown-menu.show').exists()).toBe(false);
    await button(w, 'Save').trigger('click');
    await flushPromises();
    expect(w.get('[data-field=hostname] input').classes()).toContain('is-invalid');
    expect(w.find('.has-error, .form-group, .btn-default, .input-group-btn').exists()).toBe(false);
});

import { afterEach, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createMockAj } from '../adapter/mock.mjs';
import { createModalService } from '../adapter/modal.mjs';
import { openFileEditor } from './fileEditor.mjs';
import { openFileBackups } from './fileBackups.mjs';
import FileEditorDialog from './FileEditorDialog.vue';
import FileBackupsDialog from './FileBackupsDialog.vue';
import FileDiffDialog from './FileDiffDialog.vue';

let wrapper;
afterEach(() => { wrapper?.unmount(); wrapper = undefined; vi.unstubAllGlobals(); });
function setup(Component, options = {}, props = {}) {
    const http = vi.fn(async () => ({ data: '', status: 200 }));
    const aj = createMockAj({ http, ...options });
    wrapper = mount(Component, { props: { path: '/etc/a.csv', encoding: 'latin-1', ...props }, global: { provide: { aj } } });
    return { aj, http: options.http || http };
}
const click = async (text) => { await wrapper.findAll('button').find((b) => b.text() === text).trigger('click'); await flushPromises(); };
it('opens both helpers through aj.modal with their props and cancellation', async () => {
    const open = vi.fn().mockRejectedValue(new Error('cancel'));
    const aj = createMockAj({ modal: { open } });
    await expect(openFileEditor(aj, '/a', 'utf-8')).rejects.toThrow('cancel');
    expect(open).toHaveBeenLastCalledWith(FileEditorDialog, { path: '/a', encoding: 'utf-8' });
    await expect(openFileBackups(aj, '/b', 'latin-1')).rejects.toThrow('cancel');
    expect(open).toHaveBeenLastCalledWith(FileBackupsDialog, { path: '/b', encoding: 'latin-1' });
});
it('reads and saves raw text with an encoded encoding query', async () => {
    const { http } = setup(FileEditorDialog, { http: vi.fn(async () => ({ data: 'old' })) }, { encoding: 'utf 8' });
    await flushPromises();
    expect(wrapper.find('textarea').element.value).toBe('old');
    await wrapper.find('textarea').setValue('new');
    await click('Save');
    expect(http).toHaveBeenNthCalledWith(1, expect.objectContaining({ url: '/api/filesystem/read//etc/a.csv?encoding=utf%208' }));
    expect(http).toHaveBeenLastCalledWith(expect.objectContaining({ method: 'post', url: '/api/filesystem/write//etc/a.csv?encoding=utf%208', data: 'new' }));
    expect(wrapper.emitted('close')).toEqual([['new']]);
});
it('cancels without writing, and reports failed reading and saving', async () => {
    const http = vi.fn().mockRejectedValue(new Error('failed'));
    setup(FileEditorDialog, { http }); await flushPromises();
    expect(wrapper.find('[role=alert]').exists()).toBe(true);
    await click('Cancel'); expect(wrapper.emitted('cancel')).toHaveLength(1);
    expect(http).toHaveBeenCalledTimes(1);
    wrapper.unmount();
    setup(FileEditorDialog, { http: vi.fn().mockResolvedValueOnce({ data: 'a' }).mockRejectedValue(new Error('save')) });
    await flushPromises(); await click('Save');
    expect(wrapper.emitted('close')).toBeUndefined();
    expect(wrapper.find('[role=alert]').text()).toContain('save');
});
it('imports a dropped file using encoding and downloads current text with URL cleanup', async () => {
    const read = vi.fn(); let reader;
    vi.stubGlobal('FileReader', class { constructor() { reader = this; } readAsText = read; abort = vi.fn(); });
    const createObjectURL = vi.fn(() => 'blob:test'); const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    setup(FileEditorDialog); await flushPromises();
    const file = new File(['csv'], 'a.csv');
    await wrapper.find('[data-drop]').trigger('dragover', { dataTransfer: {} });
    await wrapper.find('[data-drop]').trigger('drop', { dataTransfer: { files: [file] } });
    expect(read).toHaveBeenCalledWith(file, 'latin-1');
    reader.onload({ target: { result: 'imported' } }); await flushPromises();
    expect(wrapper.find('textarea').element.value).toBe('imported');
    await click('Download CSV'); expect(createObjectURL).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test');
    expect(document.querySelector('a[download]')).toBeNull();
    wrapper.unmount(); wrapper = undefined;
    expect(reader.onload).toBeNull(); anchorClick.mockRestore();
});
it('reuses global Ace and removes its change listener and instance on unmount', async () => {
    const editor = { setValue: vi.fn(), getValue: () => 'ace content', on: vi.fn(), off: vi.fn(), destroy: vi.fn(), setReadOnly: vi.fn() };
    vi.stubGlobal('ace', { edit: vi.fn(() => editor) });
    setup(FileEditorDialog); await flushPromises();
    expect(window.ace.edit).toHaveBeenCalled();
    expect(editor.setValue).toHaveBeenCalledWith('', -1);
    editor.on.mock.calls[0][1](); await click('Save');
    expect(wrapper.emitted('close')).toEqual([['ace content']]);
    wrapper.unmount(); wrapper = undefined;
    expect(editor.off).toHaveBeenCalledWith('change', expect.any(Function));
    expect(editor.destroy).toHaveBeenCalledOnce();
});
function backups(options = {}) {
    const http = vi.fn(async ({ url }) => ({ data: url.includes('/list/') ? { items: [
        { name: '.a.csv.bak.100' }, { name: 'other' }, { name: '.a.csv.bak.200' },
    ] } : url.includes('/diff') ? ['< old', '> new'] : 'backup' }));
    return setup(FileBackupsDialog, { http, ...options });
}
it('lists matching backups newest first and opens diff with returned lines', async () => {
    const open = vi.fn().mockRejectedValue(new Error('cancel'));
    const { http } = backups({ modal: { open } }); await flushPromises();
    expect(http).toHaveBeenCalledWith(expect.objectContaining({ url: '/api/filesystem/list//etc' }));
    expect(wrapper.findAll('[data-backup]').map((r) => r.attributes('data-backup'))).toEqual(['.a.csv.bak.200', '.a.csv.bak.100']);
    await click('Show differences');
    expect(http).toHaveBeenLastCalledWith(expect.objectContaining({ url: '/api/lmn/diff', data: { file1: '/etc/a.csv', file2: '/etc/.a.csv.bak.200' } }));
    expect(open).toHaveBeenCalledWith(FileDiffDialog, { path: '/etc/a.csv', lines: ['< old', '> new'] });
});
it('restores in order, consumes backup and reloads only on success', async () => {
    const reload = vi.fn(); const { http } = backups({ reload }); await flushPromises(); await click('Restore');
    expect(http.mock.calls.slice(1).map(([r]) => [r.url, r.data])).toEqual([
        ['/api/filesystem/read//etc/.a.csv.bak.200?encoding=latin-1', undefined],
        ['/api/filesystem/write//etc/a.csv?encoding=latin-1', 'backup'],
        ['/api/lmn/remove-file', { filepath: '/etc/.a.csv.bak.200' }],
    ]);
    expect(reload).toHaveBeenCalledOnce(); expect(wrapper.emitted('close')).toHaveLength(1);
});
it('closes and reloads a successful restore even when backup removal fails', async () => {
    const reload = vi.fn(); const notify = vi.fn();
    const { http } = backups({ reload, notify }); await flushPromises();
    http.mockImplementation(async ({ url }) => {
        if (url === '/api/lmn/remove-file') throw new Error('removal failed');
        return { data: 'backup' };
    });
    await click('Restore');
    expect(notify).toHaveBeenCalledWith('success', 'Backup file restored', undefined);
    expect(notify).toHaveBeenCalledWith('error', expect.stringContaining('removal failed'), undefined);
    expect(wrapper.emitted('close')).toHaveLength(1);
    expect(reload).toHaveBeenCalledOnce();
});
it('resolves openFileBackups after confirmed successful deletion', async () => {
    let destroy;
    const http = vi.fn(async ({ url }) => ({ data: url.includes('/list/')
        ? { items: [{ name: '.a.csv.bak.100' }] } : '' }));
    const show = vi.fn().mockResolvedValue(undefined);
    const aj = createMockAj({ http, messagebox: { show } });
    aj.modal = createModalService(() => aj, { $on: (_, cb) => { destroy = cb; return vi.fn(); } });
    const resolved = vi.fn();
    const result = openFileBackups(aj, '/etc/a.csv', 'latin-1').then(resolved, () => {});
    try {
        await flushPromises();
        [...document.querySelectorAll('[role=dialog] button')].find((button) => button.textContent === 'Delete').click();
        await flushPromises();
        expect(show).toHaveBeenCalledOnce();
        expect(http).toHaveBeenLastCalledWith(expect.objectContaining({ url: '/api/lmn/remove-file', data: { filepath: '/etc/.a.csv.bak.100' } }));
        expect(resolved).toHaveBeenCalledOnce();
        expect(document.querySelector('[role=dialog]')).toBeNull();
    } finally { destroy(); await result; }
});
it.each([true, false])('deletion requires messagebox confirmation: %s', async (confirmed) => {
    const show = vi.fn(() => confirmed ? Promise.resolve() : Promise.reject(new Error('cancel')));
    const { http } = backups({ messagebox: { show } }); await flushPromises(); await click('Delete');
    expect(show).toHaveBeenCalledWith(expect.objectContaining({ negative: 'Cancel', positive: 'OK' }));
    expect(http.mock.calls.filter(([r]) => r.url === '/api/lmn/remove-file')).toHaveLength(confirmed ? 1 : 0);
    expect(wrapper.findAll('[data-backup]')).toHaveLength(confirmed ? 1 : 2);
});
it('shows backup errors without closing or reloading and can cancel', async () => {
    const reload = vi.fn(); const { http } = backups({ reload }); await flushPromises();
    http.mockRejectedValue(new Error('restore failed')); await click('Restore');
    expect(wrapper.find('[role=alert]').text()).toContain('restore failed');
    expect(reload).not.toHaveBeenCalled(); expect(wrapper.emitted('close')).toBeUndefined();
    await click('Close'); expect(wrapper.emitted('cancel')).toHaveLength(1);
});
it('renders escaped diff lines, empty diff, and closes', async () => {
    setup(FileDiffDialog, {}, { lines: ['< old', '> new', '@ pos', '<script>'] });
    expect(wrapper.find('script').exists()).toBe(false);
    expect(wrapper.text()).toContain('<script>');
    await click('Close'); expect(wrapper.emitted('cancel')).toHaveLength(1);
    await wrapper.setProps({ lines: [] }); expect(wrapper.text()).toContain('No differences detected');
});
it('tears down an editor opened by the modal service on scope destruction', async () => {
    let destroy; const aj = createMockAj();
    aj.modal = createModalService(() => aj, { $on: (_, cb) => { destroy = cb; return vi.fn(); } });
    const result = openFileEditor(aj, '/tmp/a'); const rejected = expect(result).rejects.toThrow('cancelled');
    await flushPromises(); destroy(); await rejected;
    expect(document.querySelector('[role=dialog]')).toBeNull();
    expect(document.body.classList.contains('modal-open')).toBe(false);
});

it('uses utf-8 by default and never saves after a failed initial read', async () => {
    const { http } = setup(FileEditorDialog, { http: vi.fn().mockRejectedValue('read failed') }, { encoding: undefined });
    await flushPromises(); await click('Save');
    expect(http).toHaveBeenCalledTimes(1);
    expect(http).toHaveBeenCalledWith(expect.objectContaining({ url: '/api/filesystem/read//etc/a.csv?encoding=utf-8' }));
    expect(wrapper.findAll('button')[0].element.disabled).toBe(true);
});
it('aborts pending file readers on unmount and reports local read errors', async () => {
    let reader;
    vi.stubGlobal('FileReader', class { constructor() { reader = this; } readyState = 1; readAsText = vi.fn(); abort = vi.fn(); });
    setup(FileEditorDialog, {}, { encoding: undefined }); await flushPromises();
    await wrapper.find('[data-drop]').trigger('drop', { dataTransfer: { files: [new File([''], 'a')] } });
    expect(reader.readAsText).toHaveBeenCalledWith(expect.any(File), 'utf-8');
    reader.onerror(); await flushPromises();
    expect(wrapper.find('[role=alert]').text()).toContain('Could not read file');
    wrapper.unmount(); wrapper = undefined;
    expect(reader.abort).toHaveBeenCalledOnce(); expect(reader.onerror).toBeNull();
});
it('ignores late reads after editor destruction', async () => {
    let resolve;
    setup(FileEditorDialog, { http: () => new Promise((done) => { resolve = done; }) });
    wrapper.unmount(); wrapper = undefined;
    resolve({ data: 'late' }); await flushPromises();
    expect(document.querySelector('textarea')).toBeNull();
});
it('shows empty backup list and reports list failures', async () => {
    setup(FileBackupsDialog, { http: async () => ({ data: { items: [] } }) });
    await flushPromises(); expect(wrapper.text()).toContain('No backups available');
    wrapper.unmount();
    setup(FileBackupsDialog, { http: async () => { throw 'list failed'; } });
    await flushPromises(); expect(wrapper.find('[role=alert]').text()).toContain('list failed');
});
it('does not delete after confirmation when the owning dialog was destroyed', async () => {
    let confirm;
    const { http } = backups({ messagebox: { show: () => new Promise((done) => { confirm = done; }) } });
    await flushPromises(); await click('Delete');
    wrapper.unmount(); wrapper = undefined; confirm(); await flushPromises();
    expect(http).toHaveBeenCalledTimes(1);
});

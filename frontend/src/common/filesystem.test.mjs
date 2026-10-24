import { afterEach, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { defineComponent, ref } from 'vue';
import { createMockAj } from '../adapter/mock.mjs';
import { filesOracle } from '../../test-fixtures/shell/files.mjs';
import { createFilesystem } from './filesystem.mjs';
import FileDialog from './FileDialog.vue';
import PathSelector from './PathSelector.vue';
import CodeEditor from './CodeEditor.vue';
import FileUpload from './FileUpload.vue';
class FakeFlow {
    handlers = new Map(); upload = vi.fn(); cancel = vi.fn();
    on(event, fn) { this.handlers.set(event, fn); }
    off(event) { this.handlers.delete(event); }
    fire(event) { this.handlers.get(event)?.(); }
}

const wrappers = [], oracles = [];
afterEach(() => { wrappers.splice(0).forEach(w => w.unmount()); oracles.splice(0).forEach(o => o.close()); vi.unstubAllGlobals(); });
const oracle = options => { const o = filesOracle(options); oracles.push(o); return o; };
const items = [ { name: 'z.txt', path: '/z.txt', isFile: true }, { name: 'dir', path: '/dir', isDir: true }, { name: 'a.txt', path: '/a.txt', isFile: true } ];
function setup(component, props = {}, options = {}) {
    const http = vi.fn(async () => ({ data: { items, parent: null } }));
    const aj = createMockAj({ http, ...options });
    const w = mount(component, { props, global: { provide: { aj } } }); wrappers.push(w);
    return { w, aj, http };
}
const button = (w, text) => w.findAll('button').find(b => b.text() === text);
it('matches original read/write encoding, raw payload and data unwrapping', async () => {
    const old = oracle();
    const http = vi.fn(async () => ({ data: 'fixture' })); const fs = createFilesystem(createMockAj({ http }));
    expect(await fs.read('/etc/demo', 'latin-1')).toBe(old.filesystem.read('/etc/demo', 'latin-1'));
    expect(await fs.write('/etc/demo', '  ä\n', '')).toBe(old.filesystem.write('/etc/demo', '  ä\n', ''));
    expect(http.mock.calls.map(([r]) => ({ method: r.method, url: r.url, data: r.data }))).toEqual(old.calls);
    await fs.stat('/a ?#ä'); expect(http.mock.calls.at(-1)[0].url).toBe('/api/filesystem/stat//a%20%3F%23%C3%A4');
});
it.each(['open', 'save', 'directory'])('matches original %s selection and cancellation without writing', async mode => {
    const old = oracle({ items }); const selected = vi.fn(), cancel = vi.fn();
    const legacy = old.mount('<file-dialog ng-show="visible" mode="'+mode+'" on-select="selected(path)" on-cancel="cancel()"></file-dialog>', { visible: true, selected, cancel });
    const { w, http } = setup(FileDialog, { mode }); await flushPromises();
    expect(w.findAll('[data-path]').map(b => b.attributes('data-path'))).toEqual(mode === 'directory' ? ['/dir'] : ['/dir', '/a.txt', '/z.txt']);
    if (mode === 'directory') { legacy.scope.selectDirectory(); await button(w, 'Select this directory').trigger('click'); }
    else {
        legacy.scope.select(items[0]); await w.get('[data-path="/z.txt"]').trigger('click');
        if (mode === 'save') { legacy.scope.save(); await button(w, 'Save').trigger('click'); }
    }
    expect(w.emitted('close')).toEqual(selected.mock.calls);
    legacy.scope.escape(27); await w.trigger('keydown', { key: 'Escape' });
    expect(w.emitted('cancel')).toHaveLength(cancel.mock.calls.length);
    expect(http.mock.calls.every(([r]) => r.method === 'get')).toBe(true);
});
it('navigates directories and reports explicit load errors, preserving the previous selection', async () => {
    const notify = vi.fn(); const { w, http } = setup(FileDialog, {}, { notify }); await flushPromises();
    http.mockResolvedValueOnce({ data: { items: [], parent: '/' } });
    await w.get('[data-path="/dir"]').trigger('click'); await flushPromises();
    expect(w.get('h4').text()).toBe('/dir');
    http.mockRejectedValueOnce({ message: 'denied', status: 403 });
    await button(w, 'Up one level').trigger('click'); await flushPromises();
    expect(notify).toHaveBeenCalledWith('error', 'Could not load directory', 'denied');
    expect(w.emitted('close')).toBeUndefined();
});
it('uses identity fs_root, suppresses parent and refuses sibling-prefix or dot traversal before requesting', async () => {
    const { w, http } = setup(FileDialog, {}, { identity: { profile: { fs_root: '/home/test' } } }); await flushPromises();
    expect(http.mock.calls[0][0].url).toBe('/api/filesystem/list//home/test');
    expect(button(w, 'Up one level')).toBeUndefined();
    await w.setProps({ path: '/home/test-other' }); await flushPromises();
    await w.setProps({ path: '/home/test/../other' }); await flushPromises();
    expect(http.mock.calls.every(([r]) => r.url === '/api/filesystem/list//home/test')).toBe(true);
});
it('path selector starts at the root like the original and changes its model only on selection', async () => {
    const open = vi.fn().mockRejectedValueOnce(Error('cancel')).mockResolvedValueOnce('/picked');
    const { w } = setup(PathSelector, { modelValue: '/existing' }, { modal: { open } });
    await w.get('[role=button]').trigger('click'); await flushPromises(); expect(w.emitted('update:modelValue')).toBeUndefined();
    expect(open).toHaveBeenCalledWith(FileDialog, expect.objectContaining({ mode: 'open', browser: expect.objectContaining({ path: '/' }) }), { backdrop: 'static' });
    const old = oracle(); const legacy = old.mount('<path-selector ng-model="value"></path-selector>', { value: '/existing' });
    legacy.scope.select('/picked'); old.flush(); expect(legacy.parent.value).toBe('/picked');
    await w.get('[role=button]').trigger('click'); await flushPromises(); expect(w.emitted('update:modelValue')).toEqual([['/picked']]);
    await w.get('input').setValue('  /typed  '); expect(w.emitted('update:modelValue').at(-1)).toEqual(['/typed']);
});
it('keeps an inner space while typing a path character by character across renders', async () => {
    const value = ref('');
    const required = ref(false);
    const Parent = defineComponent({ components: { PathSelector }, setup: () => ({ value, required }),
        template: '<PathSelector v-model="value" :required="required" />' });
    const w = mount(Parent, { attachTo: document.body, global: { provide: { aj: createMockAj() } } });
    wrappers.push(w);
    const input = w.get('input');
    input.element.focus();
    let typed = '';
    for (const char of '/x y') {
        typed += char;
        input.element.value += char;
        await input.trigger('input');
        required.value = !required.value;
        await flushPromises();
        expect(value.value).toBe(typed.trim());
        expect(input.element.value).toBe(typed);
    }
});
it('shares original Ace defaults, verbatim content, mode reload, readonly and cleanup', async () => {
    let value = ''; const session = { setUseWrapMode: vi.fn(), setMode: vi.fn() };
    const editor = { setOptions: vi.fn(), setReadOnly: vi.fn(), resize: vi.fn(), getSession: () => session,
        setValue: vi.fn(v => { value = v; }), getValue: () => value, on: vi.fn(), off: vi.fn(), destroy: vi.fn() };
    const old = oracle({ editor }); const legacy = old.ace(); const expected = editor.setOptions.mock.calls[0][0];
    vi.stubGlobal('ace', { config: { set: vi.fn() }, edit: () => editor, require: () => ({ getModeForPath: () => ({ mode: 'ace/mode/sh' }) }) });
    editor.setOptions.mockClear();
    const { w } = setup(CodeEditor, { modelValue: '  ü\r\n', path: 'demo.sh' });
    expect(editor.setOptions).toHaveBeenCalledWith(expect.objectContaining(expected));
    expect(session.setUseWrapMode).toHaveBeenCalledWith(legacy.options.useWrapMode);
    expect(session.setMode).toHaveBeenCalledWith('ace/mode/sh'); expect(value).toBe('  ü\r\n');
    value = ' \nnew\n '; editor.on.mock.calls[0][1](); expect(w.emitted('update:modelValue')).toEqual([[' \nnew\n ']]);
    await w.setProps({ modelValue: 'copied', readonly: true, active: true }); expect(value).toBe('copied'); expect(editor.setReadOnly).toHaveBeenLastCalledWith(true);
    w.unmount(); wrappers.pop(); expect(editor.off).toHaveBeenCalledWith('change', expect.any(Function)); expect(editor.destroy).toHaveBeenCalledOnce();
});
it('keeps textarea whitespace and readonly without Ace', async () => {
    const { w } = setup(CodeEditor, { modelValue: '  text\n' });
    expect(w.get('textarea').element.value).toBe('  text\n'); await w.get('textarea').setValue('  changed\n');
    expect(w.emitted('update:modelValue')).toEqual([['  changed\n']]);
    await w.setProps({ readonly: true }); expect(w.get('textarea').element.readOnly).toBe(true);
});
it('finishes filesystem Flow uploads at the filesystem endpoint with original descriptors', async () => {
    const http = vi.fn(async () => ({ data: ['/tmp/a'] })); const fs = createFilesystem(createMockAj({ http }));
    const flow = new FakeFlow(); flow.files = [{ uniqueIdentifier: 'id', name: 'a', progress: () => 0.456 }];
    const progress = vi.fn(); const result = fs.startFlowUpload(flow, '/tmp', progress); flow.fire('fileProgress'); flow.fire('complete');
    expect(await result).toEqual(['/tmp/a']); expect(progress).toHaveBeenCalledWith([{ id: 'id', name: 'a', progress: 45 }]);
    expect(http.mock.calls[0][0]).toMatchObject({ url: '/api/filesystem/finish-upload', data: [{ id: 'id', path: '/tmp', name: 'a' }] });
});

it('reuses the upload UI for filesystem chunks and finish, including error and cancellation', async () => {
    let flow;
    vi.stubGlobal('Flow', class extends FakeFlow {
        constructor(options) { super(); flow = this; this.options = options; this.files = []; }
        assignBrowse = vi.fn(); assignDrop = vi.fn(); unAssignDrop = vi.fn();
    });
    const { w, http } = setup(FileUpload, { uploadpath: '/fixture' });
    expect(flow.options).toEqual({ target: '/api/filesystem/upload', chunkSize: 1024 * 1024 });
    flow.files = [{ uniqueIdentifier: 'u', name: 'demo.txt', progress: () => 0.5 }];
    http.mockResolvedValueOnce({ data: ['/fixture/demo.txt'] });
    flow.fire('filesSubmitted'); flow.fire('fileProgress'); await flushPromises();
    expect(w.get('[role=progressbar]').attributes('aria-valuenow')).toBe('50');
    flow.fire('complete'); await flushPromises();
    expect(http.mock.calls.at(-1)[0].url).toBe('/api/filesystem/finish-upload');
    expect(w.emitted('uploaded')).toEqual([[['/fixture/demo.txt']]]);
    http.mockRejectedValueOnce({ message: 'write denied', status: 403 });
    flow.fire('filesSubmitted'); flow.fire('complete'); await flushPromises();
    expect(w.get('[role=alert]').text()).toContain('write denied');
    flow.fire('filesSubmitted'); w.unmount(); wrappers.pop(); await flushPromises();
    expect(flow.cancel).toHaveBeenCalledTimes(3);
});
it('compares upload progress and finish descriptors with the original filesystem service', async () => {
    const old = oracle();
    const flow = new FakeFlow(); flow.files = [{ uniqueIdentifier: 'old', name: 'demo.txt', progress: () => 0.429 }];
    const progress = vi.fn();
    old.filesystem.startFlowUpload(flow, '/fixture').then(() => {}, () => {}, progress);
    flow.fire('fileProgress'); flow.fire('complete'); await flushPromises();
    expect(progress).toHaveBeenCalledWith([{ id: 'old', name: 'demo.txt', progress: 42 }]);
    expect(old.calls.at(-1)).toEqual({ method: 'post', url: '/api/filesystem/finish-upload', data: [{ id: 'old', path: '/fixture', name: 'demo.txt' }] });
});

it('retains directory position across selector cancellation without another eager request', async () => {
    const open = vi.fn(async (component, { browser }) => { await browser.navigate('/dir'); throw Error('cancel'); });
    const { w, http } = setup(PathSelector, { modelValue: '/original' }, { modal: { open } });
    await flushPromises(); expect(http).toHaveBeenCalledTimes(1);
    await w.get('[role=button]').trigger('click'); await flushPromises();
    expect(w.emitted('update:modelValue')).toBeUndefined();
    expect(open.mock.calls[0][1].browser.path).toBe('/dir');
});
it('rejects save selections escaping the configured root and never requests or writes that path', async () => {
    const { w, http } = setup(FileDialog, { mode: 'save', root: '/fixture' }); await flushPromises();
    await w.get('input').setValue('../outside'); await button(w, 'Save').trigger('click');
    expect(w.emitted('close')).toBeUndefined(); expect(w.get('[role=alert]').text()).toContain('outside');
    expect(http).toHaveBeenCalledTimes(1);
});
it('keeps the most recent directory on racing loads and ignores responses after teardown', async () => {
    const pending = [];
    const { w } = setup(FileDialog, {}, { http: () => new Promise(resolve => pending.push(resolve)) });
    await w.setProps({ path: '/new' });
    pending[1]({ data: { items: [], parent: '/' } }); await flushPromises();
    pending[0]({ data: { items, parent: null } }); await flushPromises(); expect(w.get('h4').text()).toBe('/new');
    await w.setProps({ path: '/late' }); w.unmount(); wrappers.pop();
    pending[2]({ data: { items, parent: '/' } }); await flushPromises();
});
it('prefixes standalone Flow chunk targets and Ace worker assets through the native adapter', () => {
    let flowOptions;
    vi.stubGlobal('Flow', class extends FakeFlow {
        constructor(options) { super(); flowOptions = options; }
        assignBrowse() {} assignDrop() {} unAssignDrop() {}
    });
    const aj = { ...createMockAj(), prefix: '/panel' };
    const uploader = mount(FileUpload, { props: { uploadpath: '/tmp' }, global: { provide: { aj } } }); wrappers.push(uploader);
    expect(flowOptions.target).toBe('/panel/api/filesystem/upload');
    const set = vi.fn();
    const editor = { setOptions() {}, setValue() {}, on() {}, off() {}, destroy() {}, setReadOnly() {}, getSession: () => ({ setUseWrapMode() {} }) };
    vi.stubGlobal('ace', { edit: () => editor, config: { set } });
    const view = mount(CodeEditor, { global: { provide: { aj } } }); wrappers.push(view);
    expect(set).toHaveBeenCalledWith('basePath', '/panel/resources/lmn_common/resources/vue/assets/ace');
});

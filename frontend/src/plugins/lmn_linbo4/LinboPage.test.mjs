import { afterEach, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createMockAj } from '../../adapter/mock.mjs';
import { mount as mountEntry } from './entry.mjs';
import LinboPage from './LinboPage.vue';
import GroupsTab from './GroupsTab.vue';
import { configs, images, config, examples } from '../../../e2e/fixtures/linbo4.mjs';
const base = '/api/lmn/linbo4';
const wrappers = [];
afterEach(() => { wrappers.forEach(w => w.unmount()); wrappers.length = 0; vi.restoreAllMocks(); window.history.replaceState({}, '', '/'); });
function setup(options = {}) {
    const guards = [], off = vi.fn(), calls = [], title = vi.fn(), prompt = vi.fn();
    const aj = createMockAj({
        identity: { profile: { activeSchool: 'p83-school' } },
        pageTitle: { set: title }, guardLeave: fn => { guards.push(fn); return off; },
        messagebox: { prompt, show: async () => undefined },
        http: async request => {
            calls.push(request);
            if (options.http) return options.http(request);
            return { data: request.url.endsWith('/configs') ? configs() : request.url.endsWith('/images') ? images() : request.url.endsWith('/examples/config') ? examples : config() };
        },
    });
    const wrapper = mount(LinboPage, { global: { provide: { aj } } }); wrappers.push(wrapper);
    return { wrapper, aj, guards, off, calls, title, prompt };
}
it('mounts translated heading/tabs, loads filtered sorted rows and releases guard on unmount', async () => {
    const { wrapper, guards, off, title } = setup();
    expect(wrapper.find('[role="status"]').exists()).toBe(true); await flushPromises();
    expect(title.mock.calls).toEqual([['LINBO 4']]);
    expect(wrapper.findComponent(GroupsTab).findAll('tbody tr td:first-child b').map(n => n.text())).toEqual(['alpha', 'local', 'zulu']);
    expect(wrapper.text()).toContain('legacy.cloop'); expect(wrapper.find('.label-info').text()).toBe('linux.qcow2');
    expect(wrapper.find('.label-default').text()).toBe('legacy.cloop'); expect(guards[0]()).toBe(true);
    expect(wrapper.findComponent(GroupsTab).findAll('button:has(.fa-copy)').length).toBe(3);
    // Rename has no UI trigger in Angular and must not acquire one here.
    expect(wrapper.text()).not.toContain('Rename');
    wrapper.unmount(); wrappers.pop(); expect(off.mock.calls).toEqual([[]]);
});
it('opens import after edits and clears the dirty navigation guard before the dialog resolves', async () => {
    const { wrapper, aj, prompt, guards } = setup(); await flushPromises();
    await wrapper.find('tbody td').trigger('click');
    await wrapper.find('button:has(.fa-pencil)').trigger('click');
    expect(wrapper.emitted('edit-config')).toEqual([['start.conf.alpha'], ['start.conf.alpha', true]]);
    await wrapper.find('[data-action="create"]').trigger('click');
    prompt.mockResolvedValue({ value: 'created' }); await wrapper.find('[data-example=""]').trigger('click'); await flushPromises();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    expect(guards[0]()).toBe(false);
    expect(confirm.mock.calls).toEqual([['You should call an import devices process to apply the new changes, quit this page anyway ?']]);
    confirm.mockReturnValue(true); expect(guards[0]()).toBe(true);
    let resolveImport;
    aj.modal.open = vi.fn(() => new Promise(resolve => { resolveImport = resolve; }));
    aj.reload = vi.fn();
    await wrapper.find('[data-action="import"]').trigger('click');
    expect(wrapper.emitted('import-devices')).toEqual([[]]);
    expect(wrapper.find('[data-action="import"]').exists()).toBe(false);
    confirm.mockClear(); expect(guards[0]()).toBe(true); expect(confirm.mock.calls).toEqual([]);
    expect(aj.reload.mock.calls).toEqual([]); resolveImport(); await flushPromises();
    expect(aj.reload.mock.calls).toEqual([[]]);
});
it('uses messagebox prompts for create/copy/delete and preserves cancellation', async () => {
    const { wrapper, prompt, calls } = setup(); await flushPromises();
    prompt.mockRejectedValueOnce('cancel'); await wrapper.find('button:has(.fa-copy)').trigger('click'); await flushPromises();
    expect(calls.filter(c => c.method !== 'get')).toEqual([]);
    prompt.mockResolvedValue({ value: 'copy' }); await wrapper.find('button:has(.fa-copy)').trigger('click'); await flushPromises();
    expect(wrapper.findComponent(GroupsTab).findAll('tbody tr td:first-child b').map(n => n.text())).toEqual(['alpha', 'copy', 'local', 'zulu']);
    await wrapper.find('button:has(.fa-trash-o)').trigger('click'); await flushPromises();
    expect(calls.at(-1).method).toBe('delete'); expect(wrapper.findComponent(GroupsTab).findAll('tbody tr td:first-child b').map(n => n.text())).toEqual(['copy', 'local', 'zulu']);
});
it('keeps table hidden when config loading rejects; examples do not fake a successful list', async () => {
    const { wrapper } = setup({ http: async ({ url }) => { if (url.endsWith('/configs')) throw new Error('forbidden'); return { data: [] }; } });
    await flushPromises(); expect(wrapper.find('table').exists()).toBe(false); expect(wrapper.find('[role="status"]').exists()).toBe(true);
});
it('hash images selects the image slot; clicking groups is local and does not navigate', async () => {
    window.history.replaceState({}, '', '/view/lmn/linbo4#images');
    const { wrapper } = setup(); await flushPromises(); expect(wrapper.find('.nav-tabs li.active').text()).toBe('Images');
    expect(wrapper.findComponent(GroupsTab).find('table').isVisible()).toBe(false);
    await wrapper.find('.nav-tabs a').trigger('click'); expect(wrapper.find('.nav-tabs li.active').text()).toBe('Groups');
    expect(window.location.hash).toBe('#images');
});
it('entry mounts with the adapter and cleans up the guard', async () => {
    const node = document.createElement('div'), off = vi.fn();
    const aj = createMockAj({ guardLeave: () => off, http: async () => ({ data: [] }) });
    const unmount = mountEntry(node, aj); await flushPromises(); expect(node.textContent).toContain('Groups'); unmount(); expect(off.mock.calls).toEqual([[]]);
});
it('groups keeps image ordering, skips empty image labels and has no invented empty message', () => {
    const aj = createMockAj(), wrapper = mount(GroupsTab, { props: { configs: [{ file: 'start.conf.test', images: ['', 'a.cloop', 'z.qcow2'] }], examples: undefined, changed: false }, global: { provide: { aj } } });
    wrappers.push(wrapper); expect(wrapper.findAll('.label').map(n => n.text())).toEqual(['a.cloop', 'z.qcow2']);
    expect(wrapper.find('[data-action="import"]').exists()).toBe(false); expect(wrapper.findAll('[data-example]').length).toBe(1);
    expect(wrapper.findAll('button:has(.fa-pencil)').length).toBe(1);
});
it('closes the create dropdown on outside click/Escape and dispatches the selected example', async () => {
    const aj = createMockAj(), wrapper = mount(GroupsTab, { attachTo: document.body, props: { configs: [], examples, changed: false }, global: { provide: { aj } } });
    wrappers.push(wrapper);
    const toggle = wrapper.find('[data-action="create"]');
    await toggle.trigger('click'); expect(toggle.attributes('aria-expanded')).toBe('true');
    document.body.click(); await wrapper.vm.$nextTick(); expect(toggle.attributes('aria-expanded')).toBe('false');
    await toggle.trigger('click'); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); await wrapper.vm.$nextTick();
    expect(toggle.attributes('aria-expanded')).toBe('false');
    await toggle.trigger('click'); await wrapper.find(`[data-example="${examples[0]}"]`).trigger('click');
    expect(wrapper.emitted('create-config')).toEqual([[examples[0]]]); expect(toggle.attributes('aria-expanded')).toBe('false');
});
it('wires image editing/copying and publishes the returned main/diff draft before save failure', async () => {
    const source={name:'p86',backups:{},diff_image:{name:'p86',diff:true,size:12}};
    const {wrapper,aj,calls,prompt}=setup({http:async({url,method})=>{
        if(method==='post' && url.includes('/images/'))throw Error('fixture save');
        return {data:url.endsWith('/configs')?[]:url.endsWith('/images')?[source]:[]};
    }});await flushPromises();
    await wrapper.findAll('.nav-tabs a')[1].trigger('click');
    aj.modal.open=vi.fn(async(Component,props)=>({...props.image,desc:'updated',size:2048}));
    await wrapper.find('[data-action="edit"]').trigger('click');await flushPromises();
    expect(wrapper.find('[data-name]').text()).toBe('p86');expect(wrapper.find('[data-action="edit"]').element.closest('tr').textContent).toContain('2.0 KB');
    await wrapper.find('[data-action="edit-diff"]').trigger('click');await flushPromises();
    expect(aj.modal.open.mock.calls.map(c=>c[1].image)).toEqual([{...source,backups_list:[],used_in:[]},source.diff_image]);
    expect(source.size).toEqual(undefined);expect(source.diff_image.size).toEqual(12);
    prompt.mockResolvedValue({value:'copy'});await wrapper.find('[data-action="duplicate"]').trigger('click');await flushPromises();
    expect(calls.filter(c=>c.url.includes('/duplicateImage/')).map(c=>c.data)).toEqual([{new_name:'copy'}]);
});

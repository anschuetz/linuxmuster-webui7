import { afterEach, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createMockAj } from '../adapter/mock.mjs';
import SmbUpload from './SmbUpload.vue';

let flow, wrapper;
class Flow {
    constructor(options) { flow = this; this.opts = options; this.files = []; this.handlers = new Map(); }
    on(event, fn) { this.handlers.set(event, [...(this.handlers.get(event) || []), fn]); }
    off(event, fn) { this.handlers.set(event, this.handlers.get(event).filter((f) => f !== fn)); }
    fire(event, ...args) { for (const fn of this.handlers.get(event) || []) fn(...args); }
    assignBrowse = vi.fn(); assignDrop = vi.fn(); unAssignDrop = vi.fn(); cancel = vi.fn(); upload = vi.fn();
}
function setup(props = {}, http = vi.fn().mockResolvedValue({ data: [{ name: 'synthetic.txt' }] })) {
    vi.stubGlobal('Flow', Flow);
    const notify = vi.fn();
    wrapper = mount(SmbUpload, { props: { uploadpath: '//home', ...props }, global: { provide: { aj: createMockAj({ http, notify }) } } });
    flow.files = [{ uniqueIdentifier: 'id', name: 'synthetic.txt', progress: () => 0.5 }];
    return { notify, http };
}
afterEach(() => { wrapper?.unmount(); vi.unstubAllGlobals(); });
it('uses legacy Flow options, browse/drop, progress and immutable listing completion', async () => {
    const items = [{ name: 'existing' }]; const { notify } = setup({ reload: true, items });
    expect(flow.opts).toEqual({ target: '/api/lmn/smbclient/upload', chunkSize: 1024 * 1024 });
    expect(flow.assignBrowse).toHaveBeenCalledWith(wrapper.get('button').element);
    expect(flow.assignDrop).toHaveBeenCalledWith(wrapper.get('.dragdroparea').element);
    flow.fire('filesSubmitted'); flow.fire('fileProgress'); await flushPromises();
    expect(wrapper.text()).toContain('synthetic.txt (50 %)');
    await wrapper.get('.dragdroparea').trigger('dragenter'); expect(wrapper.get('.dragdroparea').classes()).toContain('dragdroparea-enter');
    await wrapper.get('.dragdroparea').trigger('dragleave'); expect(wrapper.get('.dragdroparea').classes()).not.toContain('dragdroparea-enter');
    flow.fire('complete'); await flushPromises();
    expect(notify).toHaveBeenCalledWith('success', 'Uploaded synthetic.txt', undefined);
    expect(wrapper.emitted('uploaded')).toEqual([[[{ name: 'synthetic.txt' }]]]);
    expect(wrapper.emitted('update:items')).toEqual([[[...items, { name: 'synthetic.txt' }]]]);
    expect(items).toHaveLength(1);
    expect(wrapper.find('progress').exists()).toBe(false);
});
it('supports custom target and does not update listing without reload', async () => {
    setup({ target: '/custom' }); expect(flow.opts.target).toBe('/custom');
    flow.fire('filesSubmitted'); flow.fire('complete'); await flushPromises();
    expect(wrapper.emitted('update:items')).toBeUndefined();
});
it('reports upload errors and cleans up on unmount', async () => {
    const { notify, http } = setup(); flow.fire('filesSubmitted');
    flow.fire('fileError', flow.files[0], 'denied'); await flushPromises();
    expect(wrapper.text()).toContain('denied');
    expect(notify).toHaveBeenCalledWith('error', 'denied', undefined);
    expect(http).not.toHaveBeenCalled();
    wrapper.unmount(); expect(flow.unAssignDrop).toHaveBeenCalled();
    flow.fire('filesSubmitted'); expect(flow.upload).toHaveBeenCalledOnce();
});
it('cancels an active upload on unmount without success/error notification', async () => {
    const { notify } = setup(); flow.fire('filesSubmitted'); wrapper.unmount(); await flushPromises();
    expect(flow.cancel).toHaveBeenCalledOnce(); expect(notify).not.toHaveBeenCalled();
});
it('ignores duplicate submissions and cancels from the UI', async () => {
    const { notify } = setup(); flow.fire('filesSubmitted'); flow.fire('filesSubmitted'); await flushPromises();
    expect(flow.upload).toHaveBeenCalledOnce();
    await wrapper.get('[data-cancel]').trigger('click'); await flushPromises();
    expect(flow.cancel).toHaveBeenCalledOnce(); expect(notify).not.toHaveBeenCalled();
});

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import LmLog from './LmLog.vue';
import { createMockAj } from '../adapter/mock.mjs';

let wrapper;
beforeEach(() => vi.useFakeTimers());
afterEach(() => { wrapper?.unmount(); vi.useRealTimers(); });
const render = (http, props = {}) => {
    wrapper = mount(LmLog, { props: { path: '/tmp/test.log', ...props }, global: { provide: { aj: createMockAj({ http, gettext: (text) => `T:${text}` }) } } });
    return wrapper;
};
const tick = async () => { await vi.advanceTimersByTimeAsync(1000); await flushPromises(); };

it('appends text and sends accumulated character offsets each second (lmlog.coffee:21-24)', async () => {
    const http = vi.fn().mockResolvedValueOnce({ data: '<b>ä</b>\n' }).mockResolvedValue({ data: 'second\n' });
    render(http);
    expect(http).not.toHaveBeenCalled();
    await tick();
    expect(wrapper.get('pre').text()).toBe('<b>ä</b>');
    expect(wrapper.find('b').exists()).toBe(false);
    await tick();
    expect(http.mock.calls.map(([request]) => request.url)).toEqual(['/api/lmn/log/tmp/test.log?offset=0', '/api/lmn/log/tmp/test.log?offset=9']);
    expect(wrapper.get('pre').element.textContent).toBe('<b>ä</b>\nsecond\n');
});

it('autoscrolls by default and allows disabling it (lmlog.coffee:20,36-39)', async () => {
    render(async () => ({ data: 'line\n' }));
    const pre = wrapper.get('pre').element;
    Object.defineProperty(pre, 'scrollHeight', { value: 123 });
    await tick();
    expect(pre.scrollTop).toBe(123);
    expect(wrapper.text()).toContain('T:Options');
    expect(wrapper.text()).toContain('T:Autoscroll');
    await wrapper.get('input').setValue(false);
    pre.scrollTop = 10;
    await tick();
    expect(pre.scrollTop).toBe(10);
});

it.each(['one\ntwo\nthree\n', 'one\ntwo\nthree'])('limits visible lines while preserving full offsets (lmlog.coffee:26-34)', async (data) => {
    const http = vi.fn().mockResolvedValue({ data });
    render(http, { lines: 2 });
    await tick();
    expect(wrapper.get('pre').element.textContent).toBe('two\nthree');
    await tick();
    expect(http.mock.calls[1][0].url).toBe(`/api/lmn/log/tmp/test.log?offset=${data.length}`);
});

it('stops polling and ignores a pending response on unmount (lmlog.coffee:43-44)', async () => {
    let respond;
    const http = vi.fn(() => new Promise((resolve) => { respond = resolve; }));
    render(http);
    await tick();
    wrapper.unmount();
    respond({ data: 'late\n' });
    await flushPromises();
    await tick();
    expect(http).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
});

it('continues polling at the same offset after HTTP failure', async () => {
    const http = vi.fn().mockRejectedValueOnce(new Error('HTTP 500')).mockResolvedValue({ data: 'recovered' });
    render(http);
    await tick();
    await tick();
    expect(http.mock.calls.map(([request]) => request.url)).toEqual(Array(2).fill('/api/lmn/log/tmp/test.log?offset=0'));
    expect(wrapper.get('pre').text()).toBe('recovered');
});

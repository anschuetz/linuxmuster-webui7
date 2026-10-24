import { afterEach, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import Docker from './Docker.vue';
import { createMockAj } from '../../../adapter/mock.mjs';
const container = { Container: 'abc', Name: 'synthetic', PIDs: '1', MemUsage: '2MiB', CPUPerc: '1%', NetIO: '3kB' };
const image = { hash: 'image', Repository: 'test', Tag: 'latest', Size: '2MB', CreatedSince: 'today' };
const wrappers = [];
afterEach(() => { wrappers.splice(0).forEach((w) => w.unmount()); vi.useRealTimers(); });
async function setup(handler = ({ url }) => ({ data: url.endsWith('/containers') ? [container] : url.endsWith('/images') ? [image] : null }), options = {}) {
    const http = vi.fn(handler), notify = vi.fn();
    const aj = createMockAj({ http, notify, ...options });
    const w = mount(Docker, { global: { provide: { aj } } }); wrappers.push(w); await flushPromises();
    return { w, http, notify };
}
const tab = (w, name) => w.findAll('[role=tab]').find((t) => t.text() === name).trigger('click');
it('loads stats with exact request and displays original fields in order', async () => {
    const { w, http } = await setup();
    expect(http.mock.calls.map(([r]) => r)).toEqual([{ method: 'get', url: '/api/lmn/docker/which', data: undefined, cfg: undefined }, { method: 'get', url: '/api/lmn/docker/containers', data: undefined, cfg: { ignoreLoadingBar: true } }]);
    expect(w.findAll('tbody td').map((c) => c.text())).toEqual(['syntheticabc', '2MiB', '1%', '3kB', '', '']);
});
it('polls once every five seconds, stops on images/unmount and restarts without immediate fetch', async () => {
    vi.useFakeTimers(); const { w, http } = await setup();
    await vi.advanceTimersByTimeAsync(5000); expect(http.mock.calls.length).toBe(3);
    await tab(w, 'Images'); await flushPromises(); const count = http.mock.calls.length;
    await vi.advanceTimersByTimeAsync(10000); expect(http.mock.calls.length).toBe(count);
    await tab(w, 'Container'); expect(http.mock.calls.length).toBe(count);
    await vi.advanceTimersByTimeAsync(5000); expect(http.mock.calls.length).toBe(count + 1);
    w.unmount(); await vi.advanceTimersByTimeAsync(10000); expect(http.mock.calls.length).toBe(count + 1);
});
it.each(['stop', 'start'])('sends exact %s payload and success message', async (control) => {
    const { w, http, notify } = await setup(({ url }) => ({ data: url.endsWith('/containers') ? [{ ...container, PIDs: control === 'start' ? '0' : '1' }] : null }));
    await w.get(`button:has(.fa-${control === 'start' ? 'play' : 'stop'})`).trigger('click'); await flushPromises();
    expect(http.mock.calls.at(-1)[0]).toEqual({ method: 'post', url: '/api/lmn/docker/container_command', data: { container_id: 'abc', control }, cfg: undefined });
    expect(notify.mock.calls).toEqual([['success', `${control === 'stop' ? 'Stop' : 'Start'} command successfully sent.`, undefined]]);
});
it.each([false, true])('container removal confirmation accepted=%s', async (accepted) => {
    const show = vi.fn(() => accepted ? Promise.resolve() : Promise.reject());
    const { w, http } = await setup(undefined, { messagebox: { show } });
    await w.get('button:has(.fa-trash)').trigger('click'); await flushPromises();
    expect(show.mock.calls).toEqual([[{ text: 'Really remove this container?', positive: 'Remove', negative: 'Cancel' }]]);
    expect(http.mock.calls.filter(([r]) => r.method === 'post').map(([r]) => r.data)).toEqual(accepted ? [{ container_id: 'abc', control: 'rm' }] : []);
});
it('removes an image only after successful DELETE, retains unrelated images', async () => {
    const { w, http, notify } = await setup(({ url }) => ({ data: url.endsWith('/containers') ? [] : url.endsWith('/images') ? [image, { ...image, hash: 'other', Repository: 'other' }] : null }));
    await tab(w, 'Images'); await flushPromises(); await w.get('button:has(.fa-trash)').trigger('click'); await flushPromises();
    expect(http.mock.calls.at(-1)[0]).toEqual({ method: 'delete', url: '/api/lmn/docker/image/image', data: undefined, cfg: undefined });
    expect(w.findAll('tbody tr').map((r) => r.text())).toEqual(['othertodaylatest2MB']);
    expect(notify.mock.calls).toEqual([['success', 'Remove command successfully sent.', undefined]]);
});
it('image rejection keeps image and displays backend error', async () => {
    const { w, notify } = await setup(({ method, url }) => { if (method === 'delete') throw { data: { message: 'in use' } }; return { data: url.endsWith('/images') ? [image] : [] }; });
    await tab(w, 'Images'); await flushPromises(); await w.get('button').trigger('click'); await flushPromises();
    expect(w.text()).toContain('test'); expect(notify.mock.calls).toEqual([['error', 'in use', undefined]]);
});
it('cancel image removal never sends DELETE', async () => {
    const { w, http } = await setup(undefined, { messagebox: { show: () => Promise.reject() } });
    await tab(w, 'Images'); await flushPromises(); await w.get('button').trigger('click'); await flushPromises();
    expect(http.mock.calls.filter(([r]) => r.method === 'delete')).toEqual([]);
});
it('shows installed failure only after which rejects', async () => {
    let reject; const { w } = await setup(() => new Promise((_, r) => { reject = r; }));
    expect(w.text()).not.toContain('No container'); expect(w.text()).not.toContain('not installed');
    reject({}); await flushPromises(); expect(w.text()).toContain('Docker is not installed on this host.');
});
it('stats/images rejection preserves loading state without an empty message', async () => {
    const { w } = await setup(({ url }) => { if (!url.endsWith('/which')) throw {}; return { data: null }; });
    expect(w.text()).not.toContain('No container'); await tab(w, 'Images'); await flushPromises(); expect(w.text()).not.toContain('No docker images');
});
it('shows empty messages only after successful empty responses', async () => {
    const { w } = await setup(() => ({ data: [] })); expect(w.text()).toContain('No container on this host.');
    await tab(w, 'Images'); await flushPromises(); expect(w.text()).toContain('No docker images on this host.');
});
it('details preserve networks, first port binding and mounts; close hides modal', async () => {
    const details = { Name: '/test', Config: { Hostname: 'host' }, Id: 'full', Created: 'today', NetworkSettings: { Networks: { a: { IPAddress: '192.0.2.1' } }, Ports: { '80/tcp': [{ HostPort: '8080' }], '90/tcp': null } }, Mounts: [{ Source: '/a', Type: 'bind', Destination: '/b' }] };
    const { w } = await setup(({ url }) => ({ data: url.endsWith('/containers') ? [container] : details }));
    await w.get('tbody td').trigger('click'); await flushPromises(); expect(w.get('[role=dialog]').text()).toContain('80/tcp -> 8080'); expect(w.get('[role=dialog]').text()).toContain('90/tcp ->');
    expect(w.get('[role=dialog]').text()).toContain('/a (bind) -> /b'); await w.get('[role=dialog] a').trigger('click'); expect(w.find('[role=dialog]').exists()).toBe(false);
});
it('command/details failures stay silent as in original', async () => {
    const { w, notify } = await setup(({ method, url }) => { if (method === 'post' || url.includes('/container/')) throw {}; return { data: url.endsWith('/containers') ? [container] : null }; });
    await w.get('tbody td').trigger('click'); await w.get('button:has(.fa-stop)').trigger('click'); await flushPromises();
    expect(w.find('[role=dialog]').exists()).toBe(false); expect(notify.mock.calls).toEqual([]);
});

it('retains the original adjacent duplicate-image removal quirk', async () => {
    const { w } = await setup(({ url }) => ({ data: url.endsWith('/images') ? [image, { ...image, Tag: 'second' }, { ...image, Tag: 'third' }] : [] }));
    await tab(w, 'Images'); await flushPromises(); await w.findAll('button')[0].trigger('click'); await flushPromises();
    expect(w.findAll('tbody tr').map((r) => r.text())).toEqual(['testtodaysecond2MB']);
});
it('entry mounts through the adapter and disposes the application', async () => {
    const { mount: mountDocker } = await import('../entry.mjs');
    const element = document.createElement('div'); document.body.append(element);
    const dispose = mountDocker(element, createMockAj({ http: async () => ({ data: [] }) }));
    await flushPromises(); expect(element.textContent).toContain('No container on this host.');
    dispose(); expect(element.textContent).toBe(''); element.remove();
});

import { afterEach, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import Nextcloud from './Nextcloud.vue';
import { mount as mountNextcloud } from '../entry.mjs';
import { createMockAj } from '../../../adapter/mock.mjs';

const wrappers = [];
function setup(data = [200, 'https://p53.invalid', false, false], identity = { user: 'P53 synthetic' }, http) {
    const calls = [];
    const scope = {
        toggleNavigation: vi.fn(), toggleWidescreen: vi.fn(),
    };
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const set = vi.fn();
    const aj = createMockAj({ identity, pageTitle: { set }, gettext: text => `DE: ${text}`, http: http ?? (async request => { calls.push(request); return { data }; }) });
    aj.shell = scope;
    const wrapper = mount(Nextcloud, { global: { provide: { aj } } });
    wrappers.push(wrapper);
    return { wrapper, aj, calls, open, scope, set };
}
afterEach(() => { wrappers.splice(0).forEach(w => w.unmount()); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('waits for identity and response without showing an error', async () => {
    let resolve;
    const http = vi.fn(() => new Promise(r => { resolve = r; }));
    const { wrapper, aj } = setup(undefined, { user: null }, http);
    expect(http.mock.calls).toEqual([]);
    expect(wrapper.get('.nextcloud-spinner').isVisible()).toEqual(true);
    expect(wrapper.get('.alert-info').isVisible()).toEqual(false);
    aj.identity.user = 'synthetic'; await nextTick();
    expect(http.mock.calls).toEqual([[{ method: 'get', url: '/api/lmn/nextcloud', data: undefined, cfg: undefined }]]);
    expect(wrapper.get('.nextcloud-spinner').isVisible()).toEqual(true);
    resolve({ data: [0, null, null, null] }); await flushPromises();
    expect(wrapper.get('.nextcloud-spinner').element.style.display).toEqual('none');
});
it.each([null, undefined])('does not start for identity %s', async user => {
    const { calls, open } = setup(undefined, { user }); await flushPromises();
    expect(calls).toEqual([]); expect(open.mock.calls).toEqual([]);
});
it.each([[false, false], [true, true], [false, true], [true, false]])('loads the named iframe, fullscreen=%s askuser=%s', async (fullscreen, askuser) => {
    const { wrapper, calls, open, scope, set } = setup([200, 'https://p53.invalid/', fullscreen, askuser]);
    await flushPromises();
    expect(calls).toEqual([{ method: 'get', url: '/api/lmn/nextcloud', data: undefined, cfg: undefined }]);
    expect(set.mock.calls).toEqual([['DE: Nextcloud']]);
    expect(open.mock.calls).toEqual([[`https://p53.invalid/${askuser ? '/index.php/login?user=P53 synthetic' : ''}`, 'iframe_nextcloud']]);
    expect(wrapper.get('iframe').attributes('name')).toEqual('iframe_nextcloud');
    expect(wrapper.get('iframe').isVisible()).toEqual(true);
    expect(wrapper.get('.alert-info').isVisible()).toEqual(false);
    expect(wrapper.get('.nextcloud-spinner').isVisible()).toEqual(false);
    expect(scope.toggleNavigation.mock.calls).toEqual(fullscreen ? [[]] : []);
    expect(scope.toggleWidescreen.mock.calls).toEqual(fullscreen ? [[]] : []);
});
it.each([0, 404, 1])('shows original status state for code %s', async code => {
    const { wrapper, open } = setup([code, null, false, false]); await flushPromises();
    expect(wrapper.get('.alert-info').isVisible()).toEqual(code !== 1);
    expect(wrapper.get('.alert-info').text()).toEqual('DE: URL not found or not valid! Please check config file.');
    expect(wrapper.get('iframe').isVisible()).toEqual(false);
    expect(wrapper.get('.nextcloud-spinner').isVisible()).toEqual(code === 1);
    expect(open.mock.calls).toEqual([]);
});
it('keeps the spinner after HTTP rejection as the original; adapter owns error dialog', async () => {
    const { wrapper, open } = setup(undefined, undefined, async () => { throw new Error('503'); });
    await flushPromises();
    expect(wrapper.get('.nextcloud-spinner').isVisible()).toEqual(true);
    expect(wrapper.get('.alert-info').isVisible()).toEqual(false);
    expect(open.mock.calls).toEqual([]);
});
it('starts again when the identity changes', async () => {
    const { aj, open } = setup(); await flushPromises();
    aj.identity.user = 'P53 second'; await flushPromises();
    expect(open.mock.calls).toEqual([['https://p53.invalid', 'iframe_nextcloud'], ['https://p53.invalid', 'iframe_nextcloud']]);
});
it('mounts and releases the entry', async () => {
    const host = document.createElement('div');
    const aj = createMockAj({ identity: { user: 'synthetic' }, http: async () => ({ data: [0, null, null, null] }) });
    aj.shell = {};
    const dispose = mountNextcloud(host, aj);
    await flushPromises(); expect(host.textContent.includes('URL not found')).toEqual(true);
    dispose(); expect(host.textContent).toEqual('');
});

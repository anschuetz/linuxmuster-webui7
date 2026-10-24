import { expect, it } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { mount, getSessionStore } from './entry.mjs';
import { createMockAj } from '../../adapter/mock.mjs';
it('mounts both real routes and keeps session across list/detail remounts', async () => {
    const calls = [], aj = createMockAj({ identity: { user: 'p96-entry', profile: { sophomorixRole: 'teacher' } }, http: async r => { calls.push(r.url); return { data: r.url.endsWith('/userInRoom') ? { usersList: [], objects: {} } : [] }; } });
    const el = document.createElement('div'), store = getSessionStore(aj);
    window.history.replaceState({}, '', '/view/lmn/sessionsList'); let stop = mount(el, aj); await flushPromises(); expect(el.querySelectorAll('.list-group').length).toBe(4); stop();
    store.state.current = { sid: 'p96', name: 'p96', type: 'group', members: [], generated: false };
    window.history.replaceState({}, '', '/view/lmn/session'); stop = mount(el, aj); await flushPromises(); expect(el.querySelector('[data-close]')).not.toBeNull(); expect(calls.includes('/api/lmn/smbclient/createSessionWorkingDirectory')).toBe(true); stop();
    window.history.replaceState({}, '', '/view/lmn/sessionsList'); stop = mount(el, aj); await flushPromises(); expect(store.state.current.sid).toBe('p96'); stop(); window.history.replaceState({}, '', '/');
});

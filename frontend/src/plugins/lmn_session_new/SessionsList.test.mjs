import { afterEach, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createMockAj } from '../../adapter/mock.mjs';
import SessionsList from './SessionsList.vue';
import { mount as mountEntry } from './entry.mjs';
import { getSessionStore } from './sessionStore.mjs';
import { fixtures, members } from '../../../e2e/fixtures/session_new.mjs';
const wrappers = []; afterEach(() => wrappers.splice(0).forEach(w => w.unmount()));
let user = 0;
function setup({ http, identity, messagebox } = {}) {
    const data = fixtures(), calls = [], notify = vi.fn(), pageTitle = { set: vi.fn() }, navigate = vi.fn();
    const aj = createMockAj({ identity: identity ?? { user: 'teacher-' + ++user, profile: { sophomorixRole: 'teacher' } }, notify, pageTitle, navigate, messagebox, http: http ?? (async r => {
        calls.push(r); return { data: r.url.endsWith('/userinfo') ? members() : r.url.endsWith('/userInRoom') ? data.room : data[r.url.split('/').at(-1)] };
    }) });
    const w = mount(SessionsList, { global: { provide: { aj } } }); wrappers.push(w);
    return { w, aj, calls, data, notify, navigate, pageTitle };
}
const cards = (w, i) => w.findAll('.list-group')[i].findAll('.list-group-item');
it('shows loading before data, then lists and original ordering; filters trim and preserve inner space', async () => {
    const { w, pageTitle } = setup(); expect(w.find('[role=status]').isVisible()).toBe(true); expect(w.findAll('.alert-info')).toEqual([]); await flushPromises();
    expect(pageTitle.set.mock.calls).toEqual([['Sessions list']]); expect(cards(w, 2).map(c => c.find('h4').text())).toEqual(['Alpha', 'alpha', 'Zeta']);
    expect(cards(w, 1).map(c => c.find('h4').text())).toEqual(['p92-z-class', 'p92-a-class']);
    const input = w.find('input[type=search]'); await input.setValue(' !alpha '); expect(cards(w, 2).map(c => c.find('h4').text())).toEqual(['Zeta']); expect(cards(w, 0)).toHaveLength(1);
    await input.setValue(''); for (const ch of '  inner space  ') { input.element.value += ch; await input.trigger('input'); }
    expect(input.element.value).toContain('inner space'); expect(cards(w, 2)).toHaveLength(0);
});
it('room owns loading; empty project notice intentionally depends on classes', async () => {
    const { w } = setup({ http: async r => ({ data: r.url.endsWith('/userInRoom') ? { name: '', usersList: [] } : r.url.endsWith('/schoolclasses') ? [] : r.url.endsWith('/projects') ? fixtures().projects : [] }) });
    await flushPromises(); expect(w.find('[role=status]').exists()).toBe(false); expect(w.findAll('.alert-info')).toHaveLength(4); expect(cards(w, 3)).toHaveLength(2);
});
it('failed load/room retains unavailable values and no empty notices; remount can retry', async () => {
    const { w } = setup({ http: async () => { throw new Error('HTTP'); } }); await flushPromises();
    expect(w.find('[role=status]').isVisible()).toBe(true); expect(w.findAll('.alert-info')).toEqual([]);
});
it.each([null, 'root'])('waits for usable identity %s before list load, then follows new user', async name => {
    const { w, aj, calls } = setup({ identity: { user: name, profile: {} } }); await flushPromises(); expect(calls.map(r => r.url)).toEqual(['/api/lmn/session/userInRoom']);
    expect(w.find('.root-access-blocker').exists()).toBe(name === 'root');
    aj.identity.profile = { sophomorixRole: 'teacher' }; aj.identity.user = 'new-teacher-' + ++user; await flushPromises(); expect(cards(w, 2)).toHaveLength(3); expect(calls.length).toBe(5);
    aj.identity.user = 'other-teacher-' + ++user; await flushPromises(); expect(calls.length).toBe(9);
});
it('start room/class/project and existing group use only userinfo; unmount does not lose current', async () => {
    const { w, aj, calls } = setup(); await flushPromises(); await cards(w, 0)[0].trigger('click'); await flushPromises();
    expect(getSessionStore(aj).state.current.type).toBe('room'); expect(calls.at(-1).data).toEqual({ users: ['p92-student'] });
    for (const [i, type] of [[1, 'schoolclass'], [3, 'project'], [2, 'group']]) { await cards(w, i)[0].trigger('click'); await flushPromises(); expect(getSessionStore(aj).state.current.type).toBe(type); }
    const current = getSessionStore(aj).state.current; w.unmount(); expect(getSessionStore(aj).state.current).toEqual(current);
    const next = mount(SessionsList, { global: { provide: { aj } } }); wrappers.push(next); await flushPromises();
    aj.identity.user = 'changed-' + ++user; await flushPromises();
    expect(getSessionStore(aj).state.current.sid).toBe(''); expect(getSessionStore(aj).state.examUsers).toEqual([]);
});
it('new/clone reload, rename replaces row, delete removes row, buttons never start detail', async () => {
    const prompt = vi.fn(async () => ({ value: 'p92-renamed' }));
    const { w, calls, navigate } = setup({ messagebox: { prompt, show: async () => {} } }); await flushPromises();
    await w.find('button').trigger('click'); await flushPromises(); expect(calls.find(r => r.method === 'put').data).toEqual({ members: [] });
    await cards(w, 2)[2].findAll('a')[1].trigger('click'); await flushPromises(); expect(calls.filter(r => r.method === 'put').at(-1).data).toEqual({ members: fixtures().sessions[0].members });
    await cards(w, 2)[2].findAll('a')[2].trigger('click'); await flushPromises(); expect(w.text()).toContain('p92-renamed');
    await cards(w, 2).find(c => c.text().includes('p92-renamed')).find('a').trigger('click'); await flushPromises(); expect(cards(w, 2)).toHaveLength(2); expect(navigate.mock.calls).toEqual([]);
});
it('dialog rejection leaves rows intact; invalid rename keeps the original undefined-name quirk', async () => {
    const prompt = vi.fn().mockRejectedValue('cancel'); const show = vi.fn().mockRejectedValue('cancel');
    const { w, calls } = setup({ messagebox: { prompt, show } }); await flushPromises();
    await cards(w, 2)[2].findAll('a')[2].trigger('click'); await flushPromises(); await cards(w, 2)[2].find('a').trigger('click'); await flushPromises(); expect(cards(w, 2)).toHaveLength(3);
    prompt.mockResolvedValue({ value: 'bad name' }); await cards(w, 2)[2].findAll('a')[2].trigger('click'); await flushPromises(); expect(w.text()).not.toContain('Zeta'); expect(calls.filter(r => r.method !== 'get')).toEqual([]);
});
it('entry mounts/unmounts without activating Angular templates', async () => {
    const el = document.createElement('div'), aj = createMockAj(); const unmount = mountEntry(el, aj); await flushPromises(); expect(el.querySelector('input[type=search]')).not.toBeNull(); unmount(); expect(el.innerHTML).toBe('');
});

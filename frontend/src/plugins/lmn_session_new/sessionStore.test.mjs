import { describe, expect, it, vi } from 'vitest';
import { effectScope } from 'vue';
import { createMockAj } from '../../adapter/mock.mjs';
import { getSessionStore } from './sessionStore.mjs';
import { fixtures, members } from '../../../e2e/fixtures/session_new.mjs';
const setup = () => {
    const calls = [], data = fixtures();
    const aj = createMockAj({ identity: { user: 'zem' }, navigate: vi.fn(), http: async r => {
        calls.push(r);
        return { data: r.url.endsWith('/userinfo') ? members() : data[r.url.split('/').at(-1)], status: 200 };
    } });
    return { aj, calls, store: getSessionStore(aj) };
};
describe('plugin lifetime and identity boundary', () => {
    it('shares state across different route adapters for the same identity, resets for another user', async () => {
        const { aj, store } = setup();
        await store.start(fixtures().sessions[0]);
        const next = createMockAj({ identity: { user: 'zem' } });
        expect(getSessionStore(next)).toBe(store);
        expect(store.state.current.name).toBe('Zeta');
        next.identity.user = 'ba';
        expect(getSessionStore(next).state.current).toEqual({ sid: '', name: '', generated: false, members: [], type: '' });
        expect(getSessionStore(aj).state.examUsers).toEqual([]);
    });
    it('does not retain the identity watcher of an unmounted adapter and handles logout/root', async () => {
        const scope = effectScope(); const { aj, store } = scope.run(setup);
        await store.start(fixtures().sessions[0]); scope.stop();
        getSessionStore(createMockAj({ identity: { user: 'zem' } }));
        aj.identity.user = null;
        expect(store.state.current.sid).toBe('Zeta');
        expect(getSessionStore(createMockAj({ identity: { user: 'root' } })).state.current.sid).toBe('');
    });
    it('ignores a pending response after identity changes', async () => {
        let resolve;
        const aj = createMockAj({ identity: { user: 'zem' }, navigate: vi.fn(), http: () => new Promise(r => { resolve = r; }) });
        const store = getSessionStore(aj), pending = store.start(fixtures().sessions[0]);
        aj.identity.user = 'ba'; getSessionStore(aj);
        resolve({ data: members() }); await pending;
        expect(store.state.current.sid).toBe(''); expect(aj.navigate.mock.calls).toEqual([]);
    });
});
describe('session data contract', () => {
    it('starts an existing session with resolved members, exam groups and one navigation, without mutating lists', async () => {
        const { store, aj, calls } = setup(), session = fixtures().sessions[0];
        await store.start(session);
        expect(calls.map(({ method, url, data }) => ({ method, url, data }))).toEqual([{ method: 'post', url: '/api/lmn/session/userinfo', data: { users: session.members } }]);
        expect(store.state.current).toEqual({ ...session, generated: false, type: 'group', members: members() });
        expect(session.members).toEqual(['p92-student', 'p92-exam', 'p92-foreign']);
        expect(store.state.examUsers).toEqual([members()[1]]); expect(store.state.extExamUsers).toEqual([members()[2]]);
        expect(store.state.examMode).toBe(false); expect(aj.navigate.mock.calls).toEqual([['/view/lmn/session']]);
    });
    it.each(['room', 'schoolclass', 'project'])('generates %s only client-side with numeric SID', async type => {
        const { store, calls } = setup(); vi.spyOn(Date, 'now').mockReturnValue(92000);
        await store.startGenerated('p92', ['p92-student'], type);
        expect(store.state.current).toEqual({ sid: 92000, name: 'p92', generated: true, members: members(), type });
        expect(calls.map(r => [r.method, r.url, r.data])).toEqual([['post', '/api/lmn/session/userinfo', { users: ['p92-student'] }]]);
        vi.restoreAllMocks();
    });
    it('preserves the empty-member all-exam comparison and redirects on direct entry without SID', async () => {
        const aj = createMockAj({ identity: { user: 'empty' }, navigate: vi.fn(), http: async () => ({ data: [] }) });
        const store = getSessionStore(aj);
        expect(store.enterDetail()).toBe(false); expect(aj.navigate.mock.calls).toEqual([['/view/lmn/sessionsList']]);
        await store.startGenerated('empty', [], 'room'); expect(store.state.examMode).toBe(true); expect(store.enterDetail()).toBe(true);
        store.reset(); expect(store.state.current).toEqual({ sid: '', name: '', generated: false, members: [], type: '' });
    });
});

it('keeps the pending existing session on failure, and generates a SID only after userinfo resolves', async () => {
    let resolve;
    const aj = createMockAj({ identity: { user: 'timing' }, navigate: vi.fn(), http: () => new Promise(r => { resolve = r; }) });
    const store = getSessionStore(aj), session = fixtures().sessions[0];
    const start = store.start(session); expect(store.state.current).toEqual(session);
    resolve({ data: [] }); await start;
    const now = vi.spyOn(Date, 'now').mockReturnValue(1);
    const generated = store.startGenerated('room', [], 'room'); expect(store.state.current.sid).toBe('');
    now.mockReturnValue(2); resolve({ data: [] }); await generated; expect(store.state.current.sid).toBe(2); now.mockRestore();
    aj.http.post = async () => { throw new Error('HTTP'); };
    await expect(store.start(session)).rejects.toThrow('HTTP'); expect(store.state.current).toEqual(session);
});

it('central member replacement preserves all group references and polling stop leaves runtime reusable',()=>{
    const {store}=setup();store.state.current={sid:'p95',members:members()};store.filterExamUsers();
    const old=store.state.current.members;store.state.user_missing_membership=[old[0]];
    const next=old.map(u=>({...u,wifi:true}));store.replaceMembers(next);
    expect(store.state.examUsers[0]).toBe(next[1]);expect(store.state.extExamUsers[0]).toBe(next[2]);expect(store.state.user_missing_membership[0]).toBe(next[0]);
    const stop=vi.fn(),dispose=vi.fn();store.state.filePolling={stop,dispose};store.stopFilePolling();expect(stop.mock.calls).toEqual([[]]);expect(dispose.mock.calls).toEqual([]);expect(store.state.filePolling.stop).toBe(stop);
});

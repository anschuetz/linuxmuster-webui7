import { expect, it, vi } from 'vitest';
import { createMockAj } from '../../adapter/mock.mjs';
import { createSessions, visibleGroups } from './sessions.mjs';
import { fixtures } from '../../../e2e/fixtures/session_new.mjs';
function setup(value = 'p92-new') {
    const calls = [], notify = vi.fn(), show = vi.fn(async () => {}), prompt = vi.fn(async () => ({ value }));
    const aj = createMockAj({ notify, messagebox: { show, prompt }, http: async r => { calls.push(r); return { data: r.method === 'get' ? fixtures()[r.url.split('/').at(-1)] : 'deleted' }; } });
    return { aj, calls, notify, prompt, show, api: createSessions(aj) };
}
it('loads schoolclasses, projects and sessions in their original tuple order', async () => {
    const { api, calls } = setup(); expect(await api.load()).toEqual([fixtures().schoolclasses, fixtures().projects, fixtures().sessions]);
    expect(calls.map(r => [r.method, r.url])).toEqual(['schoolclasses', 'projects', 'sessions'].map(key => ['get', '/api/lmn/session/' + key]));
});
it('creates and clones using exact members; prompt has Angular trim semantics at the dialog boundary', async () => {
    const { api, calls, prompt, notify } = setup('p92-new');
    await api.new(); await api.new(['p92-student']);
    expect(prompt.mock.calls).toEqual([['Session Name', ''], ['Session Name', '']]);
    expect(calls.map(r => [r.method, r.url, r.data])).toEqual([['put', '/api/lmn/session/sessions/p92-new', { members: [] }], ['put', '/api/lmn/session/sessions/p92-new', { members: ['p92-student'] }]]);
    expect(notify.mock.calls).toEqual([['success', 'Session Created', undefined], ['success', 'Session Created', undefined]]);
});
it.each(['', 'bad name', 'bad/name'])('rejects empty/invalid name %j without a write', async name => {
    const { api, calls, notify } = setup(name); expect(await api.new()).toBeUndefined(); expect(calls).toEqual([]);
    expect(notify.mock.calls).toEqual(name ? [['error', name + ' can only contain alphanumeric chars or _+-', undefined, { sticky: true }]] : []);
});
it('renames with the SID and returns new name; delete sends no body', async () => {
    const { api, calls, show } = setup('p92-renamed'); expect(await api.rename('SID92', 'original')).toBe('p92-renamed'); await api.kill('SID92', 'p92-renamed');
    expect(calls.map(r => [r.method, r.url, r.data])).toEqual([['post', '/api/lmn/session/sessions', { action: 'rename-session', session: 'SID92', comment: 'p92-renamed' }], ['delete', '/api/lmn/session/sessions/SID92', undefined]]);
    expect(show.mock.calls).toEqual([[{ text: 'Delete Session: p92-renamed ?', positive: 'Delete', negative: 'Cancel' }]]);
});
it('rejects dialog cancellation and propagates HTTP failures without success notifications', async () => {
    const { api, aj, calls, notify, prompt, show } = setup(); prompt.mockRejectedValue('cancel');
    await expect(api.new()).rejects.toBe('cancel'); await expect(api.rename('id', 'name')).rejects.toBe('cancel');
    show.mockRejectedValue('cancel'); await expect(api.kill('id', 'name')).rejects.toBe('cancel'); expect(calls).toEqual([]);
    prompt.mockResolvedValue({ value: 'valid' }); aj.http.put = async () => { throw new Error('HTTP'); };
    await expect(api.new()).rejects.toThrow('HTTP'); expect(notify.mock.calls).toEqual([]);
});
it('missing SID shows existing messages without a write', async () => {
    const { api, calls, show } = setup(); await api.rename('', 'name'); await api.kill('', 'name'); expect(calls).toEqual([]);
    expect(show.mock.calls).toEqual([[{ title: 'No Session selected', text: 'You have to select a session first.', positive: 'OK' }], [{ title: 'No session selected', text: 'You have to select a session first.', positive: 'OK' }]]);
});
it('keeps class/project order, Angular deep filtering/negation, hidden auto groups, ascending names and reversed ties', () => {
    const data = fixtures();
    expect(visibleGroups(data.schoolclasses).map(g => g.name)).toEqual(['p92-z-class', 'p92-a-class']);
    expect(visibleGroups(data.sessions, '', true).map(g => g.sid)).toEqual(['Alpha', 'alpha', 'Zeta']);
    expect(visibleGroups(data.sessions, 'p92-student', true).map(g => g.sid)).toEqual(['Alpha', 'alpha', 'Zeta']);
    expect(visibleGroups(data.sessions, '!alpha', true).map(g => g.sid)).toEqual(['Zeta']);
    expect(visibleGroups(data.sessions, 'inner space')).toEqual([]);
});

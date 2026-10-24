import { afterEach, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { reactive } from 'vue';
import { createMockAj } from '../../adapter/mock.mjs';
import { browser } from './browser.mjs';
import Websession from './components/Websession.vue';
import CreateSession from './components/CreateSession.vue';
import Participants from './components/Participants.vue';
import { mount as mountEntry } from './entry.mjs';
const base = '/api/lmn/websession/';
const profile = { sophomorixRole: 'teacher', sn: 'Nachname', givenName: 'Vorname' };
const session = (changes = {}) => ({ id: 'one', sessionname: 'Konferenz', moderator: 'zem', participants: ['ba', 'serdarje'], sessionpassword: '', status: 'stopped', attendeepw: 'attendee', moderatorpw: 'moderator', ...changes });
const wrappers = [];
afterEach(() => { wrappers.splice(0).forEach((w) => w.unmount()); vi.restoreAllMocks(); });
function setup({ data = [session()], user = 'zem', role = 'teacher', get, post, deletion, box } = {}) {
    const aj = createMockAj({ identity: reactive({ user, profile: { ...profile, sophomorixRole: role }, isSuperuser: false }) });
    aj.http.get = get ?? vi.fn(async (url) => ({ data: url === base + 'webConferenceEnabled' ? true : data }));
    aj.http.post = post ?? vi.fn(async () => ({ data: { returncode: 'SUCCESS' } }));
    aj.http.delete = deletion ?? vi.fn(async () => ({ data: { status: 'SUCCESS' } }));
    aj.notify = Object.fromEntries(['success', 'error'].map((name) => [name, vi.fn()]));
    aj.modal.open = vi.fn().mockRejectedValue('cancel');
    aj.messagebox.show = box ?? vi.fn().mockResolvedValue();
    vi.spyOn(browser, 'open').mockImplementation(() => {});
    vi.spyOn(browser, 'copy').mockImplementation(() => {});
    vi.spyOn(browser, 'publicUrl').mockImplementation((id) => `https://webui.example/websession/${id}`);
    aj.pageTitle.set = vi.fn();
    const w = mount(Websession, { global: { provide: { aj } } }); wrappers.push(w);
    return { aj, w };
}
const button = (w, icon) => w.find(`button:has(.fa-${icon})`);
it('mount entry provides adapter and unmounts', async () => {
    const host = document.createElement('div');
    const aj = createMockAj({ identity: { user: null, profile: {}, isSuperuser: false } });
    const unmount = mountEntry(host, aj); await flushPromises(); expect(host.innerHTML).toContain('progress-spinner'); unmount(); expect(host.innerHTML).toEqual('');
});
it.each([null, undefined, 'root'])('waits for identity %s without requests', async (user) => {
    const { w, aj } = setup({ user: user === undefined ? null : user }); await flushPromises();
    expect(aj.http.get.mock.calls).toEqual([]); expect(w.find('progress-spinner').exists()).toEqual(true);
});
it('loads for all Samba roles and only teachers can create', async () => {
    for (const role of ['teacher', 'student', 'schooladministrator', 'globaladministrator']) {
        const { w, aj } = setup({ role }); await flushPromises();
        expect(aj.http.get.mock.calls).toEqual([[base + 'webConferenceEnabled'], [base + 'webConferences']]);
        expect(button(w, 'plus').exists()).toEqual(role === 'teacher');
        expect(aj.pageTitle.set.mock.calls).toEqual([['Websession']]);
    }
});
it('blocks root without Samba role and starts when identity arrives', async () => {
    const { w, aj } = setup({ user: null, role: null }); await flushPromises();
    aj.identity.user = 'root'; await flushPromises(); expect(w.find('.root-access-blocker').exists()).toEqual(true);
    aj.identity.user = 'zem'; aj.identity.profile = profile; await flushPromises(); expect(w.findAll('.session_table').length).toEqual(1);
});
it('leaves list unset while loading or rejected; shows empty only after response', async () => {
    let finish; const get = vi.fn((url) => url.endsWith('Enabled') ? Promise.resolve({ data: true }) : new Promise((resolve) => { finish = resolve; }));
    const { w } = setup({ get }); await flushPromises(); expect(w.text()).not.toContain('Currently no websession');
    finish({ data: [] }); await flushPromises(); expect(w.text()).toContain('Currently no websession');
    const bad = setup({ get: vi.fn().mockResolvedValueOnce({ data: true }).mockRejectedValue(new Error('network')) }); await flushPromises(); expect(bad.w.text()).not.toContain('Currently no websession');
});
it.each([false, 'true'])('disabled uses strict boolean %s', async (value) => {
    const { w, aj } = setup({ get: vi.fn().mockResolvedValue({ data: value }) }); await flushPromises();
    expect(w.text()).toContain('Websession-Module not enabled'); expect(aj.http.get.mock.calls).toEqual([[base + 'webConferenceEnabled']]);
});
it('enabled rejection leaves disabled warning as original', async () => {
    const { w } = setup({ get: vi.fn().mockRejectedValue(new Error('network')) }); await flushPromises(); expect(w.text()).toContain('Websession-Module not enabled');
});
it('keeps order, owner controls, passwords and participant dialog', async () => {
    const { w, aj } = setup({ data: [session({ id: 'z', sessionname: 'Z', sessionpassword: 'secret' }), session({ id: 'a', sessionname: 'A', moderator: 'other' })] }); await flushPromises();
    const rows = w.findAll('.session_table'); expect(rows.map((r) => r.findAll('td')[1].text())).toEqual(['Z', 'A']);
    expect(rows[0].text()).toContain('secret'); expect(rows[1].text()).toContain('no password');
    expect(button(rows[1], 'play').attributes('disabled')).toEqual(''); expect(button(rows[1], 'trash-alt').exists()).toEqual(false);
    await rows[0].findAll('td')[4].trigger('click'); expect(aj.modal.open.mock.calls).toEqual([[Participants, { participants: ['ba', 'serdarje'] }]]);
});
it('renders participant strings and uses modal dismissal without refresh', async () => {
    const aj = createMockAj(); const w = mount(Participants, { props: { participants: ['ba', 'zem'] }, global: { provide: { aj } } }); wrappers.push(w);
    expect(w.findAll('td').map((td) => td.text())).toEqual(['ba', 'zem']);
    const main = setup(); await flushPromises(); await button(main.w, 'plus').trigger('click'); await flushPromises();
    expect(main.aj.modal.open.mock.calls).toEqual([[CreateSession]]); expect(main.aj.http.get.mock.calls.length).toEqual(2);
});
it('refreshes only if the create modal resolves', async () => {
    const { w, aj } = setup(); aj.modal.open.mockResolvedValue(); await flushPromises(); await button(w, 'plus').trigger('click'); await flushPromises();
    expect(aj.http.get.mock.calls.length).toEqual(3); expect(aj.notify.success.mock.calls).toEqual([['Created successfully!']]);
});
it('starts and joins using exact moderator payload/name, then opens external URL', async () => {
    const post = vi.fn().mockResolvedValueOnce({ data: { returncode: 'SUCCESS' } }).mockResolvedValueOnce({ data: 'https://bbb.example/join' });
    const { w, aj } = setup({ post }); await flushPromises(); await button(w, 'play').trigger('click'); await flushPromises();
    expect(post.mock.calls).toEqual([[base + 'startWebConference', { sessionname: 'Konferenz', id: 'one', attendeepw: 'attendee', moderatorpw: 'moderator' }], [base + 'joinWebConference', { id: 'one', password: 'moderator', name: 'Nachname, Vorname' }]]);
    expect(browser.open.mock.calls).toEqual([['https://bbb.example/join']]); expect(aj.http.get.mock.calls.length).toEqual(3);
});
it.each([['zem', 'moderator'], ['other', 'attendee']])('joins started session owned by %s', async (owner, password) => {
    const { w, aj } = setup({ data: [session({ moderator: owner, status: 'started' })], post: vi.fn().mockResolvedValue({ data: 'url' }) }); await flushPromises(); await button(w, 'play').trigger('click'); await flushPromises();
    expect(aj.http.post.mock.calls).toEqual([[base + 'joinWebConference', { id: 'one', password, name: 'Nachname, Vorname' }]]); expect(browser.open.mock.calls).toEqual([['url']]);
});
it('stops successfully; failed start/stop retain list and report original messages', async () => {
    const good = setup({ data: [session({ status: 'started' })] }); await flushPromises(); await button(good.w, 'stop').trigger('click'); await flushPromises();
    expect(good.aj.http.post.mock.calls).toEqual([[base + 'endWebConference', { id: 'one', moderatorpw: 'moderator' }]]); expect(good.aj.notify.success.mock.calls).toEqual([['Stopped successfully!']]);
    for (const [status, icon, text] of [['stopped', 'play', 'Cannot start websession! Try to reload page!'], ['started', 'stop', 'Cannot stop websession! Try to reload page!']]) {
        const { w, aj } = setup({ data: [session({ status })], post: vi.fn().mockResolvedValue({ data: { returncode: 'FAILED' } }) }); await flushPromises(); await button(w, icon).trigger('click'); await flushPromises();
        expect(aj.notify.error.mock.calls).toEqual([[text]]); expect(aj.http.get.mock.calls.length).toEqual(2);
    }
});
it('uses original undefined delete ID and preserves cancel/failure behavior', async () => {
    const { w, aj } = setup(); await flushPromises(); await button(w, 'trash-alt').trigger('click'); await flushPromises();
    expect(aj.messagebox.show.mock.calls).toEqual([[{ text: 'Delete one?', positive: 'Delete', negative: 'Cancel' }]]);
    expect(aj.http.delete.mock.calls).toEqual([[base + 'webConference/undefined']]); expect(aj.notify.success.mock.calls).toEqual([['Successfully removed!']]);
    aj.messagebox.show.mockRejectedValueOnce('cancel'); await button(w, 'trash-alt').trigger('click'); await flushPromises(); expect(aj.http.delete.mock.calls.length).toEqual(1);
    aj.http.delete.mockResolvedValueOnce({ data: { status: 'FAILED' } }); await button(w, 'trash-alt').trigger('click'); await flushPromises(); expect(aj.notify.error.mock.calls).toEqual([['Cannot delete entry!']]);
});
it('shows and copies original public URL through adapter', async () => {
    const { w, aj } = setup(); await flushPromises(); await button(w, 'eye').trigger('click'); await button(w, 'clipboard').trigger('click'); await flushPromises();
    expect(aj.messagebox.show.mock.calls).toEqual([[{ text: 'https://webui.example/websession/one', positive: 'Ok' }]]); expect(browser.copy.mock.calls).toEqual([['https://webui.example/websession/one']]); expect(aj.notify.success.mock.calls).toEqual([['Copied!']]);
});
it('HTTP failures leave state unchanged and rely on adapter error handling', async () => {
    const { w, aj } = setup({ post: vi.fn().mockRejectedValue(new Error('HTTP')), deletion: vi.fn().mockRejectedValue(new Error('HTTP')) }); await flushPromises();
    for (const icon of ['play', 'trash-alt']) { await button(w, icon).trigger('click'); await flushPromises(); }
    expect(aj.notify.error.mock.calls).toEqual([]); expect(w.findAll('.session_table').length).toEqual(1);
});
function createSetup(post = vi.fn().mockResolvedValue({ data: { status: 'SUCCESS' } })) {
    const aj = createMockAj(); aj.http.post = post; aj.http.get = vi.fn(); aj.notify.error = vi.fn();
    const w = mount(CreateSession, { global: { provide: { aj } } }); wrappers.push(w); return { w, aj };
}
it('create name validation; trimmed name/password allow inner spaces typed one character at a time', async () => {
    const { w, aj } = createSetup(); await w.find('[data-action=create]').trigger('click'); expect(aj.http.post.mock.calls).toEqual([]); expect(aj.notify.error.mock.calls).toEqual([['You have to enter a name!']]);
    for (const [name, text] of [['sessionname', '  P62 Konferenz  '], ['sessionpassword', '  zwei Worte  ']]) {
        const input = w.find(`[name=${name}]`); for (const char of text) { input.element.value += char; await input.trigger('input'); }
    }
    await w.find('select').setValue('password'); await w.find('[data-action=create]').trigger('click'); await flushPromises();
    expect(aj.http.post.mock.calls).toEqual([[base + 'webConferences', { sessionname: 'P62 Konferenz', sessiontype: 'password', sessionpassword: 'zwei Worte', participants: [] }]]); expect(w.emitted('cancel')).toEqual([[]]); expect(w.emitted('close')).toEqual(undefined);
});
it('class lookup preserves ten-item limit, duplicate members, removal and payload', async () => {
    const { w, aj } = createSetup(); const member = { sAMAccountName: 'zem', givenName: 'Vor', sn: 'Nach' };
    aj.http.get.mockResolvedValue({ data: Array.from({ length: 12 }, (_, i) => ({ sophomorixAdminClass: `5a-${i}`, members: { one: member, two: { sAMAccountName: 'ba' }, three: member } })) });
    await w.find('[name=classQuery]').setValue('  5a  '); await flushPromises();
    expect(aj.http.get.mock.calls).toEqual([['/api/lmn/session/schoolClass-search/5a']]); expect(w.findAll('.dropdown-menu li').length).toEqual(10);
    await w.find('.dropdown-menu li').trigger('click'); expect(w.findAll('.fa-times-circle').length).toEqual(3);
    await w.findAll('.fa-times-circle')[2].trigger('click'); await w.find('[name=sessionname]').setValue('name'); await w.find('[data-action=create]').trigger('click'); await flushPromises();
    expect(aj.http.post.mock.calls).toEqual([[base + 'webConferences', { sessionname: 'name', sessiontype: 'public', sessionpassword: '', participants: ['ba', 'zem'] }]]);
});
it('preserves broken user lookup without backend request; class request failure and clear hide results', async () => {
    const { w, aj } = createSetup(); await w.find('[name=userQuery]').setValue('ze'); expect(aj.http.get.mock.calls).toEqual([]);
    aj.http.get.mockResolvedValueOnce({ data: null }).mockRejectedValue(new Error('HTTP')); await w.find('[name=classQuery]').setValue('5!'); await flushPromises(); expect(w.find('.dropdown-menu').exists()).toEqual(false);
    await w.find('[name=classQuery]').setValue('5'); await flushPromises(); expect(w.find('.dropdown-menu').exists()).toEqual(false);
    await w.find('[name=classQuery]').setValue(''); await flushPromises(); expect(aj.http.get.mock.calls.length).toEqual(2);
});
it('failed create reports original error then dismisses; HTTP rejection stays open; Close cancels', async () => {
    const { w, aj } = createSetup(vi.fn().mockResolvedValueOnce({ data: { status: 'FAILED' } }).mockRejectedValue(new Error('HTTP')));
    await w.find('[name=sessionname]').setValue('name'); await w.find('[data-action=create]').trigger('click'); await flushPromises();
    expect(aj.notify.error.mock.calls).toEqual([['Create session failed! Try again later!']]); expect(w.emitted('cancel').length).toEqual(1);
    await w.find('[data-action=create]').trigger('click'); await flushPromises(); expect(w.emitted('cancel').length).toEqual(1);
    await w.find('[data-action=close]').trigger('click'); expect(w.emitted('cancel').length).toEqual(2);
});

import { readFileSync, readdirSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import Participants from './Participants.vue';
import SessionFiles from './SessionFiles.vue';
import ManagementControls from './ManagementControls.vue';
import { createMockAj } from '../../adapter/mock.mjs';
import { session, users } from '../../../e2e/fixtures/session_participants.mjs';
const mounted = [];
afterEach(() => mounted.splice(0).forEach(w => w.unmount()));
const aj = createMockAj({ identity: { user: 'fixture-teacher' } });
const render = (component, props) => { const w = mount(component, { props, global: { provide: { aj } } }); mounted.push(w); return w; };
it('C6 templates contain no migrated BS3 structures, including dynamic neutral variants', () => {
    for (const file of readdirSync('src/plugins/lmn_session_new').filter(f => f.endsWith('.vue'))) {
        const source = readFileSync('src/plugins/lmn_session_new/' + file, 'utf8');
        expect(source, file).not.toMatch(/\b(?:btn-default|label-(?:default|success|info)|pull-(?:right|left)|input-group-btn|dropdown-menu-right|progress-bar-warning)\b/);
        expect(source, file).not.toMatch(/\bopen:\s*menu/);
    }
});
it('search show/active state belongs to the menu and option; Escape clears choices and errors remain unchanged', async () => {
    const store = { state: { current: { ...session(), members: [{ ...users()[0], files_error: 'NOTJOINED' }] } } };
    const api = { findUsers: vi.fn().mockResolvedValue(users()), missingClasses: { value: 'fixture-class' }, fixMembership: vi.fn() };
    const w = render(Participants, { store, api, files: { active: { value: false } } });
    const input = w.get('input'); await input.setValue('fixture'); await flushPromises();
    expect(w.get('[data-users]').classes()).toContain('show');
    expect(w.findAll('[data-users] li.active')).toHaveLength(0);
    expect(w.get('[data-users] button.active').classes()).toContain('dropdown-item');
    await input.trigger('keydown', { key: 'ArrowDown' });
    expect(w.findAll('[data-users] button')[1].classes()).toContain('active');
    expect(w.get('[data-membership]').text()).toContain('fixture-class');
    expect(w.get('.badge.bg-info').text()).toContain('1');
    expect(w.get('select').classes()).toContain('form-select');
    await input.trigger('keydown', { key: 'Escape' }); expect(w.find('[data-users]').exists()).toBe(false);
});
it('collect show closes after rejected/cancelled command; row neutral active and B01 menu markup remain', async () => {
    const user = { ...users()[0], files_error: '' }, store = { state: { current: session(), extExamUsers: [] } };
    const api = { collectUser: vi.fn().mockRejectedValue('cancel') };
    const w = render(SessionFiles, { user, store, api });
    expect(w.get('[data-share-user]').classes()).toEqual(expect.arrayContaining(['btn-light', 'c6-button', 'active']));
    await w.get('[data-collect-toggle]').trigger('click');
    expect(w.get('ul').classes()).toEqual(expect.arrayContaining(['show', 'dropdown-menu-end']));
    expect(w.get('[data-collect-user-copy]').classes()).toContain('dropdown-item');
    await w.get('[data-collect-user-copy]').trigger('click'); await flushPromises();
    expect(w.get('ul').classes()).not.toContain('show'); expect(api.collectUser).toHaveBeenCalledWith('copy', user);
});
it('mixed management state resolves neutral BS5 classes without changing all/none LMN priorities', async () => {
    const store = { state: { current: { members: [{ wifi: true }, { wifi: false }] } } };
    const w = render(ManagementControls, { store, api: {} });
    expect(w.get('[data-management-all-wifi]').classes()).toEqual(expect.arrayContaining(['btn-light', 'c6-button']));
    await w.setProps({ store: { state: { current: { members: [{ wifi: true }] } } } });
    expect(w.get('[data-management-all-wifi]').classes()).toContain('btn-lmn-success-inv');
    expect(w.get('[data-management-all-wifi]').classes()).not.toContain('c6-button');
});

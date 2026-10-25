import { afterEach, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import PasswordActions from './PasswordActions.vue';
import ShowPassword from '../../common/users/ShowPassword.vue';
import CustomPassword from '../../common/users/CustomPassword.vue';
import { createMockAj } from '../../adapter/mock.mjs';
const mounted = [];
afterEach(() => { mounted.forEach(w => w.unmount()); vi.restoreAllMocks(); });
function setup(extra = {}) {
    const calls = [], aj = createMockAj({ identity: { user: 'p96-teacher' }, http: async r => { calls.push([r.method, r.url, r.data]); return { data: {} }; } });
    aj.messagebox.show = vi.fn(aj.messagebox.show);
    aj.modal.open = vi.fn().mockResolvedValue();
    const user = { cn: 'p96-a', sAMAccountName: 'p96-a', sn: 'Fixture', givenName: 'Synthetic', sophomorixAdminClass: 'p96-class', ...extra };
    const wrapper = mount(PasswordActions, { props: { user }, global: { provide: { aj } } }); mounted.push(wrapper);
    return { wrapper, aj, user, calls };
}
it('opens the shared first-password dialog, blurs the table until close and closes the menu', async () => {
    const s = setup(); let close; s.aj.modal.open.mockReturnValue(new Promise(r => { close = r; }));
    await s.wrapper.get('button').trigger('click'); expect(s.wrapper.get('[data-password-menu] .dropdown-menu').classes()).toContain('show'); await s.wrapper.get('[data-password-show]').trigger('click');
    expect(s.aj.modal.open.mock.calls).toEqual([[ShowPassword, { username: 'p96-a' }, { backdrop: 'static', keyboard: false }]]);
    expect(s.wrapper.emitted('blur')).toEqual([[true]]); expect(s.wrapper.get('button').attributes('aria-expanded')).toBe('false');
    close(); await flushPromises(); expect(s.wrapper.emitted('blur')).toEqual([[true], [false]]);
});
it('reset and random use single CN; custom first/current reuse existing dialog without changing targets', async () => {
    const s = setup();
    for (const name of ['reset', 'random', 'first', 'current']) await s.wrapper.get(`[data-password-${name}]`).trigger('click');
    await flushPromises(); expect(s.calls).toEqual([['post', '/api/lmn/users/passwords/reset-first', { users: 'p96-a' }], ['post', '/api/lmn/users/passwords/set-random', { users: 'p96-a' }]]);
    expect(s.aj.modal.open.mock.calls).toEqual([[CustomPassword, { users: [s.user], pwtype: 'first' }], [CustomPassword, { users: [s.user], pwtype: 'current' }]]);
});
it('own exam resets both accounts separately, offers current for exam alone or both, hides first/random', async () => {
    const s = setup({ cn: 'p96-a-exam', sAMAccountName: 'p96-a-exam', sophomorixAdminClass: 'p96-class-exam', examMode: true, examTeacher: 'p96-teacher', examBaseCn: 'p96-a' });
    expect(s.wrapper.find('[data-password-first]').exists()).toBe(false); expect(s.wrapper.find('[data-password-random]').exists()).toBe(false);
    await s.wrapper.get('[data-password-reset]').trigger('click'); await s.wrapper.get('[data-password-current]').trigger('click'); await s.wrapper.get('[data-password-both]').trigger('click'); await flushPromises();
    expect(s.calls).toEqual(['p96-a-exam', 'p96-a'].map(users => ['post', '/api/lmn/users/passwords/reset-first', { users }]));
    expect(s.aj.modal.open.mock.calls).toEqual([[CustomPassword, { users: [s.user], pwtype: 'current' }], [CustomPassword, { users: [s.user, { sophomorixAdminClass: 'p96-class', sn: 'Fixture', givenName: 'Synthetic', sAMAccountName: 'p96-a' }], pwtype: 'current' }]]);
});
it('foreign exam has no password menu and suffix check blocks random even with stale examMode', async () => {
    const s = setup({ examMode: true, examTeacher: 'other' }); expect(s.wrapper.find('button').exists()).toBe(false);
    await s.wrapper.setProps({ user: { ...s.user, cn: 'p96-a-exam', examMode: false } });
    await s.wrapper.get('[data-password-random]').trigger('click'); await flushPromises(); expect(s.calls).toEqual([]); expect(s.aj.messagebox.show).toHaveBeenCalled();
});
it('focus leaving the menu closes it and dismissed password display restores blur', async () => {
    const s = setup(); s.aj.modal.open.mockRejectedValue('cancel'); await s.wrapper.get('button').trigger('click');
    await s.wrapper.get('[data-password-menu]').trigger('focusout', { relatedTarget: document.body }); expect(s.wrapper.get('button').attributes('aria-expanded')).toBe('false');
    await s.wrapper.get('[data-password-show]').trigger('click'); await flushPromises(); expect(s.wrapper.emitted('blur')).toEqual([[true], [false]]);
});
it.each(['higher role', 'other teacher', 'unknown target'])('keeps backend target authorization for %s and reports denied reset without success', async reason => {
    const s = setup(), notify = vi.fn(); s.aj.notify.success = notify; s.aj.notify.error = vi.fn();
    s.aj.http.post = vi.fn().mockRejectedValue({ status: 403, data: { message: reason } });
    await s.wrapper.get('[data-password-reset]').trigger('click'); await flushPromises();
    expect(s.aj.http.post.mock.calls).toEqual([['/api/lmn/users/passwords/reset-first', { users: 'p96-a' }]]);
    expect(notify.mock.calls).toEqual([]); expect(s.aj.notify.error.mock.calls).toEqual([['Password change failed: ' + reason, undefined, { sticky: true }]]);
});

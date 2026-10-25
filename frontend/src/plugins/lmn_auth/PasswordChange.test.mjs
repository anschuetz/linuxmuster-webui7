import { afterEach, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import PasswordChange from './PasswordChange.vue';
import { mount as entry } from './entry.mjs';

const wrappers = [];
function setup(overrides = {}) {
    const aj = { gettext: (s) => s, pageTitle: { set: vi.fn() }, navigate: vi.fn(),
        http: { post: vi.fn(async () => ({})) },
        notify: { success: vi.fn(), error: vi.fn() }, ...overrides };
    const w = mount(PasswordChange, { attachTo: document.body, global: { provide: { aj } } });
    wrappers.push(w); return { w, aj };
}
const fields = (w) => w.findAll('input');
const save = (w) => w.find('button');
async function fill(w, old = 'old dummy', next = 'new dummy', repeat = next) {
    for (const [i, value] of [[0, old], [1, next], [3, repeat]]) await fields(w)[i].setValue(value);
}
afterEach(() => { wrappers.splice(0).forEach((w) => w.unmount()); document.body.innerHTML = ''; });
it('translates the original policy, title and labels without imposing a client policy', async () => {
    const { w, aj } = setup({ gettext: (s) => `DE:${s}` });
    expect(aj.pageTitle.set.mock.calls).toEqual([['DE:Change Password']]);
    expect(w.findAll('label').map((l) => l.text())).toEqual(['DE:Current password', 'DE:New password', 'DE:New password', 'DE:Repeat password']);
    expect(w.find('.alert-info').text()).toContain('DE:All fields are required');
    expect(save(w).element.disabled).toBe(true);
    await fill(w, 'a', 'x', 'y');
    expect(w.find('small').isVisible()).toBe(true); expect(save(w).element.disabled).toBe(true);
    await fields(w)[3].setValue('x'); expect(save(w).element.disabled).toBe(false);
    await fields(w)[0].setValue(''); expect(save(w).element.disabled).toBe(true);
});
it('keeps masked whitespace intact and sends only the exact old/new keys', async () => {
    const { w, aj } = setup();
    await fill(w, ' old dummy ', ' new dummy ');
    await save(w).trigger('click'); await flushPromises();
    expect(aj.http.post.mock.calls).toEqual([['/api/lmn/change-password', { password: ' old dummy ', new_password: ' new dummy ' }]]);
    expect(aj.notify.success.mock.calls).toEqual([['Password changed']]);
    expect(aj.navigate.mock.calls).toEqual([['landingpage', { replace: true }]]);
});
it('switches the two original new-password inputs and trims only typed visible text like Angular', async () => {
    const { w, aj } = setup();
    await fill(w);
    expect(fields(w)[1].isVisible()).toBe(true); expect(fields(w)[2].isVisible()).toBe(false);
    await w.find('.fa-eye').trigger('click');
    expect(fields(w)[1].isVisible()).toBe(false); expect(fields(w)[2].isVisible()).toBe(true);
    const text = fields(w)[2]; await text.setValue(''); text.element.focus();
    for (const c of ' new dummy ') { text.element.value += c; await text.trigger('input'); }
    expect(text.element.value).toBe(' new dummy ');
    await w.find('.fa-eye-slash').trigger('click');
    expect(fields(w)[1].element.value).toBe('new dummy');
    await save(w).trigger('click'); await flushPromises();
    expect(aj.http.post.mock.calls).toEqual([['/api/lmn/change-password', { password: 'old dummy', new_password: 'new dummy' }]]);
});
it('keeps the form enabled during requests and shows the original permanent failure without navigation', async () => {
    let reject;
    const { w, aj } = setup({ http: { post: vi.fn(() => new Promise((_, no) => { reject = no; })) } });
    await fill(w); await save(w).trigger('click');
    expect(save(w).element.disabled).toBe(false);
    reject({ data: { message: 'Wrong password' } }); await flushPromises();
    expect(aj.notify.error.mock.calls).toEqual([['Password change failed: Wrong password', undefined, { sticky: true }]]);
    expect(aj.navigate.mock.calls).toEqual([]); expect(aj.notify.success.mock.calls).toEqual([]);
    expect(fields(w)[0].element.value).toBe('old dummy');
});
it('retains the controller guard if change is invoked without a new password', async () => {
    const { w, aj } = setup();
    // DOM bypass corresponds to calling the old scope.change directly.
    save(w).element.disabled = false; await save(w).trigger('click'); await flushPromises();
    expect(aj.http.post.mock.calls).toEqual([]);
    expect(aj.notify.error.mock.calls).toEqual([['You have to enter a password']]);
});
it('mounts and disposes through the plugin entry', () => {
    const { aj } = setup(); const host = document.createElement('div');
    const unmount = entry(host, aj); expect(host.textContent).toContain('Current password');
    unmount(); expect(host.innerHTML).toBe('');
});

it('uses BS5 spacing with separately positioned eyes and retains mismatch-only feedback', async () => {
    const { w, aj } = setup();
    expect(w.find('.form-group, .has-feedback, .form-control-feedback, .has-error').exists()).toBe(false);
    expect(w.findAll('.auth-field.mb-3')).toHaveLength(5);
    expect(w.findAll('.auth-password-field.position-relative .auth-password-feedback')).toHaveLength(2);
    await fill(w, 'old', 'one', 'two');
    expect(w.find('small').isVisible()).toBe(true);
    expect(save(w).element.disabled).toBe(true);
    expect(w.find('.is-invalid').exists()).toBe(false);
    expect(aj.http.post).not.toHaveBeenCalled();
});

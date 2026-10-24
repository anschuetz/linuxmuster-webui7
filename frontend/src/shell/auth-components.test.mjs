import { afterEach, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { reactive } from 'vue';
import { Login, PasswordReset } from './auth-components.mjs';
const wrappers = [];
afterEach(() => wrappers.splice(0).forEach(w => w.unmount()));
function render(component, state) {
    const model = { state: reactive(state), gettext: text => text, dispose: vi.fn(), login: vi.fn(), verify: vi.fn(), cancel: vi.fn(), send: vi.fn(), save: vi.fn() };
    const wrapper = mount(component, { props: { model, customization: { plugins: { core: { bigLogoURL: '/logo.png' } } } } });
    wrappers.push(wrapper); return { wrapper, model };
}
it('renders login grid, card, logo, placeholders and eye toggle', async () => {
    const { wrapper: w } = render(Login, { mode: 'normal', username: '', password: '', showPWReset: true });
    expect(w.find('.container.auth-page #login-form.row .col-sm-4.auth-card').exists()).toBe(true);
    expect(w.find('.text-center img').attributes('src')).toBe('/logo.png');
    expect(w.find('h1 .fa-lock').exists()).toBe(true);
    expect(w.find('label').exists()).toBe(false);
    expect(w.find('[name=username]').attributes()).toMatchObject({ placeholder: 'Username', 'aria-label': 'Username', autofocus: '' });
    expect(w.find('[name=password]').attributes()).toMatchObject({ placeholder: 'Password', 'aria-label': 'Password', type: 'password' });
    expect(w.find('button[type=submit]').classes()).toEqual(expect.arrayContaining(['btn-primary', 'btn-block']));
    expect(w.find('button[type=submit]').text()).toBe('Log in');
    expect(w.find('a').text()).toBe('Password forgotten ?');
    await w.find('[data-action=show-password]').trigger('click');
    expect(w.find('[name=password]').attributes('type')).toBe('text');
    expect(w.find('[data-action=show-password] .fa-eye-slash').exists()).toBe(true);
    expect(w.find('[data-action=show-password]').attributes('aria-label')).toBe('Hide password');
    await w.find('[data-action=show-password]').trigger('click');
    expect(w.find('[data-action=show-password] .fa-eye').exists()).toBe(true);
});
it('renders working/success lock, sudo action and structured TOTP dialog', async () => {
    const { wrapper: w, model: m } = render(Login, { mode: 'sudo', username: 'admin', password: 'pw', working: true, verif_code: true, code: '' });
    expect(w.find('[name=username]').exists()).toBe(false);
    expect(w.find('h1 .flip-cycle.fa-lock').exists()).toBe(true);
    expect(w.find('button[type=submit]').text()).toBe('Authenticate');
    expect(w.find('dialog.auth-dialog .modal-header h4').text()).toBe('Please enter TOTP verification code:');
    expect(w.find('dialog .modal-body [name=code]').attributes('aria-label')).toBe('Please enter TOTP verification code:');
    expect(w.find('dialog .modal-footer [data-action=cancel]').exists()).toBe(true);
    m.state.success = true; await w.vm.$nextTick();
    expect(w.find('h1 .flip-cycle.fa-unlock-alt').exists()).toBe(true);
});
it('renders matching reset cards with original icons, placeholders and primary actions', () => {
    for (const state of [{ mail: '' }, { serial: 'valid', ready: true, serial_ok: true, password1: '', password2: '' }]) {
        const { wrapper: w } = render(PasswordReset, state);
        expect(w.find('.auth-page #login-form.row .auth-card.col-sm-4').exists()).toBe(true);
        expect(w.find('.text-center img').exists()).toBe(true);
        expect(w.find(`h1 .${state.serial ? 'fa-user-edit' : 'fa-envelope'}`).exists()).toBe(true);
        expect(w.find('button[type=submit]').classes()).toEqual(expect.arrayContaining(['btn-primary', 'btn-block']));
        expect(w.find('input').attributes('placeholder')).toBe(state.serial ? 'New password' : 'Email');
    }
});

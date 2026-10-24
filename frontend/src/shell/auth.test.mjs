import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { authOracle } from '../../test-fixtures/shell/auth.mjs';
import { createLogin, createPasswordReset, createTotp } from './auth.mjs';
import { Login, PasswordReset, Totp, mountAuthentication } from './auth-components.mjs';
const cleanup = [];
afterEach(() => { cleanup.splice(0).reverse().forEach(fn => fn()); vi.restoreAllMocks(); });
function setup(options = {}) {
    const old = authOracle(options); cleanup.push(old.close);
    const navigate = vi.fn(), notify = { error: vi.fn(), success: vi.fn() };
    const session = { http: old.http, identity: { user: null, refresh: vi.fn(async () => {}) }, logout: vi.fn() };
    const services = { notify, gettext: text => text, messagebox: { show: vi.fn(() => Promise.resolve()) } };
    return { old, session, services, navigate, options: { session, services, navigate, ...options } };
}
function render(component, model) { const wrapper = mount(component, { props: { model } }); cleanup.push(() => wrapper.unmount()); return wrapper; }
const settle = () => flushPromises();
const identityReply = { identity: { user: null, profile: {} } };

describe('login against original controller, service and real inputs', () => {
    it('matches ngTrim, password spaces, lowercase username and LM redirect after refresh', async () => {
        const s = setup({ nextPage: '/view/private', pwReset: 'True' });
        s.old.respond(url => url.endsWith('identity') ? identityReply : { success: true });
        const old = s.old.controller('Login'); expect(s.old.root.disableExpiredSessionInterceptor).toBe(true); await settle();
        const dom = s.old.mount('login', old), inputs = dom.querySelectorAll('input');
        for (const [input, value] of [[inputs[0], ' User '], [inputs[1], ' pass ']]) { input.value = value; input.dispatchEvent(new dom.ownerDocument.defaultView.Event('input', { bubbles: true })); }
        old.login(); await settle();
        const model = createLogin(s.options), ui = render(Login, model); await model.start();
        await ui.get('[name=username]').setValue(' User '); await ui.get('[name=password]').setValue(' pass ');
        await ui.get('form').trigger('submit'); await settle();
        expect(s.old.requests.filter(x => x[1].endsWith('/auth')).map(x => x[2])).toEqual(Array(2).fill({ username: 'user', password: ' pass ', mode: 'normal' }));
        expect(s.navigate).toHaveBeenCalledWith('/'); expect(s.old.redirects).toEqual(['/']);
        expect(s.session.identity.refresh).toHaveBeenCalledTimes(2); expect(ui.find('a').attributes('href')).toBe('/view/reset_password_send');
        model.cancel(); await settle(); await ui.get('[data-action=show-password]').trigger('click'); await ui.get('[name=password]').setValue(' visible '); expect(model.state.password).toBe('visible');
    });
    it.each(['normal', 'sudo:Root', 'other'])('matches failed %s authentication and provider flag', async mode => {
        const s = setup({ mode, pwReset: true }); s.old.respond(url => url.endsWith('identity') ? identityReply : { success: false, error: 'denied' });
        const old = s.old.controller('Login'); await settle(); old.username = 'User'; old.password = 'pw'; old.login(); await settle();
        const model = createLogin(s.options); if (mode.startsWith('sudo:')) expect(model.state.username).toBe(mode.split(':')[1]); model.state.username = 'User'; model.state.password = 'pw'; await model.login();
        expect(s.services.notify.error).toHaveBeenCalledWith(s.old.notices.at(-1)[1]); expect(model.state.working).toBe(false);
        expect(model.state.showPWReset).toBe(old.showPWReset); expect(model.state.mode).toBe(old.mode);
        expect(render(Login, model).find('[name=username]').exists()).toBe(mode === 'normal');
    });
    it('uses code#nonce and ends the second stage after three wrong codes', async () => {
        const s = setup(); s.old.respond(url => url.endsWith('identity') ? identityReply : { success: true, totp: true, totp_random: 'nonce' });
        const old = s.old.controller('Login'); await settle(); old.username = 'user'; old.password = 'pw'; old.login(); await settle();
        const model = createLogin(s.options); model.state.username = 'user'; model.state.password = 'pw'; await model.login(); expect(model.state.verif_code).toBe(old.verif_code);
        s.old.respond(() => ({ success: false })); const ui = render(Login, model); await model.verify('123'); expect(model.state.totp_attempts).toBe(0);
        for (let i = 0; i < 3; i++) { const event = { code: '012345' }; old.verify(event); await settle(); await ui.get('[name=code]').setValue(' 012345 '); await settle(); expect(event.code).toBe(''); }
        expect(s.old.requests.filter(x => x[2]?.mode === 'totp').map(x => x[2].password)).toEqual(Array(6).fill('012345#nonce'));
        for (const key of ['working', 'verif_code', 'totp_attempts', 'username', 'password']) expect(model.state[key]).toBe(old[key]);
    });
    it('finishes TOTP and cancels the dialog; empty credentials do nothing', async () => {
        const s = setup(); s.old.respond(() => ({ success: true })); const model = createLogin(s.options);
        model.state.username = 'user'; model.state.totp_random = 'n'; model.state.verif_code = true;
        await model.verify('123456'); expect(model.state.success).toBe(true); expect(s.navigate).toHaveBeenCalledWith('/');
        const ui = render(Login, model); await ui.get('[data-action=cancel]').trigger('click'); expect(model.state.username).toBe(''); await model.login(); expect(model.state.working).toBe(false);
    });
    it('redirects identified normal users, retains sudo, and handles HTTP authentication errors', async () => {
        const s = setup(); s.session.identity.user = 'user'; const model = createLogin(s.options); await model.start(); expect(s.navigate).toHaveBeenCalledWith('/');
        s.navigate.mockClear(); await createLogin({ ...s.options, mode: 'sudo:user' }).start(); expect(s.navigate).not.toHaveBeenCalled();
        s.old.respond(() => { throw { status: 401 }; }); model.state.username = 'user'; model.state.password = 'pw'; await model.login(); expect(s.services.notify.error).toHaveBeenCalledWith('Authentication failed');
    });
});

describe('reset against original controllers', () => {
    it('sends trimmed mail and immediately redirects with the same notice', async () => {
        const s = setup(); const old = s.old.controller('PWResetMail'), dom = s.old.mount('reset_password_send', old), input = dom.querySelector('input');
        input.value = ' user@example.test '; input.dispatchEvent(new dom.ownerDocument.defaultView.Event('input', { bubbles: true })); old.send_email_reset();
        const model = createPasswordReset(s.options), ui = render(PasswordReset, model); await ui.get('[name=mail]').setValue(' user@example.test '); await ui.get('form').trigger('submit'); await settle();
        expect(s.old.requests.filter(x => x[1].endsWith('send_password_reset')).map(x => x[2])).toEqual([{ mail: 'user@example.test' }, { mail: 'user@example.test' }]);
        expect(s.services.notify.success).toHaveBeenCalledWith(s.old.notices[0][1]); expect(s.navigate).toHaveBeenCalledWith('/');
    });
    it.each(['ok', 'serial', 'complexity', 'update'])('matches %s response and payloads', async failure => {
        const s = setup({ serial: 'link-id' }); s.old.respond(url => { if (url.includes(failure === 'serial' ? 'check_password_serial' : failure === 'complexity' ? 'check_password_complexity' : failure === 'update' ? 'update_password' : 'never')) throw { data: { message: 'requirements' } }; return {}; });
        const old = s.old.controller('PWReset'); expect(s.old.root.disableExpiredSessionInterceptor).toBe(true); await settle(); const model = createPasswordReset(s.options); await model.start(); expect(model.state.ready).toBe(old.ready); expect(model.state.serial_ok).toBe(old.serial_ok);
        const ui = render(PasswordReset, model); if (failure === 'serial') { expect(ui.text()).toContain('not valid or expired'); return; }
        old.password1 = old.password2 = ' secret '; old.save_password(); await settle();
        await ui.get('[name=password1]').setValue(' secret '); await ui.get('[name=password2]').setValue(' secret '); await ui.get('form').trigger('submit'); await settle();
        expect(s.old.requests.filter(x => x[1].endsWith('check_password_complexity')).map(x => x[2])).toEqual([{ password: ' secret ' }, { password: ' secret ' }]);
        expect([...s.services.notify.success.mock.calls, ...s.services.notify.error.mock.calls].at(-1)[0]).toBe(s.old.notices.at(-1)[1]); expect(s.navigate.mock.calls.map(x => x[0])).toEqual(s.old.redirects);
    });
    it('disables mismatched passwords and handles send failure through shared policy', async () => {
        const s = setup({ serial: 's' }), model = createPasswordReset(s.options); await model.start(); const ui = render(PasswordReset, model);
        expect(ui.get('button').attributes('disabled')).toBeDefined(); await ui.get('[name=password1]').setValue('a'); await ui.get('[name=password2]').setValue('b'); expect(ui.text()).toContain('differ'); await model.save(); expect(s.old.requests).toHaveLength(1);
        s.old.respond(() => { throw { status: 500 }; }); await createPasswordReset({ ...s.options, serial: undefined }).send(); expect(s.navigate).toHaveBeenCalledWith('/');
    });
});

describe('TOTP review regressions', () => {
    it('preserves inner description spaces when typing character by character', async () => {
        const s = setup(), model = createTotp(s.options); model.state.add_new = true;
        const ui = render(Totp, model), input = ui.get('[name=description]');
        for (const character of 'my phone') {
            input.element.value += character;
            await input.trigger('input');
        }
        expect(input.element.value).toBe('my phone');
        expect(model.state.tmp_totp.description).toBe('my phone');
    });
    it('does not claim there are no keys while loading or after HTTP 500', async () => {
        const s = setup(); let reject;
        s.session.http = { get: vi.fn(() => new Promise((resolve, fail) => { reject = fail; })) };
        const model = createTotp(s.options), ui = render(Totp, model), loading = model.start();
        expect(ui.text()).not.toContain('There is currently no TOTP key for this user.');
        reject({ status: 500 }); await loading; await settle();
        expect(ui.text()).not.toContain('There is currently no TOTP key for this user.');
        expect(model.state.totp).toBeUndefined();
    });
    it('only requests verification or QR when the trimmed input changes', async () => {
        const s = setup(); s.session.http = { post: vi.fn(() => new Promise(() => {})) };
        const login = createLogin(s.options); login.state.verif_code = true;
        const loginUi = render(Login, login), code = loginUi.get('[name=code]');
        await code.setValue('123456'); await code.setValue('123456 ');
        expect(s.session.http.post).toHaveBeenCalledTimes(1);
        expect(login.state.totp_attempts).toBe(1);
        const totp = createTotp(s.options); totp.state.add_new = true; totp.state.tmp_totp.secret = 'A'.repeat(32);
        const ui = render(Totp, totp), verification = ui.get('[name=verification]');
        await verification.setValue('123456'); await verification.setValue('123456 ');
        expect(s.session.http.post).toHaveBeenCalledTimes(2);
        totp.state.verified = true; totp.state.tmp_qr = 'existing'; await settle();
        await ui.get('[name=secret]').setValue('A'.repeat(32) + ' ');
        expect(s.session.http.post).toHaveBeenCalledTimes(2);
        expect(totp.state.verified).toBe(true); expect(totp.state.tmp_qr).toBe('existing');
    });
});

describe('TOTP management', () => {
    it('generates base32, requests QR, verifies and saves the original envelope', async () => {
        vi.spyOn(Date, 'now').mockReturnValue(1700000000000); const s = setup(); s.old.respond(url => url.endsWith('/totps') ? [] : url.endsWith('/qr') ? 'cG5n' : true);
        const old = s.old.controller('Totp'); await settle(); const model = createTotp(s.options); await model.start(); const ui = render(Totp, model);
        await ui.get('[data-action=add]').trigger('click'); expect(model.state.tmp_totp.secret).toMatch(/^[A-Z2-7]{32}$/); await settle(); expect(ui.get('img').attributes('src')).toBe('data:image/png;base64,cG5n');
        old.tmp_totp = { description: 'key', secret: 'A'.repeat(32) }; old.update_tmp_qr(); await settle(); old.verify({ verif_code: '123456' }); await settle(); old.save(); await settle();
        await ui.get('[name=description]').setValue(' key '); await ui.get('[name=secret]').setValue('a'.repeat(32)); await ui.get('[name=verification]').setValue(' 123456 '); await settle(); expect(model.state.verified).toBe(true);
        await ui.get('[data-action=save]').trigger('click'); await settle();
        expect(s.old.requests.filter(x => x[0] === 'POST' && x[1] === '/api/core/totps').map(x => x[2])).toEqual(Array(2).fill({ secret: { description: 'key', secret: 'A'.repeat(32), created: 1700000000 } })); expect(model.state.totp).toEqual(old.totp); expect(model.state.add_new).toBe(false);
    });
    it('handles invalid keys, short codes, cancel, delete confirmation and rejection', async () => {
        const s = setup(); s.old.respond(() => [{ description: 'key', created: 123 }]); const model = createTotp(s.options); await model.start(); const ui = render(Totp, model);
        await ui.get('[data-action=add]').trigger('click'); await settle(); await ui.get('[name=secret]').setValue('invalid'); expect(ui.find('img').exists()).toBe(false); await model.verify('123');
        await ui.get('[data-action=cancel]').trigger('click'); expect(model.state.add_new).toBe(false);
        s.services.messagebox.show.mockRejectedValueOnce('cancel'); await ui.get('[data-action=delete]').trigger('click'); await settle(); expect(model.state.totp).toHaveLength(1);
        await ui.get('[data-action=delete]').trigger('click'); await settle(); expect(model.state.totp).toEqual([]); expect(s.services.notify.success).toHaveBeenCalledWith('Command successfully sent');
    });
    it('keeps list on transport failures and failed verification never approves saving', async () => {
        const s = setup(); s.old.respond(() => { throw { status: 500 }; }); const model = createTotp(s.options); await model.start(); await model.add(); model.state.tmp_totp.secret = 'A'.repeat(32);
        await model.verify('123456'); expect(model.state.verified).toBe(false); await model.save(); expect(model.state.totp).toBeUndefined(); model.state.totp = [{ created: 12 }]; await model.remove(model.state.totp[0]); expect(model.state.totp).toHaveLength(1);
    });
});
it('mounts explicit isolated routes and rejects unrelated routes', async () => {
    const s = setup(); s.old.respond(() => identityReply); const element = document.createElement('div'); document.body.append(element); cleanup.push(() => element.remove());
    for (const path of ['/view/login/normal', '/view/totp', '/view/reset_password_send', '/view/reset_password/link-id']) { const stop = mountAuthentication(element, { ...s.options, path }); await settle(); expect(element.children.length).toBeGreaterThan(0); stop(); expect(element.children).toHaveLength(0); }
    expect(() => mountAuthentication(element, { ...s.options, path: '/view/settings' })).toThrow('Unknown authentication route');
});

it('renders TOTP user, description and local timestamp like the original table', async () => {
    const s = setup(); s.old.respond(() => [{ created: 1700000000, description: 'test key' }]);
    const old = s.old.controller('Totp'); await settle(); old.identity = { user: 'testuser' };
    const dom = s.old.mount('totp', old), model = createTotp(s.options); s.session.identity.user = 'testuser'; await model.start();
    const ui = render(Totp, model), cells = ui.findAll('tbody td'), original = dom.querySelectorAll('tr')[1].querySelectorAll('td');
    expect(cells.slice(0, 3).map(cell => cell.text())).toEqual(Array.from(original).slice(0, 3).map(cell => cell.textContent));
});

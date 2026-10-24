import { afterEach, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { mountAuthHarness } from './auth-harness.mjs';
import { createLogin, createPasswordReset, createTotp } from './auth.mjs';

const cleanups = [];
afterEach(() => { cleanups.splice(0).reverse().forEach(fn => fn()); });
function harness(path, respond, extra = {}) {
    const element = document.createElement('div'); document.body.append(element);
    const requests = [], navigate = vi.fn();
    const owner = mountAuthHarness(element, { path, prefix: '/panel', navigate, ...extra,
        fetch: async (url, cfg) => {
            const body = cfg.body ? JSON.parse(cfg.body) : undefined; requests.push([url, body]);
            const result = await respond(url, body);
            return { status: result.status ?? 200, statusText: '', headers: new Headers({ 'Content-Type': 'application/json' }), text: async () => JSON.stringify(result.data) };
        } });
    cleanups.push(() => { owner.dispose(); element.remove(); });
    return { ...owner, element, requests, navigate };
}
const identity = { data: { identity: { user: null, profile: {} } } };
const enter = (input, value) => { input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); };
it('composes real session/presentation with login and renders failed authentication', async () => {
    const s = harness('/view/login/normal', url => url.endsWith('identity') ? identity : { data: { success: false } }, { pwReset: 'True' });
    await flushPromises(); enter(s.element.querySelector('[name=username]'), ' test '); enter(s.element.querySelector('[name=password]'), ' pw ');
    s.element.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await flushPromises();
    expect(s.element.textContent).toContain('Authentication failed'); expect(s.requests.at(-1)).toEqual(['/panel/api/core/auth', { username: 'test', password: ' pw ', mode: 'normal' }]);
});
it('suppresses reset 401 expiry, retains shared 403/500 policy and redirects mail immediately', async () => {
    const s = harness('/view/reset_password/expired', url => ({ status: url.endsWith('forbidden') ? 403 : 401, data: 'expired' })); await flushPromises();
    expect(s.element.textContent).toContain('not valid or expired'); expect(s.navigate).not.toHaveBeenCalled(); expect(s.element.textContent).not.toContain('Your session has expired');
    await s.session.http.get('/forbidden').catch(() => {}); await flushPromises(); expect(s.element.textContent).toContain('Security error');
    const mail = harness('/view/reset_password_send', () => ({ status: 500, data: { exception: 'Failure', message: 'reset failed' } }));
    enter(mail.element.querySelector('[name=mail]'), ' fake@example.test '); mail.element.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await flushPromises();
    expect(mail.element.textContent).toContain('If the email exists'); expect(mail.element.textContent).toContain('Server error'); expect(mail.element.textContent).toContain('reset failed'); expect(mail.navigate).toHaveBeenCalledWith('/');
});
function modelOptions() {
    const http = { get: vi.fn(async () => ({ data: [] })), post: vi.fn(async () => ({ data: true })), delete: vi.fn(async () => ({})) };
    return { session: { http, identity: { user: 'test', refresh: vi.fn(async () => {}) } }, services: { gettext: t => t,
        notify: { success: vi.fn(), error: vi.fn() }, messagebox: { show: vi.fn(async () => {}) } }, navigate: vi.fn() };
}
it('invalidates verification and late QR/verify responses when the TOTP key changes', async () => {
    const options = modelOptions(), m = createTotp(options); cleanups.push(m.dispose); await m.add(); await m.verify('123456'); expect(m.state.verified).toBe(true);
    const pending = [];
    options.session.http.post.mockImplementation((url, data) => new Promise(resolve => pending.push({ url, data, resolve })));
    const verification = m.verify('654321'); m.state.tmp_totp = { ...m.state.tmp_totp, secret: 'B'.repeat(32) }; const first = m.updateQr();
    expect(m.state.verified).toBe(false); m.state.tmp_totp = { ...m.state.tmp_totp, secret: 'C'.repeat(32) }; const second = m.updateQr();
    pending[2].resolve({ data: 'new' }); await second; pending[1].resolve({ data: 'old' }); pending[0].resolve({ data: true }); await Promise.all([first, verification]);
    expect(m.state.tmp_qr).toBe('new'); expect(m.state.verified).toBe(false); const before = options.session.http.post.mock.calls.length; await m.save(); expect(options.session.http.post).toHaveBeenCalledTimes(before);
});
it('handles verification rejection and save transport errors without adding a key', async () => {
    const options = modelOptions(), m = createTotp(options); cleanups.push(m.dispose); await m.add();
    options.session.http.post.mockResolvedValueOnce({ data: false }); await m.verify('123456'); expect(m.state.verified).toBe(false);
    options.session.http.post.mockResolvedValueOnce({ data: true }); await m.verify('123456'); options.session.http.post.mockRejectedValueOnce({ status: 403 }); await m.save();
    expect(m.state.add_new).toBe(false); expect(m.state.totp).toBeUndefined(); expect(options.services.notify.success).not.toHaveBeenCalled();
});
it('teardown prevents late auth, reset and TOTP results from navigating or restoring secrets', async () => {
    for (const kind of ['login', 'verify', 'reset', 'qr', 'save', 'delete', 'list']) {
        const o = modelOptions(); let resolve; const pending = new Promise(yes => { resolve = yes; });
        const m = kind === 'login' || kind === 'verify' ? createLogin(o) : kind === 'reset' ? createPasswordReset({ ...o, serial: 's' }) : createTotp(o);
        let request;
        if (kind === 'list') { o.session.http.get.mockReturnValueOnce(pending); request = m.start(); }
        else if (kind === 'delete') { o.services.messagebox.show.mockReturnValueOnce(pending); request = m.remove({ created: 1 }); }
        else {
            o.session.http.post.mockReturnValueOnce(pending);
            if (kind === 'login') { m.state.username = 'user'; m.state.password = 'pw'; request = m.login(); }
            if (kind === 'verify') request = m.verify('123456');
            if (kind === 'reset') { m.state.serial_ok = true; m.state.password1 = m.state.password2 = 'pw'; request = m.save(); }
            if (kind === 'qr') { m.state.tmp_totp.secret = 'A'.repeat(32); request = m.updateQr(); }
            if (kind === 'save') { m.state.tmp_totp.secret = 'A'.repeat(32); m.state.verified = true; request = m.save(); }
        }
        m.dispose(); resolve({ data: { success: true } }); await request;
        expect(o.navigate).not.toHaveBeenCalled(); expect(o.services.notify.success).not.toHaveBeenCalled(); if (m.state.tmp_totp) expect(m.state.tmp_totp.secret).toBe('');
    }
});
it('loads the current identity for the isolated TOTP management page', async () => {
    const s = harness('/view/totp', url => url.endsWith('identity') ? { data: { identity: { user: 'testuser', profile: {} } } } : { data: [] });
    await flushPromises(); s.element.querySelector('[data-action=add]').click(); await flushPromises(); expect(s.element.textContent).toContain('testuser');
});

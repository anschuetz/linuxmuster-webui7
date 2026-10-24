import { reactive } from 'vue';

/** Login uses the session's HTTP policy and refreshes identity before the LM full-page redirect. */
export function createLogin({ session, services, navigate, mode = 'normal', pwReset = 'False' }) {
    const { http, identity } = session, { notify, gettext: t } = services;
    const sudo = mode.startsWith('sudo:');
    const state = reactive({ mode: sudo ? 'sudo' : mode, username: sudo ? mode.split(':')[1] : '', password: '',
        working: false, success: false, verif_code: false, code: '', totp_random: '', totp_attempts: 0,
        showPWReset: pwReset === 'True', showPassword: false });
    let disposed = false;
    async function auth(password, authMode) {
        const response = await http.post('/api/core/auth', { username: state.username, password, mode: authMode });
        if (!response.data.success) throw response.data.error;
        return response.data;
    }
    async function finish() {
        await identity.refresh();
        if (disposed) return;
        state.success = true;
        // lmn_common sets loginredir='/' and subsequently opens /view/lmn/landingpage.
        navigate('/');
    }
    function cancel() {
        Object.assign(state, { working: false, verif_code: false, totp_attempts: 0, username: '', password: '', code: '', totp_random: '' });
    }
    async function login() {
        if (!state.username || !state.password || disposed) return;
        state.working = true; state.username = state.username.toLowerCase();
        try {
            const data = await auth(state.password, state.mode);
            if (disposed) return;
            if (data.totp) { state.totp_random = data.totp_random; state.verif_code = true; }
            else await finish();
        } catch {
            if (disposed) return;
            state.working = false;
            notify.error(t(state.mode === 'sudo' ? 'Sudo authentication failed. Are you in the sudo group?' : 'Authentication failed'));
        }
    }
    async function verify(code) {
        state.code = code;
        if (code.toString().length !== 6 || disposed) return;
        state.totp_attempts += 1;
        try { await auth(`${code}#${state.totp_random}`, 'totp'); if (!disposed) await finish(); }
        catch {
            if (disposed) return;
            state.code = ''; notify.error(t('Wrong TOTP'));
            if (state.totp_attempts === 3) cancel();
        }
    }
    return { state, login, verify, cancel, gettext: t,
        start: async () => { await identity.refresh(); if (!disposed && identity.user !== null && state.mode !== 'sudo') navigate('/'); },
        dispose: () => { disposed = true; cancel(); },
    };
}

export function createPasswordReset({ session, services, navigate, serial }) {
    const { http } = session, { notify, gettext: t } = services;
    const state = reactive({ serial, mail: '', password1: '', password2: '', ready: false, serial_ok: false });
    let disposed = false;
    async function start() {
        if (serial === undefined) return;
        try { await http.post('/api/master/check_password_serial', { serial }); if (!disposed) state.serial_ok = true; }
        catch { /* Shared HTTP policy; the page also displays the invalid/expired-link message. */ }
        finally { if (!disposed) state.ready = true; }
    }
    function send() {
        notify.success(t('If the email exists, the user will get a reset email'));
        // Original redirects immediately, including when the transport fails.
        const request = http.post('/api/master/send_password_reset', { mail: state.mail }).catch(() => {});
        navigate('/'); return request;
    }
    async function save() {
        if (disposed || !state.password1 || state.password1 !== state.password2 || !state.serial_ok) return;
        const password = state.password2;
        try { await http.post('/api/core/check_password_complexity', { password }); }
        catch (error) { if (!disposed) notify.error(t('The password complexity does not match the system requirements : ') + error.data.message); return; }
        if (disposed) return;
        try {
            await http.post('/api/master/update_password', { serial, password });
            if (!disposed) { notify.success(t('Password successfully changed !')); navigate('/'); }
        } catch { if (!disposed) notify.error(t('An error occured while changing the password')); }
    }
    return { state, start, send, save, gettext: t,
        dispose: () => { disposed = true; state.password1 = ''; state.password2 = ''; },
    };
}

export function createTotp({ session, services }) {
    const { http, identity } = session, { notify, messagebox, gettext: t } = services;
    const empty = () => ({ description: '', secret: '' });
    const state = reactive({ totp: undefined, add_new: false, tmp_totp: empty(), tmp_qr: '', verified: false, verif_code: '' });
    let disposed = false, revision = 0;
    const valid = () => /^[A-Z2-7]{32,}$/.test(state.tmp_totp.secret);
    async function start() {
        try { const { data } = await http.get('/api/core/totps'); if (!disposed) state.totp = data || []; }
        catch { /* Session HTTP policy owns transport errors. */ }
    }
    async function updateQr() {
        const current = ++revision;
        state.tmp_totp = { ...state.tmp_totp, secret: state.tmp_totp.secret.toUpperCase() };
        state.verified = false; state.tmp_qr = '';
        if (!valid()) return;
        try { const { data } = await http.post('/api/core/totps/qr', { secret: state.tmp_totp.secret }); if (!disposed && current === revision) state.tmp_qr = data; }
        catch { /* Session HTTP policy owns transport errors. */ }
    }
    function randomSecret() {
        const bytes = crypto.getRandomValues(new Uint8Array(32)), alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        state.tmp_totp = { ...state.tmp_totp, secret: Array.from(bytes, byte => alphabet[byte % 32]).join('') };
        return updateQr();
    }
    function add() { state.add_new = true; state.verified = false; return randomSecret(); }
    function cancel() { ++revision; state.add_new = false; state.verified = false; state.verif_code = ''; }
    async function verify(code) {
        state.verif_code = code;
        if (code.toString().length !== 6) return;
        const current = revision;
        try {
            const { data } = await http.post('/api/core/totps/verify', { user: state.tmp_totp.user, secret: state.tmp_totp.secret, code });
            if (!disposed && current === revision) state.verified = data;
        } catch { if (!disposed && current === revision) state.verified = false; }
    }
    async function save() {
        if (!state.verified || !valid() || disposed) return;
        const secret = { ...state.tmp_totp, created: Math.floor(Date.now() / 1000) };
        const request = http.post('/api/core/totps', { secret }); cancel();
        try {
            await request;
            if (!disposed) { notify.success(t('Command successfully sent')); state.totp = [...state.totp, secret]; state.tmp_totp = empty(); }
        } catch { /* Session HTTP policy owns transport errors. */ }
    }
    async function remove(totp) {
        try { await messagebox.show({ text: t('Really delete this TOTP?'), positive: t('Delete'), negative: t('Cancel') }); }
        catch { return; }
        if (disposed) return;
        try {
            await http.delete(`/api/core/totps/${totp.created}`);
            if (!disposed) { notify.success(t('Command successfully sent')); state.totp = state.totp.filter(item => item !== totp); }
        } catch { /* Session HTTP policy owns transport errors. */ }
    }
    return { state, identity, gettext: t, start, valid, updateQr, randomSecret, add, cancel, verify, save, remove,
        dispose: () => { disposed = true; cancel(); state.tmp_totp = empty(); state.tmp_qr = ''; },
    };
}

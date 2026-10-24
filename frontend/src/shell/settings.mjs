import { reactive, watch } from 'vue';

/** The core config service's independent endpoints; authorization stays at the backend. */
export function createConfiguration(http) {
    const get = path => http.get(`/api/core/${path}`).then(response => response.data);
    const post = (path, data) => http.post(`/api/core/${path}`, data).then(response => response.data);
    return { load: () => get('config'), save: data => http.post('/api/core/config', data),
        getUserConfig: () => get('user-config'), setUserConfig: data => post('user-config', data),
        getSmtpConfig: () => get('smtp-config'), setSmtpConfig: data => post('smtp-config', data),
        getTfaConfig: () => get('tfa-config'), deleteTfa: data => post('tfa-config', data),
        getAuthenticationProviders: () => get('authentication-providers'), getPermissions: () => get('permissions') };
}

/** Preserve passwd 0.28's public {user,password} contract (backend's `users` mismatch is documented). */
export function createPasswd(aj) {
    const forbidden = () => Promise.reject({ status: 403, data: 'Superuser or own identity required' });
    return {
        list: () => aj.identity.isSuperuser ? aj.http.get('/api/passwds').then(r => r.data) : forbidden(),
        set: (user, password) => aj.identity.isSuperuser || (aj.identity.user !== null && user === aj.identity.user)
            ? aj.http.post('/api/passwd', { user, password }).then(r => r.data) : forbidden(),
    };
}

/** Explicitly mounted stock settings workflow. Menu/customization flags never grant API permissions. */
export function createSettings(aj, { machine = {} } = {}) {
    const config = createConfiguration(aj.http), passwd = createPasswd(aj), t = aj.gettext;
    const state = reactive({ config: undefined, languages: undefined, authenticationProviders: undefined,
        availableUsers: undefined, smtp_config: undefined, tfaList: undefined, tab: 'General',
        newClientCertificate: { c: 'NA', st: 'NA', o: '', cn: '' }, newClientCertificateDialogVisible: false, showSMTPPassword: false });
    let oldCertificate, disposed = false;
    const allowed = () => !disposed && aj.identity.isSuperuser;
    const notice = (kind, text, ...args) => { if (!disposed) aj.notify[kind](t(text), ...args); };
    const stopLanguage = watch(() => state.config?.language, value => { if (state.config && allowed()) aj.locale.setLanguage(value); });
    const stopColor = watch(() => state.config?.color, value => { if (state.config && allowed()) aj.identity.color = value; });
    async function start() {
        if (!allowed()) return;
        aj.pageTitle?.set(t('Settings'));
        state.newClientCertificate.o = machine.name;
        const users = passwd.list().then(data => {
            if (!allowed()) return;
            state.availableUsers = data;
            state.newClientCertificate = { ...state.newClientCertificate, user: 'root', cn: `${aj.identity.user}@${machine.hostname}` };
        }).catch(() => {}); // Shared HTTP policy reports service failures.
        const languages = aj.http.get('/api/core/languages').then(r => { if (allowed()) state.languages = r.data; }).catch(() => {});
        try {
            const data = await config.load(); if (!allowed()) return;
            state.config = data; oldCertificate = data.ssl.certificate;
            try { const providers = await config.getAuthenticationProviders(); if (allowed()) state.authenticationProviders = providers; }
            catch { notice('error', 'Could not load authentication provider list'); }
        } catch { notice('error', 'Could not load config'); }
        await Promise.all([users, languages]);
    }
    async function save() {
        if (!allowed() || !state.config) return;
        if (state.config.ssl.certificate !== oldCertificate) {
            try {
                await aj.http.post('/api/settings/test/ssl-certificate', { certificate: state.config.ssl.certificate });
                if (!allowed()) return;
                await config.save(state.config); notice('success', 'Saved');
            } catch { notice('error', 'SSL Error'); }
            return; // Original skips SMTP entirely in the certificate-change branch.
        }
        const global = config.save(state.config).then(() => notice('success', 'Global config saved'))
            .catch(() => notice('error', 'Could not save global config'));
        const smtp = state.smtp_config ? config.setSmtpConfig(state.smtp_config).then(() => notice('success', 'Smtp config saved'))
            .catch(() => notice('error', 'Could not save smtp config')) : Promise.resolve();
        await Promise.all([global, smtp]);
    }
    async function getSmtpConfig() {
        if (!allowed()) return;
        try { const data = await config.getSmtpConfig(); if (allowed()) state.smtp_config = data; }
        catch { /* Shared HTTP policy; no empty config on failure. */ }
    }
    async function getTfaConfig() {
        if (!allowed()) return;
        try {
            const data = await config.getTfaConfig(); if (!allowed()) return;
            state.tfaList = Object.entries(data).flatMap(([id, value]) => value.totp.map(tfa => ({
                user: id.split('@')[0], provider: id.split('@')[1], created: tfa.created, desc: tfa.description })));
        } catch { /* Shared HTTP policy; retain the old list. */ }
    }
    async function deleteTfa(tfa) {
        if (!allowed()) return;
        try {
            await config.deleteTfa({ type: 'delete', userid: `${tfa.user}@${tfa.provider}`, timestamp: `${tfa.created}` });
            if (!allowed()) return;
            notice('success', 'Deleted !'); state.tfaList = state.tfaList.filter(row => row !== tfa);
        } catch { /* Shared HTTP policy; keep the row on failure. */ }
    }
    async function createNewServerCertificate() {
        if (!allowed() || !state.config) return;
        try { await aj.messagebox.show({ title: t('Self-signed certificate'),
            text: t('Generating a new certificate will void all existing client authentication certificates!'), positive: t('Generate'), negative: t('Cancel') }); }
        catch { return; }
        if (!allowed()) return;
        state.config.ssl.client_auth.force = false;
        notice('info', 'Generating certificate', t('Please wait'));
        try {
            const response = await aj.http.post('/api/settings/generate/server-certificate');
            if (!allowed()) return;
            notice('success', 'Certificate successfully generated');
            state.config.ssl = { ...state.config.ssl, enable: true, certificate: response.data.path,
                client_auth: { ...state.config.ssl.client_auth, certificates: [] } };
            await save();
        } catch (error) { notice('error', 'Certificate generation failed', error.message); }
    }
    async function generateClientCertificate() {
        if (!allowed() || !state.config) return;
        state.newClientCertificate.generating = true;
        try {
            const response = await aj.http.post('/api/settings/generate/client-certificate', { ...state.newClientCertificate });
            if (!allowed()) return;
            const data = response.data;
            state.newClientCertificate = { ...state.newClientCertificate, generating: false, generated: true,
                url: `data:application/x-pkcs12;base64,${data.b64certificate}` };
            state.config.ssl.client_auth.certificates = [...state.config.ssl.client_auth.certificates,
                { user: state.newClientCertificate.user, digest: data.digest, name: data.name, serial: data.serial }];
        } catch (error) {
            if (!allowed()) return;
            state.newClientCertificate.generating = false; state.newClientCertificateDialogVisible = false;
            notice('error', 'Certificate generation failed', error.message);
        }
    }
    function addTrusted(kind) { if (allowed()) state.config[kind] = [...state.config[kind], '']; }
    async function deleteTrusted(kind, value) {
        if (!allowed()) return;
        const item = kind === 'trusted_domains' ? 'domain' : 'proxy';
        try { await aj.messagebox.show({ title: t(`Remove ${value}`), text: t(`Do you really want to remove the ${item} ${value} from the list ?`),
            positive: t('Delete'), negative: t('Cancel') }); } catch { return; }
        if (!allowed()) return;
        const index = state.config[kind].indexOf(value);
        state.config[kind] = state.config[kind].filter((_, i) => i !== index); notice('success', `${value} removed`);
    }
    return { state, start, save, getSmtpConfig, getTfaConfig, deleteTfa, createNewServerCertificate, generateClientCertificate,
        addTrusted, deleteTrusted, gettext: t,
        providerWarning() { if (state.config.auth.provider !== 'os') notice('info', 'Please be sure to have at least one valid user in the authentication provider. When not, you will be lock out from Ajenti. '); },
        changeClientUser(user) { state.newClientCertificate = { ...state.newClientCertificate, user, cn: `${aj.identity.user}@${machine.hostname}` }; },
        restart: () => { if (allowed()) return aj.restart(); },
        dispose() { disposed = true; stopLanguage(); stopColor(); state.config = undefined; state.smtp_config = undefined; state.newClientCertificate = {}; },
    };
}

import { reactive, watch } from 'vue';
import { createValidation } from '../../common/validation.mjs';

const copyKeys = keys => Array.isArray(keys) ? Object.assign([...keys], keys) : { ...keys };

/** Domain requests stay local; shell language/restart cross the shared adapter. */
export function createGlobalSettings(aj, { hostname = window.location.hostname, clipboard = navigator.clipboard } = {}) {
    const gettext = aj.gettext;
    const validation = createValidation(aj);
    validation.set([], 'devices');
    const handled = promise => promise.catch(() => undefined);
    const confirmed = (options, action) => handled(aj.messagebox.show(options).then(action));
    const state = reactive({
        config: { data: undefined }, subnets: undefined, languages: undefined, smtp_config: undefined,
        tfa_config: undefined, tfaList: undefined, allowed_roles: undefined, api_keys: undefined,
        edulutionStatus: undefined, edulutionToken: undefined, LMNVersion: undefined,
        all_roles: ['globaladministrator', 'schooladministrator', 'teacher', 'student', 'parent', 'staff'],
        newClientCertificate: { c: 'NA', st: 'NA', o: '', cn: '' },
        showNewApiKey: false, showUpdateApiKey: false, showAddApiKeyIp: false, showApiKeySecret: false,
        showAddApiKeyScope: undefined, apiKeySecret: '', apiKey: undefined, old_api_key_name: undefined,
        _: { newIp: '', newApiUser: { label: '' } },
        missing_lmnapi: undefined, activetab: 0, showSMTPPassword: false,
        searchText: gettext('Search user by login, firstname or lastname (min. 3 chars)'),
        help_trusted_domains: gettext('If Ajenti is installed behind a proxy, oder reachable by a fqdn other than provided by the host,\n' + 'you can then specify the other domains here, and by this way avoiding some resources loading problems.'),
        help_trusted_proxies: gettext('If Ajenti is installed behind one or more proxies, specify the ip of these proxies here, in order to\n' + 'get the real client ip address.'),
        help_certificate: gettext("This certificate is the default certificate used to create client certificate and to provide https connection.\n" + "Using a Let's Encrypt certificate here will break the client certificate generator.\n" + 'Using a self-generated certificate is fine here.'),
        help_fqdn_certificate: gettext("If you have a special certificate for your domain, like a Let's Encrypt certificate, put it there.\n" + 'If you are not sure, just use the same certificate as the one above.'),
    });
    const replaceConfigList = (field, values) => { state.config.data = { ...state.config.data, [field]: values }; };
    const replaceKeyList = (field, values) => {
        // Editing shares lists with the table in Angular, even when cancelled.
        const original = state.api_keys?.keys[state.old_api_key_name];
        if (state.showUpdateApiKey && original?.[field] === state.apiKey[field]) {
            state.api_keys = { ...state.api_keys, keys: { ...state.api_keys.keys, [state.old_api_key_name]: { ...original, [field]: values } } };
        }
        state.apiKey = { ...state.apiKey, [field]: values };
    };
    const removeTrusted = (field, value, noun) => confirmed({
        title: gettext(`Remove ${value}`), text: gettext(`Do you really want to remove the ${noun} ${value} from the list ?`), positive: gettext('Delete'), negative: gettext('Cancel'),
    }, () => {
        const list = state.config.data[field];
        const index = list.indexOf(value);
        replaceConfigList(field, list.filter((entry, n) => n !== (index < 0 ? list.length - 1 : index)));
        aj.notify.success(gettext(`${value} removed`));
    });
    Object.assign(state, {
        removeSubnet: subnet => confirmed({ text: gettext('Are you sure you want to delete permanently this subnet ?'), positive: gettext('Delete'), negative: gettext('Cancel') }, () => { state.subnets = state.subnets.filter(entry => entry !== subnet); }),
        addSubnet() { state.subnets = [...state.subnets, { routerIp: '', network: '', beginRange: '', endRange: '', setupFlag: '' }]; },
        saveApplySubnets: () => handled(aj.http.post('/api/lmn/subnets', state.subnets).then(() => aj.notify.success(gettext('Saved')))),
        getSmtpConfig: () => handled(aj.http.get('/api/core/smtp-config').then(({ data }) => { state.smtp_config = data; })),
        add_trusted_proxy: () => replaceConfigList('trusted_proxies', [...state.config.data.trusted_proxies, '']),
        add_trusted_domain: () => replaceConfigList('trusted_domains', [...state.config.data.trusted_domains, '']),
        delete_trusted_proxy: proxy => removeTrusted('trusted_proxies', proxy, 'proxy'),
        delete_trusted_domain: domain => removeTrusted('trusted_domains', domain, 'domain'),
        save() {
            const actions = [aj.http.post('/api/core/config', state.config.data).then(() => aj.notify.success(gettext('Global config saved')))
                .catch(() => aj.notify.error(gettext('Could not save global config')))];
            if (state.smtp_config) actions.push(aj.http.post('/api/core/smtp-config', state.smtp_config).then(() => aj.notify.success(gettext('Smtp config saved')))
                .catch(() => aj.notify.error(gettext('Could not save smtp config'))));
            return Promise.all(actions);
        },
        createNewServerCertificate: () => confirmed({ title: gettext('Self-signed certificate'), text: gettext('Generating a new certificate will void all existing client authentication certificates!'), positive: gettext('Generate'), negative: gettext('Cancel') }, () => {
            state.config.data.ssl.client_auth.force = false;
            aj.notify.info(gettext('Generating certificate'), gettext('Please wait'));
            // Preserve the original GET and path, including its backend mismatch.
            return aj.http.get('/api/settings/generate-server-certificate').then(({ data }) => {
                aj.notify.success(gettext('Certificate successfully generated'));
                state.config.data = { ...state.config.data, ssl: { ...state.config.data.ssl, enable: true, certificate: data.path, client_auth: { ...state.config.data.ssl.client_auth, certificates: [] } } };
                return state.save();
            }, error => aj.notify.error(gettext('Certificate generation failed'), error.message));
        }),
        toggleShowSMTPPassword() { state.showSMTPPassword = !state.showSMTPPassword; },
        restart: () => handled(aj.restart()),
        getTfaConfig: () => handled(aj.http.get('/api/core/tfa-config').then(({ data }) => {
            state.tfa_config = data;
            state.tfaList = Object.entries(data).flatMap(([userProvider, totp]) => totp.totp.map(tfa => ({ user: userProvider.split('@')[0], provider: userProvider.split('@')[1], created: tfa.created, desc: tfa.description })));
        })),
        deleteTfa: tfa => handled(aj.http.post('/api/core/tfa-config', { type: 'delete', userid: `${tfa.user}@${tfa.provider}`, timestamp: `${tfa.created}` }).then(() => {
            aj.notify.success('Deleted !'); state.tfaList = state.tfaList.filter(entry => entry !== tfa);
        })),
        checkEdulution() {
            state.edulutionStatus = { api_installed: null, api_running: null, binduser_created: null, binduser: null, external_domain: hostname };
            return Promise.all([
                handled(aj.http.get('/api/lmn/edulution/api-status').then(({ data }) => { state.edulutionStatus = { ...state.edulutionStatus, api_installed: data.api_installed, api_running: data.api_running }; })),
                handled(aj.http.get('/api/lmn/sophomorixUsers/bindusers/global').then(({ data }) => {
                    const bindusers = Object.values(data).filter(value => value.sAMAccountName === 'edulutionui-binduser');
                    const binduser = bindusers.at(-1) || null;
                    state.edulutionStatus = { ...state.edulutionStatus, binduser_created: binduser !== null, binduser };
                })),
            ]);
        },
        createEdulutionBinduser: () => handled(aj.http.post('/api/lmn/sophomorixUsers/bindusers/global', { binduser: 'edulutionui-binduser' }).then(() => state.checkEdulution())),
        generateEdulutionSetupToken() {
            const status = state.edulutionStatus;
            if (status.binduser !== null) return handled(aj.http.post('/api/lmn/edulution/generate', { external_domain: status.external_domain, binduser_name: status.binduser.sAMAccountName, binduser_dn: status.binduser.DN }).then(({ data }) => { state.edulutionToken = data; }));
        },
        copyEdulutionSetupToken: () => clipboard.writeText(state.edulutionToken).then(() => aj.notify.success('Copied to clipboard!')).catch(() => aj.notify.error('Failed to copy!')),
        getAllowedRoles: () => handled(aj.http.get('/api/lmn/webuisettings/allowed_roles').then(({ data }) => { state.allowed_roles = Object.fromEntries(state.all_roles.map(role => [role, data.indexOf(role) > -1])); })),
        saveWebui: () => handled(aj.http.post('/api/lmn/webuisettings/allowed_roles', { allowed_roles: state.all_roles.filter(role => state.allowed_roles[role]) }).then(() => { aj.notify.success('Roles successfully saved!'); return state.restart(); })),
        getApiConfig: () => handled(aj.http.get('/api/lmn/apisettings').then(({ data }) => {
            state.missing_lmnapi = !data;
            state.api_keys = data ? { keys: data.keys, enable_host_auth: data.enable_host_auth } : {};
        })),
        notifyApiRestart(response) {
            if (response.data?.api_restarted === false) aj.notify.error(gettext('Could not restart linuxmuster-api: the change will only take effect once it is restarted.'));
        },
        deleteApiKey: name => confirmed({ title: gettext('Delete Api key'), text: gettext(`Do you really want to delete the key ${name}?`), positive: 'Delete', negative: 'Cancel' }, () => aj.http.delete(`/api/lmn/apikeys/${name}`).then(response => {
            const keys = copyKeys(state.api_keys.keys); delete keys[name];
            state.api_keys = { ...state.api_keys, keys };
            aj.notify.success(gettext('Key deleted')); state.notifyApiRestart(response);
        })),
        showApiKey: key => confirmed({ title: gettext('Show Api key'), text: gettext('Do you really want to see this secret key ? It could be a security issue!'), positive: 'Show', negative: 'Cancel' }, () => { state.apiKeySecret = key.secret; state.showApiKeySecret = true; }),
        closeApiKeySecret() { state.showApiKeySecret = false; state.apiKeySecret = ''; },
        copyApiKeySecret: () => handled(clipboard.writeText(state.apiKeySecret).then(() => aj.notify.success(gettext('Copied to clipboard!')))),
        addApiKey() { state.showNewApiKey = true; state.apiKey = { name: '', ips: [], user: '', scope: [] }; },
        editApiKey(key, name) {
            state.old_api_key_name = name; state.showUpdateApiKey = true;
            state.apiKey = { name, ips: key.ips, user: key.user, secret: key.secret, scope: key.scope || [] };
            state._ = { ...state._, newApiUser: { label: key.user, login: key.user } };
        },
        saveApiKey() {
            state.showNewApiKey = false;
            const key = { ...state.apiKey, user: state._.newApiUser.login };
            state.apiKey = key;
            return handled(aj.http.put('/api/lmn/apikeys', { key }).then(response => {
                aj.notify.success(gettext('Api key added !')); state.notifyApiRestart(response);
                state.apiKey = { ...state.apiKey, secret: response.data.secret };
                const keys = copyKeys(state.api_keys.keys);
                keys[state.apiKey.name] = { ips: state.apiKey.ips, scope: state.apiKey.scope, secret: state.apiKey.secret, user: state._.newApiUser.login };
                state.api_keys = { ...state.api_keys, keys };
                state._ = { ...state._, newApiUser: { label: '' } };
            }));
        },
        saveApiKeys: () => handled(aj.http.post('/api/lmn/apikeys', { config: { api_keys: state.api_keys.keys, enable_host_auth: state.api_keys.enable_host_auth } }).then(response => {
            aj.notify.success(gettext('Configuration saved')); state.notifyApiRestart(response);
        })),
        closeAddApiKey() { state.showNewApiKey = false; },
        closeUpdateApiKey() { state.showUpdateApiKey = false; },
        toggleAddIp() { state.showAddApiKeyIp = !state.showAddApiKeyIp; },
        removeApiKeyIp(ip) {
            const index = state.apiKey.ips.indexOf(ip);
            replaceKeyList('ips', state.apiKey.ips.filter((entry, n) => n !== (index < 0 ? state.apiKey.ips.length - 1 : index)));
        },
        saveApiKeyIp() { state.toggleAddIp(); replaceKeyList('ips', [...state.apiKey.ips, state._.newIp]); state._ = { ...state._, newIp: '' }; },
        validateIp: () => validation.isValidIP(state._.newIp) === true,
        toggleAddScope() { state.showAddApiKeyScope = !state.showAddApiKeyScope; },
        removeApiKeyScope(entry) {
            const index = state.apiKey.scope.indexOf(entry);
            replaceKeyList('scope', state.apiKey.scope.filter((value, n) => n !== (index < 0 ? state.apiKey.scope.length - 1 : index)));
        },
        saveApiKeyScope() { state.toggleAddScope(); replaceKeyList('scope', [...state.apiKey.scope, state._.newScope]); state._ = { ...state._, newScope: '' }; },
        validateScope: () => /^(\*|[A-Za-z]+) \/\S*$/.test((state._.newScope || '').trim()),
        updateApiKey() {
            state.showUpdateApiKey = false;
            const keys = copyKeys(state.api_keys.keys); delete keys[state.old_api_key_name];
            keys[state.apiKey.name] = { ips: state.apiKey.ips, scope: state.apiKey.scope, secret: state.apiKey.secret, user: state._.newApiUser.login };
            state.api_keys = { ...state.api_keys, keys };
            const done = state.saveApiKeys(); state._ = { ...state._, newApiUser: { label: '' } }; return done;
        },
        findUsers: query => aj.http.post('/api/lmn/ldap-search', { role: '', login: query }).then(({ data }) => data),
        getLMNVersion: () => handled(aj.http.get('/api/lmn/version').then(({ data }) => { state.LMNVersion = data; })),
        formatTfaDate(value) {
            const date = new Date(value);
            const pad = n => String(n).padStart(2, '0');
            return `${pad(date.getDate())} ${new Intl.DateTimeFormat('en-US', { month: 'long' }).format(date)} ${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
        },
    });
    watch(() => state.config.data?.language, language => {
        if (state.config.data) handled(aj.locale.setLanguage(language));
    });
    state.ready = Promise.all([
        handled(aj.http.get('/api/core/config').then(({ data }) => { state.config.data = data; })),
        handled(aj.http.get('/api/lmn/subnets').then(({ data }) => { state.subnets = data; })),
        handled(aj.http.get('/api/core/languages').then(({ data }) => { state.languages = data; })),
    ]);
    return state;
}

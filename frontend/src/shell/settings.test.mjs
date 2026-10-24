import { describe, it, expect, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import StockSettings from './StockSettings.vue';
import { mountStockSettings } from './settings-harness.mjs';
import { settingsOracle } from '../../test-fixtures/shell/settings.mjs';
import { createConfiguration, createPasswd, createSettings } from './settings.mjs';

export const fixtureConfig = () => ({ name: 'Fixture', color: 'default', language: 'en', bind: { mode: 'tcp', host: '', port: 8000 },
    auth: { provider: 'os', allow_sudo: true, emails: {} }, trusted_domains: [], trusted_proxies: [], session_max_time: 3600,
    ssl: { enable: true, force: false, certificate: '/fixture.pem', fqdn_certificate: '', client_auth: { enable: true, force: true, certificates: [] } },
    email: { enable: true, templates: { reset_email: '/fixture.txt' } } });
const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
export function setup() {
    const requests = [], notices = [], languages = [], config = fixtureConfig();
    let response = url => url === '/api/core/config' ? structuredClone(config) : url === '/api/passwds' ? [{ name: 'root' }] : [];
    const http = Object.fromEntries(['get', 'post'].map(method => [method, vi.fn(async (url, data) => {
        requests.push([method.toUpperCase(), url, data === undefined ? undefined : JSON.parse(JSON.stringify(data))]);
        return { data: await response(url, data) };
    })]));
    const aj = { http, identity: { user: 'root', isSuperuser: true, profile: {} }, gettext: text => text,
        notify: Object.fromEntries(['error','success','info'].map(kind => [kind, (...args) => notices.push([kind, ...args])])),
        messagebox: { show: vi.fn(() => Promise.resolve()) }, restart: vi.fn(), pageTitle: { set: vi.fn() },
        locale: { setLanguage: value => languages.push(value) } };
    const model = createSettings(aj, { machine: { name: 'Fixture', hostname: 'fixture.test' } });
    return { aj, model, requests, notices, languages, config, respond: fn => { response = fn; } };
}

describe('stock settings original contract', () => {
    it('loads config/providers, passwd and languages against the actual controller', async () => {
        const old = settingsOracle(), next = setup();
        old.respond(url => url === '/api/core/config' ? fixtureConfig() : url === '/api/passwds' ? [{ name: 'root' }] : []);
        const scope = old.controller(); await settle(); old.digest(scope);
        await next.model.start();
        expect(next.requests).toEqual(expect.arrayContaining(old.requests));
        expect(next.model.state.config).toEqual(JSON.parse(JSON.stringify(scope.config.data)));
        expect(next.model.state.newClientCertificate).toEqual(JSON.parse(JSON.stringify(scope.newClientCertificate)));
        old.close(); next.model.dispose();
    });
    it('preserves all config service payloads including independent user-config', async () => {
        const old = settingsOracle(), next = setup(), config = createConfiguration(next.aj.http);
        for (const [name, args] of [['getUserConfig', []], ['setUserConfig', [{ widgets: [] }]], ['getSmtpConfig', []],
            ['setSmtpConfig', [{ smtp: { password: ' fixture ' } }]], ['getTfaConfig', []],
            ['deleteTfa', [{ type: 'delete', userid: 'root@os', timestamp: '42' }]], ['getAuthenticationProviders', []], ['getPermissions', []]]) {
            await old.config[name](...args); await config[name](...args);
        }
        expect(next.requests).toEqual(old.requests); old.close();
    });
    it('saves unchanged certificate config and loaded SMTP independently, like original', async () => {
        const old = settingsOracle(), next = setup();
        old.respond(url => url === '/api/core/config' ? fixtureConfig() : []);
        const scope = old.controller(); await settle(); await next.model.start();
        scope.smtp_config = { smtp: { server: 'relay', password: ' secret ' } };
        next.model.state.smtp_config = scope.smtp_config;
        old.requests.length = 0; next.requests.length = 0;
        scope.save(); await next.model.save(); await settle();
        expect(next.requests).toEqual(old.requests); expect(next.notices).toEqual(old.notices); old.close();
    });
    it('changed certificate tests before save and skips SMTP, including SSL failure', async () => {
        for (const fail of [false, true]) {
            const old = settingsOracle(), next = setup();
            const responder = url => { if (url.includes('/test/') && fail) throw new Error('fixture'); return url === '/api/core/config' ? fixtureConfig() : []; };
            old.respond(responder); next.respond(responder);
            const scope = old.controller(); await settle(); await next.model.start();
            scope.config.data.ssl.certificate = '/new.pem'; next.model.state.config.ssl.certificate = '/new.pem';
            scope.smtp_config = {}; next.model.state.smtp_config = {};
            old.requests.length = 0; next.requests.length = 0;
            await scope.save(); await next.model.save(); await settle();
            expect(next.requests).toEqual(old.requests); expect(next.notices).toEqual(old.notices); old.close();
        }
    });
    it('client certificate sends the generating flag and appends the exact descriptor', async () => {
        const old = settingsOracle(), next = setup();
        const responder = url => url === '/api/core/config' ? fixtureConfig() : url.includes('client-certificate') ?
            { b64certificate: 'Zml4dHVyZQ==', digest: 'digest', name: 'CN=fixture', serial: '12' } : [];
        old.respond(responder); next.respond(responder);
        const scope = old.controller(); await settle(); old.digest(scope); await next.model.start();
        old.requests.length = 0; next.requests.length = 0;
        await scope.generateClientCertificate(); await next.model.generateClientCertificate();
        expect(next.requests).toEqual(old.requests);
        expect(next.model.state.config.ssl.client_auth.certificates).toEqual(JSON.parse(JSON.stringify(scope.config.data.ssl.client_auth.certificates)));
        expect(next.model.state.newClientCertificate.url).toBe(String(scope.newClientCertificate.url)); old.close();
    });
    it('server certificate confirmation/cancel and generated config match original', async () => {
        const old = settingsOracle(), next = setup();
        const responder = url => url === '/api/core/config' ? fixtureConfig() : url.includes('server-certificate') ? { path: '/generated.pem' } : [];
        old.respond(responder); next.respond(responder);
        const scope = old.controller(); await settle(); await next.model.start(); old.requests.length = 0; next.requests.length = 0;
        old.confirm(false); next.aj.messagebox.show.mockRejectedValueOnce(new Error('cancel'));
        await expect(scope.createNewServerCertificate()).rejects.toThrow(); await next.model.createNewServerCertificate();
        expect(next.requests).toEqual([]);
        old.confirm(true); await scope.createNewServerCertificate(); await next.model.createNewServerCertificate(); await settle();
        expect(next.requests).toEqual(old.requests); expect(next.notices).toEqual(old.notices);
        expect(next.model.state.config.ssl.client_auth.force).toBe(false); old.close();
    });
    it('flattens TFA and deletes using string timestamp exactly like original', async () => {
        const old = settingsOracle(), next = setup();
        const responder = url => url === '/api/core/config' ? fixtureConfig() : url === '/api/core/tfa-config' ?
            { 'root@os': { totp: [{ created: 42, description: 'fixture' }] } } : [];
        old.respond(responder); next.respond(responder);
        const scope = old.controller(); await settle(); await next.model.start();
        scope.getTfaConfig(); await next.model.getTfaConfig(); await settle();
        expect(next.model.state.tfaList).toEqual(JSON.parse(JSON.stringify(scope.tfaList)));
        scope.deleteTfa(scope.tfaList[0]); await next.model.deleteTfa(next.model.state.tfaList[0]); await settle();
        expect(next.requests.at(-1)).toEqual(old.requests.at(-1)); expect(next.model.state.tfaList).toEqual([]); old.close();
    });
    it('passwd keeps service payload and restricts root/list and own set without menu assumptions', async () => {
        const old = settingsOracle(), next = setup(), passwd = createPasswd(next.aj);
        await old.passwd.list(); await passwd.list(); await old.passwd.set('fixture', ' spaced '); await passwd.set('fixture', ' spaced ');
        expect(next.requests).toEqual(old.requests);
        next.aj.identity.isSuperuser = false; next.aj.identity.user = 'fixture';
        await expect(passwd.list()).rejects.toMatchObject({ status: 403 });
        await expect(passwd.set('other', 'x')).rejects.toMatchObject({ status: 403 });
        await passwd.set('fixture', ' spaced '); expect(next.requests.at(-1)[2]).toEqual({ user: 'fixture', password: ' spaced ' }); old.close();
    });
    it('does not load non-root settings; read/write failures remain distinct and state unloaded', async () => {
        const next = setup(); next.aj.identity.isSuperuser = false;
        await next.model.start(); await next.model.save(); expect(next.requests).toEqual([]);
        next.aj.identity.isSuperuser = true; next.respond(() => { throw { status: 403 }; });
        await next.model.start(); expect(next.model.state.config).toBeUndefined(); expect(next.notices).toContainEqual(['error', 'Could not load config']);
        next.respond(url => url === '/api/core/config' ? fixtureConfig() : []); await next.model.start();
        next.respond(() => { throw { status: 403 }; }); await next.model.save(); expect(next.notices).toContainEqual(['error', 'Could not save global config']);
    });
    it('updates language and color without a user-config write, and warns for non-os provider', async () => {
        const next = setup(); await next.model.start(); next.requests.length = 0;
        next.model.state.config.language = 'de'; next.model.state.config.color = 'red'; await settle();
        expect(next.languages.at(-1)).toBe('de'); expect(next.aj.identity.color).toBe('red'); expect(next.requests).toEqual([]);
        next.model.state.config.auth.provider = 'fixture'; next.model.providerWarning(); expect(next.notices.at(-1)[0]).toBe('info');
    });
});

describe('isolated Vue settings route', () => {
    it('edits general/security/SMTP/TFA and certificate dialogs with original model trimming', async () => {
        const next = setup();
        next.respond(url => url === '/api/core/config' ? fixtureConfig() : url === '/api/core/smtp-config' ?
            { smtp: { server: 'relay', port: 'ssl', user: 'fixture', password: '' } } : url === '/api/core/tfa-config' ?
            { 'root@os': { totp: [{ created: 42, description: 'fixture' }] } } : url.includes('client-certificate') ?
            { b64certificate: 'Zml4dHVyZQ==', digest: '<fixture>', name: 'CN=fixture', serial: '12' } :
            url === '/api/core/languages' ? ['en','de'] : url === '/api/core/authentication-providers' ? [{ id: 'os', name: 'OS' }] : [{ name: 'root' }]);
        const wrapper = mount(StockSettings, { attachTo: document.body, props: { model: next.model }, global: { provide: { aj: next.aj } } });
        await flushPromises();
        const name = wrapper.get('input[aria-label="Machine name"]'); name.element.focus();
        name.element.value = 'machine '; await name.trigger('input');
        name.element.value += 'name'; await name.trigger('input');
        expect(name.element.value).toBe('machine name'); expect(next.model.state.config.name).toBe('machine name');
        await wrapper.get('select[aria-label="Language"]').setValue('de');
        expect(next.languages.at(-1)).toBe('de');
        await wrapper.get('[data-tab="Security"]').trigger('click');
        await wrapper.get('[data-action="add-trusted_domains"]').trigger('click');
        await wrapper.get('input[aria-label="Trusted domains 1"]').setValue(' fixture.test ');
        expect(next.model.state.config.trusted_domains).toEqual(['fixture.test']);
        await wrapper.get('[data-action="delete-trusted_domains"]').trigger('click'); await flushPromises();
        expect(next.model.state.config.trusted_domains).toEqual([]);
        await wrapper.get('[data-action="new-certificate"]').trigger('click');
        await wrapper.get('input[aria-label="Common name"]').setValue(' client fixture ');
        await wrapper.get('[data-action="generate-client"]').trigger('click'); await flushPromises();
        expect(wrapper.get('a[download]').attributes('href')).toBe('data:application/x-pkcs12;base64,Zml4dHVyZQ==');
        await wrapper.get('[data-action="save-close"]').trigger('click'); await flushPromises();
        expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
        await wrapper.get('[data-action="revoke"]').trigger('click'); expect(next.model.state.config.ssl.client_auth.certificates).toEqual([]);
        await wrapper.get('[data-tab="Smtp relay"]').trigger('click'); await flushPromises();
        await wrapper.get('input[aria-label="SMTP password"]').setValue(' spaced ');
        expect(next.model.state.smtp_config.smtp.password).toBe(' spaced ');
        await wrapper.get('[data-action="smtp-password"]').trigger('click');
        await wrapper.get('input[aria-label="SMTP password"]').setValue(' trimmed ');
        expect(next.model.state.smtp_config.smtp.password).toBe('trimmed');
        await wrapper.get('[data-action="save"]').trigger('click'); await flushPromises();
        expect(next.requests.at(-1)[1]).toBe('/api/core/smtp-config');
        await wrapper.get('[data-tab="2FA"]').trigger('click'); await flushPromises();
        expect(wrapper.text()).toContain('fixture');
        await wrapper.get('[data-action="delete-tfa"]').trigger('click'); await flushPromises();
        expect(next.model.state.tfaList).toEqual([]);
        await wrapper.get('[data-action="restart"]').trigger('click'); expect(next.aj.restart).toHaveBeenCalledOnce();
        wrapper.unmount(); expect(next.model.state.config).toBeUndefined();
    });
    it('edits binding/security controls and cancels client creation before generating a server certificate', async () => {
        const next = setup(); next.respond(url => url === '/api/core/config' ? fixtureConfig() : url === '/api/core/authentication-providers' ?
            [{ id: 'os', name: 'OS' }, { id: 'fixture', name: 'Fixture' }] : url === '/api/passwds' ? [{ name: 'other' }, { name: 'root' }] :
            url.includes('server-certificate') ? { path: '/generated.pem' } : []);
        const wrapper = mount(StockSettings, { props: { model: next.model }, global: { provide: { aj: next.aj } } }); await flushPromises();
        await wrapper.get('select[aria-label="Color tag"]').setValue('red'); expect(next.aj.identity.color).toBe('red');
        await wrapper.get('select[aria-label="Binding"]').setValue('unix');
        await wrapper.get('input[aria-label="Socket path"]').setValue(' /fixture.sock '); expect(next.model.state.config.bind.socket).toBe('/fixture.sock');
        await wrapper.get('select[aria-label="Binding"]').setValue('tcp');
        await wrapper.get('input[aria-label="Host / IP"]').setValue('127.0.0.1');
        await wrapper.get('[data-tab="Security"]').trigger('click');
        await wrapper.get('select[aria-label="Authentication provider"]').setValue('fixture'); expect(next.notices.at(-1)[0]).toBe('info');
        await wrapper.get('input[aria-label="Allow sudo elevation for logged in users"]').setValue(false);
        expect(next.model.state.config.auth.allow_sudo).toBe(false);
        await wrapper.get('input[aria-label="Max session time"]').setValue('120'); expect(next.model.state.config.session_max_time).toBe(120);
        await wrapper.get('input[aria-label="Force SSL"]').setValue(true); expect(next.model.state.config.ssl.force).toBe(true);
        await wrapper.get('input[aria-label="Enable client authentication"]').setValue(false);
        expect(wrapper.find('[data-action="new-certificate"]').exists()).toBe(false);
        await wrapper.get('input[aria-label="Enable client authentication"]').setValue(true);
        await wrapper.get('input[aria-label="Deny other means of authentication"]').setValue(false);
        await wrapper.get('[data-action="new-certificate"]').trigger('click');
        await wrapper.get('select[aria-label="Login as"]').setValue('other');
        await wrapper.get('input[aria-label="Country"]').setValue('DE');
        await wrapper.get('input[aria-label="State"]').setValue('BW');
        await wrapper.get('input[aria-label="Organization"]').setValue('Fixture');
        await wrapper.get('[data-action="cancel-client"]').trigger('click');
        expect(next.requests.some(row => row[1].includes('client-certificate'))).toBe(false);
        await wrapper.get('[data-action="generate-server"]').trigger('click'); await flushPromises();
        expect(next.model.state.config.ssl.certificate).toBe('/generated.pem');
        await wrapper.get('input[aria-label="Enable SSL"]').setValue(false); expect(wrapper.find('[data-action="generate-server"]').exists()).toBe(false);
        wrapper.unmount();
    });
    it('retains raw input while ngTrim changes only the model in both original and Vue', async () => {
        const old = settingsOracle(), next = setup();
        old.respond(url => url === '/api/core/config' ? fixtureConfig() : []);
        const scope = old.controller(); await settle(); const body = old.mount(scope);
        const legacy = body.querySelector('input[ng\\:model="config.data.name"]');
        const wrapper = mount(StockSettings, { attachTo: document.body, props: { model: next.model }, global: { provide: { aj: next.aj } } }); await flushPromises();
        const input = wrapper.get('input[aria-label="Machine name"]'); input.element.focus();
        for (const value of ['two ', 'two words ']) {
            legacy.value = value; legacy.dispatchEvent(new oldWindowEvent(legacy, 'input')); old.digest(scope);
            input.element.value = value; await input.trigger('input');
            expect(input.element.value).toBe(legacy.value); expect(next.model.state.config.name).toBe(scope.config.data.name);
        }
        wrapper.unmount(); old.close();
    });
    it('keeps numeric empty and valid values identical to original ngModel', async () => {
        const old = settingsOracle(), next = setup(); old.respond(url => url === '/api/core/config' ? fixtureConfig() : []);
        const scope = old.controller(); await settle(); const body = old.mount(scope);
        const legacy = body.querySelector('input[ng\\:model="config.data.bind.port"]');
        const wrapper = mount(StockSettings, { props: { model: next.model }, global: { provide: { aj: next.aj } } }); await flushPromises();
        const input = wrapper.get('input[aria-label="Port"]');
        for (const value of ['', '8080']) {
            legacy.value = value; legacy.dispatchEvent(oldWindowEvent(legacy, 'input')); old.digest(scope);
            await input.setValue(value); expect(next.model.state.config.bind.port).toBe(scope.config.data.bind.port);
        }
        wrapper.unmount(); old.close();
    });
    it('blocks direct non-superuser route and respects hide flags without granting rights', async () => {
        const next = setup(); next.aj.identity.isSuperuser = false;
        const wrapper = mount(StockSettings, { attachTo: document.body, props: { model: next.model }, global: { provide: { aj: next.aj } } });
        await flushPromises(); expect(wrapper.text()).toContain('Superuser access required'); expect(next.requests).toEqual([]); wrapper.unmount();
        const root = setup();
        const hidden = mount(StockSettings, { attachTo: document.body, props: { model: root.model, customization: { hideMachineSettings: true, hideLanguageSettings: true, hideBindingSettings: true, hideAuthSettings: true, hideProxiesSettings: true, hideSessionSettings: true, hideSSLSettings: true, hideEmailSettings: true, hideEmailSmtpSettings: true } }, global: { provide: { aj: root.aj } } });
        await flushPromises(); expect(hidden.find('input').exists()).toBe(false);
        await hidden.get('[data-tab="Security"]').trigger('click'); expect(hidden.find('input').exists()).toBe(false); hidden.unmount();
    });
});
function oldWindowEvent(element, type) { return new element.ownerDocument.defaultView.Event(type, { bubbles: true }); }

describe('settings failures and lifecycle', () => {
    it('does not invent empty provider/SMTP/TFA/user data on failure; client/server failures are visible', async () => {
        const next = setup(); next.respond(url => { if (url === '/api/core/config') return fixtureConfig(); throw { status: 500, message: 'fixture' }; });
        await next.model.start(); expect(next.model.state.authenticationProviders).toBeUndefined(); expect(next.model.state.availableUsers).toBeUndefined();
        expect(next.notices).toContainEqual(['error', 'Could not load authentication provider list']);
        await next.model.getSmtpConfig(); await next.model.getTfaConfig();
        expect(next.model.state.smtp_config).toBeUndefined(); expect(next.model.state.tfaList).toBeUndefined();
        next.model.state.tfaList = [{ user: 'root', provider: 'os', created: 42 }];
        await next.model.deleteTfa(next.model.state.tfaList[0]); expect(next.model.state.tfaList).toHaveLength(1);
        next.model.state.newClientCertificateDialogVisible = true;
        await next.model.generateClientCertificate(); expect(next.model.state.newClientCertificateDialogVisible).toBe(false);
        expect(next.model.state.newClientCertificate.generating).toBe(false);
        await next.model.createNewServerCertificate(); expect(next.notices.at(-1)).toEqual(['error', 'Certificate generation failed', 'fixture']);
        next.model.state.smtp_config = { smtp: {} }; await next.model.save();
        expect(next.notices).toContainEqual(['error', 'Could not save smtp config']); next.model.dispose();
    });
    it('retains pending loading UI and discards late responses after unmount, with no follow-up save', async () => {
        const next = setup(); let resolve;
        next.respond(url => url === '/api/core/config' ? new Promise(done => { resolve = done; }) : []);
        const wrapper = mount(StockSettings, { props: { model: next.model }, global: { provide: { aj: next.aj } } });
        await settle(); expect(wrapper.find('[role="progressbar"]').exists()).toBe(true); expect(wrapper.text()).not.toContain('Machine name');
        wrapper.unmount(); resolve(fixtureConfig()); await flushPromises(); expect(next.model.state.config).toBeUndefined();
        const cert = setup(); await cert.model.start(); let finish;
        cert.respond(() => new Promise(done => { finish = done; }));
        const generating = cert.model.createNewServerCertificate(); await settle(); cert.model.dispose(); finish({ path: '/late.pem' }); await generating;
        expect(cert.requests.filter(row => row[0] === 'POST')).toHaveLength(1); expect(cert.model.state.config).toBeUndefined();
    });
    it('keeps certificate user CN tied to current identity and cancels trusted-list changes without writes', async () => {
        const next = setup(); await next.model.start(); next.model.changeClientUser('other');
        expect(next.model.state.newClientCertificate.cn).toBe('root@fixture.test');
        next.model.addTrusted('trusted_proxies'); next.model.state.config.trusted_proxies[0] = '127.0.0.1';
        next.aj.messagebox.show.mockRejectedValueOnce(new Error('cancel'));
        await next.model.deleteTrusted('trusted_proxies', '127.0.0.1'); expect(next.model.state.config.trusted_proxies).toHaveLength(1);
        await next.model.deleteTrusted('trusted_proxies', '127.0.0.1'); expect(next.model.state.config.trusted_proxies).toEqual([]);
        next.model.state.config.auth.provider = 'os'; const count = next.notices.length; next.model.providerWarning(); expect(next.notices).toHaveLength(count);
        next.model.dispose(); await next.model.save(); await next.model.getSmtpConfig(); await next.model.getTfaConfig(); await next.model.deleteTfa({});
        await next.model.createNewServerCertificate(); await next.model.generateClientCertificate(); next.model.addTrusted('trusted_domains'); await next.model.deleteTrusted('trusted_domains', 'x');
        expect(next.model.restart()).toBeUndefined();
    });
    it('mounts only /view/settings and supplies aj without touching LM settings', async () => {
        const next = setup(), element = document.createElement('div');
        expect(() => mountStockSettings(element, next.aj, { path: '/view/lmn/settings' })).toThrow('Not a stock settings route');
        const owner = mountStockSettings(element, next.aj, { machine: { name: 'Fixture', hostname: 'fixture.test' } });
        await flushPromises(); expect(element.textContent).toContain('Machine name'); owner.dispose(); expect(element.children).toHaveLength(0);
    });
});

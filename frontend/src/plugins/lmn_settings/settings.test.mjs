import { afterEach, expect, it, vi } from 'vitest';
import { effectScope, nextTick, reactive, ref } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { createMockAj } from '../../adapter/mock.mjs';
import { createSchoolSettings } from './school.mjs';
import { createGlobalSettings } from './global.mjs';
import SchoolSettings from './SchoolSettings.vue';
import GlobalSettings from './GlobalSettings.vue';
import { responses } from './fixtures.test-data.mjs';

const scopes = [];
const wrappers = [];
afterEach(() => { wrappers.splice(0).forEach(w => w.unmount()); scopes.splice(0).forEach(s => s.stop()); vi.restoreAllMocks(); });
function setup(factory, options = {}) {
    const data = { ...responses(), ...options.data };
    const http = vi.fn(async request => ({ data: request.method === 'get' ? structuredClone(data[request.url]) : null, status: 200 }));
    const notify = vi.fn();
    const aj = createMockAj({ http, notify, identity: { profile: { sophomorixRole: 'globaladministrator' } }, ...options.aj });
    const scope = effectScope(); scopes.push(scope);
    const state = scope.run(() => factory(aj, options.dependencies));
    return { state, aj, http, notify };
}
const writes = http => http.mock.calls.map(([r]) => r).filter(r => r.method !== 'get');
const request = (method, url, data) => ({ method, url, data, cfg: undefined });

it('loads school config, custom templates and password rules through HTTP only', async () => {
    const { state, http } = setup(createSchoolSettings);
    expect(state.settings).toBeUndefined();
    await state.ready;
    expect(state.settings).toEqual(responses()['/api/lmn/schoolsettings']);
    expect(state.templates).toEqual({ individual: { path: '/individual.tex', filename: 'individual.tex' }, multiple: { path: '/multiple.tex', filename: 'multiple.tex' } });
    expect(state.passwordConstraintsForm.default.student).toEqual({ minLength: null, classes: { lower: false, upper: false, digit: false, special: false }, count: null });
    expect(writes(http)).toEqual([]);
});

it('preserves automatic encoding calls including the duplicate extrastudents entry and fixed school', async () => {
    const data = responses()['/api/lmn/schoolsettings'];
    data['userfile.students.csv'].ENCODING = 'auto';
    data['userfile.extrastudents.csv'].ENCODING = 'auto';
    const http = vi.fn(async r => ({ data: r.method === 'get' ? structuredClone({ ...responses(), '/api/lmn/schoolsettings': data }[r.url]) : 'UTF8', status: 200 }));
    const { state } = setup(createSchoolSettings, { aj: { http } });
    await state.ready; await flushPromises();
    expect(writes(http)).toEqual(['students', 'extrastudents', 'extrastudents'].map(role => request('post', '/api/lmn/schoolsettings/determine-encoding', { path: `/etc/linuxmuster/sophomorix/default-school/${role}.csv`, file: `userfile.${role}.csv` })));
    expect(state.encoding).toEqual({ 'userfile.students.csv': 'UTF8', 'userfile.extrastudents.csv': 'UTF8' });
});

it('validates printserver, saves the complete school config and only then opens Users check', async () => {
    const openUsersCheck = vi.fn().mockResolvedValue();
    const { state, aj, http, notify } = setup(createSchoolSettings, { dependencies: { openUsersCheck } });
    await state.ready;
    state.settings.school.PRINTSERVER = 'bad server';
    expect(state.saveAndCheck()).toBeUndefined();
    expect(writes(http)).toEqual([]);
    expect(openUsersCheck.mock.calls).toEqual([]);
    expect(notify.mock.calls[0][0]).toBe('error');
    state.settings.school.PRINTSERVER = 'server';
    const done = state.saveAndCheck();
    expect(openUsersCheck.mock.calls).toEqual([]);
    await done;
    expect(writes(http)).toEqual([request('post', '/api/lmn/schoolsettings', state.settings)]);
    expect(openUsersCheck.mock.calls).toEqual([[aj]]);
});

it('opens quota application before the school save resolves, as the original does', async () => {
    let resolve;
    const modal = { open: vi.fn().mockResolvedValue() };
    const { state, aj } = setup(createSchoolSettings, { aj: { modal } });
    await state.ready;
    aj.http.post = vi.fn(() => new Promise(r => { resolve = r; }));
    state.saveApplyQuota();
    expect(modal.open.mock.calls).toHaveLength(1);
    expect(modal.open.mock.calls[0][2]).toEqual({ backdrop: 'static' });
    resolve({ data: null }); await flushPromises();
});

it('saves custom fields and selected template paths with the original envelope', async () => {
    const { state, http } = setup(createSchoolSettings); await state.ready;
    await state.saveCustom();
    expect(writes(http)).toEqual([request('post', '/api/lmn/config/customfields', { config: { custom: state.custom, customMulti: state.customMulti, customDisplay: state.customDisplay, proxyAddresses: state.proxyAddresses, passwordTemplates: { multiple: '/multiple.tex', individual: '/individual.tex' } } })]);
    state.settings['userfile.students.csv'].FILTERSCRIPT = '';
    state.filterscriptNotEmpty();
    expect(state.settings['userfile.students.csv'].FILTERSCRIPT).toBe('---');
});

it('adds/removes holidays immutably, rejects malformed dates and saves the unchanged list shape', async () => {
    const { state, http } = setup(createSchoolSettings); await state.ready;
    const before = state.holidays; state.addHoliday();
    expect(before).toEqual([]);
    expect(state.holidays).toEqual([{ name: '', start: '', end: '' }]);
    expect(state.validateDate('bad')).toBe('has-error');
    expect(state.validateDate('01.01.2027')).toBeUndefined();
    const field = document.createElement('input'); field.className = 'has-error'; document.body.append(field);
    expect(state.saveApplyHolidays()).toBeUndefined(); expect(writes(http)).toEqual([]); field.remove();
    await state.saveApplyHolidays();
    expect(writes(http)).toEqual([request('post', '/api/lmn/holidays', state.holidays)]);
    await state.removeHoliday(state.holidays[0]); expect(state.holidays).toEqual([]);
});

it.each(['globaladministrator', 'schooladministrator'])('builds password overrides and honors %s default scope', async role => {
    const { state, http } = setup(createSchoolSettings, { aj: { identity: { profile: { sophomorixRole: role } } } }); await state.ready;
    state.toggleSchoolOverride('student');
    const form = state.passwordConstraintsForm.schools['default-school'].student;
    form.minLength = 13; form.classes.lower = true; form.count = 4;
    state.clampRequiredCount(form);
    expect(form.count).toBe(1);
    expect(state.checkedClassCount(form)).toBe(1);
    expect(state.hasSchoolOverride('student')).toBe(true);
    await state.savePasswordConstraints();
    const config = { schools: { 'default-school': { student: [{ type: 'min_length', value: 13 }, { type: 'require_classes', classes: ['lower'], count: 1 }] } } };
    if (role === 'globaladministrator') config.default = Object.fromEntries(state.passwordConstraintsRoles.map(r => [r, []]));
    expect(writes(http)).toEqual([request('post', '/api/lmn/config/passwordconstraints', { config })]);
    state.toggleSchoolOverride('student'); expect(state.passwordConstraintsForm.schools).toEqual({});
});

it('loads global config, changes shell language and saves config and loaded SMTP independently', async () => {
    const locale = { setLanguage: vi.fn().mockResolvedValue() };
    const { state, http } = setup(createGlobalSettings, { aj: { locale } }); await state.ready; await nextTick();
    expect(locale.setLanguage.mock.calls).toEqual([['de']]);
    state.config.data.language = 'en'; await nextTick();
    expect(locale.setLanguage.mock.calls).toEqual([['de'], ['en']]);
    await state.save();
    expect(writes(http)).toEqual([request('post', '/api/core/config', state.config.data)]);
    await state.getSmtpConfig(); await state.save();
    expect(writes(http).slice(1)).toEqual([request('post', '/api/core/config', state.config.data), request('post', '/api/core/smtp-config', state.smtp_config)]);
});

it('adds/deletes subnets and trusted entries without mutating the previous arrays', async () => {
    const { state, http } = setup(createGlobalSettings); await state.ready;
    const subnets = state.subnets; state.addSubnet();
    expect(subnets).toEqual([]);
    expect(state.subnets).toEqual([{ routerIp: '', network: '', beginRange: '', endRange: '', setupFlag: '' }]);
    await state.saveApplySubnets(); await state.removeSubnet(state.subnets[0]); expect(state.subnets).toEqual([]);
    const domains = state.config.data.trusted_domains; state.add_trusted_domain(); expect(domains).toEqual(['school.test']);
    await state.delete_trusted_domain('school.test'); expect(state.config.data.trusted_domains).toEqual(['']);
    state.add_trusted_proxy(); await state.delete_trusted_proxy('127.0.0.1'); expect(state.config.data.trusted_proxies).toEqual(['']);
    expect(writes(http)[0].url).toBe('/api/lmn/subnets');
});

it('flattens TFA entries and sends exactly the delete command', async () => {
    const { state, http } = setup(createGlobalSettings, { data: { '/api/core/tfa-config': { 'test@ldap': { totp: [{ created: 42, description: 'P79' }] } } } });
    await state.ready; await state.getTfaConfig();
    expect(state.tfaList).toEqual([{ user: 'test', provider: 'ldap', created: 42, desc: 'P79' }]);
    await state.deleteTfa(state.tfaList[0]);
    expect(writes(http)).toEqual([request('post', '/api/core/tfa-config', { type: 'delete', userid: 'test@ldap', timestamp: '42' })]);
    expect(state.tfaList).toEqual([]);
});

it('saves only allowed roles in the original order and invokes shell restart', async () => {
    const restart = vi.fn().mockResolvedValue();
    const { state, http } = setup(createGlobalSettings, { aj: { restart } }); await state.ready; await state.getAllowedRoles();
    state.allowed_roles.student = true; await state.saveWebui();
    expect(writes(http)).toEqual([request('post', '/api/lmn/webuisettings/allowed_roles', { allowed_roles: ['teacher', 'student'] })]);
    expect(restart.mock.calls).toEqual([[]]);
});

it('loads API settings, creates/updates/removes keys and reports failed API restart', async () => {
    const { state, aj, http, notify } = setup(createGlobalSettings); await state.ready; await state.getApiConfig();
    state.addApiKey(); state.apiKey.name = 'p79'; state._.newApiUser = { login: 'zem', label: 'P79' };
    state._.newIp = '127.0.0.79'; expect(state.validateIp()).toBe(true); state.saveApiKeyIp();
    state._.newScope = 'GET /p79/**'; expect(state.validateScope()).toBe(true); state.saveApiKeyScope();
    aj.http.put = vi.fn().mockResolvedValue({ data: { secret: 'synthetic', api_restarted: false } });
    await state.saveApiKey();
    expect(aj.http.put.mock.calls).toEqual([['/api/lmn/apikeys', { key: { name: 'p79', ips: ['127.0.0.79'], user: 'zem', scope: ['GET /p79/**'] } }]]);
    expect(state.api_keys.keys).toEqual({ p79: { ips: ['127.0.0.79'], scope: ['GET /p79/**'], user: 'zem', secret: 'synthetic' } });
    expect(notify.mock.calls.some(([level, message]) => level === 'error' && message.startsWith('Could not restart linuxmuster-api'))).toBe(true);
    await state.showApiKey(state.api_keys.keys.p79); expect(state.apiKeySecret).toBe('synthetic');
    state.closeApiKeySecret(); expect(state.apiKeySecret).toBe('');
    state.editApiKey(state.api_keys.keys.p79, 'p79'); state.removeApiKeyIp('127.0.0.79'); state.removeApiKeyScope('GET /p79/**');
    await state.updateApiKey();
    expect(writes(http).at(-1)).toEqual(request('post', '/api/lmn/apikeys', { config: { api_keys: { p79: { ips: [], scope: [], user: 'zem', secret: 'synthetic' } }, enable_host_auth: true } }));
    await state.deleteApiKey('p79'); expect(state.api_keys.keys).toEqual({});
});

it('retains missing API, cancellation and lookup behavior', async () => {
    const { state, aj, http } = setup(createGlobalSettings, { data: { '/api/lmn/apisettings': null, '/api/lmn/ldap-search': [] } }); await state.ready;
    await state.getApiConfig(); expect(state.missing_lmnapi).toBe(true);
    aj.messagebox.show = vi.fn().mockRejectedValue('cancelled');
    await state.deleteApiKey('p79'); expect(writes(http)).toEqual([]);
    aj.http.post = vi.fn().mockResolvedValue({ data: [{ login: 'zem' }] });
    expect(await state.findUsers('zem')).toEqual([{ login: 'zem' }]);
    expect(aj.http.post.mock.calls).toEqual([['/api/lmn/ldap-search', { role: '', login: 'zem' }]]);
});

it('uses browser clipboard and Edulution payloads without logging secrets', async () => {
    const clipboard = { writeText: vi.fn().mockResolvedValue() };
    const { state, aj } = setup(createGlobalSettings, { dependencies: { hostname: 'p79.test', clipboard } }); await state.ready;
    await state.checkEdulution(); expect(state.edulutionStatus.external_domain).toBe('p79.test'); expect(state.edulutionStatus.binduser_created).toBe(false);
    state.edulutionStatus.binduser = { sAMAccountName: 'bind', DN: 'CN=bind' };
    aj.http.post = vi.fn().mockResolvedValue({ data: 'synthetic-token' });
    await state.generateEdulutionSetupToken(); await state.copyEdulutionSetupToken();
    expect(aj.http.post.mock.calls).toEqual([['/api/lmn/edulution/generate', { external_domain: 'p79.test', binduser_name: 'bind', binduser_dn: 'CN=bind' }]]);
    state.apiKeySecret = 'synthetic-secret'; await state.copyApiKeySecret();
    expect(clipboard.writeText.mock.calls).toEqual([['synthetic-token'], ['synthetic-secret']]);
});

it.each([['school', SchoolSettings], ['global', GlobalSettings]])('%s component retains loading and failed-load states', async (kind, Component) => {
    let reject;
    const aj = createMockAj({ http: () => new Promise((resolve, r) => { reject = r; }) });
    const wrapper = mount(Component, { global: { provide: { aj } }, props: { customization: {} } }); wrappers.push(wrapper);
    expect(wrapper.findAll('.nav-tabs a')).toEqual([]);
    expect(wrapper.text().includes('No holidays found!')).toBe(false);
    reject({ status: 500 }); await flushPromises();
    expect(wrapper.findAll('.nav-tabs a')).toEqual([]);
});

it('school text keeps inner spaces while typing and trims the saved model', async () => {
    const http = vi.fn(async r => ({ data: r.method === 'get' ? structuredClone(responses()[r.url]) : null, status: 200 }));
    const aj = createMockAj({ http });
    const wrapper = mount(SchoolSettings, { global: { provide: { aj } } }); wrappers.push(wrapper); await flushPromises();
    const input = wrapper.find('.tab-pane.active input[type=text]');
    let typed = '';
    for (const char of ' P79 School ') { typed += char; input.element.value = typed; await input.trigger('input'); }
    expect(input.element.value).toBe(' P79 School ');
    const button = wrapper.findAll('floating-toolbar button').find(b => b.text() === 'Save');
    await button.trigger('click'); await flushPromises();
    expect(writes(http)[0].data.school.SCHOOL_LONGNAME).toBe('P79 School');
});

it('global SMTP password retains spaces while masked, but its text counterpart applies ngTrim', async () => {
    const http = vi.fn(async r => ({ data: r.method === 'get' ? structuredClone(responses()[r.url]) : null, status: 200 }));
    const aj = createMockAj({ http });
    const wrapper = mount(GlobalSettings, { global: { provide: { aj } } }); wrappers.push(wrapper); await flushPromises();
    expect(wrapper.findAll('.nav-tabs a').map(a => a.text())).toEqual(['General', 'Subnets', 'Smtp relay', 'Allowed roles', 'Api Keys', '2FA', 'Edulution UI', 'About Linuxmuster.net']);
    await wrapper.findAll('.nav-tabs a')[2].trigger('click'); await flushPromises();
    await wrapper.find('input[type=password]').setValue(' secret value ');
    await wrapper.findAll('floating-toolbar a').find(a => a.text() === 'Save').trigger('click'); await flushPromises();
    expect(writes(http).at(-1).data.smtp.password).toBe(' secret value ');
    const visibleCopy = wrapper.findAll('input[type=text]').find(input => input.element.value === ' secret value ');
    await visibleCopy.setValue(' changed secret ');
    await wrapper.findAll('floating-toolbar a').find(a => a.text() === 'Save').trigger('click'); await flushPromises();
    expect(writes(http).at(-1).data.smtp.password).toBe('changed secret');
});

it('cleared school number keeps a null key in the save payload', async () => {
    const http = vi.fn(async r => ({ data: r.method === 'get' ? structuredClone(responses()[r.url]) : null, status: 200 }));
    const wrapper = mount(SchoolSettings, { global: { provide: { aj: createMockAj({ http }) } } }); wrappers.push(wrapper); await flushPromises();
    await wrapper.findAll('.nav-tabs a')[1].trigger('click');
    await wrapper.find('.tab-pane.active input[type=number]').setValue('1.5');
    await wrapper.findAll('floating-toolbar button').find(button => button.text() === 'Save').trigger('click'); await flushPromises();
    expect(writes(http).at(-1).data['userfile.students.csv'].SURNAME_CHARS).toBe(1.5);
    await wrapper.find('.tab-pane.active input[type=number]').setValue('');
    await wrapper.findAll('floating-toolbar button').find(button => button.text() === 'Save').trigger('click'); await flushPromises();
    expect(writes(http).at(-1).data['userfile.students.csv'].SURNAME_CHARS).toBeNull();
});

it('reflects an identity that finishes loading after the school component mounts', async () => {
    const { state, aj } = setup(createSchoolSettings, { aj: { identity: { profile: {} } } });
    expect(state.isGlobalAdmin).toBe(false);
    aj.identity.patch({ sophomorixRole: 'globaladministrator' });
    expect(state.isGlobalAdmin).toBe(true);
});

it('updates translated tab headings when the shell catalog changes language', async () => {
    const language = ref('en');
    const aj = createMockAj({ gettext: text => language.value === 'de' ? `DE ${text}` : text,
        http: async r => ({ data: r.method === 'get' ? structuredClone(responses()[r.url]) : null }) });
    const wrapper = mount(GlobalSettings, { global: { provide: { aj } } }); wrappers.push(wrapper); await flushPromises();
    expect(wrapper.find('.nav-tabs a').text()).toBe('General');
    language.value = 'de'; await nextTick();
    expect(wrapper.find('.nav-tabs a').text()).toBe('DE General');
});

it.each([SchoolSettings, GlobalSettings])('keeps the Core toolbar grid aligned with the changing sidebar', async Component => {
    const layout = reactive({ sidebar: true });
    const aj = createMockAj({ http: async r => ({ data: r.method === 'get' ? structuredClone(responses()[r.url]) : null }) });
    const wrapper = mount(Component, { props: { layout }, global: { provide: { aj } } }); wrappers.push(wrapper); await flushPromises();
    expect(wrapper.find('floating-toolbar > .container > .row > .aj-theme-toolbar-offset').exists()).toBe(true);
    expect(wrapper.find('floating-toolbar .aj-theme-toolbar-main > .bar.aj-theme-toolbar').exists()).toBe(true);
    layout.sidebar = false; await nextTick();
    expect(wrapper.find('floating-toolbar .aj-theme-toolbar-offset').exists()).toBe(false);
    expect(wrapper.find('floating-toolbar .aj-theme-toolbar-full > .bar.aj-theme-toolbar').exists()).toBe(true);
});

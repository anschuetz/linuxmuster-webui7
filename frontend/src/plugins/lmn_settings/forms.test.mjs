import { afterEach, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createMockAj } from '../../adapter/mock.mjs';
import SchoolSettings from './SchoolSettings.vue';
import GlobalSettings from './GlobalSettings.vue';
import { responses } from './fixtures.test-data.mjs';

const wrappers = [];
const examples = { smtp: ' P79 secret ', api: 'P79 synthetic secret' };
afterEach(() => { wrappers.splice(0).forEach(w => w.unmount()); vi.unstubAllGlobals(); });
async function form(Component, overrides = {}) {
    const data = { ...responses(), ...overrides };
    const http = vi.fn(async r => ({ data: r.method === 'get' ? structuredClone(data[r.url]) : null, status: 200 }));
    const modal = { open: vi.fn().mockResolvedValue() };
    const aj = createMockAj({ http, modal, identity: { profile: { sophomorixRole: 'globaladministrator' } } });
    const wrapper = mount(Component, { global: { provide: { aj } } }); wrappers.push(wrapper); await flushPromises();
    return { wrapper, http, aj, modal, data };
}
const writes = http => http.mock.calls.map(([r]) => JSON.parse(JSON.stringify(r))).filter(r => r.method !== 'get');
const tab = async (wrapper, index) => { await wrapper.findAll('.nav-tabs a')[index].trigger('click'); await flushPromises(); return wrapper.find('.tab-pane.active'); };
async function clickText(wrapper, text) {
    const element = wrapper.findAll('a,button').find(a => a.text() === text && a.isVisible());
    expect(element, text).toBeDefined(); await element.trigger('click'); await flushPromises();
}
const save = wrapper => clickText(wrapper.find('floating-toolbar'), 'Save');

it('saves school name, printserver and every mail-domain destination independently', async () => {
    const { wrapper, http, data } = await form(SchoolSettings);
    const panel = wrapper.find('.tab-pane.active');
    const values = ['P79 School', 'students.test', 'teachers.test', 'classes.test', 'teacherclasses.test', 'projects.test', 'print.test'];
    const fields = panel.findAll('input'); expect(fields).toHaveLength(7);
    for (const [index, input] of fields.entries()) await input.setValue(` ${values[index]} `);
    await save(wrapper);
    const expected = structuredClone(data['/api/lmn/schoolsettings']);
    expected.school = { SCHOOL_LONGNAME: values[0], PRINTSERVER: values[6] };
    for (const [index, role] of ['role.student', 'role.teacher', 'type.adminclass', 'type.teacherclass', 'type.project'].entries()) expected[role].MAILDOMAIN = values[index + 1];
    expect(writes(http)).toEqual([{ method: 'post', url: '/api/lmn/schoolsettings', data: expected }]);
});

it('keeps all three CSV columns, duplicate password-length controls, encodings and filter defaults', async () => {
    const { wrapper, http, data } = await form(SchoolSettings);
    const panel = await tab(wrapper, 1);
    for (const checkbox of panel.findAll('[checkbox]')) await checkbox.trigger('click');
    for (const input of panel.findAll('input[type=number]')) await input.setValue('3');
    for (const select of panel.findAll('select')) await select.setValue('ASCII');
    for (const input of panel.findAll('input[type=text]')) { await input.setValue(''); await input.trigger('blur'); }
    await save(wrapper);
    const expected = structuredClone(data['/api/lmn/schoolsettings']);
    for (const role of ['students', 'teachers', 'extrastudents']) Object.assign(expected[`userfile.${role}.csv`], {
        SURNAME_FIRSTNAME_REVERSE: true, SURNAME_CHARS: 3, FIRSTNAME_CHARS: 3, PWD_LENGTH: 3,
        RANDOM_PWD: true, TOLERATION_TIME: 3, DEACTIVATION_TIME: 3, ENCODING: 'ASCII', FILTERSCRIPT: '---',
    });
    expected['userfile.students.csv'].CLASSNAME_SLASH_TO_HYPHEN = true;
    expect(writes(http)).toEqual([{ method: 'post', url: '/api/lmn/schoolsettings', data: expected }]);
});

it('saves every quota column and opens the existing apply dialog', async () => {
    const { wrapper, http, modal, data } = await form(SchoolSettings);
    const panel = await tab(wrapper, 2);
    const inputs = panel.findAll('input[type=number]'); expect(inputs).toHaveLength(12);
    for (const [index, input] of inputs.entries()) await input.setValue(String(index + 10));
    await save(wrapper);
    const expected = structuredClone(data['/api/lmn/schoolsettings']);
    for (const [row, key] of ['QUOTA_DEFAULT_GLOBAL', 'QUOTA_DEFAULT_SCHOOL', 'CLOUDQUOTA_PERCENTAGE', 'MAILQUOTA_DEFAULT'].entries()) {
        for (const [column, role] of ['student', 'teacher', 'schooladministrator'].entries()) expected[`role.${role}`][key] = 10 + 3 * row + column;
    }
    expect(writes(http)).toEqual([{ method: 'post', url: '/api/lmn/schoolsettings', data: expected }]);
    await clickText(wrapper.find('floating-toolbar'), 'Save & Apply Quota');
    expect(modal.open.mock.calls).toHaveLength(1);
});

it('saves printing metadata but preserves the original Save && saveCustom short circuit', async () => {
    const { wrapper, http, data } = await form(SchoolSettings);
    const panel = await tab(wrapper, 3);
    const keys = ['ADMINS_PRINT', 'URLSTART_PRINT', 'URLSTART_COMMENT_PRINT', 'URLSCHUKO_PRINT', 'URLSCHUKO_COMMENT_PRINT', 'URLMOODLE_PRINT', 'URLMOODLE_COMMENT_PRINT', 'URLMAIL_PRINT', 'URLMAIL_COMMENT_PRINT'];
    const inputs = panel.findAll('input:not([disabled])'); expect(inputs).toHaveLength(keys.length);
    for (const [index, input] of inputs.entries()) await input.setValue(` P79 ${keys[index]} `);
    // Select both object-valued templates, including empty selection before save.
    for (const select of panel.findAll('select')) await select.setValue(select.findAll('option')[0].element._value);
    await save(wrapper);
    const expected = structuredClone(data['/api/lmn/schoolsettings']);
    for (const key of keys) expected.school[key] = `P79 ${key}`;
    expect(writes(http).map(r => r.url)).toEqual(['/api/lmn/schoolsettings', '/api/lmn/config/customfields']);
    expect(writes(http)[0].data).toEqual(expected);
});

it.each(['students', 'teachers', 'schooladministrators', 'globaladministrators'])('saves titles and visibility/editability for %s without mixing roles', async role => {
    const { wrapper, http, data } = await form(SchoolSettings);
    const panel = await tab(wrapper, 4);
    await panel.find('select').setValue(role);
    const roleTable = panel.findAll('table').find(table => table.element.style.display !== 'none');
    const titles = roleTable.findAll('input[type=text]'); expect(titles).toHaveLength(11);
    for (const [index, input] of titles.entries()) await input.setValue(` P79 ${index} `);
    for (const checkbox of roleTable.findAll('[checkbox]')) await checkbox.trigger('click');
    const displayTables = panel.findAll('table').filter(table => table.isVisible() && table.findAll('select').length);
    for (const table of displayTables) for (const select of table.findAll('select')) await select.setValue('proxyAddresses');
    await save(wrapper);
    const config = structuredClone(data['/api/lmn/config/customfields/']);
    config.proxyAddresses[role] = { title: 'P79 0', show: true, editable: true };
    for (let index = 1; index <= 5; index += 1) {
        config.custom[role][index] = { title: `P79 ${index}`, show: true, editable: true };
        config.customMulti[role][index] = { title: `P79 ${5 + index}`, show: true, editable: true };
    }
    for (const destination of (['students', 'teachers'].includes(role) ? ['students', 'teachers'] : ['schooladministrators', 'globaladministrators'])) config.customDisplay[destination] = { 1: 'proxyAddresses', 2: 'proxyAddresses', 3: 'proxyAddresses' };
    expect(writes(http)).toEqual([{ method: 'post', url: '/api/lmn/config/customfields', data: { config } }]);
});

it('renders missing custom roles as empty controls and only creates fields actually edited', async () => {
    const config = { custom: {}, customMulti: {}, customDisplay: {}, proxyAddresses: {}, passwordTemplates: { multiple: '/multiple.tex', individual: '/individual.tex' } };
    const { wrapper, http } = await form(SchoolSettings, { '/api/lmn/config/customfields/': config });
    const panel = await tab(wrapper, 4);
    await panel.find('select').setValue('globaladministrators');
    const table = panel.findAll('table').find(t => t.isVisible());
    await table.find('input').setValue(' P79 proxy ');
    await save(wrapper);
    expect(writes(http)).toEqual([{ method: 'post', url: '/api/lmn/config/customfields', data: { config: { ...config, proxyAddresses: { globaladministrators: { title: 'P79 proxy' } } } } }]);
});

it('edits holidays on blur, validates the dates, saves and confirms removal', async () => {
    const { wrapper, http } = await form(SchoolSettings);
    const panel = await tab(wrapper, 5);
    await clickText(panel, 'Add holidays');
    const inputs = panel.findAll('input');
    for (const [index, value] of [' P79 Holiday ', ' 01.01.2027 ', ' 02.01.2027 '].entries()) await inputs[index].setValue(value);
    await save(wrapper);
    expect(writes(http)).toEqual([{ method: 'post', url: '/api/lmn/holidays', data: [{ name: 'P79 Holiday', start: '01.01.2027', end: '02.01.2027' }] }]);
    await panel.find('tr button').trigger('click'); await flushPromises();
    expect(panel.findAll('input')).toEqual([]);
    await wrapper.findAll('floating-toolbar button').find(button => button.find('.fa-history').exists()).trigger('click'); await flushPromises();
});

it('edits role defaults and school password overrides through the actual controls', async () => {
    const { wrapper, http } = await form(SchoolSettings);
    const panel = await tab(wrapper, 6);
    await panel.find('select').setValue('teacher');
    const defaults = panel.find('table');
    await defaults.find('input[type=number]').setValue('15');
    for (const checkbox of defaults.findAll('input[type=checkbox]')) await checkbox.setValue(true);
    await defaults.findAll('input[type=number]')[1].setValue('2');
    // The override checkbox is outside the default-rule table.
    const override = panel.findAll('label.checkbox-inline').find(label => label.find('span').exists());
    if (panel.findAll('table').length === 1) await override.find('input').trigger('click');
    const school = panel.findAll('table')[1];
    await school.find('input[type=number]').setValue('16');
    for (const checkbox of school.findAll('input[type=checkbox]')) await checkbox.setValue(true);
    await school.findAll('input[type=number]')[1].setValue('3');
    await save(wrapper);
    const posted = writes(http)[0].data.config;
    expect(posted.default.teacher).toEqual([{ type: 'min_length', value: 15 }, { type: 'require_classes', classes: ['lower', 'upper', 'digit', 'special'], count: 2 }]);
    expect(posted.schools['default-school'].teacher).toEqual([{ type: 'min_length', value: 16 }, { type: 'require_classes', classes: ['lower', 'upper', 'digit', 'special'], count: 3 }]);
});

it('edits all subnet fields with blur semantics and preserves commented entries', async () => {
    const comment = { network: '#keep' };
    const subnet = { network: '10.0.0.0/24', routerIp: '10.0.0.1', beginRange: '', endRange: '', nameServer: '', nextServer: '', setupFlag: '' };
    const { wrapper, http } = await form(GlobalSettings, { '/api/lmn/subnets': [comment, subnet] });
    const panel = await tab(wrapper, 1);
    const values = ['10.79.0.0/24', '10.79.0.1', '10.79.0.20', '10.79.0.30', '10.79.0.2', '10.79.0.3', 'P79'];
    for (const [index, input] of panel.findAll('input').entries()) await input.setValue(` ${values[index]} `);
    await clickText(wrapper.find('floating-toolbar'), 'Save & Apply Subnets');
    expect(writes(http)).toEqual([{ method: 'post', url: '/api/lmn/subnets', data: [comment, Object.fromEntries(['network', 'routerIp', 'beginRange', 'endRange', 'nameServer', 'nextServer', 'setupFlag'].map((key, index) => [key, values[index]]))] }]);
    await clickText(panel, 'Add a subnet');
    expect(panel.findAll('input')).toHaveLength(14);
    await panel.findAll('tr button')[1].trigger('click'); await flushPromises();
    expect(panel.findAll('input')).toHaveLength(7);
});

it('loads every global tab and posts allowed roles through its toolbar', async () => {
    const { wrapper, http } = await form(GlobalSettings, { '/api/lmn/webuisettings/allowed_roles': ['globaladministrator', 'teacher'] });
    for (let index = 1; index < 8; index += 1) await tab(wrapper, index);
    const panel = await tab(wrapper, 3);
    for (const checkbox of panel.findAll('input[type=checkbox]')) if (checkbox.isVisible() && !checkbox.element.disabled) await checkbox.setValue(true);
    await save(wrapper);
    expect(writes(http)).toEqual([{ method: 'post', url: '/api/lmn/webuisettings/allowed_roles', data: { allowed_roles: ['globaladministrator', 'schooladministrator', 'teacher', 'student', 'parent', 'staff'] } }]);
});

it('edits global language, certificate paths, SSL, trusted domains and proxies with the full config payload', async () => {
    const { wrapper, http, modal, data } = await form(GlobalSettings);
    const panel = wrapper.find('.tab-pane.active');
    await panel.find('select').setValue('en');
    await panel.find('input[type=number]').setValue('3700');
    modal.open.mockResolvedValueOnce('/chosen.pem');
    await panel.find('.input-group a').trigger('click'); await flushPromises();
    await panel.findAll('input[type=text]')[1].setValue(' /fqdn.pem ');
    await panel.find('[checkbox]').trigger('click');
    await clickText(panel, 'New domain'); await clickText(panel, 'New proxy');
    const fields = panel.findAll('.input-group input');
    for (const [index, value] of [[2, ' new-school.test '], [3, ' p79.test '], [4, ' 127.79.0.1 '], [5, ' 127.79.0.2 ']]) await fields[index].setValue(value);
    await panel.findAll('.input-group')[2].find('a').trigger('click'); await flushPromises();
    // Remove the original proxy, retaining the newly entered one.
    await panel.findAll('.input-group')[3].find('a').trigger('click'); await flushPromises();
    await save(wrapper);
    const expected = structuredClone(data['/api/core/config']);
    Object.assign(expected, { language: 'en', session_max_time: 3700, trusted_domains: ['p79.test'], trusted_proxies: ['127.79.0.2'] });
    expected.ssl = { ...expected.ssl, force: true, certificate: '/chosen.pem', fqdn_certificate: '/fqdn.pem' };
    expect(writes(http)).toEqual([{ method: 'post', url: '/api/core/config', data: expected }]);
});

it('saves SMTP security mode, login, masked password and mail template, then invokes shell restart', async () => {
    const { wrapper, http, data, aj } = await form(GlobalSettings);
    aj.restart = vi.fn().mockResolvedValue();
    const panel = await tab(wrapper, 2);
    await panel.find('[checkbox]').trigger('click');
    const fields = panel.findAll('input[type=text]');
    await fields[0].setValue(' smtp.p79.test '); await fields[1].setValue(' p79-user ');
    await panel.find('input[type=password]').setValue(examples.smtp);
    await panel.find('.btn-group a').trigger('click');
    await panel.find('.fa-eye').trigger('click');
    await panel.find('.fa-eye-slash').trigger('click');
    await fields.at(-1).setValue(' /p79/reset.txt ');
    await save(wrapper);
    const config = structuredClone(data['/api/core/config']); config.email = { enable: true, templates: { reset_email: '/p79/reset.txt' } };
    expect(writes(http)).toEqual([
        { method: 'post', url: '/api/core/config', data: config },
        { method: 'post', url: '/api/core/smtp-config', data: { smtp: { ...data['/api/core/smtp-config'].smtp, server: 'smtp.p79.test', user: 'p79-user', password: examples.smtp, port: 'starttls' } } },
    ]);
    await clickText(wrapper.find('floating-toolbar'), 'Restart WebUI');
    expect(aj.restart.mock.calls).toEqual([[]]);
});

it('uses API dialogs, LDAP selection, IP/scope forms and secret lifecycle through real controls', async () => {
    const clipboard = { writeText: vi.fn().mockResolvedValue() };
    vi.stubGlobal('navigator', { clipboard });
    const { wrapper, http, aj } = await form(GlobalSettings);
    const originalHttp = http.getMockImplementation();
    http.mockImplementation(async r => {
        if (r.url === '/api/lmn/ldap-search') return { data: [{ login: 'zem', label: 'P79 User' }] };
        if (r.method === 'put') return { data: { secret: examples.api, api_restarted: false } };
        return originalHttp(r);
    });
    const panel = await tab(wrapper, 4);
    await clickText(panel, 'Add a key');
    const dialog = () => wrapper.findAll('.modal').at(-1);
    await dialog().find('input').setValue(' p79-key ');
    await dialog().findAll('input').at(-1).setValue('zem'); await flushPromises();
    await wrapper.find('[role=option]').trigger('mousedown'); await flushPromises();
    await dialog().findAll('a').find(a => a.find('.fa-plus').exists()).trigger('click');
    const submission = new Event('submit', { bubbles: true, cancelable: true });
    dialog().find('form').element.dispatchEvent(submission);
    expect(submission.defaultPrevented).toBe(true);
    await dialog().find('input').setValue(' 127.0.0.79 ');
    await clickText(dialog(), 'Save');
    await dialog().findAll('a').filter(a => a.find('.fa-plus').exists())[1].trigger('click');
    await dialog().find('input').setValue(' GET /p79/** ');
    await clickText(dialog(), 'Save');
    await clickText(dialog(), 'Save');
    expect(writes(http).find(r => r.method === 'put').data).toEqual({ key: { name: 'p79-key', user: 'zem', ips: ['127.0.0.79'], scope: ['GET /p79/**'] } });
    const row = () => panel.findAll('tr').find(tr => tr.text().includes('p79-key'));
    await row().findAll('button')[1].trigger('click'); await flushPromises();
    expect(dialog().find('textarea').element.value).toBe(examples.api);
    await dialog().find('textarea').trigger('click');
    await clickText(dialog(), 'Copy'); await clickText(dialog(), 'Close');
    expect(clipboard.writeText.mock.calls).toEqual([[examples.api]]);
    await row().find('button').trigger('click'); await flushPromises();
    await dialog().find('input').setValue('p79-renamed');
    await dialog().find('.c12-label.bg-info').trigger('click'); await dialog().find('.c12-label.bg-warning').trigger('click');
    await clickText(dialog(), 'Save');
    expect(writes(http).at(-1).data).toEqual({ config: { api_keys: { 'p79-renamed': { user: 'zem', ips: [], scope: [], secret: examples.api } }, enable_host_auth: true } });
    await panel.findAll('tr').find(tr => tr.text().includes('p79-renamed')).findAll('button')[2].trigger('click'); await flushPromises();
    expect(writes(http).at(-1)).toEqual({ method: 'delete', url: '/api/lmn/apikeys/p79-renamed' });
    await clickText(panel, 'Add a key'); await clickText(dialog(), 'Close');
    expect(wrapper.findAll('.modal')).toEqual([]);
    // Backend read failure stays the existing empty loading state, with no stale key.
    aj.http.get = vi.fn().mockResolvedValue({ data: null });
    await tab(wrapper, 4);
    expect(panel.text()).toContain('linuxmuster-api does not seem to be installed on your system.');
});

it('flattens and deletes a TFA enrollment through the table action', async () => {
    const { wrapper, http } = await form(GlobalSettings, { '/api/core/tfa-config': { 'p79@ldap': { totp: [{ created: 1700000000, description: 'P79 device' }] } } });
    const panel = await tab(wrapper, 5);
    expect(panel.text()).toContain('November 2023');
    await panel.find('tr .btn').trigger('click'); await flushPromises();
    expect(writes(http)).toEqual([{ method: 'post', url: '/api/core/tfa-config', data: { type: 'delete', userid: 'p79@ldap', timestamp: '1700000000' } }]);
    expect(panel.text()).not.toContain('P79 device');
});

it('creates the Edulution binduser, refreshes status and generates/copies the setup token', async () => {
    const clipboard = { writeText: vi.fn().mockResolvedValue() };
    vi.stubGlobal('navigator', { clipboard });
    const { wrapper, http } = await form(GlobalSettings, { '/api/lmn/edulution/api-status': { api_installed: true, api_running: true } });
    const originalHttp = http.getMockImplementation();
    let created = false;
    http.mockImplementation(async r => {
        if (r.url.endsWith('/bindusers/global')) {
            if (r.method === 'post') { created = true; return { data: null }; }
            return { data: created ? [{ sAMAccountName: 'edulutionui-binduser', DN: 'CN=P79' }] : [] };
        }
        if (r.url === '/api/lmn/edulution/generate') return { data: 'P79 synthetic token' };
        return originalHttp(r);
    });
    const panel = await tab(wrapper, 6);
    await clickText(panel, 'Create binduser');
    await panel.find('input').setValue(' p79.test ');
    await clickText(panel, 'Generate edulution Setup Token');
    await clickText(panel, 'Copy');
    expect(writes(http)).toEqual([
        { method: 'post', url: '/api/lmn/sophomorixUsers/bindusers/global', data: { binduser: 'edulutionui-binduser' } },
        { method: 'post', url: '/api/lmn/edulution/generate', data: { external_domain: 'p79.test', binduser_name: 'edulutionui-binduser', binduser_dn: 'CN=P79' } },
    ]);
    expect(clipboard.writeText.mock.calls).toEqual([['P79 synthetic token']]);
});

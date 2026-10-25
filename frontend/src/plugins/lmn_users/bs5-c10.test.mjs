import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { chromium } from '@playwright/test';
import { afterEach, expect, it } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createMockAj } from '../../adapter/mock.mjs';
import { users, config } from '../../../e2e/fixtures/users_2.mjs';
import UsersTable from './UsersTable.vue';
import AdminsTable from './AdminsTable.vue';
import ExtrasTable from './ExtrasTable.vue';
const wrappers = [];
afterEach(() => wrappers.splice(0).forEach(w => w.unmount()));
async function render(component, props, quotaType = 'warning') {
    const aj = createMockAj({ http: async r => ({ data: r.url.includes('customfields') ? config() : r.url.includes('schoolsettings') ? {} : r.url.includes('bindusers') ? [{ sAMAccountName: 'bind-fixture', DN: 'CN=fixture,DC=test', pw: true }] : r.url.includes('/lists/') ? [{ class: 'fixture', first_name: 'Synthetic', last_name: 'User', birthday: '', login: '' }] : r.url.includes('usermap') ? { [r.url.split('/').at(-1)]: { USED: 75, TYPE: quotaType } } : users(props.role) }) });
    const w = mount(component, { props, global: { provide: { aj } } }); wrappers.push(w); await flushPromises(); return w;
}
it.each([[UsersTable,{role:'students'}],[AdminsTable,{level:'global'}],[ExtrasTable,{kind:'students'}]])('migrates controls and Vue dropdown states', async (component, props) => {
    const w = await render(component, props);
    expect(w.find('.btn-default, .input-group-btn, .input-group-addon, .pull-right, .label, .form-group').exists()).toBe(false);
    expect(w.find('.btn-light.c10-button').exists()).toBe(true);
    expect(w.find('.dropdown-menu.show').exists()).toBe(false);
    await w.find('.c10-menu-control button').trigger('click');
    expect(w.find('.dropdown-menu.show .dropdown-item').exists()).toBe(true);
    expect(w.find('.open').exists()).toBe(false);
    await w.find('.c10-menu-control button').trigger('click');
    expect(w.find('.dropdown-menu.show').exists()).toBe(false);
});
it('places active tabs on nav-link and uses page items/links', async () => {
    const w = await render(UsersTable, {role:'students'});
    expect(w.get('.nav-item .nav-link.active').attributes('data-tab')).toBe('students');
    await w.get('[data-tab=attic]').trigger('click');
    expect(w.get('.nav-link.active').attributes('data-tab')).toBe('attic');
    expect(w.get('[data-section=students] .pagination .page-item.active .page-link').text()).toBe('1');
});
it('resolves quota/status variants to BS5 badges and backgrounds', async () => {
    const w = await render(UsersTable, {role:'teachers'});
    expect(w.get('tbody .badge.bg-success').text()).toBe('U');
    await w.get('[data-action=quotas]').trigger('click'); await flushPromises();
    expect(w.find('.badge.bg-warning').exists()).toBe(true);
    expect(w.get('.progress-bar').classes()).toContain('bg-warning');
});
it('marks only failing extras inputs invalid and keeps the save guard', async () => {
    const w = await render(ExtrasTable, {kind:'students'});
    expect(w.findAll('input.is-invalid')).toHaveLength(2);
    await w.get('[data-action=check]').trigger('click'); await flushPromises();
    expect(w.findAll('input.is-invalid')).toHaveLength(2);
    expect(w.find('[placeholder="First name"]').classes()).not.toContain('is-invalid');
});
it('binds focus, tabs and mobile fixes to the built CSS', () => {
    const root = postcss.parse(readFileSync('../usr/lib/linuxmuster-webui/plugins/lmn_common/resources/vue/styles.css','utf8'));
    const declarations = selector => { const out = {}; root.walkRules(r => { if(r.selectors.includes(selector)) r.walkDecls(d => {out[d.prop]=d.value;}); }); return out; };
    expect(declarations('.btn.c10-button')['--bs-btn-focus-box-shadow']).toBe('none');
    expect(declarations('.c10-tabs > .nav-item > .nav-link:focus-visible')['box-shadow']).toBe('none');
    expect(declarations('.c10-bind-details')['overflow-wrap']).toBe('anywhere');
    expect(declarations('.c10-table-scroll')['overflow-x']).toBe('auto');
    expect(declarations('.c10-table-scroll .lm-table-inputs .c10-field')['min-width']).toBe('140px');
    expect(declarations('.c10-table-scroll .dropup > .c10-menu').position).toBe('fixed');
});

it('keeps a default quota bar on its original base color', async () => {
    const w = await render(UsersTable, {role:'teachers'}, 'default');
    await w.get('[data-action=quotas]').trigger('click'); await flushPromises();
    expect(w.find('.badge.bg-secondary').exists()).toBe(true);
    expect(w.get('.progress-bar').classes().some(c => c.startsWith('bg-'))).toBe(false);
});

it('keeps customized tab color with the real body classes and no redundant accent overrides', async () => {
    const css = readFileSync('../usr/lib/linuxmuster-webui/plugins/lmn_common/resources/vue/styles.css','utf8');
    const browser = await chromium.launch({headless:true});
    try {
        const page = await browser.newPage();
        await page.setContent('<body class="customized global-color-red"><ul class="nav nav-tabs c10-tabs"><li class="nav-item"><a class="nav-link active">Students</a></li></ul></body>');
        await page.addStyleTag({content:css});
        await page.waitForFunction(() => getComputedStyle(document.querySelector('.nav-link')).color === 'rgb(35, 60, 76)');
        expect(await page.locator('.nav-link').evaluate(el=>({color:getComputedStyle(el).color,border:getComputedStyle(el).borderBottomColor}))).toEqual({color:'rgb(35, 60, 76)',border:'rgb(35, 60, 76)'});
        expect(/body\.global-color-[\w-]+ \.c10-tabs/.test(css)).toBe(false);
    } finally { await browser.close(); }
});

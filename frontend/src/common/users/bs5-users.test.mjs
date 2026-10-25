import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { afterEach, expect, it } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createMockAj } from '../../adapter/mock.mjs';
import { user, detailGroups } from '../../../e2e/fixtures/users_1.mjs';
import { result } from '../../../e2e/fixtures/users_3.mjs';
import UserDetails from './UserDetails.vue';
import CustomPassword from './CustomPassword.vue';
import ShowPassword from './ShowPassword.vue';
import CheckDialog from './CheckDialog.vue';
import CheckResultsDialog from './CheckResultsDialog.vue';
import ApplyDialog from './ApplyDialog.vue';
const wrappers = [];
const render = (component, props = {}) => {
    const aj = createMockAj({ http: async r => ({ data: r.url.includes('/sophomorixUsers/') ? [user()] : r.url.includes('/quota/') ? { home: { used: 75, hard_limit: 100 } } : '' }) });
    const w = mount(component, { props, global: { provide: { aj }, mocks: { $gettext: aj.gettext } } }); wrappers.push(w); return w;
};
afterEach(() => wrappers.splice(0).forEach(w => w.unmount()));
it.each([[UserDetails,{id:'fixture',role:'students'}],[CustomPassword,{users:[]}],[ShowPassword,{username:'fixture'}],[CheckDialog,{}],[CheckResultsDialog,{data:result()}],[ApplyDialog,{params:{doAdd:false,doMove:true,doKill:false}}]])('uses BS5 titles and neutral buttons', async (component, props) => {
    const w = render(component, props); await flushPromises();
    expect(w.get('.modal-header :is(h3,h4)').classes()).toContain('modal-title');
    expect(w.find('.btn-default, .form-group, .panel, .label').exists()).toBe(false);
    expect(w.find('.btn-light.common-user-button').exists()).toBe(true);
});
it('uses cards, contextual badges and named quota progress without adding validation', async () => {
    const w = render(UserDetails, { id:'fixture', role:'students' }); await flushPromises();
    expect(w.findAll('.card.common-user-card')).toHaveLength(2);
    expect(w.find('.badge.bg-success').text()).toBe('U');
    expect(w.get('[role=progressbar]').classes()).toContain('bg-warning');
    expect(w.get('[role=progressbar]').attributes()).toMatchObject({'aria-valuemin':'0','aria-valuemax':'100','aria-valuenow':'75','aria-label':'home'});
    expect(w.find('.is-invalid').exists()).toBe(false);
});
it('uses explicit result card colors and active BS5 links, retaining Cancel', async () => {
    const w = render(CheckResultsDialog, {data:result()});
    expect(w.findAll('.card.common-user-card').map(c => c.classes().find(s => s.startsWith('common-user-card-')))).toEqual(['common-user-card-info','common-user-card-warning','common-user-card-danger']);
    expect(w.get('.nav-link.active').text()).toBe('Summary');
    await w.findAll('.nav-link')[2].trigger('click'); expect(w.get('.nav-link.active').text()).toBe('Moved users');
    expect(w.find('.badge.bg-danger').exists()).toBe(true);
    await w.findAll('.modal-footer button')[1].trigger('click'); expect(w.emitted('cancel')).toEqual([[]]);
});
it('binds migrated appearance to built CSS', () => {
    const root = postcss.parse(readFileSync('../usr/lib/linuxmuster-webui/plugins/lmn_common/resources/vue/styles.css','utf8'));
    const declarations = selector => { const out = {}; root.walkRules(rule => { if(rule.selectors.includes(selector)) rule.walkDecls(d => {out[d.prop]=d.value;}); }); return out; };
    expect(declarations('.btn.common-user-button')['--bs-btn-focus-box-shadow']).toBe('none');
    expect(declarations('.common-user-card > .card-body').padding).toBe('15px');
    expect(declarations('.common-user-parents .dropdown-item.active').color).toBe('#333');
    expect(declarations('.common-user-badge.bg-warning')['--bs-warning-rgb']).toBe('255, 193, 7');
});

it('keeps the E2E group-body and toggle selectors usable after the card migration', async () => {
    const w = render(UserDetails, {id:'fixture',role:'students'}); await flushPromises();
    const body = w.get(detailGroups.body), toggle = w.get(detailGroups.toggle);
    expect(body.get('li').text()).toContain('schoolclasses');
    await toggle.trigger('click'); expect(body.element.style.display).toBe('none');
    await toggle.trigger('click'); expect(body.element.style.display).not.toBe('none');
});

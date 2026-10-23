import { expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import Links from './Links.vue';
import { createMockAj } from '../../../adapter/mock.mjs';
import { mount as mountLinks } from '../entry.mjs';

const admin = { title: 'Admin', description: 'Admin description', icon: '/admin.svg', link: 'https://example.org/admin', permissions: { globaladministrator: false } };
const teacher = { title: 'Teacher', description: 'Teacher description', icon: '/teacher.svg', link: 'https://example.org/teacher', permissions: { teacher: true } };
const shared = { title: 'Shared', description: 'Shared description', icon: '/shared.svg', link: 'https://example.org/shared', permissions: { globaladministrator: true, teacher: false } };
const data = { admin, teacher, shared };
const render = (aj) => mount(Links, { global: { provide: { aj } } });

it.each(['globaladministrator', 'teacher'])('filters by permission keys for %s, including false values', async (role) => {
    const http = vi.fn(async () => ({ status: 200, data: { status: 'success', data } }));
    const aj = createMockAj({ identity: { user: 'synthetic', profile: { sophomorixRole: role } }, http });
    const wrapper = render(aj);
    await flushPromises();
    expect(http).toHaveBeenCalledWith({ method: 'get', url: '/api/lmn/links', data: undefined, cfg: undefined });
    const expected = role === 'teacher' ? [teacher, shared] : [admin, shared];
    expect(wrapper.findAll('.info-cards')).toHaveLength(2);
    for (const [index, link] of expected.entries()) {
        const card = wrapper.findAll('.info-cards')[index];
        expect(card.text()).toContain(link.title);
        expect(card.text()).toContain(link.description);
        expect(card.get('img').attributes('src')).toBe(link.icon);
        expect(card.get('a').attributes('href')).toBe(link.link);
    }
    expect(wrapper.find('.alert-info').exists()).toBe(false);
    aj.identity.profile = { sophomorixRole: 'student' };
    await nextTick();
    expect(wrapper.findAll('.info-cards')).toHaveLength(0);
    expect(wrapper.get('.alert-info').text()).toContain('Currently no links defined!');
    wrapper.unmount();
});

it('waits for identity before loading the links', async () => {
    const http = vi.fn(async () => ({ status: 200, data: { status: 'success', data } }));
    const aj = createMockAj({ http });
    const wrapper = render(aj);
    expect(http).not.toHaveBeenCalled();
    aj.identity.profile = { sophomorixRole: 'teacher' };
    aj.identity.user = 'zem';
    await flushPromises();
    expect(wrapper.findAll('.info-cards')).toHaveLength(2);
    wrapper.unmount();
});

it.each([
    async () => ({ status: 200, data: { status: 'error', message: 'Configfile not found!' } }),
    async () => { throw new Error('HTTP 500'); },
])('shows the empty message for a failed request', async (http) => {
    const wrapper = render(createMockAj({ identity: { user: 'zem' }, http }));
    await flushPromises();
    expect(wrapper.get('.alert-info').text()).toContain('Currently no links defined!');
    expect(wrapper.findAll('.info-cards')).toHaveLength(0);
    wrapper.unmount();
});

it('sets the translated page title and releases its mount', async () => {
    const set = vi.fn();
    const host = document.createElement('div');
    const unmount = mountLinks(host, createMockAj({ pageTitle: { set }, gettext: (text) => `DE: ${text}` }));
    await flushPromises();
    expect(set).toHaveBeenCalledWith('DE: Links');
    expect(host.textContent).toContain('DE: Currently no links defined!');
    unmount();
    expect(host.textContent).toBe('');
});

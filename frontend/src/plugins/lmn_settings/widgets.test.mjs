import { expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createMockAj } from '../../adapter/mock.mjs';
import Checkbox from './Checkbox.vue';
import Translated from './Translated.mjs';
import FileDialog from './FileDialog.vue';
import UserSearch from './UserSearch.vue';

it('keeps all LDAP matches and supports typeahead keyboard selection', async () => {
    const users = Array.from({ length: 10 }, (_, index) => ({ login: `p79-${index}`, label: `P79 User ${index}` }));
    const findUsers = vi.fn().mockResolvedValue(users);
    const wrapper = mount(UserSearch, { props: { modelValue: undefined, findUsers, placeholder: 'Find' } });
    const input = wrapper.find('input');
    await input.setValue('p79'); await flushPromises();
    expect(wrapper.findAll('[role=option]')).toHaveLength(10);
    await input.trigger('keydown', { key: 'ArrowDown' });
    await input.trigger('keydown', { key: 'ArrowDown' });
    await input.trigger('keydown', { key: 'Enter' });
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual([users[2]]);
    expect(findUsers.mock.calls).toEqual([['p79']]);
    wrapper.unmount();
});

it('keeps the original checkbox truthiness, icon classes and Boolean write', async () => {
    const wrapper = mount(Checkbox, { props: { modelValue: 'False', text: 'P79' } });
    expect(wrapper.classes()).toEqual(['active']);
    expect(wrapper.findAll('i').map(i => i.attributes('class'))).toEqual(['fa fa-square-o off', 'fa fa-check-square on']);
    await wrapper.trigger('click'); expect(wrapper.emitted('update:modelValue')).toEqual([[false]]); wrapper.unmount();
});

it('translates the complete existing markup message while retaining its code and icon', () => {
    const text = '<i class="fa fa-warning"></i> Warning <code>GET /p79/**</code> <a href="https://docs.test/">Docs</a>';
    const aj = createMockAj({ gettext: key => key === text ? '<i class="fa fa-warning"></i> Warnung <code>GET /p79/**</code> <a href="https://docs.test/">Docs</a>' : key });
    const wrapper = mount(Translated, { props: { tag: 'p', text }, global: { provide: { aj } } });
    expect(wrapper.element.tagName).toBe('P'); expect(wrapper.text()).toBe('Warnung GET /p79/** Docs');
    expect(wrapper.find('code').text()).toBe('GET /p79/**'); expect(wrapper.find('i').attributes('class')).toBe('fa fa-warning');
    expect(wrapper.find('a').attributes('href')).toBe('https://docs.test/'); wrapper.unmount();
});

it('browses the filesystem through aj, sorts directories first and selects a file', async () => {
    const calls = [];
    const aj = createMockAj({ http: async r => {
        calls.push(r);
        return { data: r.url === '/api/filesystem/list//' ? { parent: null, items: [{ name: 'cert.pem', path: '/cert.pem', isFile: true, isDir: false, size: 1024 }, { name: 'etc', path: '/etc', isDir: true, isFile: false }, { name: 'ä.pem', path: '/ä.pem', isFile: true, isDir: false, size: 1024 }, { name: 'b.pem', path: '/b.pem', isFile: true, isDir: false, size: 1024 }] } : { parent: '/', items: [] } };
    } });
    const wrapper = mount(FileDialog, { attachTo: document.body, global: { provide: { aj } } }); await flushPromises();
    expect(wrapper.findAll('.list-group-item').map(a => a.text().trim())).toEqual(['etc', 'b.pem 1.0 KB', 'cert.pem 1.0 KB', 'ä.pem 1.0 KB']);
    expect(document.activeElement).toBe(wrapper.find('.list-group-item').element);
    await wrapper.find('.list-group').trigger('keydown', { key: 'ArrowDown' });
    expect(document.activeElement).toBe(wrapper.findAll('.list-group-item')[1].element);
    await wrapper.findAll('.list-group-item')[0].trigger('click'); await flushPromises();
    expect(calls.map(r => r.url)).toEqual(['/api/filesystem/list//', '/api/filesystem/list//etc']);
    await wrapper.find('.list-group-item').trigger('click'); await flushPromises();
    await wrapper.findAll('.list-group-item')[2].trigger('click');
    expect(wrapper.emitted('close')).toEqual([['/cert.pem']]); wrapper.unmount();
});

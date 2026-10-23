import { expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import Demo from './Demo.vue';
import { createMockAj } from '../adapter/mock.mjs';
import { mount as mountDemo } from '../entry.mjs';

it('renders translated content and reactive identity through the injected adapter', async () => {
    const aj = createMockAj({ gettext: (text) => `DE: ${text}`, identity: { user: 'teacher' } });
    const wrapper = mount(Demo, { global: { provide: { aj }, mocks: { $gettext: aj.gettext } } });
    expect(wrapper.text()).toContain('DE: Frontend ready');
    expect(wrapper.text()).toContain('teacher');
    Object.assign(aj.identity, { user: 'administrator' });
    await nextTick();
    expect(wrapper.text()).toContain('administrator');
    wrapper.unmount();
});

it('mounts with the adapter and releases the demo on unmount', () => {
    const host = document.createElement('div');
    const gettext = vi.fn((text) => `DE: ${text}`);
    const unmount = mountDemo(host, createMockAj({ gettext }));
    expect(host.textContent).toContain('DE: Frontend ready');
    expect(host.textContent).toContain('DE: Demo');
    expect(gettext).toHaveBeenCalledWith('Demo');
    unmount();
    expect(host.textContent).toBe('');
});

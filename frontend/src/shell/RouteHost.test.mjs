import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import * as Vue from 'vue';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { createMockAj } from '../adapter/mock.mjs';
import RouteHost from './RouteHost.mjs';

const wrappers = [];
function harness(plugin = 'first', aj = { identity: { user: 'test' } }, options = {}) {
    const wrapper = mount(RouteHost, { props: { plugin, aj }, ...options });
    wrappers.push(wrapper);
    return { wrapper, aj };
}
afterEach(() => {
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
    vi.unstubAllGlobals();
});

describe('isolated IIFE RouteHost (no router)', () => {
    it('passes the host element and the same adapter to the existing mount contract', () => {
        const entry = { mount: vi.fn((element) => {
            element.textContent = 'existing plugin';
            return () => { element.textContent = ''; };
        }) };
        vi.stubGlobal('LmnVue_first', entry);
        const { wrapper, aj } = harness();
        expect(entry.mount).toHaveBeenCalledWith(wrapper.element, aj);
        expect(wrapper.text()).toBe('existing plugin');
    });

    it('unmounts the previous plugin before mounting the next, including back navigation', async () => {
        const calls = [];
        for (const plugin of ['first', 'second']) {
            vi.stubGlobal(`LmnVue_${plugin}`, { mount: () => {
                calls.push(`mount ${plugin}`);
                return () => calls.push(`unmount ${plugin}`);
            } });
        }
        const { wrapper } = harness();
        await wrapper.setProps({ plugin: 'second' });
        await wrapper.setProps({ plugin: 'first' });
        wrapper.unmount();
        expect(calls).toEqual(['mount first', 'unmount first', 'mount second',
            'unmount second', 'mount first', 'unmount first']);
    });

    it('remounts with a new adapter and releases the old identity context', async () => {
        const dispose = vi.fn();
        const entry = { mount: vi.fn(() => dispose) };
        vi.stubGlobal('LmnVue_first', entry);
        const { wrapper } = harness();
        const next = { identity: { user: 'next' } };
        await wrapper.setProps({ aj: next });
        expect(dispose).toHaveBeenCalledTimes(1);
        expect(entry.mount).toHaveBeenLastCalledWith(wrapper.element, next);
    });

    it('does not remount when the plugin and adapter stay the same', async () => {
        const entry = { mount: vi.fn(() => vi.fn()) };
        vi.stubGlobal('LmnVue_first', entry);
        const { wrapper, aj } = harness();
        await wrapper.setProps({ plugin: 'first', aj });
        expect(entry.mount).toHaveBeenCalledTimes(1);
    });

    it('supports an empty route and disposes only once', async () => {
        const dispose = vi.fn();
        vi.stubGlobal('LmnVue_first', { mount: () => dispose });
        const { wrapper } = harness(null);
        await wrapper.setProps({ plugin: 'first' });
        await wrapper.setProps({ plugin: null });
        wrapper.unmount();
        expect(dispose).toHaveBeenCalledTimes(1);
    });

    it('reports a missing IIFE and cleans the previous route', async () => {
        const dispose = vi.fn();
        const errorHandler = vi.fn();
        vi.stubGlobal('LmnVue_first', { mount: () => dispose });
        const { wrapper } = harness('first', {}, { global: { config: { errorHandler } } });
        await wrapper.setProps({ plugin: 'missing' });
        expect(dispose).toHaveBeenCalledTimes(1);
        expect(errorHandler.mock.calls[0][0].message).toContain('LmnVue_missing.mount');
        wrapper.unmount();
        expect(dispose).toHaveBeenCalledTimes(1);
    });

    it('surfaces mount errors and can mount the next route afterwards', async () => {
        const error = new Error('plugin failed');
        const errorHandler = vi.fn();
        vi.stubGlobal('LmnVue_first', { mount: () => { throw error; } });
        const dispose = vi.fn();
        vi.stubGlobal('LmnVue_second', { mount: () => dispose });
        const { wrapper } = harness(null, {}, { global: { config: { errorHandler } } });
        await wrapper.setProps({ plugin: 'first' });
        expect(errorHandler.mock.calls[0][0]).toBe(error);
        await wrapper.setProps({ plugin: 'second' });
        wrapper.unmount();
        expect(dispose).toHaveBeenCalledTimes(1);
    });

    it('runs an unchanged plugin IIFE with mock aj and leaves prefix/deep-link/hash to the caller', async () => {
        const context = { Vue };
        const bundle = resolve('../usr/lib/linuxmuster-webui/plugins/lmn_links/resources/vue/lmn_links.js');
        runInNewContext(readFileSync(bundle, 'utf8'), context);
        vi.stubGlobal('LmnVue_lmn_links', context.LmnVue_lmn_links);
        const http = vi.fn(async () => ({ status: 200, data: { status: 'success', data: {
            example: { title: 'Example', description: 'Fixture', link: '/example',
                permissions: { teacher: true } },
        } } }));
        const aj = createMockAj({ http, identity: { user: 'test', profile: { sophomorixRole: 'teacher' } } });
        const previous = window.location.href;
        window.history.replaceState({}, '', '/prefix/view/lmn/links?test=1#section');
        try {
            const { wrapper } = harness('lmn_links', aj);
            await flushPromises();
            expect(wrapper.text()).toContain('Example');
            expect(http).toHaveBeenCalledWith(expect.objectContaining({ method: 'get', url: '/api/lmn/links' }));
            await wrapper.setProps({ plugin: null });
            aj.identity.user = 'another';
            await flushPromises();
            expect(wrapper.text()).toBe('');
            expect(http).toHaveBeenCalledTimes(1);
            expect(window.location.pathname + window.location.search + window.location.hash)
                .toBe('/prefix/view/lmn/links?test=1#section');
        } finally {
            window.history.replaceState({}, '', previous);
        }
    });
});

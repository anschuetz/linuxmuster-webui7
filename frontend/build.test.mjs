// @vitest-environment node
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';
import * as Vue from 'vue';
import { JSDOM } from 'jsdom';
import { build } from 'vite';

it('loads the shared bridge and directive without a demo bundle', async () => {
    const result = await build({
        configFile: false,
        logLevel: 'silent',
        build: {
            write: false,
            lib: {
                entry: fileURLToPath(new URL('./src/bridge/entry.mjs', import.meta.url)),
                name: 'LmnVueBridge', formats: ['iife'],
            },
            rolldownOptions: { external: ['vue'], output: { globals: { vue: 'Vue' } } },
        },
    });
    const unmount = vi.fn();
    const entry = { mount: vi.fn(() => unmount) };
    const context = { Vue, TestPlugin: entry };
    context.window = context;
    const output = Array.isArray(result) ? result[0] : result;
    runInNewContext(output.output[0].code, context);
    let directive;
    const message = Object.assign(Promise.resolve({ value: 'answer' }), { close: vi.fn() });
    const pageTitle = { set: vi.fn() };
    const messagebox = { show: vi.fn(() => message), prompt: vi.fn(() => message) };
    const route = { reload: vi.fn() };
    const services = [{ $evalAsync: (callback) => callback() }, {}, {}, (text) => text, {}, {}, route, pageTitle, messagebox];
    context.angular = { module: () => ({ directive: (name, factory) => { directive = factory(...services); } }) };
    const directivePath = '../usr/lib/linuxmuster-webui/plugins/lmn_common/resources/js/directives/lmnVueMount.es';
    runInNewContext(await readFile(new URL(directivePath, import.meta.url), 'utf8'), context);
    let destroy;
    const dom = new JSDOM('<div></div>');
    const host = dom.window.document.querySelector('div');
    directive.link({ $on: (event, handler) => { destroy = handler; return vi.fn(); } }, [host], { entry: 'TestPlugin' });
    expect(entry.mount).toHaveBeenCalledWith(host, expect.objectContaining({ gettext: services[3] }));
    const aj = entry.mount.mock.calls[0][1];
    aj.reload();
    expect(route.reload).toHaveBeenCalledOnce();
    aj.pageTitle.set('Devices');
    expect(pageTitle.set).toHaveBeenCalledWith('Devices');
    const answer = aj.messagebox.show({ title: 'Question' });
    expect(await answer).toEqual({ value: 'answer' });
    answer.close();
    expect(message.close).toHaveBeenCalledOnce();
    expect(await aj.messagebox.prompt('Name', 'initial')).toEqual({ value: 'answer' });
    expect(messagebox.prompt).toHaveBeenCalledWith('Name', 'initial');
    destroy();
    expect(unmount).toHaveBeenCalledOnce();
    dom.window.close();
    const manifest = await readFile(new URL('../usr/lib/linuxmuster-webui/plugins/lmn_common/plugin.yml', import.meta.url), 'utf8');
    expect(manifest.indexOf('resources/vue/vendor.js')).toBeLessThan(manifest.indexOf('resources/vue/bridge.js'));
    expect(manifest.indexOf('resources/vue/bridge.js')).toBeLessThan(manifest.indexOf('resources/vue/lmn_common.js'));
});

it('discovers two plugin entries and builds their own paths and globals', async () => {
    const root = await mkdtemp(join(tmpdir(), 'lmn-vue-build-'));
    try {
        const frontend = join(root, 'frontend');
        for (const plugin of ['lmn_common', 'lmn_links']) {
            const directory = join(frontend, 'src/plugins', plugin);
            await mkdir(directory, { recursive: true });
            await writeFile(join(directory, 'entry.mjs'), 'export function mount() { return "mounted"; }');
        }
        const { discoverPluginBuilds } = await import('./build.mjs');
        const bundles = await discoverPluginBuilds(frontend);
        expect(bundles).toHaveLength(2);
        for (const [index, plugin] of ['lmn_common', 'lmn_links'].entries()) {
            const output = join(root, 'usr/lib/linuxmuster-webui/plugins', plugin, 'resources/vue');
            expect(bundles[index].outDir).toBe(output);
            await build({ configFile: false, logLevel: 'silent', build: bundles[index] });
            const context = {};
            runInNewContext(await readFile(join(output, `${plugin}.js`), 'utf8'), context);
            expect(context[`LmnVue_${plugin}`].mount()).toBe('mounted');
        }
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

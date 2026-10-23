import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';

it('loads the production Ajenti bundle with Vue globals and registers the mount directive', () => {
    const directives = new Map();
    const module = Object.fromEntries(['run', 'constant', 'factory', 'service', 'controller', 'config', 'filter']
        .map((method) => [method, () => module]));
    module.directive = (name, factory) => { directives.set(name, factory); return module; };
    const context = { angular: { module: () => module }, console, $: () => ({ ready() {} }), document };
    context.window = context;
    const bundle = resolve('../usr/lib/linuxmuster-webui/plugins/lmn_common/resources/build/all.js');
    runInNewContext(readFileSync(bundle, 'utf8'), context);
    expect(typeof context.Vue.createApp).toBe('function');
    expect(typeof context.LmnVueBridge.mountBridge).toBe('function');
    expect(typeof context.LmnVue_lmn_common.mount).toBe('function');
    expect(typeof directives.get('lmnVueMount')).toBe('function');
});

it('injects toaster and gettextCatalog into the production mount directive', () => {
    let directive;
    const module = Object.fromEntries(['run', 'constant', 'factory', 'service', 'controller', 'config', 'filter']
        .map((method) => [method, () => module]));
    module.directive = (name, factory) => { if (name === 'lmnVueMount') directive = factory; return module; };
    const context = { angular: { module: () => module }, console, $: () => ({ ready() {} }), document };
    context.window = context;
    runInNewContext(readFileSync(resolve('../usr/lib/linuxmuster-webui/plugins/lmn_common/resources/build/all.js'), 'utf8'), context);
    const mountBridge = vi.fn();
    context.LmnVueBridge.mountBridge = mountBridge;
    const toaster = { pop: vi.fn() };
    const gettextCatalog = { getString: vi.fn() };
    const scope = {};
    const element = document.createElement('div');
    directive({}, {}, {}, gettextCatalog, {}, {}, {}, {}, {}, toaster).link(scope, [element], { entry: 'LmnVue_lmn_common' });
    expect(mountBridge).toHaveBeenCalledWith(scope, element, context.LmnVue_lmn_common,
        expect.objectContaining({ toaster, gettextCatalog }));
});

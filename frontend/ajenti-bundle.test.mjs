import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { expect, it } from 'vitest';

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

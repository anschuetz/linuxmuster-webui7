import { copyFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { build } from 'vite';

const require = createRequire(import.meta.url);
await build();
// Vue's official global runtime is an IIFE shared by all plugin bundles.
await copyFile(
    require.resolve('vue/dist/vue.runtime.global.prod.js'),
    new URL('../usr/lib/linuxmuster-webui/plugins/lmn_common/resources/vue/vendor.js', import.meta.url),
);

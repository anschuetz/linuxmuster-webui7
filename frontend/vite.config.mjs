import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
    plugins: [vue()],
    test: {
        environment: 'jsdom',
        coverage: {
            include: ['src/**/*.mjs', 'src/**/*.vue'],
            exclude: ['src/**/*.test.mjs'],
            thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
        },
    },
    build: {
        outDir: '../usr/lib/linuxmuster-webui/plugins/lmn_common/resources/vue',
        emptyOutDir: true,
        lib: {
            entry: fileURLToPath(new URL('./src/entry.mjs', import.meta.url)),
            name: 'LmnVueDemo',
            formats: ['iife'],
            fileName: () => 'demo.js',
        },
        rolldownOptions: {
            external: ['vue'],
            output: { globals: { vue: 'Vue' }, codeSplitting: false },
        },
    },
});

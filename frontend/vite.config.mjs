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
});

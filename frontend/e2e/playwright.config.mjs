import { existsSync, readFileSync } from 'node:fs';
import { defineConfig } from '@playwright/test';
import { loadSettings } from './settings.mjs';

const authFile = new URL('./authconfig.json', import.meta.url);
const local = existsSync(authFile) ? JSON.parse(readFileSync(authFile, 'utf8')) : {};
export const settings = loadSettings(process.env, local);

export default defineConfig({
    testDir: '.',
    testMatch: '**/*.pw.mjs',
    workers: 1,
    retries: 0,
    forbidOnly: true,
    reporter: 'list',
    outputDir: './test-results',
    use: {
        browserName: 'chromium',
        baseURL: settings.baseURL,
        // lmn73 uses a self-signed certificate, also through the local tunnel.
        ignoreHTTPSErrors: true,
        actionTimeout: 15_000,
        navigationTimeout: 30_000,
        trace: 'off',
        screenshot: 'off',
        video: 'off',
    },
});

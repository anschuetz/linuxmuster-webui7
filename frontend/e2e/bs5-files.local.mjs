// Offline real Vue common-file fixtures. No VM, credentials or network.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { build } from 'vite';
import vue from '@vitejs/plugin-vue';
import { buildStyles } from '../static-assets.mjs';
const frontend = fileURLToPath(new URL('..', import.meta.url));
const output = process.argv[2]; assert.ok(output, 'Pass local log directory');
await mkdir(output, { recursive: true });
const previous = path => execFileSync('git', ['show', `4371b41d6:${path}`], { cwd: frontend, encoding: 'utf8' });
const css = { before: previous('usr/lib/linuxmuster-webui/plugins/lmn_common/resources/vue/styles.css'), after: await buildStyles(frontend) };
const components = ['FileDialog', 'FileEditorDialog', 'FileBackupsDialog', 'FileDiffDialog', 'PathSelector', 'LmLog', 'FileUpload', 'SmbUpload'];
const entry = `import { createApp, h } from 'vue';
import { createMockAj } from '${frontend}/src/adapter/mock.mjs';
import { createModalService } from '${frontend}/src/shell/modal.mjs';
import { openWait } from '${frontend}/src/common/wait.mjs';
${components.map(name => `import ${name} from '${frontend}/src/common/${name}.vue';`).join('\n')}
const scene = window.fixtureScene;
class Flow {
 constructor() { window.flow = this; this.handlers = new Map(); this.files = [{ uniqueIdentifier: 'fixture', name: 'synthetic.csv', progress: () => .42 }]; }
 on(event, fn) { this.handlers.set(event, [...(this.handlers.get(event) || []), fn]); }
 off(event, fn) { this.handlers.set(event, (this.handlers.get(event) || []).filter(f => f !== fn)); }
 fire(event, ...args) { for (const fn of this.handlers.get(event) || []) fn(...args); }
 assignBrowse() {} assignDrop() {} unAssignDrop() {} cancel() {} upload() {}
}
window.Flow = Flow;
const aj = createMockAj({ identity: { profile: { fs_root: '/fixture' } }, http: async request => {
 if (scene === 'file-error' || scene === 'editor-error') throw new Error('synthetic failure');
 if (request.url.includes('/list/')) return { data: { parent: '/fixture', items: [{ name: 'folder', path: '/fixture/folder', isDir: true }, { name: 'synthetic.csv', path: '/fixture/synthetic.csv', isFile: true, size: 1234 }, { name: '.synthetic.csv.bak.1700000000', isFile: true }] } };
 if (request.url.includes('/log')) return { data: 'Synthetic log entry\\n' };
 return { data: 'one,two\\n3,4' };
} });
aj.modal = createModalService(() => aj);
const sceneComponents = { file: FileDialog, 'file-hover': FileDialog, 'file-focus': FileDialog, 'file-active': FileDialog, 'file-error': FileDialog, save: FileDialog, editor: FileEditorDialog, 'editor-hover': FileEditorDialog, 'editor-focus': FileEditorDialog, 'editor-active': FileEditorDialog, 'editor-error': FileEditorDialog, backups: FileBackupsDialog, diff: FileDiffDialog, path: PathSelector, 'path-focus': PathSelector, 'path-red-focus': PathSelector, 'path-custom-red-focus': PathSelector, log: LmLog, upload: FileUpload, smb: SmbUpload, 'upload-error': FileUpload };
const component = sceneComponents[scene];
let app, wait;
if (scene === 'wait') { wait = openWait(aj, { status: 'Working', style: 'progressbar' }); wait.update(42); }
else if (['path','path-focus','path-red-focus','path-custom-red-focus','log','upload','smb','upload-error'].includes(scene)) {
 app = createApp({ render: () => h(component, { modelValue: '/fixture/synthetic.csv', path: '/fixture/log', uploadpath: '/fixture' }) }); app.provide('aj', aj); app.mount('#fixture');
} else aj.modal.open(component, { path: '/fixture/synthetic.csv', mode: scene === 'save' ? 'save' : 'open', lines: ['< old line', '> new line', '@ metadata'] }).catch(() => {});
window.fixture = { dispose() { app?.unmount(); aj.modal.dispose(); }, ready: true };
`;
const bundles = {};
for (const name of ['before', 'after']) {
    const result = await build({ root: frontend, configFile: false, logLevel: 'error', plugins: [{ name: 'fixture-source', enforce: 'pre',
        resolveId(id) { if (id === 'fixture-entry') return '\0fixture-entry'; },
        load(id) {
            if (id === '\0fixture-entry') return entry;
            if (name === 'before' && id.startsWith(join(frontend, 'src/common/')) && /\.(vue|mjs)$/.test(id) && !id.includes('?')) return previous('frontend/' + id.slice(frontend.length));
        } }, vue()],
        build: { write: false, target: 'esnext', minify: false, rolldownOptions: { input: 'fixture-entry', output: { format: 'es', inlineDynamicImports: true } } } });
    bundles[name] = result.output[0].code;
}
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null;
const browser = await chromium.launch({ headless: true });
const results = [];
try {
    for (const scene of ['file','file-hover','file-focus','file-active','file-error','save','editor','editor-hover','editor-focus','editor-active','editor-error','backups','diff','path','path-focus','path-red-focus','path-custom-red-focus','log','upload','smb','upload-error','wait']) {
        if (only && !only.includes(scene)) continue;
        for (const [width, height] of [[1440,900],[768,1024],[390,844]]) {
            const shots = [], states = [];
            for (const name of ['before','after']) {
                const page = await browser.newPage({ viewport: { width, height }, timezoneId: 'UTC', locale: 'en-GB' });
                await page.route('**/*', route => route.abort());
                await page.setContent('<!doctype html><html><body class="customized"><div id="fixture" style="padding:20px"></div></body></html>');
                await page.addStyleTag({ content: css[name] });
                if (scene.includes('red-focus')) await page.evaluate(customized => { document.body.className = 'global-color-red' + (customized ? ' customized' : ''); }, scene.includes('custom'));
                await page.evaluate(scene => { window.fixtureScene = scene; }, scene);
                await page.addScriptTag({ type: 'module', content: bundles[name] });
                await page.waitForFunction(() => window.fixture?.ready);
                if (['upload','smb','upload-error'].includes(scene)) {
                    await page.evaluate(scene => { window.flow.fire('filesSubmitted'); window.flow.fire(scene === 'upload-error' ? 'fileError' : 'fileProgress', window.flow.files[0], 'synthetic failure'); }, scene);
                }
                await page.waitForTimeout(scene === 'log' ? 1100 : 800);
                await page.evaluate(() => document.activeElement?.blur());
                await page.mouse.move(width - 1, height - 1);
                if (scene.startsWith('path') && scene.endsWith('focus')) await page.locator('input').focus();
                if (scene === 'file-hover') await page.locator('[data-path]').first().hover();
                if (scene === 'file-focus') await page.locator('[data-path]').first().focus();
                if (scene === 'editor-hover') await page.locator('.modal-footer button').last().hover();
                if (scene === 'editor-focus') await page.locator('.modal-footer button').last().focus();
                if (scene.endsWith('-active')) {
                    await page.locator(scene.startsWith('file') ? '[data-path]' : '.modal-footer button').last().hover();
                    await page.mouse.down();
                }
                await page.waitForTimeout(350);
                shots.push(await page.screenshot({ path: join(output, `${scene}-${width}-${name}.png`) }));
                states.push(await page.locator('.modal-dialog, .modal-header, .modal-body, .modal-footer, button, input, textarea, pre, [role=progressbar], .input-group > span, [data-drop]').evaluateAll(elements => elements.map(el => {
                    const rect = el.getBoundingClientRect(), style = getComputedStyle(el);
                    return { tag: el.tagName, text: el.textContent, x: rect.x, y: rect.y, width: rect.width, height: rect.height,
                        color: style.color, background: style.backgroundColor, padding: style.padding, margin: style.margin, lineHeight: style.lineHeight, border: style.border, borderRadius: style.borderRadius, boxShadow: style.boxShadow, opacity: style.opacity, fontSize: style.fontSize, display: style.display, position: style.position, fontWeight: style.fontWeight, textAlign: style.textAlign };
                })));
                await page.evaluate(() => window.fixture.dispose());
                await page.close();
            }
            results.push({ scene, width, equal: shots[0].equals(shots[1]), geometryEqual: JSON.stringify(states[0]) === JSON.stringify(states[1]), before: states[0], after: states[1] });
        }
    }
} finally { await browser.close(); }
await writeFile(join(output, 'metadata.json'), JSON.stringify({ reference: '4371b41d6', cssSha256: Object.fromEntries(Object.entries(css).map(([key,value]) => [key, createHash('sha256').update(value).digest('hex')])) }, null, 2) + '\n');
await writeFile(join(output, 'comparison.json'), JSON.stringify(results, null, 2) + '\n');
console.log(`${results.filter(r => r.equal).length}/${results.length} PNG pairs identical; ${results.filter(r => r.geometryEqual).length} identical style/geometry snapshots`);
assert.ok(results.every(result => result.equal && result.geometryEqual), 'Inspect comparison.json');

// Offline real Vue common-user fixtures. No VM, credentials or network.
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
const previous = path => execFileSync('git', ['show', `78cfb5e48:${path}`], { cwd: frontend, encoding: 'utf8' });
const css = { before: previous('usr/lib/linuxmuster-webui/plugins/lmn_common/resources/vue/styles.css'), after: await buildStyles(frontend) };
const entry = `import { createApp, h } from 'vue';
import { createMockAj } from '${frontend}/src/adapter/mock.mjs';
import { users, config } from '${frontend}/e2e/fixtures/users_2.mjs';
import UsersTable from '${frontend}/src/plugins/lmn_users/UsersTable.vue';
import AdminsTable from '${frontend}/src/plugins/lmn_users/AdminsTable.vue';
import ExtrasTable from '${frontend}/src/plugins/lmn_users/ExtrasTable.vue';
const scene = window.fixtureScene;
const aj = createMockAj({ http: async r => {
 if(r.method !== 'get') throw Error('Fixture prohibits writes');
 if(r.url.includes('customfields')) return {data:config()};
 if(r.url.includes('schoolsettings')) return {data:{}};
 if(r.url.includes('bindusers')) return {data:[{sAMAccountName:'bind-fixture',givenName:'Synthetic',sn:'Bind',DN:'CN=bind-fixture-with-a-very-long-synthetic-distinguished-name-for-mobile-overflow,OU=Management,OU=GLOBAL,DC=linuxmuster,DC=lan',sophomorixComment:'Synthetic comment',pw:true}]};
 if(r.url.includes('/lists/')) return {data:[{class:'synthetic-class',first_name:'Synthetic',last_name:'User',birthday:scene.includes('invalid')?'':'01.01.2001',login:scene.includes('invalid')?'':'fixture',course:'synthetic-course',base_name:'fixture',count:'5',gecos:'Synthetic course'}]};
 if(r.url.includes('usermap')) return {data:{[r.url.split('/').at(-1)]:{USED:75,TYPE:'warning'}}};
 return {data:scene.startsWith('admins') ? users('staff').slice(0,1) : users(scene.split('-')[0])};
},modal:{open:async()=>{throw Error('cancel');}} });
const component=scene.startsWith('admins')?AdminsTable:scene.startsWith('extras')?ExtrasTable:UsersTable;
const props=component===AdminsTable?{level:scene.includes('school')?'school':'global'}:component===ExtrasTable?{kind:scene.includes('courses')?'courses':'students'}:{role:scene.split('-')[0]};
const app=createApp({render:()=>h(component,props)});app.provide('aj',aj);app.mount('#fixture');
window.fixture={ready:true,dispose(){app.unmount();}};
`;
const bundles = {};
for (const name of ['before', 'after']) {
    const result = await build({ root: frontend, configFile: false, logLevel: 'error', plugins: [{ name: 'fixture-source', enforce: 'pre',
        resolveId(id) { if (id === 'fixture-entry') return '\0fixture-entry'; },
        load(id) {
            if (id === '\0fixture-entry') return entry;
            if (name === 'before' && id.startsWith(join(frontend, 'src/plugins/lmn_users/')) && /\.(vue|mjs)$/.test(id) && !id.includes('?')) return previous('frontend/' + id.slice(frontend.length));
        } }, vue()],
        build: { write: false, target: 'esnext', minify: false, rolldownOptions: { input: 'fixture-entry', output: { format: 'es', inlineDynamicImports: true } } } });
    bundles[name] = result.output[0].code;
}
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null;
const theme = process.env.C10_THEME ?? 'customized';
const browser = await chromium.launch({ headless: true });
const results = [];
try {
    for (const scene of ['students','students-attic','teachers','teachers-quotas','staff','parents','admins-global','admins-school','extras-students','extras-courses','extras-invalid', 'students-sort', 'students-rows', 'students-password', 'admins-global-password', 'admins-global-rows', 'students-batch', 'students-hover', 'students-focus','students-active','students-space','students-tab-focus','students-active-tab-focus','students-tab-hover','students-active-tab-hover', ...['admins-global','extras-students','extras-courses'].flatMap(name=>['hover','focus','active','space','sort'].map(state=>name+'-'+state))]) {
        if (only && !only.includes(scene)) continue;
        for (const [width, height] of [[1440,900],[768,1024],[390,844]]) {
            const shots = [], states = [];
            for (const name of ['before','after']) {
                const page = await browser.newPage({ viewport: { width, height }, timezoneId: 'UTC', locale: 'en-GB' });
                await page.route('**/*', route => route.abort());
                await page.setContent(`<!doctype html><html><body class="${theme}"><div id="fixture" style="padding:20px"></div></body></html>`);
                await page.addStyleTag({ content: css[name] });
                await page.evaluate(scene => { window.fixtureScene = scene; }, scene);
                await page.addScriptTag({ type: 'module', content: bundles[name] });
                await page.waitForFunction(() => window.fixture?.ready);
                await page.waitForTimeout(800);
                const visible = page.locator('[data-section]:visible');
                if(scene==='students-attic') await page.locator('[data-tab=attic]').click();
                if(scene==='teachers-quotas') await page.locator('[data-action=quotas]').click();
                if(scene==='students-sort') await visible.locator('[data-action=sort-menu]').click();
                if(scene==='students-rows') await visible.locator('[data-action=rows-menu]').click();
                if(scene==='admins-global-rows') await page.locator('[data-action=rows]').click();
                if(scene==='students-password') await visible.locator('[data-action^=password-]').first().click();
                if(scene==='admins-global-password') await page.locator('table .dropup button').first().click();
                if(scene==='students-batch') {await visible.locator('thead input').check();await visible.locator('[data-action=batch-menu]').click();}
                await page.evaluate(() => document.activeElement?.blur());
                await page.mouse.move(width - 1, height - 1);
                const button=page.locator('.c10-menu-control button, .input-group-btn button').first();
                if(scene.endsWith('-sort') && !scene.startsWith('students')) await button.click();
                if(scene.endsWith('-hover') && !scene.includes('-tab-')) await button.hover();
                if(scene.endsWith('-focus') && !scene.includes('-tab-') || scene.endsWith('-space')) await button.focus();
                if(scene.endsWith('-space')) await page.keyboard.down(' ');
                if(scene.endsWith('-active')) {await button.hover();await page.mouse.down();}
                if(scene.endsWith('tab-focus')) {
                    // Legacy anchors have no href/tabindex. Enable focus in both fixtures only to compare their focused CSS.
                    const tab=page.locator(scene.includes('active-tab')?'[data-tab=students]':'[data-tab=attic]');
                    await tab.evaluate(el=>el.tabIndex=0); await page.keyboard.press('Tab'); await tab.focus();
                    assert.ok(await tab.evaluate(el=>el.matches(':focus-visible')), 'Tab focus must be exercised');
                }
                if(scene.endsWith('tab-hover')) await page.locator(scene.includes('active-tab')?'[data-tab=students]':'[data-tab=attic]').hover();
                await page.waitForTimeout(350);
                if(name==='after' && width===390 && scene==='students-password') {
                    const reachable = await page.locator('.c10-table-scroll .dropdown-menu a').evaluateAll(items => items.length===5 && items.every(el => {
                        const r=el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
                    }));
                    assert.ok(reachable,'D10: every password menu option must remain clickable');
                }
                shots.push(await page.screenshot({ path: join(output, `${scene}-${width}-${name}.png`) }));
                states.push(await page.locator('button, input, table, th, td, .progress-bar, .badge, .label, .nav-tabs a, .dropdown-menu, .dropdown-menu a, .pagination a, .input-group-addon, .c10-addon').evaluateAll(elements => elements.map(el => {
                    const rect = el.getBoundingClientRect(), style = getComputedStyle(el);
                    return { tag: el.tagName, text: el.textContent, x: rect.x, y: rect.y, width: rect.width, height: rect.height,
                        color: style.color, background: style.backgroundColor, padding: style.padding, margin: style.margin, lineHeight: style.lineHeight, border: style.border, borderRadius: style.borderRadius, boxShadow: style.boxShadow, opacity: style.opacity, fontSize: style.fontSize, display: style.display, position: style.position, fontWeight: style.fontWeight, textAlign: style.textAlign, focusVisible: el.matches(':focus-visible'), active: el.matches(':active') };
                })));
                if (name === 'after' && width === 390 && ['students','teachers','extras-students','extras-courses'].includes(scene)) {
                    const scroll = page.locator('.c10-table-scroll:visible').first();
                    const reach = await scroll.evaluate(el => { el.scrollLeft = el.scrollWidth; return {left:el.scrollLeft,width:el.clientWidth,total:el.scrollWidth}; });
                    assert.ok(reach.left > 0, 'D10: columns must scroll inside the viewport');
                    await page.screenshot({ path: join(output, scene + '-390-scrolled.png') });
                }
                await page.evaluate(() => window.fixture.dispose());
                await page.close();
            }
            results.push({ scene, width, equal: shots[0].equals(shots[1]), geometryEqual: JSON.stringify(states[0]) === JSON.stringify(states[1]), before: states[0], after: states[1] });
        }
    }
} finally { await browser.close(); }
await writeFile(join(output, 'metadata.json'), JSON.stringify({ reference: '78cfb5e48', cssSha256: Object.fromEntries(Object.entries(css).map(([key,value]) => [key, createHash('sha256').update(value).digest('hex')])) }, null, 2) + '\n');
await writeFile(join(output, 'comparison.json'), JSON.stringify(results, null, 2) + '\n');
console.log(`${results.filter(r => r.equal).length}/${results.length} PNG pairs identical; ${results.filter(r => r.geometryEqual).length} identical style/geometry snapshots`);
// Mobile D10/D11 are classified separately; desktop/tablet must remain pixel-identical.
assert.ok(results.filter(r=>r.width>=768).every(r=>r.equal), 'Inspect desktop/tablet comparison.json');

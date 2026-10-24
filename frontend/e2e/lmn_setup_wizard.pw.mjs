import { expect, test } from '@playwright/test';
import { settings } from './playwright.config.mjs';
test.setTimeout(120_000);
const admin = settings.roles.find(r => r.name === 'global-admin');
const roles = [admin, { name: 'school-admin', login: 'pgmadmin', pw: admin.pw }, settings.roles.find(r => r.name === 'teacher'), { name: 'student', login: 'serdarje', pw: admin.pw }];
const setupURL = '/api/lmn/setup-wizard/setup', provisionURL = '/api/lmn/setup-wizard/provision';
const write = req => !['GET', 'HEAD', 'OPTIONS'].includes(req.method()) && /^(\/api\/lmn\/setup-wizard\/|\/api\/core\/(config|restart-master)(\/|$))/.test(new URL(req.url()).pathname);
const fixture = { schoolname: 'P71 Test School', location: 'Test City', state: 'Test State', country: 'de', servername: 'p71-server', domainname: 'linuxmuster.lan', skipfw: 'False' };
const dialog = page => page.locator('.modal:visible').last();
const next = page => dialog(page).getByText('Weiter', { exact: true });
async function navigate(page, step) {
 await page.evaluate(step => { const i = angular.element(document).injector(); i.get('$rootScope').$evalAsync(() => i.get('$location').path('/view/lmn/init/' + step)); }, step);
 await expect(page).toHaveURL(new RegExp('/view/lmn/init/' + step + '$'));
 await expect(dialog(page).locator('h3').first()).toBeVisible();
}
async function harness(page, context) {
 const state = { errors: [], blocked: [], posts: [], ini: { ...fixture }, statusReads: [], configured: true, provision: 'ok', hold: null };
 page.on('pageerror', e => state.errors.push(e.message));
 page.on('console', m => { if (m.type() === 'error' && !/401 \((Unauthorized|Unauthenticated)\)/.test(m.text())) state.errors.push(m.text()); });
 // Independent final guard: a missing fixture aborts BEFORE any backend write.
 await context.route('**/*', async route => {
  if (write(route.request())) { state.blocked.push(route.request().url()); await route.abort('blockedbyclient'); }
  else await route.continue();
 });
 page.on('response', response => { if (write(response.request()) && response.headers()['x-p71-fixture'] !== 'yes') state.blocked.push('UNMOCKED ' + response.url()); });
 await page.route('**/api/**', async route => {
  const req = route.request(), path = new URL(req.url()).pathname;
  const reply = json => route.fulfill({ json, contentType: 'application/json', headers: { 'x-p71-fixture': 'yes' } });
  if (path === '/api/lmn/setup-wizard/is-configured') { state.statusReads.push(state.configured); return reply(state.configured); }
  if (path === setupURL) {
   if (req.method() === 'GET') return reply(state.ini);
   state.posts.push([path, req.postDataJSON()]); state.ini = { ...state.ini, ...req.postDataJSON() }; return reply(null);
  }
  if (path === provisionURL) {
   state.posts.push([path, req.postDataJSON()]); if (state.hold) await state.hold;
   if (state.provision === 'fail') return route.fulfill({ status: 500, json: { exception: 'EndpointError', message: 'P71 provision rejected' }, headers: { 'x-p71-fixture': 'yes' } });
   return reply(null);
  }
  if (path === '/api/core/config' && req.method() === 'POST') { state.posts.push([path, req.postDataJSON()]); return reply(null); }
  if (path === '/api/core/restart-master') { state.posts.push([path, req.postData() ?? null]); return reply(null); }
  if (path === '/api/lmn/read-config-setup') return reply({ setup: { hostip: '192.0.2.71', servername: 'p71-server', domainname: 'linuxmuster.lan' } });
  if (path === '/api/lmn/log/tmp/linuxmuster-setup.log') return route.fulfill({ body: 'P71 synthetic setup log\n' });
  return route.fallback();
 });
 return state;
}
async function login(page, role) {
 await page.goto('/'); await page.locator('input[ng\\:model="username"]').fill(role.login);
 await page.locator('input[type=password][ng\\:model="password"]').fill(role.pw);
 await page.locator('a[ng\\:click^="login"]').click();
 await expect(page.locator('h2').filter({ hasText: /Linuxmuster\.net/i }).first()).toBeVisible();
}
for (const role of roles) test(`${role.name}: wizard has no additional role gate; unconfigured redirect`, async ({ page, context }) => {
 const state = await harness(page, context); await login(page, role);
 const real = await context.request.get('/api/lmn/setup-wizard/is-configured'); expect(real.status()).toBe(200); expect(await real.json()).toBe(true);
 expect((await context.request.get(setupURL)).status()).toBe(200);
 await navigate(page, 'school'); await expect(dialog(page).locator('#schoolname-input')).toHaveValue(fixture.schoolname);
 state.configured = false; await page.reload(); await expect(page).toHaveURL(/\/view\/lmn\/init\/welcome$/);
 await expect(dialog(page)).toContainText('Willkommen zu Linuxmuster.net V7');
 expect(state.posts).toEqual([]); expect(state.blocked).toEqual([]); expect(state.errors).toEqual([]);
});
test('seven routes: language, validation, exact payloads, summary, synthetic provision/log/restart/redirect', async ({ page, context }) => {
 const state = await harness(page, context); await login(page, admin); await navigate(page, 'welcome');
 await next(page).click(); await expect(page.locator('.toast-title').last()).toContainText('Please accept the license !'); expect(state.posts).toEqual([]);
 await dialog(page).locator('select').selectOption('en'); await expect(dialog(page)).toContainText('Welcome to linuxmuster.net V7');
 await dialog(page).locator('select').selectOption('de'); await expect(dialog(page)).toContainText('Willkommen zu Linuxmuster.net V7');
 await dialog(page).locator('input[type=checkbox]').check(); await next(page).click(); await expect(page).toHaveURL(/\/school$/);
 await dialog(page).locator('#schoolname-input').fill(''); await next(page).click(); await expect(page.locator('.toast-title').last()).toContainText('Required data missing');
 await dialog(page).locator('#schoolname-input').fill(' P71 Test School '); await dialog(page).locator('#servername-input').fill('bad name'); await next(page).click(); await expect(page.locator('.toast-title').last()).toContainText('Malformed input');
 await dialog(page).locator('#servername-input').fill('p71-server'); await dialog(page).locator('#location-input').fill(' Test City '); await next(page).click(); await expect(page).toHaveURL(/\/account$/);
 const passwords = dialog(page).locator('input[type=password]');
 await passwords.nth(0).fill('weak'); await passwords.nth(1).fill('different'); await next(page).click(); await expect(page.locator('.toast-title').last()).toContainText('Administrator password missmatch');
 await passwords.nth(1).fill('weak'); await next(page).click(); await expect(page.locator('.toast-title').last()).toContainText('Password too weak');
 await passwords.nth(0).fill('P71Dummy!'); await passwords.nth(1).fill('P71Dummy!'); await next(page).click(); await expect(page).toHaveURL(/\/externalservices$/);
 await dialog(page).locator('[checkbox],input[type=checkbox]').click(); await next(page).click(); await expect(page).toHaveURL(/\/summary$/);
 await expect(dialog(page)).toContainText('P71 Test School'); await expect(dialog(page)).toContainText('p71-server.linuxmuster.lan');
 const external = { ...fixture, adminpw: 'P71Dummy!', skipfw: false, opsiip: 'null', dockerip: 'null', mailip: 'null', smtprelay: 'null', smtpuser: 'null', smtppw: 'null' };
 expect(state.posts.slice(1)).toEqual([[setupURL, fixture], [setupURL, { adminpw: 'P71Dummy!' }], [setupURL, external]]);
 expect(state.posts[0][0]).toBe('/api/core/config'); expect(state.posts[0][1].language).toBe('de');
 let release; state.hold = new Promise(resolve => { release = resolve; });
 await dialog(page).getByText('Bereitstellung starten', { exact: true }).click(); await expect(page).toHaveURL(/\/setup$/);
 await expect(dialog(page).getByText('Beenden', { exact: true })).toBeHidden(); await expect(dialog(page).locator('pre')).toContainText('P71 synthetic setup log'); release();
 await expect(dialog(page).getByText('Beenden', { exact: true })).toBeVisible(); expect(state.posts.slice(-2)).toEqual([[setupURL, external], [provisionURL, { start: 'setup' }]]);
 await dialog(page).getByText('Beenden', { exact: true }).click(); await expect(page).toHaveURL(/\/done$/);
 await page.route(/^https:\/\/192\.0\.2\.71(?::\d+)?\//, route => route.fulfill({ body: 'P71 intercepted redirect' }));
 await dialog(page).getByText('Schließen', { exact: true }).click(); await expect(page).toHaveURL(/^https:\/\/192\.0\.2\.71:/, { timeout: 15000 });
 expect(state.posts.at(-1)).toEqual(['/api/core/restart-master', null]); expect(state.blocked).toEqual([]); expect(state.errors).toEqual([]);
});
test('provision failure releases Finish and uses backend message', async ({ page, context }) => {
 const state = await harness(page, context); await login(page, admin); state.provision = 'fail'; await navigate(page, 'setup');
 await expect(page.locator('.toast-title').last()).toContainText('P71 provision rejected'); await expect(dialog(page).getByText('Beenden', { exact: true })).toBeVisible();
 expect(state.posts).toEqual([[provisionURL, { start: 'setup' }]]); expect(state.blocked).toEqual([]);
 expect(state.errors.filter(e => !/500 \(INTERNAL SERVER ERROR\)|500 \(Internal Server Error\)/i.test(e))).toEqual([]);
});

test('unauthenticated API denied and a final guard against missing write fixtures', async ({ page, context }) => {
 const status = await context.request.get('/api/lmn/setup-wizard/is-configured'); expect(status.status()).toBe(401);
 expect((await context.request.get(setupURL)).status()).toBe(401);
 const state = await harness(page, context); await page.goto('/');
 await page.evaluate(async () => { try { await fetch('/api/lmn/setup-wizard/p71-unexpected-write', { method: 'POST' }); } catch {} });
 expect(state.blocked.map(url => new URL(url).pathname)).toEqual(['/api/lmn/setup-wizard/p71-unexpected-write']); expect(state.posts).toEqual([]);
});

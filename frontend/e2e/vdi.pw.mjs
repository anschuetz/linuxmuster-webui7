import { expect, test } from '@playwright/test';
import { settings } from './playwright.config.mjs';
const admin = settings.roles.find(r => r.name === 'global-admin');
const roles = [admin, { name: 'school-admin', login: 'pgmadmin', pw: admin.pw }, settings.roles.find(r => r.name === 'teacher'), { name: 'student', login: 'serdarje', pw: admin.pw }];
const masters = {
 ZGroup: { group: 'ZGroup', room: 'P60Room', hostname: 'p60-master', ip: '192.0.2.60', mac: '02:00:00:00:00:60', pxe: 1, actual_imagesize: '8G', master_vms: { 601: { name: 'P60Master', status: 'running', cloop: 'p60.cloop', buildstate: 'ready', ostype: 'linux', imagesize: '8G', dateOfCreation: '2026-10-24', memory: 4096, cores: 2, bios: 'seabios', scsi0: 'p60disk', scsihw: 'virtio', audio0: 'spice', vga: 'qxl', net0: 'p60net', usb0: 'spice', spice_enhancements: 'foldersharing=1' }, 602: null } },
 AGroup: { group: 'AGroup', hostname: 'p60-other', pxe: 0, master_vms: {} },
};
const clones = {
 ZGroup: { summary: { available_vms: 1 }, clone_vms: { 611: { group: 'ZGroup', room: 'P60Room', hostname: 'p60-clone', ip: '192.0.2.61', mac: '02:00:00:00:00:61', user: '' } } },
 AGroup: { summary: { available_vms: 0 }, clone_vms: { 612: { group: 'AGroup', hostname: 'p60-clone2', user: 'P60synthetic' } } },
};
function listen(page) {
 const state = { errors: [], authenticated: false };
 page.on('pageerror', e => state.errors.push(e.message));
 page.on('console', m => { if (m.type() === 'error' && !(!state.authenticated && /401 \((Unauthorized|Unauthenticated)\)/.test(m.text()))) state.errors.push(m.text()); });
 return state;
}
async function login(page, role, state) {
 await page.goto('/');
 await page.locator('input[ng\\:model="username"]').fill(role.login);
 await page.locator('input[type=password][ng\\:model="password"]').fill(role.pw);
 await page.locator('a[ng\\:click^="login"]').click();
 await expect(page.locator('h2').filter({ hasText: /Linuxmuster\.net/i }).first()).toBeVisible();
 state.authenticated = true;
}
// Use the shell router; document reloads race unrelated Socket.IO polling on E.
async function navigate(page, path) {
 await page.evaluate(path => {
  const i = angular.element(document).injector();
  i.get('$rootScope').$evalAsync(() => i.get('$location').path(path));
 }, path);
 await expect(page).toHaveURL(new RegExp(path + '$'));
}
const tab = page => page.getByText(/^(All VMs|Alle VMs)$/);
const modal = page => page.locator('.modal:visible');
for (const role of roles) test(`${role.name}: real authorization, cards, download, tables and dialogs`, async ({ page }) => {
 const state = listen(page); await login(page, role, state);
 for (const endpoint of ['masterVMs', 'clones']) {
  const response = await page.request.get('/api/lmn/vdi/administration/' + endpoint);
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: 'error', message: 'VDI Tools not installed!' });
 }
 const calls = [];
 await page.route('**/api/lmn/vdi/**', route => {
  const path = new URL(route.request().url()).pathname;
  calls.push({ method: route.request().method(), path });
  if (path.includes('/download/')) return route.fulfill({ headers: { 'Content-Disposition': 'attachment; filename="vdi-session.vv"' }, contentType: 'application/x-virt-viewer', body: '[virt-viewer]\ntype=spice\n# P60 synthetic' });
  return route.fulfill({ json: path.includes('/vdiSession/') ? 'p60-session.vv' : { status: 'success', data: path.endsWith('masterVMs') ? masters : clones } });
 });
 await navigate(page, '/view/lmn_vdi_dashboard');
 const card = name => page.locator('.list-group-item').filter({ hasText: name });
 await expect(page.getByRole('heading', { name: 'VDI-Gruppen', exact: true })).toBeVisible();
 await expect(card('ZGroup')).toContainText('Verfügbare VMs:');
 await expect(card('ZGroup')).toContainText('1'); await expect(card('AGroup')).toContainText('0');
 await expect(card('AGroup').locator('a:visible')).toHaveCount(0);
 const downloadPromise = page.waitForEvent('download'); await card('ZGroup').locator('a:visible').click();
 expect((await downloadPromise).suggestedFilename()).toBe('vdi-session.vv');
 expect(calls.filter(c => /vdiSession|download/.test(c.path))).toEqual([
  { method: 'GET', path: '/api/lmn/vdi/dashboard/vdiSession/ZGroup' },
  { method: 'GET', path: '/api/lmn/vdi/dashboard/download/p60-session.vv' },
 ]);
 await navigate(page, '/view/lmn_vdi_administration');
 await expect(page.getByRole('button', { name: '602', exact: true })).toBeDisabled();
 await page.getByRole('cell', { name: 'ZGroup', exact: true }).click();
 await expect(modal(page)).toContainText('Gruppe:'); await expect(modal(page)).toContainText('P60Room'); await expect(modal(page)).toContainText('8G');
 await modal(page).getByText('OK', { exact: true }).click();
 await page.getByRole('button', { name: '601', exact: true }).click();
 for (const value of ['P60Master', 'p60.cloop', '4096', 'p60net', 'foldersharing=1']) await expect(modal(page)).toContainText(value);
 await expect(modal(page)).toContainText('Arbeitsspeicher');
 await page.keyboard.press('Escape'); await expect(modal(page)).toHaveCount(0);
 await tab(page).click();
 await expect(page.getByRole('row').filter({ hasText: 'p60-clone' }).first()).toContainText('611');
 await expect(page.getByRole('row').filter({ hasText: 'P60synthetic' })).toContainText('612');
 expect(state.errors).toEqual([]);
});
test('missing tools notify and clear both lists', async ({ page }) => {
 const state = listen(page); await login(page, admin, state);
 await page.route('**/api/lmn/vdi/administration/*', route => route.fulfill({ json: { status: 'error', message: 'P60 VDI tools unavailable' } }));
 await navigate(page, '/view/lmn_vdi_dashboard');
 await expect(page.locator('.toast-message,.toast-title').filter({ hasText: 'P60 VDI tools unavailable' }).first()).toBeVisible();
 await expect(page.locator('.list-group-item').filter({ hasText: 'ZGroup' })).toHaveCount(0);
 await navigate(page, '/view/lmn_vdi_administration'); await tab(page).click();
 await expect(page.locator('td')).toHaveCount(0); expect(state.errors).toEqual([]);
});

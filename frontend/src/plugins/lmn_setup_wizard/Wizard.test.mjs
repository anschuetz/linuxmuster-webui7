import { afterEach, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import Wizard from './Wizard.vue';
import { mount as entry, configure } from './entry.mjs';
import { connectCore } from './core.mjs';
import { redirect, setupURL } from './browser.mjs';
vi.mock('./browser.mjs', async original => ({ ...await original(), redirect: vi.fn() }));
const url = '/api/lmn/setup-wizard/setup';
const ini = { schoolname: 'Test School', location: 'Test City', state: 'BW', country: 'de', servername: 'server', domainname: 'lmn.lan', skipfw: 'False' };
const wrappers = [];
function setup(step, options = {}) {
 const aj = { gettext: s => s, pageTitle: { set: vi.fn() }, navigate: vi.fn(), reload: vi.fn(), notify: { error: vi.fn(), success: vi.fn() },
  http: { get: vi.fn(async path => ({ data: path === url ? { ...ini } : path === '/api/core/languages' ? ['de', 'en'] : { setup: { hostip: '192.0.2.71' } } })), post: vi.fn(async () => ({})) },
  wizard: { readConfig: () => ({ language: 'de', other: 'keep' }), saveConfig: vi.fn(async () => ({})), setLanguage: vi.fn() },
  messagebox: { show: vi.fn(() => Object.assign(Promise.resolve(), { close: vi.fn() })) }, ...options };
 const w = mount(Wizard, { props: { step }, global: { provide: { aj } }, attachTo: document.body }); wrappers.push(w); return { w, aj };
}
const click = (w, text) => w.findAll('a').find(a => a.text() === text).trigger('click');
afterEach(() => { wrappers.splice(0).forEach(w => w.unmount()); document.body.innerHTML = ''; vi.useRealTimers(); });
it('welcome preserves the full GPL, requires acceptance, loads languages and saves before navigating', async () => {
 const { w, aj } = setup('welcome'); await flushPromises();
 expect(w.text()).toContain('17. Interpretation of Sections 15 and 16.');
 expect(w.findAll('option').map(x => x.text())).toEqual(['de', 'en']);
 await click(w, 'Next'); expect(aj.notify.error.mock.calls).toEqual([['Please accept the license !']]); expect(aj.wizard.saveConfig.mock.calls).toEqual([]);
 await w.find('input[type=checkbox]').setValue(true); await click(w, 'Next'); await flushPromises();
 expect(aj.wizard.saveConfig.mock.calls).toEqual([[{ language: 'de', other: 'keep' }]]); expect(aj.navigate.mock.calls).toEqual([['/view/lmn/init/school']]);
 await w.find('select').setValue('en'); expect(aj.wizard.setLanguage.mock.calls).toEqual([['en']]); expect(aj.reload.mock.calls).toEqual([[]]);
});
it('school uses trimmed text without eating inner spaces and exact original full ini payload', async () => {
 const { w, aj } = setup('school'); await flushPromises(); const input = w.find('#schoolname-input'); await input.setValue(''); input.element.focus();
 for (const char of ' Test School ') { input.element.value += char; await input.trigger('input'); }
 expect(input.element.value).toBe(' Test School '); await click(w, 'Next'); await flushPromises();
 expect(aj.http.post.mock.calls).toEqual([[url, ini]]); expect(aj.navigate.mock.calls).toEqual([['/view/lmn/init/account']]);
});
it('school keeps empty/pattern checks, red highlights and resets them on input', async () => {
 const { w, aj } = setup('school'); await flushPromises(); await w.find('#schoolname-input').setValue(''); await click(w, 'Next');
 expect(aj.notify.error.mock.calls).toEqual([['Required data missing']]); expect(w.find('#schoolname-input').element.style.borderColor).toBe('red');
 await w.find('#schoolname-input').setValue('School'); expect(w.find('#schoolname-input').element.style.borderColor).toBe('');
 await w.find('#servername-input').setValue('bad name'); await click(w, 'Next'); expect(aj.notify.error.mock.calls.at(-1)).toEqual(['Malformed input']);
 await w.find('#servername-input').setValue('server'); await w.find('#domainname-input').setValue('bad123.lan'); await click(w, 'Next'); expect(aj.http.post.mock.calls).toEqual([]);
});
it('school keeps its initial defaults and no summary on failed loading', async () => {
 const http = { get: vi.fn(() => Promise.reject({})), post: vi.fn() };
 const { w } = setup('school', { http }); await flushPromises(); expect(w.find('#schoolname-input').element.value).toBe('');
 const summary = setup('summary', { http }); await flushPromises(); expect(summary.w.text()).not.toContain('Start provisioning'); expect(summary.w.find('.progress-spinner').exists()).toBe(true);
});
it('account preserves password whitespace and all original mismatch/invalid/strength checks', async () => {
 const { w, aj } = setup('account'); const fields = w.findAll('input[type=password]');
 for (const [value, repeat, error] of [['weak','different','Administrator password missmatch'],['bad?Pass7','bad?Pass7','Password contains invalid characters'],['weak','weak','Password too weak'],[' P71Dummy! ',' P71Dummy! ','Password contains invalid characters']]) {
  await fields[0].setValue(value); await fields[1].setValue(repeat); await click(w, 'Next'); expect(aj.notify.error.mock.calls.at(-1)).toEqual([error]);
 }
 await fields[0].setValue('P71Dummy!'); await fields[1].setValue('P71Dummy!'); await click(w, 'Next'); await flushPromises();
 expect(aj.http.post.mock.calls).toEqual([[url, { adminpw: 'P71Dummy!' }]]); expect(aj.navigate.mock.calls).toEqual([['/view/lmn/init/externalservices']]);
});
it('account keeps the # hint/apply discrepancy and clickable disabled-looking anchor', async () => {
 const { w, aj } = setup('account'); const fields = w.findAll('input'); await fields[0].setValue('P71Dummy#'); await fields[1].setValue('P71Dummy#');
 expect(w.text()).toContain('Password contains invalid characters'); await click(w, 'Next'); await flushPromises(); expect(aj.http.post.mock.calls).toEqual([[url, { adminpw: 'P71Dummy#' }]]);
});
it('external services keeps string checkbox truthiness and disabled service deletion strings', async () => {
 const { w, aj } = setup('externalservices'); await flushPromises(); expect(w.find('[checkbox]').classes()).toContain('active'); await w.find('[checkbox]').trigger('click'); await click(w, 'Next'); await flushPromises();
 expect(aj.http.post.mock.calls).toEqual([[url, { ...ini, skipfw: false, opsiip: 'null', dockerip: 'null', mailip: 'null', smtprelay: 'null', smtpuser: 'null', smtppw: 'null' }]]); expect(aj.navigate.mock.calls).toEqual([['/view/lmn/init/summary']]);
});
it('summary compares firewall to string True and resubmits the entire unchanged ini', async () => {
 const { w, aj } = setup('summary'); expect(w.find('.progress-spinner').exists()).toBe(true); await flushPromises(); expect(w.text()).toContain('server.lmn.lan'); expect(w.text()).toContain('Firewall will be configured!'); await click(w, 'Start provisioning'); await flushPromises();
 expect(aj.http.post.mock.calls).toEqual([[url, ini]]); expect(aj.navigate.mock.calls).toEqual([['/view/lmn/init/setup']]);
});
it('summary renders the skipped text only for the string True', async () => {
 const { w } = setup('summary', { http: { get: vi.fn(async () => ({ data: { ...ini, skipfw: 'True' } })) } }); await flushPromises(); expect(w.text()).toContain('Configuration will be skipped');
});
it('setup immediately provisions, polls the shared log and enables Finish on success', async () => {
 vi.useFakeTimers(); let resolve; const post = vi.fn(() => new Promise(ok => { resolve = ok; }));
 const { w, aj } = setup('setup', { http: { post, get: vi.fn(async () => ({ data: 'log\n' })) } }); expect(post.mock.calls).toEqual([['/api/lmn/setup-wizard/provision', { start: 'setup' }]]); expect(w.text()).not.toContain('Finish');
 await vi.advanceTimersByTimeAsync(1000); await flushPromises(); expect(w.find('pre').text()).toBe('log'); resolve(); await flushPromises();
 expect(aj.notify.success.mock.calls).toEqual([['Setup complete']]); await click(w, 'Finish'); expect(aj.navigate.mock.calls).toEqual([['/view/lmn/init/done']]);
});
it.each([{ data: { message: 'backend rejection' } }, {}])('setup failure uses backend/fallback message and still enables Finish: %j', async error => {
 const { w, aj } = setup('setup', { http: { post: vi.fn(() => Promise.reject(error)), get: vi.fn() } }); await flushPromises(); expect(aj.notify.error.mock.calls).toEqual([[error.data?.message ?? 'Setup failed']]); expect(w.text()).toContain('Finish');
});
it('failed writes stay on the current route, with interceptor handling the failure', async () => {
 const { w, aj } = setup('summary', { http: { get: vi.fn(async () => ({ data: ini })), post: vi.fn(() => Promise.reject({})) } }); await flushPromises(); await click(w, 'Start provisioning'); await flushPromises(); expect(aj.navigate.mock.calls).toEqual([]); expect(aj.notify.error.mock.calls).toEqual([]);
});
it('done shows progress/restarted dialogs and schedules both original redirects', async () => {
 vi.useFakeTimers(); redirect.mockClear(); const { w, aj } = setup('done'); await flushPromises(); await click(w, 'Close'); await flushPromises(); expect(aj.http.post.mock.calls).toEqual([['/api/core/restart-master']]); expect(aj.messagebox.show.mock.calls).toEqual([[{ progress: true, title: 'Restarting' }]]);
 await vi.advanceTimersByTimeAsync(5001); expect(aj.messagebox.show.mock.results[0].value.close).toHaveBeenCalledOnce(); expect(aj.messagebox.show.mock.calls.at(-1)).toEqual([{ title: 'Restarted', text: 'Please wait' }]);
 expect(redirect.mock.calls).toEqual([[`https://192.0.2.71:${new URL(window.location.href).port}`]]); await vi.advanceTimersByTimeAsync(5000); expect(redirect.mock.calls).toEqual([[`https://192.0.2.71:${new URL(window.location.href).port}`], [`https://192.0.2.71:${new URL(window.location.href).port}`]]);
});
it('done fallback host and restart failure retain original notification', async () => {
 const { w, aj } = setup('done', { http: { get: vi.fn(async () => ({ data: { setup: {} } })), post: vi.fn(() => Promise.reject({ message: 'unavailable' })) } }); await flushPromises(); await click(w, 'Close'); await flushPromises(); expect(aj.messagebox.show.mock.results[0].value.close).toHaveBeenCalledOnce(); expect(aj.notify.error.mock.calls).toEqual([['Could not restart', 'unavailable']]);
});
it('entry mounts by template step and unmounts, using a plugin-local core facade', async () => {
 const core = { config: { data: { language: 'de', keep: true }, save: vi.fn(async () => ({})) }, locale: { setLanguage: vi.fn(async () => ({})) }, $rootScope: { $evalAsync: fn => fn() } }; const { aj } = setup('account');
 const connected = connectCore(aj, core); connected.wizard.setLanguage('en'); expect(core.config.data).toEqual({ language: 'en', keep: true }); expect(core.locale.setLanguage.mock.calls).toEqual([['en']]);
 await connected.wizard.saveConfig({ language: 'de', keep: true }); expect(core.config.save.mock.calls).toEqual([[]]); expect(connected.wizard.readConfig()).toEqual({ language: 'de', keep: true });
 configure(core); const host = document.createElement('div'); host.dataset.step = 'account'; const unmount = entry(host, aj); expect(host.textContent).toContain('Account Information'); unmount(); expect(host.innerHTML).toBe('');
});

it('done URL preserves the current port, including the original trailing colon and fallback host', () => {
 expect(setupURL({}, 'http://localhost:8471/view/')).toBe('https://10.0.0.1:8471');
 expect(setupURL({ hostip: '192.0.2.71' }, 'https://localhost/view/')).toBe('https://192.0.2.71:');
});

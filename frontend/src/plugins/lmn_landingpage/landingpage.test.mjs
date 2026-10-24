import { afterEach, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createMockAj } from '../../adapter/mock.mjs';
import Landingpage from './Landingpage.vue';
import CustomFields from './CustomFields.vue';
import WebappQR from './WebappQR.vue';
import Wireguard from './Wireguard.vue';
import { quotasFor, groupsFor, isListAttr } from './model.mjs';
const profile = { sAMAccountName: 'zem', givenName: 'Test', sn: 'Lehrer', mail: ['a@b', 'b@c'], sophomorixRole: 'teacher', sophomorixSchoolname: 'default-school', sophomorixAdminClass: 'teachers', memberOf: ['CN=teachers,OU=Teachers,DC=x', 'CN=5a,OU=5a,DC=x', 'CN=ignored,OU=Management,DC=x'] };
const fields = [ { attr: 'sophomorixCustom1', title: 'B Einzel', value: 'before', editable: true }, { attr: 'sophomorixCustomMulti1', title: 'A Multi', value: ['first', 'second'], editable: true }, { attr: 'proxyAddresses', title: 'C Proxy', value: ['smtp:first'], editable: true }, { attr: 'sophomorixCustom2', title: 'D Locked', value: 'locked', editable: false } ];
const wrappers = [];
afterEach(() => { wrappers.splice(0).forEach((w) => w.unmount()); vi.useRealTimers(); });
async function setup(Component = Landingpage, options = {}, props = {}) {
    const defaultHttp = ({ url }) => ({ data: url.endsWith('display_options') ? { show_webdav: false, show_wireguard: false } : url.endsWith('customfields') ? structuredClone(fields) : { cloud: 10, mail: 20, home: { used: 65, hard_limit: 100 } } });
    const http = vi.fn(options.http || defaultHttp);
    const aj = createMockAj({ identity: { user: 'zem', profile: structuredClone(profile) }, ...options, http });
    const w = mount(Component, { props, global: { provide: { aj } } }); wrappers.push(w); await flushPromises(); return { w, aj, http };
}
it('quota conversion retains share order, all boundaries, errors and string limits', () => {
    const data = Object.fromEntries([['cloud', 1], ['mail', 2], ['error', { ERROR: true }], ['string', { used: 3, hard_limit: 'UNKNOWN' }], ...[0, 59, 60, 79, 80, 81].map((n) => [`q${n}`, { used: n, hard_limit: n === 0 ? 0 : 100 }])]);
    expect(quotasFor(data, (t) => `T:${t}`)).toEqual([{ share: 'error', total: 'T:Error', used: '?', usage: 0, type: 'danger' }, { share: 'string', total: 'T:UNKNOWN', used: 3, usage: 0, type: 'success' }, ...[0, 59, 60, 79, 80, 81].map((n) => ({ share: `q${n}`, total: n === 0 ? 'T:NO LIMIT' : '100 MiB', used: n, usage: n, type: n < 60 ? 'success' : n < 80 ? 'warning' : 'danger' }))]);
});
it('groups keep only original categories and custom lists are exact', () => {
    expect(groupsFor([...profile.memberOf, 'CN=p,OU=Projects,DC=x', 'CN=pr,OU=printer-groups,DC=x', 'CN=other,OU=Other,DC=x'], (t) => t)).toEqual([{ cn: 'teachers', category: 'Teachers' }, { cn: '5a', category: 'Class' }, { cn: 'p', category: 'Project' }, { cn: 'pr', category: 'Printers' }]);
    expect(['proxyAddresses', 'sophomorixCustomMulti1', 'sophomorixCustomMulti5', 'sophomorixCustomMulti6', 'sophomorixCustom1'].map(isListAttr)).toEqual([true, true, true, false, false]);
});
it('loads own fields/quota, translated title, name, mail and sorted cards without mutating identity', async () => {
    const title = vi.fn(); const { w, aj, http } = await setup(Landingpage, { pageTitle: { set: title } });
    expect(title.mock.calls).toEqual([['Home']]);
    expect(http.mock.calls.map(([r]) => r.url)).toEqual(['/api/lmn/display_options', '/api/lmn/users/zem/customfields', '/api/lmn/quota/user/zem']);
    expect(w.text()).toContain('Test Lehrer'); expect(w.text()).toContain('a@b,b@c'); expect(w.text()).toContain('65 MiB / 100 MiB');
    expect(w.findAll('[data-custom]').map((r) => r.text())).toEqual(['A Multifirst second', 'B Einzelbefore', 'C Proxysmtp:first', 'D Lockedlocked']);
    expect(aj.identity.profile).toEqual(profile);
});
it.each(['student', 'globaladministrator', 'schooladministrator'])('role %s preserves edit visibility and hints', async (role) => {
    const { w } = await setup(Landingpage, { identity: { user: 'zem', profile: { ...profile, sophomorixRole: role } } });
    expect(w.findAll('button').map((b) => b.text())).toEqual(role === 'student' ? ['Change password'] : ['Change password', 'Change my data']);
    expect(w.text().includes('With great power comes great responsibility!')).toBe(role !== 'student');
});
it('identity loading/root exclusion/access and failures preserve loading/empty-card states', async () => {
    const { w, aj, http } = await setup(Landingpage, { identity: { user: null }, http: () => Promise.reject('offline') });
    expect(w.find('progress-spinner').exists()).toBe(true); expect(w.find('[data-custom]').exists()).toBe(false);
    aj.identity.user = 'root'; await flushPromises(); expect(w.find('.root-access-blocker').exists()).toBe(true);
    aj.identity.profile = structuredClone(profile); aj.identity.user = 'zem'; await flushPromises();
    expect(w.find('progress-spinner').exists()).toBe(false); expect(w.find('[data-custom]').exists()).toBe(false);
    expect(http.mock.calls.map(([r]) => r.url)).toEqual(['/api/lmn/display_options', '/api/lmn/users/zem/customfields', '/api/lmn/quota/user/zem']);
});
it('navigates password and reloads after either custom dialog resolution or dismissal', async () => {
    for (const reject of [false, true]) {
        const reload = vi.fn(), navigate = vi.fn(), open = vi.fn(() => reject ? Promise.reject('dismiss') : Promise.resolve());
        const { w } = await setup(Landingpage, { reload, navigate, modal: { open } });
        await w.findAll('button')[0].trigger('click'); expect(navigate.mock.calls).toEqual([['/view/lmn/change-password']]);
        await w.findAll('button')[1].trigger('click'); await flushPromises(); expect(reload).toHaveBeenCalledOnce();
        expect(open.mock.calls[0][1]).toEqual({ fields, user: { ...profile, sophomorixCloudQuotaCalculated: 10, sophomorixMailQuotaCalculated: 20 }, onUpdateFields: expect.any(Function) });
    }
});
it('optional cards fetch status/config/QR with exact payload and clean polling up', async () => {
    vi.useFakeTimers(); const open = vi.fn().mockResolvedValue();
    const { w, http } = await setup(Landingpage, { modal: { open }, http: vi.fn(({ url, data }) => ({ data: url.endsWith('display_options') ? { show_webdav: true, show_wireguard: true } : url.endsWith('customfields') ? [] : url.endsWith('wireguard') ? data.url.endsWith('/status') ? { status: 'connected', endpoint: 'host', latest_handshake_difference: 5.1, transfer: { received: 2.5, send: 1 } } : 'data' : {} })) });
    expect(w.text()).toContain('host'); await w.get('a:has(.fa-apple)').trigger('click');
    await w.get('a:has(.fa-download)').trigger('click'); await flushPromises(); await w.get('a:has(.fa-qrcode)').trigger('click'); await flushPromises();
    expect(http.mock.calls.filter(([r]) => r.method === 'post').map(([r]) => r)).toEqual(['status', 'config', 'qr/b64'].map((suffix) => ({ method: 'post', url: '/api/lmn/wireguard', data: { url: `/api/wireguard/peers/lmn-user_zem/${suffix}`, method: 'GET' }, cfg: undefined })));
    expect(open.mock.calls.map((c) => c[1])).toEqual([{}, { data: 'data', qr: false, peer: 'lmn-user_zem' }, { data: 'data', qr: true, peer: 'lmn-user_zem' }]);
    await vi.advanceTimersByTimeAsync(30000); expect(http.mock.calls.filter(([r]) => r.method === 'post')).toHaveLength(4);
    w.unmount(); await vi.advanceTimersByTimeAsync(60000); expect(http.mock.calls.filter(([r]) => r.method === 'post')).toHaveLength(4);
});
it('wireguard failure opens no dialog; late options after unmount do not start timer', async () => {
    vi.useFakeTimers(); let resolve;
    const { w } = await setup(Landingpage, { http: ({ url }) => url.endsWith('display_options') ? new Promise((r) => { resolve = r; }) : Promise.reject('offline') });
    w.unmount(); resolve({ data: { show_wireguard: true } }); await flushPromises(); expect(vi.getTimerCount()).toBe(0);
});
const row = (w, title) => w.findAll('tr').find((r) => r.text().includes(title));
it('custom dialog sorts and hides actions for uneditable fields and closes', async () => {
    const { w } = await setup(CustomFields, {}, { fields: structuredClone(fields), user: profile });
    expect(w.findAll('tr').map((r) => r.text())).toEqual(['A Multifirstsecond', 'B Einzelbefore', 'C Proxysmtp:first', 'D Lockedlocked']);
    expect(row(w, 'Locked').findAll('a')).toEqual([]);
    await w.get('.modal-footer a').trigger('click'); expect(w.emitted('cancel')).toEqual([[]]);
});
it.each(['value', ''])('single custom edit posts exact %s and preserves null display', async (value) => {
    const prompt = vi.fn().mockResolvedValue({ value }); const notify = vi.fn();
    const { w, http } = await setup(CustomFields, { messagebox: { prompt }, notify }, { fields: structuredClone(fields), user: profile });
    await row(w, 'Einzel').get('a').trigger('click'); await flushPromises();
    expect(prompt.mock.calls).toEqual([['New value', 'before']]);
    expect(http.mock.calls.at(-1)[0]).toEqual({ method: 'post', url: '/api/lmn/users/zem/custom/1', data: { value }, cfg: undefined });
    expect(row(w, 'Einzel').text()).toBe(`B Einzel${value || 'null'}`);
    expect(notify.mock.calls).toEqual([['success', 'Value updated !', undefined]]);
});
it.each([['Multi', 'custommulti/1', 'value', 'Value added !'], ['Proxy', 'proxyaddresses', 'address', 'Address added !']])('adds %s via original prompt and payload', async (name, path, key, notice) => {
    const prompt = vi.fn().mockResolvedValue({ value: 'new value' }); const notify = vi.fn();
    const { w, http } = await setup(CustomFields, { messagebox: { prompt }, notify }, { fields: structuredClone(fields), user: profile });
    await row(w, name).get('a').trigger('click'); await flushPromises();
    expect(prompt.mock.calls).toEqual([[name === 'Proxy' ? 'New address' : 'New value']]);
    expect(http.mock.calls.at(-1)[0]).toEqual({ method: 'post', url: `/api/lmn/users/zem/${path}`, data: { [key]: 'new value' }, cfg: undefined });
    expect(row(w, name).text()).toContain('new value'); expect(notify.mock.calls).toEqual([['success', notice, undefined]]);
});
it.each([['Multi', 'custommulti/1', 'value', 'first', 'Remove custom field value'], ['Proxy', 'proxyaddresses', 'address', 'smtp:first', 'Remove proxy address']])('removes %s after exact confirmation', async (name, path, key, value, title) => {
    const show = vi.fn().mockResolvedValue({}); const notify = vi.fn();
    const { w, http } = await setup(CustomFields, { messagebox: { show }, notify }, { fields: structuredClone(fields), user: profile });
    await row(w, name).get('.label').trigger('click'); await flushPromises();
    expect(show.mock.calls).toEqual([[{ title, text: `Do you really want to remove ${value} ?`, positive: 'OK', negative: 'Cancel' }]]);
    expect(http.mock.calls.at(-1)[0]).toEqual({ method: 'patch', url: `/api/lmn/users/zem/${path}`, data: { [key]: value }, cfg: undefined });
    expect(row(w, name).text()).not.toContain(value); expect(notify.mock.calls).toEqual([['success', 'Value removed !', undefined]]);
});
it('cancelled removal keeps the value and sends no request as core messagebox.then rejects', async () => {
    const notify = vi.fn(); const { w, http } = await setup(CustomFields, { messagebox: { show: () => Promise.reject('cancel') }, notify }, { fields: structuredClone(fields), user: profile });
    await row(w, 'Multi').get('.label').trigger('click'); await flushPromises(); expect(http.mock.calls).toEqual([]);
    expect(row(w, 'Multi').text()).toBe('A Multifirstsecond'); expect(notify.mock.calls).toEqual([]);
});
it('prompt cancel does not write; rejected writes retain original error behavior', async () => {
    const notify = vi.fn(); const prompt = vi.fn().mockRejectedValue('cancel');
    const { w, http } = await setup(CustomFields, { messagebox: { prompt }, notify, http: () => Promise.reject('failed') }, { fields: structuredClone(fields), user: profile });
    await row(w, 'Einzel').get('a').trigger('click'); await flushPromises(); expect(row(w, 'Einzel').text()).toBe('B Einzelbefore'); expect(notify.mock.calls).toEqual([]);
    prompt.mockResolvedValue({ value: 'new' });
    for (const name of ['Einzel', 'Multi', 'Proxy']) { await row(w, name).get('a').trigger('click'); await flushPromises(); }
    expect(row(w, 'Einzel').text()).toBe('B Einzel'); expect(row(w, 'Multi').text()).toBe('A Multifirstsecond'); expect(row(w, 'Proxy').text()).toBe('C Proxysmtp:first');
    expect(notify.mock.calls).toHaveLength(3);
});
it('rejected remove preserves values; falsey add does not append', async () => {
    const { w } = await setup(CustomFields, { http: () => Promise.reject('failed') }, { fields: structuredClone(fields), user: profile });
    await row(w, 'Multi').get('.label').trigger('click'); await flushPromises(); expect(row(w, 'Multi').text()).toBe('A Multifirstsecond');
    await row(w, 'Multi').get('a').trigger('click'); await flushPromises(); expect(row(w, 'Multi').text()).toBe('A Multifirstsecond');
});
it('webdav loads QR and connection details and closes; failure leaves unset values', async () => {
    const { w } = await setup(WebappQR, { http: ({ url }) => { expect(url).toBe('/api/webdav/qrcode'); return { data: { displayName: 'mobile', url: 'url', username: 'zem', qrcode: 'base64' } }; } });
    expect(w.text()).toContain('mobile'); expect(w.get('img.centered').attributes('src')).toBe('data:image/png;base64, base64');
    await w.get('button').trigger('click'); expect(w.emitted('cancel')).toEqual([[]]);
    const failed = await setup(WebappQR, { http: () => Promise.reject('failed') }); expect(failed.w.get('.webdav-ios-tuto p').text()).toBe('');
});
it.each([false, true])('wireguard displays text or QR, never evaluates config markup (%s)', async (qr) => {
    const { w } = await setup(Wireguard, {}, { data: qr ? 'base64' : { data: '<script>bad()</script>' }, qr, peer: 'lmn-user_zem' });
    if (qr) expect(w.get('img').attributes('src')).toBe('data:image/png;base64,base64');
    else { expect(w.get('pre').text()).toBe('<script>bad()</script>'); expect(w.find('script').exists()).toBe(false); }
    const missing = await setup(Wireguard, {}, { data: null, qr, peer: 'lmn-user_zem' }); expect(missing.w.text()).toContain('No configuration is available');
});
it('entry mounts and disposes', async () => {
    const { mount: entry } = await import('./entry.mjs'); const host = document.createElement('div'); const dispose = entry(host, createMockAj()); await flushPromises(); expect(host.textContent).toContain('Welcome'); dispose(); expect(host.textContent).toBe('');
});
it('wireguard rejected config/QR/status requests are handled without opening a dialog', async () => {
    const open = vi.fn();
    const { w, http } = await setup(Landingpage, { modal: { open }, http: ({ url }) => {
        if (url.endsWith('wireguard')) return Promise.reject('forbidden');
        return { data: url.endsWith('display_options') ? { show_wireguard: true } : url.endsWith('customfields') ? [] : {} };
    } });
    await w.get('a:has(.fa-download)').trigger('click'); await w.get('a:has(.fa-qrcode)').trigger('click'); await flushPromises();
    expect(open.mock.calls).toEqual([]); expect(http.mock.calls.filter(([r]) => r.method === 'post').length).toBe(3);
});
it('missing options/empty fields keep optional cards hidden; duplicate group sorting is stable', async () => {
    const { w } = await setup(Landingpage, { http: ({ url }) => ({ data: url.endsWith('display_options') ? {} : url.endsWith('customfields') ? [] : {} }), identity: { user: 'zem', profile: { ...profile, memberOf: ['CN=z,OU=Projects,DC=x', 'CN=A,OU=Projects,DC=x', 'CN=A,OU=Projects,DC=x'] } } });
    expect(w.findAll('.cardlist').map((r) => r.text())).toEqual(['AProject', 'AProject', 'zProject']);
    expect(w.find('[data-custom]').exists()).toBe(false); expect(w.find('a:has(.fa-apple)').exists()).toBe(false);
});

it('WebDAV modal uses the original Bootstrap large dialog width', async () => {
    const { createModalService } = await import('../../adapter/modal.mjs');
    const aj = createMockAj();
    const modal = createModalService(() => aj);
    const result = modal.open(WebappQR).catch(() => {});
    await flushPromises();
    expect(document.querySelector('.modal-dialog').classList.contains('modal-lg')).toBe(true);
    document.querySelector('.modal-footer button').click(); await result;
    expect(document.querySelector('.modal')).toBe(null);
});
it('keeps calculated profile quotas while quota loading fails, as the original user binding does', async () => {
    const { w } = await setup(Landingpage, { identity: { user: 'zem', profile: { ...profile, sophomorixCloudQuotaCalculated: 901, sophomorixMailQuotaCalculated: 902 } }, http: ({ url }) => {
        if (url.includes('/quota/user/')) return Promise.reject('offline');
        return { data: url.endsWith('customfields') ? [] : {} };
    } });
    expect(w.text()).toContain('Cloudquota Calculated in MB: 901');
    expect(w.text()).toContain('Mailquota Calculated in MB: 902 MB');
});
it('updates the profile card behind the still-open custom dialog, as Angular shared fields do', async () => {
    const { createModalService } = await import('../../adapter/modal.mjs');
    const { w, aj } = await setup();
    aj.modal = createModalService(() => aj);
    aj.messagebox.prompt = async () => ({ value: 'changed while open' });
    await w.findAll('button')[1].trigger('click'); await flushPromises();
    const modal = document.querySelector('.modal');
    const single = [...modal.querySelectorAll('tr')].find((r) => r.textContent.includes('B Einzel'));
    single.querySelector('a').click(); await flushPromises();
    try { expect(w.findAll('[data-custom]').map((r) => r.text())).toContain('B Einzelchanged while open'); }
    finally { modal.querySelector('.modal-footer a').click(); await flushPromises(); }
});
it('retains both consecutive multi-value additions while HTTP replies are still pending', async () => {
    const replies = [];
    const prompt = vi.fn().mockResolvedValueOnce({ value: 'alpha' }).mockResolvedValueOnce({ value: 'beta' });
    const { w } = await setup(CustomFields, { messagebox: { prompt }, http: () => new Promise((resolve) => replies.push(resolve)) }, { fields: structuredClone(fields), user: profile });
    await row(w, 'Multi').get('a').trigger('click'); await flushPromises();
    await row(w, 'Multi').get('a').trigger('click'); await flushPromises();
    replies[0]({ data: null }); await flushPromises(); replies[1]({ data: null }); await flushPromises();
    expect(row(w, 'Multi').text()).toBe('A Multifirstsecondalphabeta');
});

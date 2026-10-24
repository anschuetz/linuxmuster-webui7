import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import Dashboard from './Dashboard.vue';
import { download } from './download.mjs';
vi.mock('./download.mjs', () => ({ download: vi.fn() }));
beforeEach(() => vi.clearAllMocks());
import { mount as mountEntry } from './entry.mjs';
import { createMockAj } from '../../adapter/mock.mjs';
const clones = { ZGroup: { summary: { available_vms: 2 } }, AGroup: { summary: { available_vms: 0 } } };
let w;
afterEach(() => w?.unmount());
function setup(http) {
 const notify = vi.fn(), navigate = vi.fn(), pageTitle = { set: vi.fn() };
 const aj = createMockAj({ http, notify, navigate, pageTitle });
 w = mount(Dashboard, { global: { provide: { aj } } });
 return { notify, navigate, pageTitle, aj };
}
it('retains loading until response and shows original object-repeat card order, with zero disabled', async () => {
 let resolve;
 const http = vi.fn(() => new Promise(r => { resolve = r; }));
 const { pageTitle } = setup(http);
 expect(w.find('[role=status]').exists()).toEqual(true);
 expect(w.findAll('.list-group-item')).toEqual([]);
 resolve({ data: { status: 'success', data: clones } }); await flushPromises();
 expect(w.find('[role=status]').exists()).toEqual(false);
 expect(w.findAll('.list-group-item').map(c => c.text())).toEqual(['ZGroupAvailable VMs: 2', 'AGroupAvailable VMs: 0']);
 expect(w.findAll('.list-group-item')[1].find('a').exists()).toEqual(false);
 expect(http.mock.calls.map(c => c[0])).toEqual([{ method: 'get', url: '/api/lmn/vdi/administration/clones', data: undefined, cfg: undefined }]);
 expect(pageTitle.set.mock.calls).toEqual([['Lmn_vdi_dashboard']]);
});
it('starts with the original GET URL and downloads via the adapter', async () => {
 const http = vi.fn(async ({ url }) => ({ data: url.endsWith('/clones') ? { status: 'success', data: clones } : 'p60.vv' }));
 const { navigate } = setup(http); await flushPromises();
 await w.get('a').trigger('click'); await flushPromises();
 expect(http.mock.calls.at(-1)).toEqual([{ method: 'get', url: '/api/lmn/vdi/dashboard/vdiSession/ZGroup', data: undefined, cfg: undefined }]);
 expect(download.mock.calls).toEqual([['/api/lmn/vdi/dashboard/download/p60.vv']]);
 expect(navigate.mock.calls).toEqual([]);
});
it('shows the backend message and empty loaded groups on status failure', async () => {
 const { notify } = setup(async () => ({ data: { status: 'error', message: 'VDI missing' } })); await flushPromises();
 expect(notify.mock.calls).toEqual([['error', 'VDI missing', undefined]]);
 expect(w.find('[role=status]').exists()).toEqual(false);
 expect(w.findAll('.list-group-item')).toEqual([]);
});
it('keeps the spinner on HTTP rejection handled by the shell', async () => {
 const { notify } = setup(async () => { throw { status: 403 }; }); await flushPromises();
 expect(w.find('[role=status]').exists()).toEqual(true); expect(notify.mock.calls).toEqual([]);
});
it('does not download when session GET rejects', async () => {
 const { navigate } = setup(async ({ url }) => { if (!url.endsWith('/clones')) throw { status: 500 }; return { data: { status: 'success', data: clones } }; });
 await flushPromises(); await w.get('a').trigger('click'); await flushPromises(); expect(download.mock.calls).toEqual([]); expect(navigate.mock.calls).toEqual([]);
});
it('mount entry provides and unmounts the dashboard', async () => {
 const el = document.createElement('div'); const cleanup = mountEntry(el, createMockAj({ http: async () => ({ data: { status: 'success', data: {} } }) }));
 await flushPromises(); expect(el.textContent).toContain('VDI Desktops'); cleanup(); expect(el.textContent).toEqual('');
});

it.each([['0', 0], [null, 1]])('preserves Angular numeric-zero comparison for %s availability', async (count, links) => {
 setup(async () => ({ data: { status: 'success', data: { Group: { summary: { available_vms: count } } } } }));
 await flushPromises(); expect(w.findAll('a').length).toEqual(links);
});

import { afterEach, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import Administration from './Administration.vue';
import GroupInfo from './GroupInfo.vue';
import MasterInfo from './MasterInfo.vue';
import { mount as mountEntry } from './entry.mjs';
import { createMockAj } from '../../adapter/mock.mjs';
const master = { name: 'P60VM', status: 'running', cloop: 'p60.cloop', buildstate: 'ready', ostype: 'linux', imagesize: '8G', dateOfCreation: 'today', memory: 4096, cores: 2, bios: 'sea', scsi0: 'disk', scsihw: 'virtio', audio0: 'spice', vga: 'qxl', net0: 'net', usb0: 'usb', spice_enhancements: 'folders' };
const group = { group: 'Z', hostname: 'p60-master', room: 'room', ip: '192.0.2.60', mac: '02:00:00:00:00:60', pxe: 1, actual_imagesize: '8G', master_vms: { 602: null, 601: master } };
const masters = { Z: group, A: { hostname: 'p60-first', master_vms: {} } };
const clones = { Z: { clone_vms: { 611: { group: 'Z', hostname: 'clone1', user: '' }, 612: { group: 'Z', hostname: 'overwritten', user: '' } } }, A: { clone_vms: { 612: { group: 'A', hostname: 'clone2', user: 'synthetic' } } } };
let w;
afterEach(() => w?.unmount());
function setup(http = async ({ url }) => ({ data: { status: 'success', data: url.endsWith('masterVMs') ? masters : clones } })) {
 const notify = vi.fn(), modal = { open: vi.fn(() => Promise.reject('dismissed')) }, pageTitle = { set: vi.fn() };
 const aj = createMockAj({ http, notify, modal, pageTitle });
 w = mount(Administration, { global: { provide: { aj } } }); return { notify, modal, pageTitle };
}
it('loads masters once, renders Angular key order and disables absent masters', async () => {
 const http = vi.fn(async () => ({ data: { status: 'success', data: masters } }));
 const { pageTitle } = setup(http); expect(w.find('[role=status]').exists()).toEqual(true); await flushPromises();
 expect(w.findAll('tbody tr').map(r => r.find('td').text())).toEqual(['Z', 'A']);
 expect(w.get('button[disabled]').text()).toEqual('602');
 expect(http.mock.calls.map(c => c[0])).toEqual([{ method: 'get', url: '/api/lmn/vdi/administration/masterVMs', data: undefined, cfg: undefined }]);
 expect(pageTitle.set.mock.calls).toEqual([['Lmn_vdi_administration']]);
});
it('passes exact resolve data to both info modals and tolerates dismiss', async () => {
 const { modal } = setup(); await flushPromises();
 await w.findAll('tbody tr')[0].get('td').trigger('click');
 await w.findAll('button').find(b => b.text() === '601').trigger('click'); await flushPromises();
 expect(modal.open.mock.calls).toEqual([[GroupInfo, { masterGroupData: group }], [MasterInfo, { masterVM: '601', masterVMData: master }]]);
});
it('fetches clones on every clone-tab click and flattens groups with last collision winning', async () => {
 const http = vi.fn(async ({ url }) => ({ data: { status: 'success', data: url.endsWith('masterVMs') ? masters : clones } }));
 setup(http); await flushPromises();
 const tab = w.findAll('[role=tab]')[1]; await tab.trigger('click'); await flushPromises();
 expect(w.findAll('tbody tr').map(r => r.text())).toEqual(['Z611clone1No user', 'A612clone2synthetic']);
 await tab.trigger('click'); await flushPromises();
 expect(http.mock.calls.map(c => c[0].url)).toEqual(['/api/lmn/vdi/administration/masterVMs', '/api/lmn/vdi/administration/clones', '/api/lmn/vdi/administration/clones']);
 await w.findAll('[role=tab]')[0].trigger('click'); expect(w.text()).toContain('p60-master');
});
it('clears lists on status failures and reports backend messages', async () => {
 const { notify } = setup(async () => ({ data: { status: 'error', message: 'VDI missing' } })); await flushPromises();
 expect(w.find('[role=status]').exists()).toEqual(false);
 await w.findAll('[role=tab]')[1].trigger('click'); await flushPromises();
 expect(w.find('[role=status]').exists()).toEqual(false); expect(w.findAll('tbody tr')).toEqual([]);
 expect(notify.mock.calls).toEqual([['error', 'VDI missing', undefined], ['error', 'VDI missing', undefined]]);
});
it('retains unresolved state on HTTP errors without duplicate shell notification', async () => {
 const { notify } = setup(async () => { throw { status: 500 }; }); await flushPromises();
 expect(w.find('[role=status]').exists()).toEqual(true);
 await w.findAll('[role=tab]')[1].trigger('click'); await flushPromises();
 expect(w.find('[role=status]').exists()).toEqual(true); expect(notify.mock.calls).toEqual([]);
});
it.each([[0, 'No'], [1, 'Yes'], [2, '2'], ['0', 'No'], ['1', 'Yes'], [null, '']])('group dialog retains PXE %s and all data', async (pxe, label) => {
 const aj = createMockAj(); w = mount(GroupInfo, { props: { masterGroupData: { ...group, pxe } }, global: { provide: { aj } } });
 expect(w.findAll('td').map(c => c.text())).toEqual(['room', 'p60-master', '02:00:00:00:00:60', '192.0.2.60', label, '8G']);
 await w.get('a').trigger('click'); expect(w.emitted('cancel')).toEqual([[]]);
});
it('master dialog renders every original field and closes', async () => {
 w = mount(MasterInfo, { props: { masterVM: '601', masterVMData: master }, global: { provide: { aj: createMockAj() } } });
 expect(w.findAll('td').map(c => c.text())).toEqual(Object.values(master).map(String));
 await w.get('a').trigger('click'); expect(w.emitted('cancel')).toEqual([[]]);
});
it('mount entry provides and unmounts administration', async () => {
 const el = document.createElement('div'); const cleanup = mountEntry(el, createMockAj({ http: async () => ({ data: { status: 'success', data: {} } }) }));
 await flushPromises(); expect(el.textContent).toContain('Master VMs'); cleanup(); expect(el.textContent).toEqual('');
});

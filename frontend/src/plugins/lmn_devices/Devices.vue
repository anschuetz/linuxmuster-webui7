<script setup>
import { computed, inject, onBeforeUnmount, ref, watch } from 'vue';
import { createValidation } from '../../common/validation.mjs';
import { openFileEditor } from '../../common/fileEditor.mjs';
import { openFileBackups } from '../../common/fileBackups.mjs';
import AddDialog from './AddDialog.vue';
import GroupInput from './GroupInput.vue';
import ApplyDialog from './ApplyDialog.vue';
import { fields as definitions, roles, pxe } from './fields.mjs';
const aj = inject('aj');
const devices = ref();
const groups = ref([]);
const path = ref();
const filter = ref('');
const sort = ref('room');
const page = ref(1);
const pageSize = ref(100);
const menu = ref('');
const dirty = ref(false);
const sidebar = computed(() => aj.shell.layout.sidebar);
const showErrors = ref(false);
const closeMenus = (event) => { if (!event.target.closest('.c3-menu-control')) menu.value = ''; };
window.addEventListener('click', closeMenus);
const visible = ref(Object.fromEntries(definitions.map(([id, , shown]) => [id, shown])));
const sorts = definitions.slice(0, 5);
const fields = computed(() => definitions.filter(([id]) => visible.value[id]));
const sortName = computed(() => definitions.find(([id]) => id === sort.value)[1]);
function matchesFilter(value, term) {
    if (term.startsWith('!')) return !matchesFilter(value, term.slice(1));
    if (value == null) return false;
    if (typeof value === 'object') return Object.entries(value).some(([key, item]) => !key.startsWith('$') && matchesFilter(item, term));
    return String(value).toLowerCase().includes(term);
}
const shown = computed(() => {
    const newOrder = (d) => d._isNew === undefined ? 2 : Number(d._isNew);
    const compare = (a, b) => a === b ? 0 : a < b ? -1 : 1;
    const key = (d) => sort.value === 'ip' ? d.ip.split('.').map((n) => n.padStart(3, '0')).join('.') : d[sort.value];
    const term = filter.value.toLowerCase();
    return (devices.value || []).filter((d) => (d._isNew || (d.room && !d.room.startsWith('#')))
        && matchesFilter(d, term))
        .toSorted((a, b) => newOrder(a) - newOrder(b) || compare(String(key(a)).toLowerCase(), String(key(b)).toLowerCase()))
        .slice((page.value - 1) * pageSize.value, page.value * pageSize.value);
});
const pageCount = computed(() => Math.ceil((devices.value?.length || 0) / pageSize.value));
const pages = computed(() => {
    const end = Math.min(pageCount.value, Math.max(1, page.value - 5) + 9);
    const start = Math.max(1, end - 9);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
});
const placeholders = { officeKey: 'Office-Key', windowsKey: 'Windows-Key', dhcpOptions: 'DHCP-Options',
    lmnReserved10: 'LMN-Reserved10', lmnReserved12: 'LMN-Reserved12', lmnReserved13: 'LMN-Reserved13',
    lmnReserved14: 'LMN-Reserved14', sophomorixComment: 'Sophomorix-Comment' };
const validation = createValidation(aj);
const validationState = computed(() => {
    // Original validation only visits rendered cells (page, filter and field visibility).
    const originals = (devices.value || []).filter((d) => d.room?.[0] !== '#');
    const data = originals.map((d) => ({ ...d }));
    validation.set(data, 'devices');
    const checks = shown.value.map((d, index) => Object.fromEntries(fields.value.filter(([, , , rule]) => rule).map(([id, , , rule]) => {
        if (!d[id]) return [id, { empty: true }];
        const longHost = ['server', 'router', 'printer', 'switch', 'iponly'].includes(d.sophomorixRole);
        const result = rule === 'Mac' ? validation.isValidMac(d[id], index)
            : rule === 'Host' ? validation.isValidHost(d[id], !longHost) : validation[`isValid${rule}`](d[id]);
        return [id, result === true ? null : { message: result }];
    })));
    return { checks, originals, data };
});
const checks = computed(() => validationState.value.checks);
watch(validationState, ({ originals, data }) => {
    // Publish the common validator's shared-data normalization, including its legacy row index.
    const changes = new Map(originals.flatMap((d, i) => d.mac !== data[i].mac ? [[d, data[i].mac]] : []));
    if (changes.size) devices.value = devices.value.map((d) => changes.has(d) ? { ...d, mac: changes.get(d) } : d);
}, { immediate: true });
const errorState = ref({ messages: {}, empty: {} });
watch(checks, (rows) => {
    // Like error_msg/emptyCells in the original, off-screen keys survive until visited again.
    const next = { messages: { ...errorState.value.messages }, empty: { ...errorState.value.empty } };
    rows.forEach((row, index) => Object.entries(row).forEach(([id, error]) => {
        const key = `${id}-${index}`;
        if (error?.empty) { delete next.messages[key]; next.empty[key] = 1; }
        else {
            delete next.empty[key];
            if (!error) delete next.messages[key];
            else if (!Object.values(next.messages).includes(error.message)) next.messages[key] = error.message;
        }
    }));
    errorState.value = next;
}, { immediate: true });
const messages = computed(() => Object.values(errorState.value.messages));
const emptyCount = computed(() => Object.keys(errorState.value.empty).length);
function update(device, id, value) {
    devices.value = devices.value.map((d) => d === device ? { ...d, [id]: value } : d);
    dirty.value = true;

}
async function add(device) {
    try {
        const result = await aj.modal.open(AddDialog, { device });
        devices.value = [result, ...devices.value];
    } catch { /* Dialog cancellation leaves the table unchanged. */ }
}
function remove(device) { devices.value = devices.value.filter((d) => d !== device); }
async function save(importAfter = false) {
    if (checks.value.some((row) => Object.entries(row).some(([id, error]) => id !== 'sophomorixRole' && error))) {
        showErrors.value = true;
        aj.notify.error(aj.gettext('Please check the errors.'));
        return;
    }
    showErrors.value = false;
    dirty.value = false; // As in the original, pristine is set before the HTTP response.
    try {
        await aj.http.post('/api/lmn/devices', devices.value.map((d) => ({ ...d })));
        devices.value = devices.value.map((d) => ({ ...d, _isNew: false }));
        aj.notify.success(aj.gettext('Saved'));
        if (importAfter) await aj.modal.open(ApplyDialog);
    } catch { /* HTTP failures are displayed by the adapter; modal cancellation is expected. */ }
}
async function editCSV() {
    try { await openFileEditor(aj, path.value); aj.reload(); }
    catch { /* Editor cancellation must not reload. */ }
}
async function backups() {
    try { await openFileBackups(aj, path.value); }
    catch { /* Backup dialog cancellation. */ }
}
function keydown(event) {
    if (!event.ctrlKey) return;
    const actions = { s: () => save(), i: () => save(true), b: backups };
    const action = actions[event.key.toLowerCase()];
    if (action) { event.preventDefault(); action(); }
}
const offLeave = aj.guardLeave(() => !dirty.value || window.confirm(aj.gettext('Changes are not saved, continue anyway ?')));
window.addEventListener('keydown', keydown);
onBeforeUnmount(() => {
    window.removeEventListener('click', closeMenus);
    window.removeEventListener('keydown', keydown);
    offLeave();
});
aj.pageTitle.set(aj.gettext('Devices'));
async function load(url, receive) {
    try { receive((await aj.http.get(url)).data); }
    catch { /* Retain the original loading state; adapter handles HTTP errors. */ }
}
load('/api/lmn/linbo4/groups', (data) => { groups.value = data; });
load('/api/lmn/activeschool', (school) => {
    aj.identity.profile.activeSchool = school;
    path.value = `/etc/linuxmuster/sophomorix/${school}/${school === 'default-school' ? '' : school + '.'}devices.csv`;
});
load('/api/lmn/devices', (data) => { devices.value = data; });
</script>

<template>
    <br>
    <component :is="'progress-spinner'" v-if="devices == null" role="progressbar"><div><div class="one"></div><div class="two"></div></div></component>
    <div v-else>
        <div v-if="showErrors && (emptyCount || messages.length)" id="error_messages" class="alert alert-danger"><ul>
            <li v-if="emptyCount">{{ emptyCount }} {{ aj.gettext('empty cells') }}.</li>
            <li v-for="message in messages" :key="message">{{ message }}</li>
        </ul></div>
        <div>
            <button class="btn btn-success float-end" @click="add()"><i class="fa fa-plus"></i> <span>{{ aj.gettext('Add a device') }}</span></button>
            <div class="input-group">
                <input v-model.trim="filter" type="search" autofocus class="form-control" placeholder="Filter">
                <div class="dropdown c3-menu-control">
                    <button class="btn c3-button" @click="menu = menu === 'sort' ? '' : 'sort'"><i class="fa fa-sort-amount-asc"></i> {{ aj.gettext(sortName) }} <span class="dropdown-toggle aj-dropdown-marker"></span></button>
                    <ul v-if="menu === 'sort'" class="dropdown-menu dropdown-menu-end show" style="width:150px"><li v-for="[id, label] in sorts" :key="id"><a class="dropdown-item" :data-sort="id" @click="sort = id; menu = ''"><i class="fa fa-sort-amount-asc"></i> {{ aj.gettext(label) }}</a></li></ul>
                </div>
                <div class="dropdown c3-menu-control">
                    <button class="btn c3-button" @click="menu = menu === 'fields' ? '' : 'fields'"><i class="fa fa-ellipsis-h"></i> {{ aj.gettext('Fields') }} <span class="dropdown-toggle aj-dropdown-marker"></span></button>
                    <ul v-if="menu === 'fields'" class="dropdown-menu dropdown-menu-end show" style="width:190px"><li v-for="[id, label] in definitions" :key="id"><label checkbox :class="{ active: visible[id] }" style="font-weight:normal;margin:0"><input class="visually-hidden" :checked="visible[id]" @change="visible = { ...visible, [id]: $event.target.checked }" type="checkbox" :data-visible="id"><i class="fa fa-square-o off"></i><i class="fa fa-check-square on"></i> {{ aj.gettext(label) }}</label></li></ul>
                </div>
                <div class="dropdown c3-menu-control">
                    <button class="btn c3-button" @click="menu = menu === 'rows' ? '' : 'rows'"><i class="fa fa-list-ol"></i> {{ aj.gettext('Rows') }} <span class="dropdown-toggle aj-dropdown-marker"></span></button>
                    <ul v-if="menu === 'rows'" class="dropdown-menu dropdown-menu-end show" style="width:150px"><li v-for="size in [10,25,50,100,500]" :key="size"><a class="dropdown-item" :data-size="size" @click="pageSize = size; menu = ''"><i class="fa fa-list-ol"></i> {{ size }}</a></li><li><input v-model="pageSize" type="number" class="form-control"></li></ul>
                </div>
            </div>
        </div><br>
        <form @submit.prevent>
            <div class="c3-devices-scroll"><table class="lm-table lm-table-inputs"><thead><tr><th v-for="[id, label] in fields" :key="id">{{ aj.gettext(label) }}</th><th></th></tr></thead>
                <tbody><tr v-for="(device, index) in shown" :key="devices.indexOf(device)" class="device-row" :class="{ newDevice: device._isNew }">
                    <td v-for="[id, label] in fields" :key="id" class="c3-device-field" :width="id === 'room' ? 80 : id === 'pxeFlag' ? 100 : undefined" :data-field="id" :class="{ 'c3-unchecked-error': id !== 'sophomorixRole' && !!checks[index]?.[id], 'c3-invalid': !!checks[index]?.[id] && (showErrors || id === 'sophomorixRole') }">
                        <GroupInput :invalid="!!checks[index]?.[id] && (showErrors || id === 'sophomorixRole')" v-if="id === 'group'" :model-value="device.group" :groups="groups" @update:model-value="update(device, id, $event)" />
                        <select v-else-if="id === 'sophomorixRole' || id === 'pxeFlag'" class="form-control" :class="{ 'is-invalid': !!checks[index]?.[id] && (showErrors || id === 'sophomorixRole') }" :value="device[id]" :aria-label="aj.gettext(label)" @change="update(device, id, $event.target.value)"><option v-for="[value, text] in id === 'sophomorixRole' ? roles : pxe" :key="value" :value="value">{{ aj.gettext(text) }}</option></select>
                        <input v-else type="text" class="form-control" :class="{ 'is-invalid': !!checks[index]?.[id] && (showErrors || id === 'sophomorixRole') }" :value="device[id]" :placeholder="placeholders[id] || label" @blur="$event.target.value !== device[id] && update(device, id, $event.target.value.trim())">
                    </td>
                    <td width="1"><button type="button" class="btn c3-button" :title="aj.gettext('Duplicate')" @click="add(device)"><i class="fa fa-copy"></i></button></td>
                    <td width="1"><button type="button" class="btn c3-button" :title="aj.gettext('Remove')" @click="remove(device)"><i class="fa fa-trash-o"></i></button></td>
                </tr></tbody>
            </table></div><a href="#" id="end_table"></a>
        </form>
        <br>
        <ul v-if="devices.length > pageSize" class="pagination c3-pagination"><li class="page-item"><a class="page-link" @click="page = 1">First</a></li><li class="page-item"><a class="page-link" @click="page = Math.max(1, page - 1)">Previous</a></li><li v-for="n in pages" :key="n" class="page-item" :class="{ active: page === n }"><a class="page-link" :data-page="n" @click="page = n">{{ n }}</a></li><li class="page-item"><a class="page-link" @click="page = Math.min(pageCount, page + 1)">Next</a></li><li class="page-item"><a class="page-link" @click="page = pageCount">Last</a></li></ul>
        <div class="floating-toolbar-padder"></div>
        <component :is="'floating-toolbar'"><div class="container"><div class="row aj-theme-toolbar-layout"><div :class="{ 'aj-theme-toolbar-offset': sidebar }"></div><div :class="sidebar ? 'aj-theme-toolbar-main' : 'aj-theme-toolbar-full'"><div class="bar aj-theme-toolbar">
            <button class="btn btn-lmn float-end" @click="backups"><i class="fa fa-history"></i></button>
            <a class="btn btn-lmn" @click="save()">{{ aj.gettext('Save') }}</a>
            <a class="btn btn-lmn" @click="save(true)">{{ aj.gettext('Save & import') }}</a>
            <button class="btn btn-lmn" @click="editCSV">{{ aj.gettext('Edit CSV') }}</button>
        </div></div></div></div></component>
    </div>
</template>

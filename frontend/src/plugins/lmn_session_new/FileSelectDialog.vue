<script setup>
import { computed, inject, onBeforeUnmount, ref } from 'vue';
import { createSmbclient } from '../../common/smbclient.mjs';
import SmbUpload from '../../common/SmbUpload.vue';
import { sortedFiles } from './participants.mjs';
const props = defineProps({ path: String, printPath: String, action: String, user: String });
const emit = defineEmits(['close', 'cancel']);
const aj = inject('aj'), smb = createSmbclient(aj);
const items = ref(), currentPath = ref(props.path), parents = ref([]), count = ref(0), toggle = ref(false);
let alive = true;
onBeforeUnmount(() => { alive = false; });
const rows = computed(() => sortedFiles(items.value).filter(item => item.name !== 'collected'));
async function load(path) {
    const data = await smb.list(path);
    if (!alive) return;
    items.value = data.items.map(item => ({ ...item }));
    parents.value = [...parents.value, currentPath.value]; currentPath.value = path;
}
async function back() {
    const path = parents.value.at(-1), data = await smb.list(path);
    if (!alive) return;
    items.value = data.items.map(item => ({ ...item })); currentPath.value = path; parents.value = parents.value.slice(0, -1);
}
async function run(fn) { try { await fn(); } catch { /* Preserve cancellation and shell HTTP handling; legacy mutation catches refer to an uninjected lmnSession. */ } }
const reload = () => run(() => load(currentPath.value));
function select(item, selected) {
    items.value = items.value.map(row => row === item ? { ...row, selected } : row);
    count.value = items.value.filter(row => row.selected === true).length;
}
function toggleAll() {
    items.value = items.value.map(item => ({ ...item, selected: !item.selected }));
    // Legacy toggleAll deliberately leaves count_selected untouched.
}
function save() {
    const selected = (items.value ?? []).filter(item => item.selected);
    if (!selected.length) { aj.notify.info(aj.gettext('Please select at least one file!')); return; }
    emit('close', { response: 'accept', items: selected });
}
async function mkdir() {
    const msg = await aj.messagebox.prompt(aj.gettext('Directory name :'), '');
    if (!alive) return;
    const path = currentPath.value + '/' + msg.value;
    await smb.createDirectory(path);
    if (alive) { aj.notify.success(path + aj.gettext(' created ')); await load(currentPath.value); }
}
async function rename(item) {
    const msg = await aj.messagebox.prompt(aj.gettext('New name :'), item.name);
    if (!alive) return;
    const path = currentPath.value + '/' + msg.value;
    await smb.move(item.path, path);
    if (alive) { aj.notify.success(item.path + aj.gettext(' renamed to ') + path); await load(currentPath.value); }
}
async function remove(item) {
    const kind = item.isDir ? 'directory ' : 'file ';
    await aj.messagebox.show({ text: aj.gettext('Are you sure you want to delete permanently the ' + kind + item.path + '?'), positive: aj.gettext('Delete'), negative: aj.gettext('Cancel') });
    if (!alive) return;
    await (item.isDir ? smb.delete_dir(item.path) : smb.delete_file(item.path));
    if (alive) { aj.notify.success(item.path + aj.gettext(' deleted !')); await load(currentPath.value); }
}
run(() => load(props.path));
const icons = { powerpoint: 'powerpoint', text: 'alt', code: 'code', word: 'word', pdf: 'pdf', excel: 'excel', audio: 'audio', archive: 'archive', video: 'video', image: 'image' };
const icon = type => type === 'file' ? 'far fa-file' : icons[type] ? `far fa-file-${icons[type]}` : undefined;
function bytes(value) {
    if (Number.isNaN(parseFloat(value)) || !Number.isFinite(value)) return '-';
    if (value === 0) return aj.gettext('0 bytes');
    const index = Math.floor(Math.log(value) / Math.log(1024)), number = value / 1024 ** index;
    return `${index === 0 ? Math.floor(number) : number.toFixed(1)} ${aj.gettext(['bytes', 'KB', 'MB', 'GB', 'TB', 'PB'][index])}`;
}
const title = computed(() => !props.action ? aj.gettext('Browse collected files') : aj.gettext(props.action === 'share' ? (props.user === 'all' ? 'Share files to all participants from directory {{print_path}}' : 'Share files to {{user}} from directory {{print_path}}') : 'Collect files from {{user}} from directory {{print_path}}').replace('{{user}}', props.user).replace('{{print_path}}', props.printPath));
</script>
<template>
    <div class="modal-header"><h4>{{ title }}</h4></div>
    <div class="modal-body">
        <div v-if="items === undefined" class="progress-spinner" role="status"><i class="fa fa-spinner fa-spin"></i></div>
        <SmbUpload :uploadpath="currentPath" @uploaded="reload">
            <template #default="{ browseRef, progress }">
                <div class="list-group" style="min-height:600px">
                    <div style="margin-bottom:20px;text-align:center">
                        <button data-mkdir class="btn btn-link float-end" :aria-label="aj.gettext('Directory name :')" @click="run(mkdir)"><i class="fas fa-folder-plus fa-2x"></i></button>
                        <button :ref="browseRef" class="btn btn-link float-end" :aria-label="aj.gettext('Upload file')"><i class="fas fa-cloud-upload-alt fa-2x"></i></button>
                        <button v-if="currentPath !== path" data-back class="btn btn-link float-start" :aria-label="aj.gettext('Back')" @click="run(back)"><i class="fas fa-arrow-left"></i></button>
                        &nbsp; <span v-if="action">{{ aj.gettext(action === 'share' ? 'Select files you want to share' : action === 'copy' ? 'Select files you want to copy' : 'Select files you want to move') }}</span>
                    </div>
                    <div v-if="items?.length === 0" class="alert alert-info">{{ aj.gettext('Empty directory.') }}</div>
                    <div v-if="progress.reduce((sum, item) => sum + item.progress, 0) !== progress.length * 100" class="uploads">
                        <h3>{{ aj.gettext('Uploading ... ') }}</h3>
                        <template v-for="p in progress" :key="p.id"><div v-if="p.progress < 100" style="margin-top:10px"><span>{{ p.name }} ({{ p.progress }} %) </span><div class="progress"><div class="progress-bar bg-warning c6-progress" role="progressbar" :aria-label="p.name" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="p.progress" :style="{ width: p.progress + '%' }"></div></div></div></template>
                    </div>
                    <div v-if="items?.length" class="list-group-item list-group-item-small">
                        <input v-if="action && action !== 'share'" v-model="toggle" data-toggle-all type="checkbox" :aria-label="aj.gettext('Select all')" @change="toggleAll">
                        <span data-count class="float-end">{{ count }} {{ aj.gettext('item(s) selected') }}</span>&nbsp;
                    </div>
                    <div v-for="item in rows" :key="item.path" :data-item="item.name" class="list-group-item list-group-item-small" :style="item.selected ? { background: '#ffc876' } : {}">
                        <button :data-delete-file="item.isFile ? '' : undefined" :data-delete-dir="item.isDir ? '' : undefined" class="btn btn-link list-group-btn" :aria-label="aj.gettext('Delete')" @click="run(() => remove(item))"><i class="fa fa-trash"></i></button>
                        <button data-rename class="btn btn-link list-group-btn" :aria-label="aj.gettext('New name :')" @click="run(() => rename(item))"><i class="fa fa-pen"></i></button>
                        <input v-if="action" type="checkbox" :checked="!!item.selected" :aria-label="item.name" @change="select(item, $event.target.checked)">
                        <a v-if="item.isDir" data-open href="" class="list-group-main" @click.prevent="run(() => load(item.path))"><i class="fa fa-fw fa-folder"></i> {{ item.name }}</a>
                        <span v-if="item.isFile" class="list-group-main"><i :class="icon(item.filetype)"></i> {{ item.name }} <span class="subtle">{{ bytes(item.size) }}</span></span>
                    </div>
                </div>
            </template>
        </SmbUpload>
    </div>
    <div class="modal-footer"><button v-if="action" data-save class="btn btn-light c6-button btn-flat" @click="save">{{ aj.gettext(action === 'share' ? 'Share' : 'Collect from User') }}</button> <button data-close class="btn btn-light c6-button btn-flat" @click="emit('cancel')">{{ aj.gettext('Close') }}</button></div>
</template>

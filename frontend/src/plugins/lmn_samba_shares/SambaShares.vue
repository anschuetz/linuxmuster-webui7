<script setup>
import { computed, inject, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useSambaAccess } from '../../common/access.mjs';
import { createSmbclient } from '../../common/smbclient.mjs';
import SmbUpload from '../../common/SmbUpload.vue';

const aj = inject('aj');
const client = createSmbclient(aj);
const allowed = useSambaAccess(aj);
const loading = ref(true);
const shares = ref();
const items = ref();
const activeShare = ref('');
const currentPath = ref();
const breadcrumbs = ref([]);
const protectedFiles = ref([]);
const dialog = ref(null);
const newName = ref('');
const nameInput = ref();
const clipboardKey = 'ngStorage-sambaSharesClipboard';
const clipboard = ref(JSON.parse(localStorage.getItem(clipboardKey)) || []);
const sidebar = ref(true);
const sidebarChanged = event => { sidebar.value = event.detail; };
window.addEventListener('lmn-samba-shares-sidebar', sidebarChanged);
onBeforeUnmount(() => window.removeEventListener('lmn-samba-shares-sidebar', sidebarChanged));
const icons = {
    powerpoint: 'far fa-file-powerpoint', text: 'far fa-file-alt', code: 'far fa-file-code',
    word: 'far fa-file-word', pdf: 'far fa-file-pdf', excel: 'far fa-file-excel',
    audio: 'far fa-file-audio', archive: 'far fa-file-archive', video: 'far fa-file-video',
    image: 'far fa-file-image', file: 'far fa-file',
};
const selected = computed(() => (items.value || []).filter(item => item.selected));
const sortedItems = computed(() => [...(items.value || [])].sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    const x = a.name.toLowerCase(), y = b.name.toLowerCase();
    return x < y ? -1 : x > y ? 1 : 0;
}));
aj.pageTitle.set(aj.gettext('Samba shares'));
watch(() => aj.identity.user, async user => {
    if (user === null) return;
    if (user === 'root') { loading.value = false; return; }
    try {
        shares.value = await client.shares(user);
        // Preserve the legacy removal loop (including skipping a following entry).
        for (let index = 0; index < shares.value.length; index++) {
            const share = shares.value[index];
            if (share.name === 'Home') {
                currentPath.value = share.path;
                loadShare(share);
            } else if (share.name === null) {
                shares.value = shares.value.filter((_, position) => position !== index);
            }
        }
    } catch { /* Shares failures retain the spinner; aj.http owns the HTTP error policy. */ }
}, { immediate: true });

function loadShare(share) {
    shares.value = shares.value.map(item => ({ ...item, active: item.path === share.path }));
    activeShare.value = { ...share, active: true };
    // Original missing braces protect .upload on every share, transfer only on Home.
    protectedFiles.value = [...(share.name === 'Home' ? [`${share.path}/transfer`] : []), `${share.path}/.upload`];
    return loadPath(share.path);
}
async function loadPath(path) {
    let progressive = activeShare.value.path;
    breadcrumbs.value = path.replace(activeShare.value.path, '').split('/').filter(Boolean).map(name => {
        progressive += `/${name}`;
        return { name, path: progressive };
    });
    try {
        items.value = (await client.list(path)).items;
        currentPath.value = path;
    } catch (error) { aj.notify.error(aj.gettext('Could not load directory : '), error.data.message); }
    finally { loading.value = false; }
}
const reload = () => loadPath(currentPath.value);
const isProtected = item => ['transfer', '.upload'].includes(item.name) && protectedFiles.value.includes(item.path);
const clearSelection = () => { items.value = items.value.map(item => ({ ...item, selected: false })); };
const toggleSelection = item => { items.value = items.value.map(value => value === item ? { ...value, selected: !value.selected } : value); };
async function rename(item) {
    let message;
    try { message = await aj.messagebox.prompt(aj.gettext('New name :'), item.name); }
    catch { return; } // Dialog dismissal is not an SMB failure.
    const destination = `${currentPath.value}/${message.value}`;
    await client.move(item.path, destination);
    // SMB transfer errors are swallowed by the original service; retain the second notification.
    aj.notify.success(item.path + aj.gettext(' renamed to ') + destination);
    reload();
}
function setClipboard(value) {
    clipboard.value = value;
    localStorage.setItem(clipboardKey, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent('lmn-samba-shares-clipboard', { detail: value }));
}
function addClipboard(mode) {
    for (const item of selected.value) {
        setClipboard([...clipboard.value.filter(value => value.item.path !== item.path), { item: { ...item, selected: false }, mode }]);
    }
    clearSelection();
}
function clearClipboard() { setClipboard([]); dialog.value = null; }
async function paste() {
    const transfers = [], prompts = [];
    for (const operation of structuredClone(clipboard.value.map(value => ({ ...value, item: { ...value.item } })))) {
        const item = operation.item;
        const destination = `${currentPath.value}/${item.name}`;
        if (operation.mode === 'copy') {
            if (item.path === destination) {
                prompts.push(aj.messagebox.prompt(aj.gettext('A file/directory with this name already exists, please give a new name :'), item.name)
                    .then(message => { transfers.push(client.copy(item.path, `${currentPath.value}/${message.value}`)); }));
            } else transfers.push(client.copy(item.path, destination));
        }
        if (operation.mode === 'move') transfers.push(client.move(item.path, destination));
    }
    try {
        await Promise.all(prompts);
        await Promise.all(transfers);
        clearSelection(); clearClipboard(); reload();
    } catch { /* Cancelled conflict prompts retain the clipboard, as in Angular. */ }
}
async function deleteItem(item) {
    try {
        await aj.messagebox.show({
            text: aj.gettext(item.isDir ? 'Do you really want to delete this directory?' : 'Do you really want to delete this file?'),
            positive: aj.gettext('Delete'), negative: aj.gettext('Cancel'),
        });
    } catch { return; }
    try {
        await (item.isDir ? client.delete_dir(item.path) : client.delete_file(item.path));
        aj.notify.success(item.path + aj.gettext(' deleted !')); reload();
    } catch (error) { aj.notify.error(aj.gettext('Error during deleting : '), error.data.message); }
}
async function deleteSelected() {
    try {
        await aj.messagebox.show({ text: aj.gettext('Delete selected items?'), positive: aj.gettext('Delete'), negative: aj.gettext('Cancel') });
    } catch { return; }
    let last;
    for (const item of selected.value) {
        last = (item.isDir ? client.delete_dir(item.path) : client.delete_file(item.path))
            .then(() => aj.notify.success(item.name + ' deleted!')).catch(error => aj.notify.error(error));
    }
    clearSelection();
    // Deliberately wait only for the last operation, preserving the original bulk-delete race.
    return last.then(reload);
}
function showNew(kind) {
    newName.value = ''; dialog.value = kind;
    nextTick(() => nameInput.value.focus());
}
async function create() {
    if (!newName.value) return;
    const directory = dialog.value === 'directory';
    try {
        await (directory ? client.createDirectory : client.createFile)(`${currentPath.value}/${newName.value}`);
        reload(); dialog.value = null;
    } catch (error) { aj.notify.error(aj.gettext(directory ? 'Could not create directory' : 'Could not create file'), error.data.message); }
}
async function download(item) {
    const url = `/api/lmn/smbclient/download?path=${item.download_url}`;
    try { await aj.http.head(url); window.open(url); }
    catch { aj.notify.error(aj.gettext('File not found, may be due to special chars in the file name.')); }
}

function uploaded() {
    // Legacy `for (file in $flow.files)` reads indices; its success message has no names.
    aj.notify.success(aj.gettext('Uploaded ')); reload();
}
function bytes(value) {
    if (isNaN(parseFloat(value)) || !isFinite(value)) return '-';
    if (value === 0) return aj.gettext('0 bytes');
    const units = ['bytes', 'KB', 'MB', 'GB', 'TB', 'PB'].map(aj.gettext);
    const number = Math.floor(Math.log(value) / Math.log(1024));
    const size = value / Math.pow(1024, number);
    return `${number === 0 ? Math.floor(size) : size.toFixed(1)} ${units[number]}`;
}
function keyboardFocus(event) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const focused = event.currentTarget.querySelector(':focus');
    (event.key === 'ArrowDown' ? focused?.nextElementSibling : focused?.previousElementSibling)?.focus();
    event.preventDefault();
}
</script>

<template>
    <div v-if="allowed">
        <div class="row" style="padding-bottom:100px">
            <component :is="'progress-spinner'" v-show="loading" class="shares-spinner"><div><div class="one"></div><div class="two"></div></div></component>
            <br>
            <div><button v-for="share in shares" :key="share.path" class="btn btn-lmn share-button" style="margin-left:20px" :style="share.active && { backgroundColor: '#ffc876' }" @click="loadShare(share)"><i :class="share.icon"></i> {{ share.name }}</button></div>
            <br style="clear:right">
            <ol class="breadcrumb">
                <li><a href="#" @click.prevent="loadPath(activeShare.path)"><i :class="activeShare.icon"></i></a></li>
                <li v-for="(item, index) in breadcrumbs" :key="item.path" :class="{ active: index === breadcrumbs.length - 1 }"><a v-if="index !== breadcrumbs.length - 1" href="#" @click.prevent="loadPath(item.path)">{{ item.name }}</a><span v-else>{{ item.name }}</span></li>
            </ol>
            <br style="clear:both">
            <SmbUpload :uploadpath="currentPath" :notify-success="false" class="list-group" @uploaded="uploaded" @keydown="keyboardFocus">
                <template #default="{ browseRef, progress }">
                    <div style="min-height:600px">
                        <div v-show="progress.length * 100 !== progress.reduce((sum, item) => sum + item.progress, 0)" class="uploads">
                            <h3>{{ aj.gettext('Uploading ...') }}</h3>
                            <template v-for="item in progress" :key="item.id"><div v-show="item.progress < 100" style="margin-top:10px"><span>{{ item.name }} ({{ item.progress }} %) </span><component :is="'smart-progress'" type="warning" :max="100" :value="item.progress"><div class="progress"><div class="progress-bar progress-bar-warning" role="progressbar" :aria-label="item.name" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="item.progress" :style="{ width: item.progress + '%' }"></div></div></component></div></template>
                        </div>
                        <div v-for="item in sortedItems" :key="item.path" class="list-group-item list-group-item-small" :test-bind-item="item.name" :style="item.selected && { background: '#ffc876' }">
                            <a v-if="item.isFile || (item.isDir && !isProtected(item))" class="list-group-btn" @click="deleteItem(item)"><i class="fa fa-trash"></i></a>
                            <a v-if="!isProtected(item)" class="list-group-btn" @click="rename(item)"><i class="fa fa-pen"></i></a>
                            <a class="list-group-btn" @click="download(item)"><i class="fas fa-download"></i></a>
                            <div class="list-group-addon pull-left"><span v-if="!isProtected(item)" checkbox class="subtle" :class="{ active: item.selected }" @click="toggleSelection(item)"><i class="fa fa-square-o off"></i><i class="fa fa-check-square on"></i></span></div>
                            <a v-if="item.isDir" class="list-group-main" @click="loadPath(item.path)"><i class="fa fa-fw fa-folder"></i> {{ item.name }}</a>
                            <span v-if="item.isFile" class="list-group-main"><i :class="icons[item.filetype]"></i> {{ item.name }} <span class="subtle">{{ bytes(item.size) }}</span></span>
                        </div>
                        <component :is="'floating-toolbar'"><div class="container"><div class="row"><div :class="{ 'col-md-3': sidebar }"></div><div class="toolbar-content" :class="sidebar ? 'col-md-9' : 'col-md-12'"><div class="bar row">
                            <a v-if="clipboard.length" data-clipboard class="btn btn-default btn-flat pull-right" @click="dialog = 'clipboard'"><i class="fa fa-paste"></i> {{ clipboard.length }}</a>
                            <a class="btn btn-default btn-flat" @click="showNew('file')">{{ aj.gettext('New file') }}</a>
                            <a class="btn btn-default btn-flat" @click="showNew('directory')">{{ aj.gettext('New directory') }}</a>
                            <span :ref="browseRef" class="btn btn-default btn-flat">{{ aj.gettext('Upload') }}</span>
                            <a v-if="clipboard.length" class="btn btn-default btn-flat" @click="paste">{{ aj.gettext('Paste here') }}</a>
                        </div></div></div></div></component>
                        <component :is="'floating-toolbar'" v-show="selected.length" class="accented"><div class="container"><div class="row"><div :class="{ 'col-md-3': sidebar }"></div><div class="toolbar-content" :class="sidebar ? 'col-md-9' : 'col-md-12'"><div class="bar row">
                            <a disabled class="btn btn-default btn-flat pull-right"><strong>{{ selected.length }}</strong> {{ aj.gettext('items selected') }}</a>
                            <a class="btn btn-default btn-flat" @click="addClipboard('move')">{{ aj.gettext('Cut') }}</a>
                            <a class="btn btn-default btn-flat" @click="addClipboard('copy')">{{ aj.gettext('Copy') }}</a>
                            <a class="btn btn-default btn-flat" @click="deleteSelected">{{ aj.gettext('Delete') }}</a>
                        </div></div></div></div></component>
                    </div>
                </template>
            </SmbUpload>
        </div>
        <dialog v-if="dialog === 'file' || dialog === 'directory'" open class="block-element animate-modal"><div class="modal"><div class="modal-dialog"><div class="modal-content">
            <div class="modal-header"><h4>{{ aj.gettext(dialog === 'file' ? 'New file' : 'New directory') }}</h4></div>
            <div class="modal-body"><input ref="nameInput" v-model.trim="newName" type="text" class="form-control" :placeholder="aj.gettext(dialog === 'file' ? 'File name' : 'Directory name')" autofocus @keydown.enter="create"></div>
            <div class="modal-footer"><a class="btn btn-default btn-flat" @click="create">{{ aj.gettext('Create') }}</a><a class="btn btn-default btn-flat" @click="dialog = null">{{ aj.gettext('Cancel') }}</a></div>
        </div></div></div></dialog>
        <dialog v-if="dialog === 'clipboard' && clipboard.length" open class="block-element animate-modal"><div class="modal"><div class="modal-dialog"><div class="modal-content">
            <div class="modal-header"><h4>{{ aj.gettext('Clipboard') }}</h4></div>
            <div class="modal-body"><div class="list-group"><div v-for="(operation, index) in clipboard" :key="operation.item.path" class="list-group-item list-group-item-small">
                <a class="list-group-btn subtle" :title="aj.gettext('Remove')" @click="setClipboard(clipboard.filter((_, position) => position !== index))"><i class="fa fa-times"></i></a>
                <div class="list-group-main"><i class="fa fa-fw" :class="operation.mode === 'move' ? 'fa-cut' : 'fa-copy'"></i> &nbsp; <i v-if="operation.item.isDir" class="fa fa-fw fa-folder-o"></i><i v-if="operation.item.isFile" class="fa fa-fw fa-file-o"></i> &nbsp; {{ operation.item.path }}</div>
            </div></div></div>
            <div class="modal-footer"><a class="btn btn-default btn-flat" @click="clearClipboard">{{ aj.gettext('Remove all items') }}</a><a class="btn btn-default btn-flat" @click="dialog = null">{{ aj.gettext('Close') }}</a></div>
        </div></div></div></dialog>
    </div>
    <div v-else class="text-center root-access-blocker"><h1><i class="fas fa-exclamation-triangle"></i></h1><h4 class="alert alert-danger">{{ aj.gettext('You should not use WebUI as root user!') }}<br>{{ aj.gettext('If this is your first time running WebUI, proceed through the') }} <a href="/view/lmn/init/welcome">{{ aj.gettext('setup wizard') }}</a>.<br>{{ aj.gettext('Afterwards login using the global-admin account.') }}</h4></div>
</template>

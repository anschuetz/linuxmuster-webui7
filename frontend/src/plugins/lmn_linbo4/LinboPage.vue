<script setup>
import { computed, inject, onBeforeUnmount, ref } from 'vue';
import { editConfig } from './config.mjs';
import { importDevices } from './import.mjs';
import GroupsTab from './GroupsTab.vue';
import ImagesTab from './ImagesTab.vue';
import { createImageActions } from './images.mjs';
import { createDestructiveActions, replaceImage } from './imageActions.mjs';
import ImageBackupsDialog from './ImageBackupsDialog.vue';
import { createGroups, initialTab } from './groups.mjs';
const aj = inject('aj');
const emit = defineEmits(['edit-config', 'import-devices', 'download-iso']);
const groups = createGroups(aj);
const { state } = groups;
const imageActions = createImageActions(aj, (original, result) => {
    state.images = replaceImage(state.images, original, result);
});
const destructive = createDestructiveActions(aj, imageActions.restartServices);
const selected = ref([]);
function toggleImage(image) {
    selected.value = selected.value.includes(image.name) ? selected.value.filter(name => name !== image.name) : [...selected.value, image.name];
    state.images = state.images.map(item => item === image ? { ...item, selected: !item.selected } : item);
}
async function showBackups(image) {
    try {
        await aj.modal.open(ImageBackupsDialog, {
            image, getImage: () => state.images.find(item => item.name === image.name),
            editImage: backup => imageActions.editImage(backup, state.images),
            restoreBackup: destructive.restoreBackup, deleteBackupImage: destructive.deleteBackupImage,
        });
    } catch { /* Modal dismissal. */ }
}
const sidebar = computed(() => aj.shell.layout.sidebar);
const tab = ref(initialTab(window.location.hash));
aj.pageTitle.set(aj.gettext('LINBO 4'));
const offLeave = aj.guardLeave(() => !state.changed || window.confirm(aj.gettext('You should call an import devices process to apply the new changes, quit this page anyway ?')));
onBeforeUnmount(offLeave);
groups.load();
function edit(...args) { emit('edit-config', ...args); return editConfig(aj, args[0], () => { state.changed = true; }); }
function apply() { emit('import-devices'); return importDevices(aj, () => { state.changed = false; }); }
function downloadIso() { emit('download-iso'); window.location.href = '/lmn/download/linbo.iso'; }

</script>

<template>
    <br>
    <component :is="'progress-spinner'" v-if="state.configs === undefined" role="status"><div><div class="one"></div><div class="two"></div></div></component>
    <div v-else>
        <ul class="nav nav-tabs c8-tabs">
            <li class="nav-item"><a class="nav-link" :class="{ active: tab === 0 }" href="" @click.prevent="tab = 0">{{ aj.gettext('Groups') }}</a></li>
            <li class="nav-item"><a class="nav-link" :class="{ active: tab === 1 }" href="" @click.prevent="tab = 1">{{ aj.gettext('Images') }}</a></li>
        </ul>
        <div v-show="tab === 0"><GroupsTab :sidebar="sidebar" :configs="state.configs" :examples="state.examples" :changed="state.changed"
            @create-config="groups.createConfig" @duplicate-config="groups.duplicateConfig" @delete-config="groups.deleteConfig"
            @edit-config="edit" @import-devices="apply" @download-iso="downloadIso" /></div>
        <div v-show="tab === 1"><slot name="images" :images="state.images"><ImagesTab :sidebar="sidebar" :images="state.images" @edit-image="imageActions.editImage($event, state.images)" @duplicate-image="imageActions.duplicateImage"
            @show-backups="showBackups" @delete-image="destructive.deleteImage" @delete-diff="destructive.deleteDiffImage"
            @toggle-image="toggleImage" :has-selected="selected.length > 0" @delete-selected="destructive.deleteImages(selected.map(name => state.images.find(image => image.name === name)))" /></slot></div>
    </div>
</template>

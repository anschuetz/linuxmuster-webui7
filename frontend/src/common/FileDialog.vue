<script setup>
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, toRefs, watch } from 'vue';
import { createFileBrowser } from './fileBrowser.mjs';
import { withinRoot } from './filesystem.mjs';
const props = defineProps({ mode: { type: String, default: 'open' }, root: String, path: String, name: String, browser: Object });
const emit = defineEmits(['close', 'cancel']);
const aj = inject('aj');
const root = computed(() => props.root ?? aj.identity.profile.fs_root ?? '/');
const browser = props.browser || createFileBrowser(aj, () => root.value, props.path);
const { path, parent, loading, error } = toRefs(browser);
const name = ref(props.name || ''), list = ref();
const visible = computed(() => browser.sorted.filter(item => props.mode !== 'directory' || item.isDir));
const focus = () => list.value?.querySelector('button')?.focus();
onMounted(async () => { await browser.ready; await nextTick(); focus(); });
async function navigate(target, explicit = false) { await browser.navigate(target, explicit); await nextTick(); focus(); }
function choose(target) {
    if (withinRoot(target, root.value)) emit('close', target);
    else browser.error = aj.gettext('Path is outside the selected root');
}
function select(item) {
    if (item.isDir) return navigate(item.path, true);
    if (props.mode === 'open') choose(item.path);
    if (props.mode === 'save') name.value = item.name;
}
function move(direction) {
    const active = document.activeElement;
    const next = direction > 0 ? active.nextElementSibling : active.previousElementSibling;
    if (next?.matches('button')) next.focus();
}
function bytes(value) {
    if (!Number.isFinite(value)) return '-';
    if (value === 0) return aj.gettext('0 bytes');
    const index = Math.floor(Math.log(value) / Math.log(1024));
    const number = value / 1024 ** index;
    return `${index === 0 ? Math.floor(number) : number.toFixed(1)} ${aj.gettext(['bytes', 'KB', 'MB', 'GB', 'TB', 'PB'][index])}`;
}
watch(() => [root.value, props.path], () => navigate(props.path ?? root.value));
watch(() => props.name, value => { name.value = value || ''; });
onBeforeUnmount(() => { if (!props.browser) browser.dispose(); });
</script>
<template>
    <div @keydown.esc.stop.prevent="emit('cancel')">
        <div class="modal-header"><h4 class="modal-title">{{ path }}</h4></div>
        <div class="modal-body file-open-dialog scrollable">
            <p v-if="loading" role="status">{{ aj.gettext('Loading') }}</p>
            <p v-if="error" role="alert">{{ error }}</p>
            <div v-show="!loading" ref="list" class="list-group" @keydown.down.prevent="move(1)" @keydown.up.prevent="move(-1)">
                <button v-if="parent" type="button" class="list-group-item list-group-item-action" @click="navigate(parent, true)"><i class="fa fa-fw fa-level-up"></i>{{ aj.gettext('Up one level') }}</button>
                <button v-for="item in visible" :key="item.path" type="button" class="list-group-item list-group-item-action" :data-path="item.path" @click="select(item)"><i class="fa fa-fw" :class="{ 'fa-folder-o': item.isDir, 'fa-file-o': item.isFile }"></i>{{ item.name }} <span v-if="item.isFile && item.size != null" class="subtle">{{ bytes(item.size) }}</span></button>
            </div>
            <label v-if="mode === 'save'">{{ aj.gettext('File name') }}<input v-model.trim="name" class="form-control" required></label>
        </div>
        <div class="modal-footer">
            <button v-if="mode === 'directory'" class="btn btn-primary" :disabled="loading || !!error" @click="choose(path)">{{ aj.gettext('Select this directory') }}</button>
            <button v-if="mode === 'save'" class="btn btn-primary" :disabled="!name || loading || !!error" @click="choose(path + '/' + name)">{{ aj.gettext('Save') }}</button>
            <button class="btn btn-light common-file-button" @click="emit('cancel')">{{ aj.gettext('Cancel') }}</button>
        </div>
    </div>
</template>

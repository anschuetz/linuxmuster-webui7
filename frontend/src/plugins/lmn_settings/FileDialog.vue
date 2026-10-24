<script setup>
import { inject, nextTick, onMounted, ref, toRefs } from 'vue';
import { createFileBrowser } from './filebrowser.mjs';
const props = defineProps(['browser']);
const emit = defineEmits(['close', 'cancel']);
const aj = inject('aj');
const browser = props.browser || createFileBrowser(aj);
const { path, parent, loading, sorted } = toRefs(browser);
const list = ref();
const focus = () => list.value?.querySelector('a')?.focus();
onMounted(async () => { await browser.ready; await nextTick(); focus(); });
async function navigate(path, explicit = false) { await browser.navigate(path, explicit); await nextTick(); focus(); }
function move(direction) {
    const active = document.activeElement;
    const next = direction > 0 ? active.nextElementSibling : active.previousElementSibling;
    if (next?.matches('a')) next.focus();
}
function bytes(value) {
    if (Number.isNaN(parseFloat(value)) || !Number.isFinite(value)) return '-';
    if (value === 0) return aj.gettext('0 bytes');
    const index = Math.floor(Math.log(value) / Math.log(1024));
    const number = value / 1024 ** index;
    return `${index === 0 ? Math.floor(number) : number.toFixed(1)} ${aj.gettext(['bytes', 'KB', 'MB', 'GB', 'TB', 'PB'][index])}`;
}
</script>
<template>
    <div class="modal-header"><h4 class="modal-title">{{ path }}</h4></div>
    <div class="modal-body file-open-dialog scrollable">
        <component :is="'progress-spinner'" v-if="loading"><div><div class="one"></div><div class="two"></div></div></component>
        <div ref="list" v-show="!loading" class="list-group" @keydown.down.prevent="move(1)" @keydown.up.prevent="move(-1)">
            <a v-if="parent" href="#" class="list-group-item" @click.prevent="navigate(parent)"><i class="fa fa-fw fa-level-up"></i> {{ aj.gettext('Up one level') }}</a>
            <a v-for="(item, index) in sorted" :key="index" href="#" class="list-group-item" @click.prevent="item.isDir ? navigate(item.path, true) : emit('close', item.path)">
                <i class="fa fa-fw" :class="{ 'fa-folder-o': item.isDir, 'fa-file-o': item.isFile }"></i>
                {{ item.name }} <span v-if="item.isFile" class="subtle">{{ bytes(item.size) }}</span>
            </a>
        </div>
    </div>
    <div class="modal-footer"><a class="btn btn-default btn-flat" @click="emit('cancel')">{{ aj.gettext('Cancel') }}</a></div>
</template>

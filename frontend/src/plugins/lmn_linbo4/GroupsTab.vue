<script setup>
import { computed, inject, onBeforeUnmount, ref } from 'vue';
import { sortedConfigs } from './groups.mjs';
const aj = inject('aj');
const props = defineProps({ configs: { type: Array, required: true }, examples: Array, changed: Boolean, sidebar: { type: Boolean, default: true } });
const emit = defineEmits(['edit-config', 'create-config', 'duplicate-config', 'delete-config', 'import-devices', 'download-iso']);
const shown = computed(() => sortedConfigs(props.configs));
const menu = ref(false);
const outside = event => { if (!event.target.closest('[data-config-create]')) menu.value = false; };
const keydown = event => { if (event.key === 'Escape') menu.value = false; };
window.addEventListener('click', outside);
window.addEventListener('keydown', keydown);
onBeforeUnmount(() => { window.removeEventListener('click', outside); window.removeEventListener('keydown', keydown); });
function create(example) { menu.value = false; emit('create-config', example); }
</script>

<template>
    <br>
    <table class="table">
        <thead><tr><th>{{ aj.gettext('Group name') }}</th><th>{{ aj.gettext('Used images') }}</th><th colspan="3">{{ aj.gettext('Actions') }}</th></tr></thead>
        <tbody><tr v-for="(config, index) in shown" :key="index">
            <td style="cursor:pointer" @click="emit('edit-config', config.file)"><b>{{ config.file.substring('start.conf.'.length) }}</b></td>
            <td style="cursor:pointer" @click="emit('edit-config', config.file)">
                <template v-for="(image, imageIndex) in config.images" :key="imageIndex">
                    <span v-if="image" class="badge c8-label" :class="image.endsWith('.qcow2') ? 'bg-info' : 'bg-secondary'" style="display:inline-block">{{ image }}</span>{{ ' ' }}
                </template>
            </td>
            <td width="1"><button class="btn c8-button" @click="emit('edit-config', config.file, true)"><i class="fa fa-pencil"></i></button></td>
            <td width="1"><button class="btn c8-button" @click="emit('duplicate-config', config.file)"><i class="fa fa-copy"></i></button></td>
            <td width="1"><button class="btn c8-button" @click="emit('delete-config', config.file)"><i class="fa fa-trash-o"></i></button></td>
        </tr></tbody>
    </table>
    <div class="floating-toolbar-padder"></div>
    <component :is="'floating-toolbar'"><div class="container"><div class="row"><div :class="{ 'col-md-3': sidebar }"></div><div class="c8-menu-host" :class="sidebar ? 'col-md-9' : 'col-md-12'"><div class="bar row">
        <button class="btn btn-lmn float-end" @click="emit('download-iso')">{{ aj.gettext('Download Linbo Boot') }}</button>
        <button v-if="changed" data-action="import" class="btn btn-lmn float-end" @click="emit('import-devices')">{{ aj.gettext('Import devices') }}</button>
        <div data-config-create class="dropup c8-create-menu" style="width:50%" :class="{ show: menu }">
            <button data-action="create" class="btn btn-lmn" :aria-expanded="menu" @click="menu = !menu"><i class="fa fa-plus"></i> <span>{{ aj.gettext('Create') }}</span> <i class="fa fa-caret-up"></i></button>
            <ul v-show="menu" class="dropdown-menu scrollable" :class="{ show: menu }">
                <li><a class="dropdown-item" data-example="" @click="create()">{{ aj.gettext('Empty') }}</a></li>
                <li v-for="(example, index) in examples" :key="index"><a class="dropdown-item" :data-example="example" @click="create(example)">{{ example }}</a></li>
            </ul>
        </div>
    </div></div></div></div></component>
</template>

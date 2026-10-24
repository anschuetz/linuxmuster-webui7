<script setup>
import { computed, inject } from 'vue';
import FileDialog from './FileDialog.vue';
import { createFileBrowser } from './filebrowser.mjs';
const props = defineProps(['modelValue']);
const emit = defineEmits(['update:modelValue']);
const aj = inject('aj');
const browser = createFileBrowser(aj);
const value = computed({ get: () => props.modelValue, set: next => emit('update:modelValue', next) });
async function browse() {
    try { emit('update:modelValue', await aj.modal.open(FileDialog, { browser }, { backdrop: 'static' })); }
    catch { /* Cancel retains the original path. */ }
}
</script>
<template>
    <div class="input-group"><input v-model.trim="value" type="text" class="form-control"><span class="input-group-addon"><a @click="browse"><i class="fa fa-folder-open"></i></a></span></div>
</template>

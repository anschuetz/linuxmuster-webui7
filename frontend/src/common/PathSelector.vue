<script setup>
import { computed, inject, onBeforeUnmount } from 'vue';
import { createFileBrowser } from './fileBrowser.mjs';
import FileDialog from './FileDialog.vue';
const props = defineProps({ modelValue: String, mode: { type: String, default: 'open' }, required: Boolean });
const emit = defineEmits(['update:modelValue']);
const value = computed({ get: () => props.modelValue, set: value => emit('update:modelValue', value) });
const aj = inject('aj');
const browser = createFileBrowser(aj);
onBeforeUnmount(() => browser.dispose());
async function browse() {
    try { emit('update:modelValue', await aj.modal.open(FileDialog, { mode: props.mode, browser }, { backdrop: 'static' })); }
    catch { /* Cancelling retains the current model, like pathSelector. */ }
}
</script>
<template>
    <div class="input-group">
        <input v-model.trim="value" type="text" class="form-control" :required="required">
        <span class="input-group-addon"><a role="button" tabindex="0" :aria-label="aj.gettext('Select path')" @click="browse" @keydown.enter.prevent="browse"><i class="fa fa-folder-open"></i></a></span>
    </div>
</template>

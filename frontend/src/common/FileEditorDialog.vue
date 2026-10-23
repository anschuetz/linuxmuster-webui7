<script setup>
import { inject, onMounted, onBeforeUnmount, ref } from 'vue';
import { fileUrl } from './fileEditor.mjs';

const props = defineProps({ path: { type: String, required: true }, encoding: String });
const emit = defineEmits(['close', 'cancel']);
const aj = inject('aj');
const content = ref('');
const busy = ref(true);
const loaded = ref(false);
const error = ref('');
const aceHost = ref(null);
const hasAce = Boolean(window.ace?.edit);
let editor;
let readers = [];
let disposed = false;
const changed = () => { content.value = editor.getValue(); };
function setContent(value) {
    if (disposed) return;
    content.value = value;
    editor?.setValue(value, -1);
}
onMounted(async () => {
    if (hasAce) {
        editor = window.ace.edit(aceHost.value);
        editor.on('change', changed);
        editor.setReadOnly(true);
    }
    try {
        setContent((await aj.http.get(fileUrl('read', props.path, props.encoding))).data);
        loaded.value = true;
    }
    catch (cause) { error.value = aj.gettext('Could not read file') + ': ' + String(cause.message || cause); }
    finally { busy.value = false; editor?.setReadOnly(Boolean(error.value)); }
});
async function save() {
    busy.value = true;
    error.value = '';
    try {
        await aj.http.post(fileUrl('write', props.path, props.encoding), content.value);
        if (!disposed) emit('close', content.value);
    } catch (cause) { error.value = aj.gettext('Could not save file') + ': ' + String(cause.message || cause); }
    finally { busy.value = false; }
}
function drop(event) {
    if (busy.value) return;
    for (const file of event.dataTransfer.files) {
        const reader = new FileReader();
        readers = [...readers, reader];
        reader.onload = (event) => setContent(event.target.result);
        reader.onerror = () => { error.value = aj.gettext('Could not read file'); };
        reader.readAsText(file, props.encoding || 'utf-8');
    }
}
function download() {
    const url = URL.createObjectURL(new Blob([content.value], { type: 'text/csv' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = props.path.split('/').at(-1);
    document.body.append(anchor);
    try { anchor.click(); }
    finally { anchor.remove(); URL.revokeObjectURL(url); }
}
onBeforeUnmount(() => {
    disposed = true;
    for (const reader of readers) {
        reader.onload = null;
        reader.onerror = null;
        if (reader.readyState === 1) reader.abort();
    }
    editor?.off('change', changed);
    editor?.destroy();
    editor = undefined;
});
</script>

<template>
    <div class="modal-header"><h4>{{ path }}</h4></div>
    <div class="modal-body">
        <p v-if="error" role="alert" class="alert alert-danger">{{ error }}</p>
        <div data-drop class="well" @dragover.stop.prevent @drop.stop.prevent="drop">{{ aj.gettext('Drop a CSV file here to import') }}</div>
        <div v-if="hasAce" ref="aceHost" style="height: 55vh" :aria-label="path"></div>
        <textarea v-else v-model="content" :aria-label="path" :disabled="busy" class="form-control" rows="20"></textarea>
    </div>
    <div class="modal-footer">
        <button class="btn btn-default" :disabled="busy || !loaded" @click="save">{{ aj.gettext('Save') }}</button>
        <button class="btn btn-default" :disabled="busy || !loaded" @click="download">{{ aj.gettext('Download CSV') }}</button>
        <button class="btn btn-default" @click="emit('cancel')">{{ aj.gettext('Cancel') }}</button>
    </div>
</template>

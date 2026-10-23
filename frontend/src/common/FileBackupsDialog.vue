<script setup>
import { inject, onMounted, onBeforeUnmount, ref } from 'vue';
import { fileUrl } from './fileEditor.mjs';
import FileDiffDialog from './FileDiffDialog.vue';

const props = defineProps({ path: { type: String, required: true }, encoding: String });
const emit = defineEmits(['close', 'cancel']);
const aj = inject('aj');
const backups = ref([]);
const busy = ref(false);
const error = ref('');
let disposed = false;
const dir = props.path.substring(0, props.path.lastIndexOf('/'));
const name = props.path.substring(props.path.lastIndexOf('/') + 1);
const backupPath = (backup) => `${dir}/${backup.name}`;
async function run(action) {
    busy.value = true;
    error.value = '';
    try { await action(); }
    catch (cause) { if (!disposed) error.value = aj.gettext('Backup operation failed') + ': ' + String(cause.message || cause); }
    finally { busy.value = false; }
}
onMounted(() => run(async () => {
    const { data } = await aj.http.get(`/api/filesystem/list/${dir.split('/').map(encodeURIComponent).join('/')}`);
    if (!disposed) backups.value = data.items.filter((item) => item.name.startsWith(`.${name}.bak.`))
        .map((item) => ({ name: item.name, date: new Date(1000 * parseInt(item.name.split('.').at(-1), 10)) }))
        .sort((a, b) => b.date - a.date);
}));
function diff(backup) {
    return run(async () => {
        const { data } = await aj.http.post('/api/lmn/diff', { file1: props.path, file2: backupPath(backup) });
        if (!disposed) {
            // Closing the read-only diff is normal modal cancellation.
            await aj.modal.open(FileDiffDialog, { path: props.path, lines: data }).catch(() => {});
        }
    });
}
async function onlyRemove(backup) {
    await aj.http.post('/api/lmn/remove-file', { filepath: backupPath(backup) });
    if (!disposed) backups.value = backups.value.filter((item) => item.name !== backup.name);
}
function restore(backup) {
    return run(async () => {
        const { data } = await aj.http.get(fileUrl('read', backupPath(backup), props.encoding));
        await aj.http.post(fileUrl('write', props.path, props.encoding), data);
        await onlyRemove(backup);
        if (!disposed) {
            aj.notify.success(aj.gettext('Backup file restored'));
            emit('close');
            aj.reload();
        }
    });
}
function remove(backup) {
    return run(async () => {
        try {
            await aj.messagebox.show({ title: aj.gettext('Confirmation'), text: aj.gettext('Do you really want to delete') + ' ' + backup.name + ' ?', positive: 'OK', negative: aj.gettext('Cancel') });
        } catch { return; }
        if (disposed) return;
        await onlyRemove(backup);
        if (!disposed) aj.notify.success(aj.gettext('Backup file removed'));
    });
}
onBeforeUnmount(() => { disposed = true; });
</script>
<template>
    <div class="modal-header"><h4>{{ aj.gettext('Backups') }} · {{ path }}</h4></div>
    <div class="modal-body">
        <p v-if="error" role="alert" class="alert alert-danger">{{ error }}</p>
        <p v-if="!busy && !backups.length" class="alert alert-info">{{ aj.gettext('No backups available') }}</p>
        <div v-for="backup in backups" :key="backup.name" :data-backup="backup.name" class="list-group-item">
            <span>{{ backup.date.toLocaleString() }}</span>
            <button class="btn btn-default" :disabled="busy" @click="diff(backup)">{{ aj.gettext('Show differences') }}</button>
            <button class="btn btn-default" :disabled="busy" @click="restore(backup)">{{ aj.gettext('Restore') }}</button>
            <button class="btn btn-default" :disabled="busy" @click="remove(backup)">{{ aj.gettext('Delete') }}</button>
        </div>
    </div>
    <div class="modal-footer"><button class="btn btn-default" @click="emit('cancel')">{{ aj.gettext('Close') }}</button></div>
</template>

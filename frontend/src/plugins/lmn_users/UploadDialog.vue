<script setup>
import { inject, onBeforeUnmount, ref } from 'vue';
import { uploadFilesystem } from '../../common/filesystemUpload.mjs';
import { createImport, uploadWarning } from './import.mjs';
const props = defineProps({ role: String, refresh: Function });
const emit = defineEmits(['close']), aj = inject('aj');
const uploading = ref(false), progress = ref(0);
let transfer, disposed = false;
async function upload(event, check) {
    const file = event.target.files[0];
    if (!file || uploading.value) return;
    uploading.value = true;
    transfer = uploadFilesystem(aj, file, '/tmp/', value => { progress.value = Math.floor(100 * value); });
    try {
        await transfer;
        transfer = undefined;
        if (disposed) return;
        aj.notify.success(aj.gettext('Uploaded'));
        emit('close');
        // A successful upload closes before the import/sorting chain, just like Angular.
        await createImport(aj).complete(props.role, file.name, check, props.refresh);
    } catch { /* Original has no local HTTP error toast; failed uploads retain the progress window. */ }
}
onBeforeUnmount(() => { disposed = true; transfer?.cancel(); });
</script>
<template>
    <div class="modal-header"><h4>{{ uploading ? `Uploading: ${progress}%` : aj.gettext('Upload CSV') }}</h4></div>
    <div class="modal-body">
        <div v-if="!uploading" class="alert alert-warning"><i class="fa fa-warning"></i> <span v-html="aj.gettext(uploadWarning)"></span></div>
        <div v-else class="progress"><div class="progress-bar progress-bar-warning" role="progressbar" :aria-valuenow="progress" aria-valuemin="0" aria-valuemax="100" :style="{width:progress+'%'}"></div></div>
    </div>
    <div v-if="!uploading" class="modal-footer">
        <button class="btn btn-default btn-flat" @click="emit('close')">{{ aj.gettext('Close') }}</button>
        <label class="btn btn-default btn-flat">{{ aj.gettext('Save directly') }}<input type="file" style="display:none" @change="upload($event,false)"></label>
        <label class="btn btn-default btn-flat">{{ aj.gettext('Check columns') }}<input type="file" style="display:none" @change="upload($event,true)"></label>
    </div>
</template>

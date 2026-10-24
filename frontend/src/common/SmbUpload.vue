<script setup>
import { inject, onBeforeUnmount, onMounted, ref } from 'vue';
import { createSmbclient } from './smbclient.mjs';

const props = defineProps({
    uploadpath: { type: String, required: true },
    target: { type: String, default: '/api/lmn/smbclient/upload' },
    reload: Boolean,
    items: { type: Array, default: () => [] },
});
const emit = defineEmits(['uploaded', 'update:items']);
const aj = inject('aj');
const smbclient = createSmbclient(aj);
const drop = ref();
const browse = ref();
const progress = ref([]);
const dragging = ref(false);
const uploading = ref(false);
const error = ref('');
let flow, transfer, disposed = false;

function begin() {
    if (uploading.value) return;
    progress.value = [];
    error.value = '';
    uploading.value = true;
    const names = flow.files.map((file) => file.name).join(', ');
    transfer = smbclient.startFlowUpload(flow, props.uploadpath, (value) => {
        // Legacy comparator/order, deliberately no new alphabetical sorting.
        progress.value = [...value].sort((a, b) => Number(a.name > b.name));
    });
    transfer.then((descriptors) => {
        if (disposed) return;
        aj.notify.success(aj.gettext('Uploaded ') + names);
        if (props.reload) emit('update:items', [...props.items, ...descriptors]);
        emit('uploaded', descriptors);
    }, (failure) => {
        if (disposed || failure.name === 'AbortError') return;
        error.value = failure.message;
        aj.notify.error(failure.message);
    }).finally(() => {
        transfer = undefined;
        uploading.value = false;
        progress.value = [];
    });
}
onMounted(() => {
    // filesystem/plugin.yml loads ng-flow-standalone.min.js (including window.Flow).
    // Original smbUpload uses flow-init with exactly these options.
    flow = new globalThis.Flow({ target: props.target, chunkSize: 1024 * 1024 });
    flow.assignBrowse(browse.value);
    flow.assignDrop(drop.value);
    flow.on('filesSubmitted', begin);
});
onBeforeUnmount(() => {
    disposed = true;
    flow.off('filesSubmitted', begin);
    flow.unAssignDrop(drop.value);
    if (transfer) transfer.cancel();
    else flow.cancel();
});
</script>

<template>
    <div class="smb-upload">
        <div ref="drop" class="dragdroparea" :class="{ 'dragdroparea-enter': dragging }"
             @dragenter="dragging = true" @dragleave="dragging = false" @drop="dragging = false">
            <span>{{ aj.gettext('Drag and drop your files here') }}</span>
            <button ref="browse" type="button" class="btn btn-lmn btn-upload">{{ aj.gettext('Upload file') }}</button>
        </div>
        <template v-for="item in progress" :key="item.id">
            <div v-if="item.progress < 100" style="margin-top: 10px">
                <span>{{ item.name }} ({{ item.progress }} %) </span>
                <progress max="100" :value="item.progress" :aria-label="item.name" />
            </div>
        </template>
        <button v-if="uploading" type="button" data-cancel class="btn btn-default" @click="transfer.cancel()">{{ aj.gettext('Cancel') }}</button>
        <p v-if="error" role="alert">{{ error }}</p>
    </div>
</template>

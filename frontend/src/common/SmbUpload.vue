<script setup>
import { inject, onBeforeUnmount, onMounted, ref } from 'vue';
import { createSmbclient } from './smbclient.mjs';

const props = defineProps({
    uploadpath: { type: String, required: true },
    target: { type: String, default: '/api/lmn/smbclient/upload' },
    reload: Boolean,
    onUploaded: [Function, Array],
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
        aj.notify.success(aj.gettext('Uploaded ') + names);
        if (props.reload) emit('update:items', [...props.items, ...descriptors]);
        // Vue suppresses emits after unmount; finish-upload must still notify its consumer.
        if (disposed) {
            for (const listener of [props.onUploaded].flat()) listener?.(descriptors);
        } else emit('uploaded', descriptors);
    }, (failure) => {
        if (disposed || failure.name === 'AbortError') return;
        error.value = failure.message ?? failure.data?.message ?? failure.statusText;
        aj.notify.error(error.value);
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
                <div class="progress">
                    <div class="progress-bar progress-bar-warning" role="progressbar" :aria-label="item.name"
                         aria-valuemin="0" aria-valuemax="100" :aria-valuenow="item.progress"
                         :style="{ width: item.progress + '%' }" />
                </div>
            </div>
        </template>
        <p v-if="error" role="alert">{{ error }}</p>
    </div>
</template>

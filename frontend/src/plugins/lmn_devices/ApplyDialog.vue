<script setup>
import { inject, onMounted, onBeforeUnmount, ref } from 'vue';
import LmLog from '../../common/LmLog.vue';
const emit = defineEmits(['close']);
const aj = inject('aj');
const working = ref(true);
const logVisible = ref(true);
const header = ref(null);
let frame;
const staticBackdrop = (event) => { if (event.target === frame) event.stopImmediatePropagation(); };
onMounted(() => {
    frame = header.value.closest('.modal');
    header.value.closest('.modal-dialog')?.classList.add('modal-lg');
    frame?.addEventListener('click', staticBackdrop, true);
});
onBeforeUnmount(() => frame?.removeEventListener('click', staticBackdrop, true));
aj.http.post('/api/lmn/devices/import').then(() => {
    working.value = false;
    aj.notify.success(aj.gettext('Import complete'));
}, (cause) => {
    aj.notify.error(aj.gettext('Import failed'), cause.data?.message);
    working.value = false;
    logVisible.value = !logVisible.value;
});
</script>
<template>
    <div ref="header" class="modal-header"><h4>{{ aj.gettext('Importing device') }}</h4></div>
    <div class="modal-body">
        <component :is="'progress-spinner'" v-if="working" role="progressbar"><div><div class="one"></div><div class="two"></div></div></component>
        <div v-show="logVisible"><LmLog path="/tmp/import_devices.log" /></div>
    </div>
    <div class="modal-footer">
        <a class="btn c3-button btn-flat" @click="logVisible = !logVisible">{{ aj.gettext(logVisible ? 'Hide details' : 'Details') }}</a>
        <a v-if="!working" class="btn c3-button btn-flat" @click="emit('close')">{{ aj.gettext('Close') }}</a>
    </div>
</template>

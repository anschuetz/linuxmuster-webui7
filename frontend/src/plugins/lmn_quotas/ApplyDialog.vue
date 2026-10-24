<script setup>
import { inject, ref } from 'vue';
import LmLog from '../../common/LmLog.vue';
const emit = defineEmits(['close']);
const aj = inject('aj');
const working = ref(true);
const logVisible = ref(true);
aj.http.post('/api/lmn/quota/apply').then(() => {
    working.value = false;
    aj.notify.success(aj.gettext('Update complete'));
}, (cause) => {
    aj.notify.error(aj.gettext('Update failed'), cause.data?.message);
    working.value = false;
    logVisible.value = true;
});
</script>
<template>
    <div class="modal-header"><h4>{{ aj.gettext('Applying changes') }}</h4></div>
    <div class="modal-body">
        <component :is="'progress-spinner'" v-if="working" role="progressbar"><div><div class="one"></div><div class="two"></div></div></component>
        <div v-show="logVisible"><LmLog path="/tmp/apply-sophomorix.log" /></div>
    </div>
    <div class="modal-footer">
        <a class="btn btn-default btn-flat" @click="logVisible = !logVisible">{{ aj.gettext(logVisible ? 'Hide details' : 'Details') }}</a>
        <a v-if="!working" class="btn btn-default btn-flat" @click="emit('close')">{{ aj.gettext('Close') }}</a>
    </div>
</template>

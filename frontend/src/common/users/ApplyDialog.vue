<script setup>
import { inject, onMounted, ref } from 'vue';
import LmLog from '../LmLog.vue';
const props = defineProps({ params: { type: Object, required: true } });
const emit = defineEmits(['close']);
const aj = inject('aj');
const isWorking = ref(true);
onMounted(async () => {
    try {
        await aj.http.post('/api/lmn/users/lists/apply', props.params);
        isWorking.value = false;
        aj.notify.success(aj.gettext('Changes applied'));
        aj.reload();
    } catch (response) {
        isWorking.value = false;
        aj.notify.error(aj.gettext('Failed'), response.data?.message);
    }
});
</script>
<template>
    <div class="modal-header"><h4>{{ $gettext('Applying changes') }}</h4></div>
    <div class="modal-body">
        <div v-show="isWorking" class="spinner" role="status"><i class="fa fa-circle-o-notch fa-spin"></i></div>
        <LmLog path="/tmp/sophomorix.log" />
    </div>
    <div v-show="!isWorking" class="modal-footer"><button class="btn btn-default btn-flat" @click="emit('close')">{{ $gettext('Close') }}</button></div>
</template>

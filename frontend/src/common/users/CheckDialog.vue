<script setup>
import { inject, onMounted, ref } from 'vue';
import LmLog from '../LmLog.vue';
import CheckResultsDialog from './CheckResultsDialog.vue';
const emit = defineEmits(['close']);
const aj = inject('aj');
const isWorking = ref(true), error = ref(false), errorList = ref();
onMounted(async () => {
    try {
        const { data } = await aj.http.get('/api/lmn/users/lists/check');
        if (!data) {
            aj.notify.error(aj.gettext('Unknown error!'), aj.gettext('Please run sophomorix-check manually to identity the reason.'));
            emit('close');
            return;
        }
        if (data.OUTPUT[0].TYPE === 'ERROR') {
            aj.notify.error(data.OUTPUT[0].MESSAGE_EN);
            error.value = true;
            isWorking.value = false;
            emit('close');
            return;
        }
        if (data.CHECK_RESULT.ERRORLIST.length > 0) {
            aj.notify.error(aj.gettext('Check failed'));
            isWorking.value = false;
            error.value = true;
            errorList.value = data.CHECK_RESULT.ERROR;
        } else {
            aj.modal.open(CheckResultsDialog, { data }).catch(() => {}); // Dismissal is not a check failure.
            emit('close');
        }
    } catch (response) {
        isWorking.value = false;
        error.value = true;
        aj.notify.error(aj.gettext('Check failed'), response.data?.message);
    }
});
</script>
<template>
    <div class="modal-header"><h4 class="modal-title common-user-title">{{ $gettext('Checking users') }}</h4></div>
    <div class="modal-body">
        <div v-show="error" class="alert alert-danger">
            <i class="fa fa-warning"></i> <span>{{ $gettext('Check failed') }}</span><br><br>
            <div v-for="(details, name) in errorList" :key="name"><br>{{ name }}<br>--&gt; {{ details.REASON }}</div>
        </div>
        <div v-show="isWorking" class="spinner" role="status"><i class="fa fa-circle-o-notch fa-spin"></i></div>
        <LmLog path="/tmp/sophomorix-check.log" />
    </div>
    <div v-show="!isWorking" class="modal-footer"><button class="btn btn-light common-user-button btn-flat" @click="emit('close')">{{ $gettext('Close') }}</button></div>
</template>

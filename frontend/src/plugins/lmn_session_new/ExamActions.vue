<script setup>
import { computed, inject } from 'vue';
const props = defineProps({ store: Object, api: Object, user: Object });
const aj = inject('aj');
const groups = computed(() => props.store.state.examViewGroups ?? { own: props.store.state.examUsers, external: props.store.state.extExamUsers });
async function action(fn) { try { await fn(); } catch { /* Cancellation and request errors belong to the shell. Legacy failed exam waits remain open. */ } }
</script>
<template>
    <template v-if="user">
        <button v-if="user.examMode" data-exam-stop-user class="btn btn-danger" style="width:80px" :title="aj.gettext('Stop exam from ') + user.examTeacher" @click="action(() => api.stopUserExam(user))"><i class="fa fa-graduation-cap"></i> {{ user.examTeacher }}</button>
        <button v-else data-exam-start-user class="btn btn-light c6-button" style="width:80px" :title="aj.gettext('Start exam for ') + user.examTeacher" @click="action(() => api.startExam(user.cn))"><i class="fa fa-graduation-cap"></i> {{ user.examTeacher }}</button>
    </template>
    <template v-else>
        <button v-if="store.state.examMode" data-exam-stop-all class="btn btn-lmn-danger-inv" style="font-size:20px" title="Stop exam mode" @click="action(api.stopExam)"><i class="fa fa-graduation-cap"></i></button>
        <button v-else-if="groups.external.length + groups.own.length > 0" data-exam-stop-running class="btn btn-lmn-danger-inv" style="font-size:20px" title="Stop exam mode" @click="action(api.stopRunningExams)"><i class="fa fa-graduation-cap"></i></button>
        <button v-else-if="store.state.current.type !== 'room'" data-exam-start-all class="btn btn-light c6-button" style="font-size:20px" title="Start exam mode" @click="action(() => api.startExam())"><i class="fa fa-graduation-cap"></i></button>
    </template>
</template>

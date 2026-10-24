<script setup>
import { inject, onMounted, ref } from 'vue';
import LmLog from '../../common/LmLog.vue';
import { createImport } from './import.mjs';
const aj = inject('aj');
const emit = defineEmits(['close', 'cancel']);
const { state, toggleLog } = createImport(aj);
const header = ref(null);
onMounted(() => header.value.closest('.modal-dialog')?.classList.add('modal-lg'));
</script>

<template>
    <div ref="header" class="modal-header"><h4>{{ aj.gettext('Importing device') }}</h4></div>
    <div class="modal-body">
        <component :is="'progress-spinner'" v-if="state.working" role="progressbar"><div><div class="one"></div><div class="two"></div></div></component>
        <div v-show="state.logVisible"><LmLog path="/tmp/import_devices.log" /></div>
    </div>
    <div class="modal-footer">
        <a class="btn btn-default btn-flat" @click="toggleLog">{{ aj.gettext(state.logVisible ? 'Hide details' : 'Details') }}</a>
        <a v-if="!state.working" class="btn btn-default btn-flat" @click="emit('close')">{{ aj.gettext('Close') }}</a>
    </div>
</template>

<script setup>
import { inject } from 'vue';
const aj = inject('aj');
defineProps({ masterVM: { type: String, required: true }, masterVMData: { type: Object, required: true } });
defineEmits(['cancel']);
const summary = [['Name', 'name'], ['Status', 'status'], ['Cloop', 'cloop'], ['Build state', 'buildstate'], ['OS Type', 'ostype'], ['Image size', 'imagesize'], ['Creation date', 'dateOfCreation']];
const hardware = [['Memory', 'memory'], ['Cores', 'cores'], ['BIOS', 'bios'], ['SCSI 0', 'scsi0'], ['SCSI Hardware', 'scsihw'], ['Audio', 'audio0'], ['VGA', 'vga'], ['Network', 'net0'], ['USB', 'usb0'], ['Spice enhancements', 'spice_enhancements']];
</script>
<template>
    <div class="modal-header"><h4><span>{{ aj.gettext('VM-Number:') }}</span> {{ masterVM }}</h4></div>
    <div class="modal-body">
        <h4>{{ aj.gettext('Summary') }}</h4>
        <table class="table table-hover" style="width:100%;"><tbody><tr v-for="[label, key] in summary" :key="key"><th>{{ aj.gettext(label) }}</th><td>{{ masterVMData[key] }}</td></tr></tbody></table>
        <h4>{{ aj.gettext('Hardware') }}</h4>
        <table class="table table-hover" style="width:100%;"><tbody><tr v-for="[label, key] in hardware" :key="key"><th>{{ aj.gettext(label) }}</th><td>{{ masterVMData[key] }}</td></tr></tbody></table>
    </div>
    <div class="modal-footer"><a class="btn btn-default btn-flat" @click="$emit('cancel')">{{ aj.gettext('OK') }}</a></div>
</template>

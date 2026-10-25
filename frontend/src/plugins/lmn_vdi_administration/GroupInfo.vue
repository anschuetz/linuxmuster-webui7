<script setup>
import { computed, inject } from 'vue';
const aj = inject('aj');
const props = defineProps({ masterGroupData: { type: Object, required: true } });
// Angular compares PXE numerically; null must still render as an empty value.
const pxeNumber = computed(() => props.masterGroupData.pxe === null ? null : Number(props.masterGroupData.pxe));
defineEmits(['cancel']);
</script>
<template>
    <div class="modal-header"><h4><span>{{ aj.gettext('Group:') }}</span> {{ masterGroupData.group }}</h4></div>
    <div class="modal-body">
        <table class="table table-hover" style="width:100%;"><tbody>
            <tr><th>{{ aj.gettext('Room') }}</th><td>{{ masterGroupData.room }}</td></tr>
            <tr><th>{{ aj.gettext('Hostname') }}</th><td>{{ masterGroupData.hostname }}</td></tr>
            <tr><th>{{ aj.gettext('MAC-Address') }}</th><td>{{ masterGroupData.mac }}</td></tr>
            <tr><th>{{ aj.gettext('IP-Address') }}</th><td>{{ masterGroupData.ip }}</td></tr>
            <tr><th>{{ aj.gettext('PXE-Boot') }}</th><td>{{ pxeNumber === 0 ? aj.gettext('No') : pxeNumber === 1 ? aj.gettext('Yes') : masterGroupData.pxe }}</td></tr>
            <tr><th>{{ aj.gettext('Image Size') }}</th><td>{{ masterGroupData.actual_imagesize }}</td></tr>
        </tbody></table>
    </div>
    <div class="modal-footer"><a class="btn c7-button btn-flat" @click="$emit('cancel')">{{ aj.gettext('OK') }}</a></div>
</template>

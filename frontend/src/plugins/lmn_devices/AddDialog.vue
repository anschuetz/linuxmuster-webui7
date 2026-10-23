<script setup>
import { inject, ref } from 'vue';
import { newDevice, roles, pxe } from './fields.mjs';
const props = defineProps({ device: Object });
const emit = defineEmits(['close', 'cancel']);
const aj = inject('aj');
const draft = ref({ ...(props.device || newDevice()), _isNew: true });
const inputs = [['room', 'Room:'], ['hostname', 'Hostname'], ['group', 'Group:'], ['mac', 'Mac:'], ['ip', 'IP: ']];
</script>
<template>
    <div class="modal-header"><h3>{{ aj.gettext('Add device') }}</h3></div>
    <div class="modal-body"><form class="form-group" @submit.prevent><table class="table"><tbody>
        <tr v-for="[id, label] in inputs" :key="id"><td><span>{{ id === 'ip' ? label : aj.gettext(label) }}</span><input :value="draft[id]" @input="draft = { ...draft, [id]: $event.target.value.trim() }" class="form-control" type="text" :aria-label="id === 'ip' ? label : aj.gettext(label)"></td></tr>
        <tr><td><span>{{ aj.gettext('Sophomorix role:') }}</span><select :value="draft.sophomorixRole" @change="draft = { ...draft, sophomorixRole: $event.target.value }" class="form-control"><option v-for="[value, label] in roles" :key="value" :value="value">{{ aj.gettext(label) }}</option></select></td></tr>
        <tr><td><span>{{ aj.gettext('PXE Boot:') }}</span><select :value="draft.pxeFlag" @change="draft = { ...draft, pxeFlag: $event.target.value }" class="form-control"><option v-for="[value, label] in pxe" :key="value" :value="value">{{ aj.gettext(label) }}</option></select></td></tr>
    </tbody></table></form></div>
    <div class="modal-footer"><button class="btn btn-default" @click="emit('close', { ...draft })">{{ aj.gettext('Add') }}</button><button class="btn btn-default" @click="emit('cancel')">{{ aj.gettext('Cancel') }}</button></div>
</template>

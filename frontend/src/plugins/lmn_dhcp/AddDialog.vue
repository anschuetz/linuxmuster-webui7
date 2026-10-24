<script setup>
import { computed, inject, ref } from 'vue';
import { createValidation } from '../../common/validation.mjs';
import ApplyDialog from '../lmn_devices/ApplyDialog.vue';
import { roles, pxe } from '../lmn_devices/fields.mjs';
const props = defineProps({ mac: String, used: Array, onRegistered: Function });
const emit = defineEmits(['close']);
const aj = inject('aj');
const device = ref({
    room: '', hostname: '', group: '', mac: props.mac, ip: '', pxeFlag: '0',
    officeKey: '', windowsKey: '', dhcpOptions: '', sophomorixRole: 'staffcomputer',
    lmnReserved10: '', lmnReserved12: '', lmnReserved13: '', lmnReserved14: '', sophomorixComment: '',
});
const validation = createValidation(aj);
const duplicateIP = computed(() => props.used.some((known) => known.ip === device.value.ip));
const duplicateHost = computed(() => props.used.some((known) => known.hostname === device.value.hostname));
function save() {
    validation.set(props.used, 'devices');
    const errors = [validation.isValidIP(device.value.ip), validation.isValidHost(device.value.hostname)].filter((result) => result !== true);
    errors.forEach((error) => aj.notify.error(error));
    if (errors.length) return;
    aj.http.post('/api/lmn/dhcp/register', { device: { ...device.value } }).then(() => {
        aj.notify.success(aj.gettext('Device successfully saved in devices.csv!'));
        // The last legacy duplicateHost check leaves its global `device` at the
        // matching hostname, or the last used row if there is no match.
        // Preserve that bug: the newly saved MAC becomes known only after reload.
        const last = props.used.find((known) => known.hostname === device.value.hostname) ?? props.used.at(-1);
        if (!last) {
            console.error(new ReferenceError('device is not defined'));
            return; // Original reports success but cannot close with an empty used list.
        }
        props.onRegistered({ mac: last.mac, ip: last.ip, hostname: last.hostname });
        emit('close');
    }, () => {}); // As in Angular, failed requests keep the form open.
}
function saveImport() {
    save();
    aj.modal.open(ApplyDialog, {}, { static: true }).catch(() => {});
}
const textModels = Object.fromEntries(['room', 'mac', 'ip', 'hostname', 'group'].map((field) => [field, computed({
    get: () => device.value[field],
    set: (value) => { device.value = { ...device.value, [field]: value }; },
})]));
const textFields = [['room', 'Room:'], ['mac', 'Mac:']];
</script>
<template>
    <div class="modal-header"><h1>{{ aj.gettext('Add device') }}</h1></div>
    <div class="modal-body">
        <form class="form-group" @submit.prevent>
            <table class="table"><tbody>
                <tr v-for="[key, label] in textFields" :key="key"><td><span>{{ aj.gettext(label) }}</span><input v-model.trim="textModels[key].value" class="form-control" type="text" /></td></tr>
                <tr><td :class="{ 'has-error': duplicateIP }"><div>IP <span v-if="duplicateIP" style="color:red;">{{ aj.gettext('(Already used)') }}</span> :</div><input v-model.trim="textModels.ip.value" class="form-control" type="text" /></td></tr>
                <tr><td :class="{ 'has-error': duplicateHost }"><div><span>{{ aj.gettext('Hostname') }}</span><span v-if="duplicateHost" style="color:red;">{{ aj.gettext('Already used') }}</span> :</div><input v-model.trim="textModels.hostname.value" class="form-control" type="text" /></td></tr>
                <tr><td><span>{{ aj.gettext('Group:') }}</span><input v-model.trim="textModels.group.value" class="form-control" type="text" /></td></tr>
                <tr><td><span>{{ aj.gettext('PXE Boot:') }}</span><select :value="device.pxeFlag" @change="device = { ...device, pxeFlag: $event.target.value }" class="form-control"><option v-for="[value, label] in pxe" :key="value" :value="value">{{ aj.gettext(label) }}</option></select></td></tr>
                <tr><td><span>{{ aj.gettext('Sophomorix role:') }}</span><select :value="device.sophomorixRole" @change="device = { ...device, sophomorixRole: $event.target.value }" class="form-control"><option v-for="[value, label] in roles" :key="value" :value="value">{{ aj.gettext(label) }}</option></select></td></tr>
            </tbody></table>
        </form>
    </div>
    <div class="modal-footer">
        <button class="btn btn-default" @click="save">{{ aj.gettext('Save') }}</button>
        <button class="btn btn-default" @click="saveImport">{{ aj.gettext('Save & import') }}</button>
        <button class="btn btn-default" @click="emit('close')">{{ aj.gettext('Cancel') }}</button>
    </div>
</template>

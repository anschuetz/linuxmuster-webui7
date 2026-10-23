<script setup>
import { inject, ref } from 'vue';
import AddDialog from './AddDialog.vue';
const aj = inject('aj');
const leases = ref();
const used = ref();
aj.pageTitle.set(aj.gettext('DHCP'));
aj.http.get('/api/lmn/dhcp/leases').then(({ data }) => {
    leases.value = data[0];
    used.value = data[1];
}, () => {}); // The adapter owns HTTP errors; the original has no local error view.
const alreadyIn = (mac) => used.value.some((device) => device.mac && device.mac.toUpperCase() === mac.toUpperCase());
function addDevice(device) {
    aj.modal.open(AddDialog, {
        mac: device.mac, used: used.value,
        onRegistered: (registered) => { used.value = [...used.value, registered]; },
    }).catch(() => {}); // Escape/backdrop dismissal.
}
</script>
<template>
    <br />
    <div>
        <h2>{{ aj.gettext('DHCP Leases') }}</h2>
        <table class="table"><tbody>
            <tr><th>{{ aj.gettext('Mac address') }}</th><th>{{ aj.gettext('IP') }}</th><th>{{ aj.gettext('Start') }}</th><th>{{ aj.gettext('End') }}</th><th> </th></tr>
            <tr v-for="(device, index) in leases" :key="index">
                <td>{{ device.mac }}<br /><span v-if="alreadyIn(device.mac)" style="color:red;">{{ aj.gettext('Already registered!') }}</span></td>
                <td>{{ device.ip }}</td><td>{{ device.starts }}</td><td>{{ device.ends }}</td>
                <td><button v-if="!alreadyIn(device.mac)" class="btn btn-default" @click="addDevice(device)"><i class="fas fa-plus"></i></button></td>
            </tr>
        </tbody></table>
    </div>
</template>

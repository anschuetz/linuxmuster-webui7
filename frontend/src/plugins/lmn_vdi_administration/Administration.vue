<script setup>
import { inject, ref } from 'vue';
import GroupInfo from './GroupInfo.vue';
import MasterInfo from './MasterInfo.vue';
const aj = inject('aj');
const masters = ref();
const clones = ref();
const activeTab = ref('masters');
aj.pageTitle.set(aj.gettext('Lmn_vdi_administration'));
aj.http.get('/api/lmn/vdi/administration/masterVMs').then(({ data }) => {
    if (data.status === 'success') masters.value = data.data;
    else {
        aj.notify.error(data.message);
        masters.value = {};
    }
}, () => {}); // HTTP errors belong to the shell; retain the original loading state.
function getClones() {
    activeTab.value = 'clones';
    aj.http.get('/api/lmn/vdi/administration/clones').then(({ data }) => {
        if (data.status === 'success') {
            // Object.fromEntries retains the original last-group-wins collision behavior.
            clones.value = Object.fromEntries(Object.values(data.data).flatMap(group => Object.entries(group.clone_vms)));
        } else {
            aj.notify.error(data.message);
            clones.value = {};
        }
    }, () => {}); // No local error view in the Angular original.
}
function groupInfo(masterGroupData) {
    aj.modal.open(GroupInfo, { masterGroupData }).catch(() => {}); // Dismiss/Escape/backdrop.
}
function masterInfo(masterVM, masterVMData) {
    aj.modal.open(MasterInfo, { masterVM, masterVMData }).catch(() => {}); // Dismiss/Escape/backdrop.
}
</script>
<template>
    <br />
    <div>
        <ul class="nav nav-tabs c7-tabs">
            <li class="nav-item"><a class="nav-link" :class="{ active: activeTab === 'masters' }" href="#" role="tab" :aria-selected="activeTab === 'masters'" @click.prevent="activeTab = 'masters'">{{ aj.gettext('Master VMs') }}</a></li>
            <li class="nav-item"><a class="nav-link" :class="{ active: activeTab === 'clones' }" href="#" role="tab" :aria-selected="activeTab === 'clones'" @click.prevent="getClones">{{ aj.gettext('All VMs') }}</a></li>
        </ul>
        <div v-if="activeTab === 'masters'">
            <div v-if="masters === undefined || masters === null" role="status" class="progress-spinner"><i class="fa fa-circle-o-notch fa-spin"></i></div>
            <table v-else class="table table-hover" style="width:100%;margin-top:10px;">
                <thead><tr><th>Group</th><th>Hostname</th><th>IP-Address</th><th>MAC-Address</th><th>Master VMs</th></tr></thead>
                <tbody><tr v-for="(data, group) in masters" :key="group">
                    <td @click="groupInfo(data)">{{ group }}</td><td @click="groupInfo(data)">{{ data.hostname }}</td><td @click="groupInfo(data)">{{ data.ip }}</td><td @click="groupInfo(data)">{{ data.mac }}</td>
                    <td><div v-for="(vmData, vm) in data.master_vms" :key="vm"><button class="btn btn-primary" style="margin:3px;float:left;" :disabled="vmData === null || vmData === undefined" @click="masterInfo(vm, vmData)">{{ vm }}</button></div></td>
                </tr></tbody>
            </table>
        </div>
        <div v-else>
            <div v-if="clones === undefined || clones === null" role="status" class="progress-spinner"><i class="fa fa-circle-o-notch fa-spin"></i></div>
            <table v-else class="table table-hover" style="width:100%;margin-top:10px;">
                <thead><tr><th>Master-Group</th><th>{{ aj.gettext('VM ID') }}</th><th>{{ aj.gettext('Room') }}</th><th>{{ aj.gettext('Hostname') }}</th><th>{{ aj.gettext('IP-Address') }}</th><th>{{ aj.gettext('MAC-Address') }}</th><th>{{ aj.gettext('User') }}</th></tr></thead>
                <tbody><tr v-for="(data, vm) in clones" :key="vm">
                    <td>{{ data.group }}</td><td>{{ vm }}</td><td>{{ data.room }}</td><td>{{ data.hostname }}</td><td>{{ data.ip }}</td><td>{{ data.mac }}</td><td>{{ data.user === '' ? aj.gettext('No user') : data.user }}</td>
                </tr></tbody>
            </table>
        </div>
    </div>
</template>

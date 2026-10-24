<script setup>
import { inject, ref } from 'vue';
import { download } from './download.mjs';
const aj = inject('aj');
const clones = ref();
// Preserve Angular's numeric comparison for JSON numbers and numeric strings.
const hasVMs = count => count === null || Number(count) !== 0;
aj.pageTitle.set(aj.gettext('Lmn_vdi_dashboard'));
aj.http.get('/api/lmn/vdi/administration/clones').then(({ data }) => {
    if (data.status === 'success') clones.value = data.data;
    else {
        aj.notify.error(data.message);
        clones.value = {};
    }
}, () => {}); // As before, the shell handles HTTP errors; loading remains unresolved.
function startSession(group) {
    aj.http.get('/api/lmn/vdi/dashboard/vdiSession/' + group).then(({ data }) => {
        console.log(data); // Retain the original session filename diagnostic.
        download('/api/lmn/vdi/dashboard/download/' + data);
    }, () => {}); // The shell owns the HTTP error; no download after a rejection.
}
</script>
<template>
    <h1>{{ aj.gettext('VDI Desktops') }}</h1>
    <div v-if="clones === undefined || clones === null" role="status" class="progress-spinner"><i class="fa fa-circle-o-notch fa-spin"></i></div>
    <div>
        <div v-if="clones !== undefined && clones !== null" class="list-group">
            <h4>{{ aj.gettext('VDI Groups') }}</h4>
            <div class="flex-container lmn-container-list">
                <div v-for="(data, group) in clones" :key="group" class="list-group-item" style="margin-bottom:10px;width:250px;">
                    <div v-if="hasVMs(data.summary.available_vms)" @click="startSession(group)">
                        <span style="float:right;width:50%;"><div class="session_container"><a href="#" @click.prevent><span style="overflow:hidden;width:100%;">{{ group }}<br /><span>{{ aj.gettext('Available VMs:') }}</span> {{ data.summary.available_vms }}</span></a></div></span>
                        <span style="float:left;width:50%"><div class="session_image session_image_room"><span class="fas fa-play session_image_btn"></span></div></span>
                    </div>
                    <div v-else :title="aj.gettext('No VMs avaliable!')">
                        <span style="float:right;width:50%;"><div class="session_container"><span style="overflow:hidden;width:100%;">{{ group }}<br /><span>{{ aj.gettext('Available VMs:') }}</span> {{ data.summary.available_vms }}</span></div></span>
                        <span style="float:left;width:50%"><div class="session_image session_image_room disabled"><span class="fas fa-times-circle session_image_btn disabled"></span></div></span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { inject, onUnmounted, ref, unref } from 'vue';
const props = defineProps({ processes: [Array, Object], refresh: Function });
const emit = defineEmits(['close']);
const aj = inject('aj'), loading = ref(false), result = ref();
let timer;
function loadLog(hostname) {
    loading.value = true;
    if (!timer) timer = setInterval(() => {
        aj.http.post('/api/lmn/device-manager/getlinboremotelog', { device: { hostname } }).then(resp => {
            result.value = resp.data; loading.value = false;
        }, () => { /* Original leaves the spinner and previous log on failure. */ });
    }, 1000);
}
function close() { clearInterval(timer); emit('close'); }
onUnmounted(() => clearInterval(timer));
</script>
<template>
    <div class="modal-header"><h3>{{ unref(processes)?.length }} {{ aj.gettext('running processes') }}</h3></div>
    <div class="modal-body">
        <div v-if="!unref(processes)?.length" style="width:100%" class="alert alert-info">{{ aj.gettext('Currently no linbo-remote processes running!') }}</div>
        <table v-if="unref(processes)?.length > 0" class="table"><thead><tr><th>{{ aj.gettext('#') }}</th><th>{{ aj.gettext('Hostname') }}</th><th>{{ aj.gettext('Timestamp') }}</th><th></th></tr></thead><tbody>
            <tr v-for="(process,index) in unref(processes)" :key="index"><td style="vertical-align:middle">{{ process.id }}</td><td style="vertical-align:middle">{{ process.hostname }}</td><td style="vertical-align:middle">{{ process.startdate }} {{ process.starttime }}</td><td style="line-height:40px;text-align:right"><button data-show class="btn c3-button" @click="loadLog(process.hostname)"><i class="fas fa-terminal"></i> Show</button> <button data-kill class="btn btn-danger"><i class="fas fa-times"></i> Kill</button></td></tr>
        </tbody></table>
        <component :is="'progress-spinner'" v-show="loading"><div><div class="one"></div><div class="two"></div></div></component>
        <textarea v-if="result?.length > 0" id="linbocommandlog" :value="result" class="form-control" rows="10" style="width:100%;resize:none" disabled></textarea>
    </div>
    <div class="modal-footer"><button data-refresh class="btn c3-button" @click="refresh">{{ aj.gettext('Refresh') }}</button><button class="btn c3-button" @click="close">{{ aj.gettext('Close') }}</button></div>
</template>

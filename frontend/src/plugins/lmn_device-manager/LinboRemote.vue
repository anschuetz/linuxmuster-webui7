<script setup>
import { inject, onUnmounted, ref, unref, watch } from 'vue';
const props = defineProps({ device: Object, prestart: Boolean, updateDevice: Function, refreshProcesses: Function, refreshPrestart: Function });
const emit = defineEmits(['close']);
const aj = inject('aj'), base = '/api/lmn/device-manager/';
const selected = ref(unref(props.device)), command = ref(), result = ref();
let timer;
watch(() => unref(props.device), device => { selected.value = device; }, { flush: 'sync' });
function save(device) { selected.value = device; props.updateDevice?.(device); }
aj.http.post(base + 'getlinboconfig', { device: selected.value }).then(resp => {
    save({ ...selected.value, linboconfig: resp.data });
    // A missing configuration is null on E; keep the empty table rather than throwing in for-of.
    for (const os of selected.value.linboconfig || []) {
        aj.http.post(base + 'getlastsync', { device: selected.value, image: os.BaseImage }).then(resp => {
            save({ ...selected.value, lastsync: resp.data });
        }, () => { /* Original leaves last sync unchanged. */ });
    }
}, () => { /* Adapter owns HTTP error; keep existing config. */ });
function updateCommand() {
    const device = selected.value;
    const operations = ['format', 'partition', 'initcache'].filter(key => device[key]);
    for (const [i, os] of (device.linboconfig || []).entries()) {
        for (const key of ['format','sync','start']) if (os[key]) operations.push(`${key}:${i + 1}`);
    }
    command.value = operations.length ? `linbo-remote -s ${device.school} -i ${device.hostname}${device.disablegui ? ' -d' : ''} ${props.prestart ? '-p' : '-c'} ${operations.join(',')}` : '';
}
function toggleGlobal(key) { save({ ...selected.value, [key]: !selected.value[key] }); updateCommand(); }
function toggleImage(index, key) {
    save({ ...selected.value, linboconfig: selected.value.linboconfig.map((os, i) => i === index ? { ...os, [key]: !os[key] } : os) });
    updateCommand();
}
async function run() {
    try {
        await aj.http.post(base + 'run', { command: command.value });
        command.value = '';
        if (props.prestart) {
            aj.notify.success(aj.gettext('Command successfully stored!'));
            props.refreshPrestart(); emit('close');
        } else {
            result.value = 'Linbo is running...'; props.refreshProcesses();
            if (!timer) timer = setInterval(() => {
                aj.http.post(base + 'getlinboremotelog', { device: selected.value }).then(resp => { result.value = resp.data; }, () => { /* Keep last log. */ });
            }, 1000);
        }
    } catch { aj.notify.error(aj.gettext('Command failed!')); }
}
function close() {
    clearInterval(timer);
    save({ ...selected.value, format: false, partition: false, initcache: false, disablegui: false,
        linboconfig: selected.value.linboconfig?.map(os => ({ ...os, format:false, sync:false, start:false })) });
    emit('close');
}
onUnmounted(() => clearInterval(timer));
</script>
<template>
    <div class="modal-header"><h3>{{ aj.gettext('Linbo-Remote') }} - {{ selected.hostname }}</h3></div>
    <div class="modal-body">
        <h5>Image options</h5><table class="table"><thead><tr><th>{{ aj.gettext('Baseimage') }}</th><th>{{ aj.gettext('Last sync') }}</th><th></th></tr></thead><tbody>
            <tr v-for="(os, index) in selected.linboconfig" :key="index"><td style="vertical-align:middle">{{ os.BaseImage }}</td><td style="vertical-align:middle"><i v-if="['danger','warning','success'].includes(selected.lastsync?.status)" class="fas fa-circle" :style="{color:{danger:'red',warning:'orange',success:'green'}[selected.lastsync.status]}"></i> {{ selected.lastsync?.date }}</td><td style="line-height:40px">
                <button v-for="(key, i) in ['format','sync','start']" :key="key" :data-image="`${index}-${key}`" :class="'btn ' + ['btn-danger','btn-warning','btn-success'][i]" @click="toggleImage(index,key)"><i :class="['fas fa-eraser','fas fa-sync-alt','fas fa-play'][i]"></i></button>
            </td></tr>
        </tbody></table>
        <h5>Global options</h5><table class="table" style="border:0"><tbody><tr><td v-for="(label,key) in {format:'Format',partition:'Partition',initcache:'Init cache',disablegui:'Disable GUI'}" :key="key">
            <button :data-global="key" :class="'btn ' + ({format:'btn-danger',partition:'btn-info'}[key] || 'c3-button')" style="width:100%" :disabled="key === 'disablegui' && !command?.length" @click="toggleGlobal(key)"><i :class="{format:'fas fa-eraser',partition:'fas fa-eraser',initcache:'fas fa-sync-alt',disablegui:'fas fa-terminal'}[key]"></i> {{ label }}</button>
        </td></tr></tbody></table>
        <div v-if="command?.length > 0" style="width:100%" class="alert alert-info">{{ command }}</div>
        <textarea v-if="result?.length > 0" id="linbocommandlog" :value="result" class="form-control" rows="10" style="width:100%;resize:none" disabled></textarea>
    </div>
    <div class="modal-footer"><button data-run class="btn c3-button" :disabled="!command?.length" @click="run">{{ aj.gettext('Run') }}</button><button data-cancel class="btn c3-button" @click="close">{{ aj.gettext('Cancel') }}</button></div>
</template>

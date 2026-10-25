<script setup>
import { inject, ref } from 'vue';
const props = defineProps({ devices: Array, action: String });
const emit = defineEmits(['close']), aj = inject('aj');
const count = ref(0), errors = ref(0), errorText = ref(''), current = ref('');
if (['start','shutdown','reboot'].includes(props.action)) {
    for (const device of props.devices) {
        if (!('hostname' in device)) continue;
        aj.http.post('/api/lmn/device-manager/' + props.action, { device }).then(resp => {
            current.value = device;
            if (!resp.data.status) { errors.value += 1; errorText.value += `${device.hostname}: ${resp.data.message}\n`; }
            count.value += 1;
            if (count.value === props.devices.length) current.value = 'finished';
        }, () => { /* Legacy HTTP failures do not count as completed; keep Close disabled. */ });
    }
}
</script>
<template>
    <div class="modal-header"><h3>{{ action.charAt(0).toUpperCase() }}{{ action.slice(1) }} {{ aj.gettext('all devices') }}</h3></div>
    <div class="modal-body">
        <div class="progress"><div class="progress-bar" role="progressbar" :aria-valuemax="devices.length" :aria-valuenow="count" :style="{width: `${100 * count / devices.length}%`}">{{ count }} / {{ devices.length }}</div></div>
        <div v-if="!current" style="text-align:center">{{ aj.gettext('Starting...') }}...</div>
        <div v-if="current && current !== 'finished'" style="text-align:center">{{ aj.gettext('Now processing') }} {{ current.hostname }}...</div>
        <div v-if="current === 'finished'" style="text-align:center"><span>{{ aj.gettext('Finished!') }}</span><span v-if="errors > 0" style="color:red"><br><br>{{ errors }} {{ aj.gettext('error(s) occourt!') }}<pre style="width:100%;height:100px;overflow-y:scroll;text-align:left;border:1px solid black;border-radius:2px;padding:5px;margin-top:10px">{{ errorText }}</pre></span></div>
    </div>
    <div class="modal-footer"><button class="btn c3-button" :disabled="current !== 'finished'" @click="emit('close')">{{ aj.gettext('Close') }}</button></div>
</template>

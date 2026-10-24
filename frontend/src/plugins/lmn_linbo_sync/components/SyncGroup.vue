<script setup>
import { computed, inject, ref, shallowRef, watch } from 'vue';
import ActionButton from './ActionButton.vue';
import { initialCommand, selectHost, changeOS, changeAuto, changePower, buildCommand, syncDate } from '../command.mjs';
const props = defineProps({ name: String, details: [Object, String], school: String });
const aj = inject('aj'), details = shallowRef(props.details), command = shallowRef(initialCommand());
const timeout = ref(props.details.power?.timeout);
const icons = { Off: 'fas fa-power-off', 'No response': 'fas fa-power-off', 'OS Linux': 'fab fa-linux', 'OS Windows': 'fab fa-windows', Linbo: 'fas fa-laptop-medical' };
const hint = computed(() => aj.gettext('<i class="fas fa-info-circle"></i>\n                To apply a linbo-remote command, you have to select at least one client and one command.').replace(/<i[^>]*><\/i>\s*/, ''));
function refresh() { command.value = buildCommand(props.name, details.value, command.value, props.school); }
function update(next) { details.value = next; refresh(); }
function host(ip) { command.value = selectHost(props.name, details.value, command.value, ip); refresh(); }
const osAction = (index, action) => update(changeOS(details.value, index, action));
const auto = key => update(changeAuto(details.value, key));
const power = value => update(changePower(details.value, value));
watch(timeout, value => update({ ...details.value, power: { ...details.value.power,
    timeout: value === '' ? null : value < 1 ? undefined : value } }), { flush: 'sync' });
function isUp(index) {
    const hostname = details.value.hosts[index].hostname;
    aj.http.get(`/api/lmn/linbosync/isOnline/${hostname}`).then(resp => {
        details.value = { ...details.value, hosts: details.value.hosts.map((h, i) => i === index ? {
            ...h, up_comment: resp.data, up_icon: icons[resp.data],
            upClass: ['Off', 'No response'].includes(resp.data) ? 'btn-danger' : 'btn-success',
        } : h) };
    }, () => {});
}
function checkOnline() { details.value.hosts.forEach((_, i) => isUp(i)); }
function run() {
    for (const cmd_parameters of command.value.cmd_parameters) {
        aj.http.post('/api/lmn/linbosync/run', { cmd_parameters }).then(resp => {
            if (resp.data.status === 1) aj.notify.error(resp.data.msg);
            else aj.notify.success(aj.gettext('Command successfully sent: ' + resp.data.msg));
        }, () => {});
    }
}
</script>
<template>
    <div>
        <h1>{{ name }}</h1>
        <table class="table"><tbody>
            <tr>
                <td><input type="checkbox" :checked="command.target === 'group'" @click="host(name)"></td>
                <th>{{ aj.gettext('Hostname') }}</th><th>{{ aj.gettext('IP') }}</th><th>{{ aj.gettext('Mac address') }}</th>
                <th v-for="(image, index) in details.os" :key="index"><span>{{ aj.gettext('Last sync') }} </span><br>{{ image.baseimage }}</th>
                <th class="pull-right">{{ aj.gettext('Online ?') }}</th>
            </tr>
            <tr v-for="(h, index) in details.hosts" :key="index">
                <td><input type="checkbox" :checked="command.host.includes(h.ip) || command.target === 'group'" @click="host(h.ip)"></td>
                <th>{{ h.hostname }}</th><td>{{ h.ip }}</td><td>{{ h.mac }}</td>
                <td v-for="(image, i) in h.image" :key="i" style="width:160px;" :class="image.status">
                    <span v-show="image.date !== 'Never'">{{ syncDate(image.date) }}</span>
                    <span v-show="image.date === 'Never'">{{ aj.gettext('No date found.') }}</span>
                </td>
                <td><a class="btn btn-default pull-right" :class="h.upClass || 'btn-primary'" @click="isUp(index)">
                    <i v-show="h.up_comment" class="fa-lg" :class="h.up_icon"></i> {{ h.up_comment || 'Up ?' }}
                </a></td>
            </tr>
        </tbody></table>
        <hr>
        <h3>{{ aj.gettext('Run linbo-remote command') }}</h3>
        <table class="table"><tbody>
            <tr v-for="(image, index) in details.os" :key="index">
                <td style="display:flex;">
                    <div style="width:200px;font-weight:bold;">{{ image.baseimage }} (sda{{ image.partition }})</div>
                    <ActionButton class="btn-danger" style="width:110px;" icon="fas fa-eraser" label="Format" :checked="image.run_format === 1" @click="osAction(index, 'format')" />
                    <ActionButton class="btn-warning" style="width:110px;" icon="fas fa-sync-alt" label="Sync" :checked="image.run_sync === 'sync'" @click="osAction(index, 'sync')" />
                    <ActionButton v-show="image.start_enabled" class="btn-success" style="width:110px;" icon="fas fa-play" label="Start" :checked="image.run_start === 1" @click="osAction(index, 'start')" />
                    <ActionButton v-show="image.new_enabled" class="btn-danger" style="width:110px;" icon="fas fa-exclamation-triangle" label="New" :checked="image.run_sync === 'new'" @click="osAction(index, 'new')" />
                </td>
            </tr>
            <tr><td style="display:flex;">
                <div style="width:200px;font-weight:bold;">{{ aj.gettext('Power management') }}</div>
                <ActionButton class="btn-danger" style="width:110px;" icon="fas fa-power-off" label="Halt" :checked="details.power?.halt === 'halt'" @click="power('halt')" />
                <ActionButton class="btn-warning" style="width:110px;" icon="fas fa-sync" label="Reboot" :checked="details.power?.halt === 'reboot'" @click="power('reboot')" />
                <ActionButton class="btn-default" style="width:200px;" icon="fas fa-lightbulb" label="Wake on lan" :checked="!!details.auto?.wol" @click="auto('wol')" />
                <button v-show="details.auto?.wol > 0" class="btn btn-default" style="margin-left:10px;"><i class="fas fa-clock"></i> Boot timeout (in seconds):</button>
                <input v-show="details.auto?.wol > 0" v-model.number="timeout" type="number" min="1" style="width:50px;text-align:center;">
            </td></tr>
            <tr><td style="display:flex;">
                <div style="width:200px;font-weight:bold;">{{ aj.gettext('Global options') }}</div>
                <!-- Original binds image.run_partition outside its repeat scope. -->
                <ActionButton class="btn-info" style="width:130px;" icon="fas fa-eraser" label="Partition" :checked="false" @click="auto('partition')" />
                <ActionButton class="btn-default" style="width:150px;" icon="fas fa-terminal" label="Disable GUI" :checked="!!details.auto?.disable_gui" @click="auto('disable_gui')" />
                <ActionButton v-show="details.auto?.wol > 0" class="btn-default" style="width:170px;" icon="fas fa-directions" label="Bypass autostart" :checked="!!details.auto?.bypass" @click="auto('bypass')" />
                <ActionButton class="btn-default" style="width:150px;" icon="fas fa-plug" label="Use Prestart" :checked="!!details.auto?.prestart" @click="auto('prestart')" />
                <ActionButton class="btn-default" style="width:150px;" icon="fas fa-terminal" label="Broadcast" :checked="!!details.auto?.broadcast" @click="auto('broadcast')" />
            </td></tr>
        </tbody></table>
        <div v-show="!command.show" class="alert alert-info"><i class="fas fa-info-circle"></i> {{ hint }}</div>
        <div v-show="command.show" class="alert alert-info">
            <h3>{{ aj.gettext('Result command') }}</h3><pre v-for="(cmd, i) in command.cmd" :key="i">{{ cmd }}</pre>
        </div>
        <div class="modal-footer">
            <a class="btn btn-lmn" @click="checkOnline">{{ aj.gettext('Check online') }}</a>
            <a v-show="command.show" class="btn btn-lmn" @click="run">{{ aj.gettext('Apply') }}</a>
        </div>
    </div>
</template>

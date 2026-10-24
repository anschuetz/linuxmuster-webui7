<script setup>
import { computed, inject, onUnmounted, ref, watch } from 'vue';
import LinboRemote from './LinboRemote.vue';
import Processes from './Processes.vue';
import Prestart from './Prestart.vue';
import BulkAction from './BulkAction.vue';
const aj = inject('aj'), base = '/api/lmn/device-manager/';
const devices = ref(), rooms = ref({}), filtered = ref(), checked = ref([]), allSelected = ref(false);
const processes = ref([]), commands = ref([]), auto = ref(false), timerStart = ref(30), countdown = ref(30);
const menus = ref({});
const shell = aj.shell, sidebar = computed(() => shell.layout.sidebar);
let interval;
const timeouts = new Set();
const closeMenus = event => { if (!event.target.closest('.input-group-btn')) menus.value = {}; };
window.addEventListener('click', closeMenus);
const escapeMenu = event => { if (event.key === 'Escape') menus.value = {}; };
window.addEventListener('keydown', escapeMenu);
aj.pageTitle.set(aj.gettext('Device Manager'));
function updateDevice(device) {
    devices.value = devices.value?.map(d => d.hostname === device.hostname ? device : d);
    filtered.value = filtered.value?.map(d => d.hostname === device.hostname ? device : d);
    checked.value = checked.value.map(d => d.hostname === device.hostname ? device : d);
}
// The legacy controller leaves the previous value on HTTP failure; adapter owns error reporting.
async function refreshProcesses() { try { processes.value = (await aj.http.get(base + 'getrunninglinboremotecommands')).data; } catch { /* Preserve list. */ } }
async function refreshPrestart() { try { commands.value = (await aj.http.get(base + 'getPrestartCommands')).data; } catch { /* Preserve list. */ } }
function checkStatus() {
    for (const [endpoint, field] of [['checkOnline', 'online'], ['checkOS', 'os']]) {
        for (const device of filtered.value || []) {
            aj.http.post(base + endpoint, { device }).then(resp => {
                const current = devices.value.find(d => d.hostname === device.hostname);
                updateDevice({ ...current, [field]: resp.data });
            }, () => { /* Preserve status on adapter error. */ });
        }
    }
    refreshProcesses(); refreshPrestart();
}
watch(() => aj.identity.user, async user => {
    if (user == null) return;
    allSelected.value = false; checked.value = []; processes.value = []; commands.value = [];
    auto.value = false; timerStart.value = countdown.value = 30;
    clearInterval(interval);
    interval = setInterval(() => {
        if (auto.value && filtered.value?.length > 0) {
            if (countdown.value === 0) { checkStatus(); countdown.value = timerStart.value; }
            else countdown.value -= 1;
        }
    }, 1000);
    try {
        const school = (await aj.http.get('/api/lmn/activeschool')).data;
        aj.identity.patch({ activeSchool: school });
        const filepath = `/etc/linuxmuster/sophomorix/${school}/${school === 'default-school' ? 'devices.csv' : school + '.devices.csv'}`;
        devices.value = (await aj.http.post(base + 'getdevices', { filepath, school })).data;
        filtered.value = [];
        rooms.value = Object.fromEntries(devices.value.map(d => [d.room, { name: d.room, checked: false }]));
        checkStatus();
    } catch { /* Like Angular, no empty devices message before successful loading. */ }
}, { immediate: true });
function filterRoom(room, selected) {
    rooms.value = { ...rooms.value, [room.name]: { ...room, checked: selected } };
    const selectedRooms = Object.values(rooms.value).filter(r => r.checked).map(r => r.name);
    filtered.value = devices.value.filter(d => selectedRooms.includes(d.room));
    checkStatus();
}
function checkDevice(device, selected) {
    // ng:click ran before checkbox ng:model: preserve its one-click selection lag.
    checked.value = filtered.value.filter(d => d.checked && 'hostname' in d);
    updateDevice({ ...device, checked: selected });
}
function toggleAll() {
    allSelected.value = !allSelected.value;
    for (const device of filtered.value) updateDevice({ ...device, checked: allSelected.value });
    checked.value = filtered.value.filter(d => d.checked && 'hostname' in d);
}
async function action(device, name) {
    try {
        await aj.http.post(base + name, { device });
        aj.notify.success(aj.gettext(`Device ${name} successful initiated!`));
        const timeout = setTimeout(() => { timeouts.delete(timeout); checkStatus(); }, 3000);
        timeouts.add(timeout);
    } catch { aj.notify.error(aj.gettext(`Device ${name} failed!`)); }
}
function toggleMenu(host, value) { menus.value = menus.value[host] === value ? {} : { [host]: value }; }
function openProcesses() { open(Processes, { processes, refresh: refreshProcesses }); }
function openPrestart() { open(Prestart, { commands, refresh: refreshPrestart }); }
function open(Component, props) { aj.modal.open(Component, props, { backdrop: 'static' }).catch(() => { /* Escape/dismiss. */ }); }
function remote(device, prestart) { open(LinboRemote, { device: computed(() => devices.value.find(d => d.hostname === device.hostname)), prestart, updateDevice, refreshPrestart, refreshProcesses }); }
onUnmounted(() => { window.removeEventListener('click', closeMenus); window.removeEventListener('keydown', escapeMenu); clearInterval(interval); timeouts.forEach(clearTimeout); });
</script>
<template>
    <div>
        <div id="siteContent" style="padding-top:20px">
            <div class="alert alert-warning">{{ aj.gettext('This plugin is deprecated and will be removed in a future release. Running LINBO commands is no longer possible here: please use the plugin "Linbo synchronization" instead.') }}</div>
            <div v-if="filtered?.length === 0" id="deviceList" style="width:75%;float:left" class="alert alert-info">{{ aj.gettext('Please select a room to display devices!') }}</div>
            <div v-if="filtered?.length > 0" id="deviceList" style="width:75%;float:left">
                <div v-for="device in filtered" :key="device.hostname" class="lmp_deviceBoxSM">
                    <div class="lmp_deviceBoxSM_topBar">
                        <div style="float:left"><input type="checkbox" :checked="device.checked" @change="checkDevice(device, $event.target.checked)">
                            <i v-if="['up','down','unknown'].includes(device.online)" class="fas fa-circle" :style="{color: {up:'green',down:'red',unknown:'grey'}[device.online]}" :title="device.online"></i>
                        </div>
                        <div class="input-group-btn" style="float:right;margin-right:25px" :class="{open: menus[device.hostname] === 'options'}">
                            <button class="btn btn-default btn-sm" style="padding:3px 8px" :title="aj.gettext('Options')" @click="toggleMenu(device.hostname, 'options')"><i class="fas fa-bars" style="color:black"></i></button>
                            <div class="dropdown-menu dropdown-menu-left multi-level">
                                <li v-if="device.online === 'down' && !device.remoteBlock" class="dropdown-item"><a data-action="start" @click="action(device, 'start')"><i class="fa fa-power-off"></i> {{ aj.gettext('Start') }}</a></li>
                                <li v-if="device.online === 'up' || device.online === 'unknown'" class="dropdown-item disabled"><a><i class="fa fa-power-off"></i> {{ aj.gettext('Start') }}</a></li>
                                <li v-for="name in ['shutdown','reboot']" :key="name" class="dropdown-item" :class="{disabled: device.os === 'Unknown' || device.remoteBlock}"><a :data-action="device.os !== 'Unknown' && !device.remoteBlock ? name : undefined" @click="device.os !== 'Unknown' && !device.remoteBlock && action(device, name)"><i :class="name === 'reboot' ? 'fa fa-refresh' : 'fa fa-power-off'"></i> {{ aj.gettext(name === 'reboot' ? 'Reboot' : 'Shutdown') }}</a></li>
                                <li class="dropdown-item" :class="{disabled:device.os !== 'Linbo'}"><a :data-action="device.os === 'Linbo' ? 'remote' : undefined" @click="device.os === 'Linbo' && remote(device, false)"><i class="fa fa-hospital-o"></i> Linbo-Remote</a></li>
                                <li class="dropdown-item" :class="{disabled:device.remoteBlock}"><a :data-action="!device.remoteBlock ? 'prestart' : undefined" @click="!device.remoteBlock && remote(device, true)"><i class="fa fa-hospital-o"></i> Linbo-Remote (Prestart)</a></li>
                            </div>
                        </div>
                        <div class="input-group-btn" style="float:right;margin-right:30px" :class="{open:menus[device.hostname] === 'infos'}">
                            <button class="btn btn-default btn-sm" style="padding:3px 8px" :title="aj.gettext('Infos')" @click="toggleMenu(device.hostname, 'infos')"><i class="fas fa-question-circle" style="color:black"></i></button>
                            <ul class="dropdown-menu dropdown-menu-left"><li v-for="[label, field] in [['Room','room'],['Hostname','hostname'],['IP','ip'],['MAC','mac'],['Group','group'],['Type','type'],['OS','os'],['Online','online']]" :key="field" class="dropdown-item" style="padding:0 5px">{{ aj.gettext(label) }}: {{ device[field] }}</li></ul>
                        </div>
                    </div>
                    <div id="OSArea" style="text-align:center"><i v-if="['Linux','Windows','Linbo','Unknown'].includes(device.os)" :class="'fa ' + {Linux:'fa-linux', Windows:'fa-windows', Linbo:'fa-hospital-o', Unknown:'fa-question-circle'}[device.os]" style="color:black;font-size:35px;height:40px;width:40px" :title="device.os"></i></div>
                    <div style="text-align:center;width:100%"><strong>{{ device.hostname }}</strong><br>{{ device.ip }}</div>
                </div>
            </div>
            <div id="sideBar" style="width:20%;float:right;padding:5px">
                <div style="margin-bottom:10px"><button class="btn btn-lmn" style="width:100%;text-align:left" :title="aj.gettext('Linbo-Remote Processes currently running')" @click="openProcesses"><span class="badge badge-secondary" style="margin-right:10px">{{ processes?.length }}</span><span>{{ aj.gettext('LR-Processes') }}</span></button></div>
                <div style="margin-bottom:10px"><button class="btn btn-lmn" style="width:100%;text-align:left" :title="aj.gettext('Commands to use when device starts in linbo')" @click="openPrestart"><span class="badge badge-secondary" style="margin-right:10px">{{ commands?.length }}</span><span>{{ aj.gettext("LR-Prestart's") }}</span></button></div>
                <hr><div style="margin-bottom:10px"><button class="btn btn-lmn" style="width:100%" @click="checkStatus">{{ aj.gettext('Refresh') }}</button></div>
                <div style="margin-bottom:10px"><input v-model="auto" data-auto type="checkbox"> {{ aj.gettext('Auto-Refresh') }}<br>
                    <div class="input-group" style="margin:10px 0"><input v-model.number="timerStart" type="number" style="width:60%" class="form-control" aria-label="autoRefreshStatusTimerStart"><button data-set class="btn btn-lmn btn-sm" style="margin-left:10px;width:calc(40% - 15px)" @click="countdown = timerStart === '' ? null : timerStart">Set</button></div>
                    {{ aj.gettext('Next refresh in') }} {{ countdown }} {{ aj.gettext('seconds!') }}
                </div>
                <hr><div style="margin-bottom:10px">{{ aj.gettext('Current school:') }}<br><strong style="padding-left:10px">{{ aj.identity.profile.activeSchool }}</strong></div>
                <div style="margin-bottom:10px">{{ aj.gettext('Rooms:') }}<br><div v-for="room in rooms" :key="room.name" class="room" style="font-weight:bold;padding-left:10px"><input type="checkbox" :checked="room.checked" @change="filterRoom(room, $event.target.checked)"> {{ room.name }}<br></div></div>
            </div>
        </div>
        <div class="floating-toolbar-padder"></div>
        <component :is="'floating-toolbar'"><div class="container"><div class="row"><div v-if="sidebar" class="col-md-3"></div><div :class="sidebar ? 'col-md-9' : 'col-md-12'"><div class="bar row">
            <template v-if="checked.length > 0"><button v-for="name in ['start','shutdown','reboot']" :key="name" class="btn btn-lmn" @click="open(BulkAction, {devices:checked,action:name})"><i :class="name === 'reboot' ? 'fa fa-refresh' : 'fa fa-power-off'"></i> {{ aj.gettext({start:'Start',shutdown:'Shutdown',reboot:'Reboot'}[name]) }}</button></template>
            <button v-if="filtered?.length > 0" class="btn btn-lmn pull-right" @click="toggleAll">{{ checked.length }} {{ aj.gettext('devices selected') }}</button>
        </div></div></div></div></component>
    </div>
</template>

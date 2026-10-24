<script setup>
import { inject, onBeforeUnmount, ref } from 'vue';
import ConfigDialog from './ConfigDialog.vue';
import ImportDialog from './ImportDialog.vue';
const aj = inject('aj');
const peers = ref(), status = ref({});
const sidebar = ref(true);
const sidebarChanged = event => { sidebar.value = event.detail; };
window.addEventListener('lmn-wireguard-sidebar', sidebarChanged);
onBeforeUnmount(() => window.removeEventListener('lmn-wireguard-sidebar', sidebarChanged));
const api = (url, method = 'GET', data) => aj.http.post('/api/lmn/wireguard', { url: '/api/wireguard/' + url, method, ...(data === undefined ? {} : { data }) });
aj.pageTitle.set(aj.gettext('Wireguard'));
async function loadStatus() {
    try { status.value = (await api('peers/status')).data; }
    catch { /* Keep the old status; the adapter handles HTTP failures. */ }
}
async function loadPeers() {
    try { peers.value = (await api('peers')).data; loadStatus(); }
    catch { /* Preserve original loading/connection warning on failure. */ }
}
async function showConfig(peer, qr = false) {
    try {
        const { data } = await api('peers/' + peer + (qr ? '/qr/b64' : '/config'));
        await aj.modal.open(ConfigDialog, { peer, config: qr ? undefined : String(data.data), qr: qr ? String(data) : undefined });
    } catch { /* No dialog on HTTP failure; dismissal has no side effects. */ }
}
async function restart(changed = false) {
    try {
        await aj.messagebox.show({ text: aj.gettext(changed ? 'The configuration has changed. Do you want to restart the server?' : 'Do you really want to restart the wireguard server? All clients have to reconnected!'), positive: aj.gettext('Restart'), negative: aj.gettext('Cancel') });
        await api('restart');
        aj.notify.success(aj.gettext('Restarted succesfully!'));
        loadPeers();
    } catch { /* Cancellation or HTTP error leaves peers as before. */ }
}
async function create() {
    try {
        const msg = await aj.messagebox.prompt(aj.gettext('Name') + ': ');
        await api('peers', 'POST', { name: msg.value });
        aj.notify.success(aj.gettext('Created succesfully!'));
        loadPeers(); restart(true);
    } catch { /* Prompt cancelled or HTTP failed. */ }
}
async function remove(peer) {
    try {
        await aj.messagebox.show({ text: aj.gettext('Do you really want to delete this peer?'), positive: aj.gettext('Delete'), negative: aj.gettext('Cancel') });
        await api('peers/' + peer, 'DELETE');
        aj.notify.success(aj.gettext('Deleted succesfully!'));
        loadPeers(); restart(true);
    } catch { /* Confirmation cancelled or HTTP failed. */ }
}
async function importUsers() {
    try {
        const result = await aj.modal.open(ImportDialog, { peers: peers.value }, { backdrop: 'static', keyboard: true });
        if (result) restart(true);
        loadPeers();
    } catch { /* Dismissal leaves the parent unchanged, as in the original. */ }
}
// The original Angular number filter uses its bundled en-US locale.
const number = (value, digits) => value == null ? '' : Number(value).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
loadPeers();
</script>
<template>
    <h1>Wireguard</h1>
    <div v-if="!peers" class="alert alert-warning" role="alert">Connection to wireguard server is not possible! Please check the server or your configuration!</div>
    <div v-if="peers" style="margin-bottom:100px">
        <div class="card" style="width:100%"><ul v-for="(peer, index) in peers" :key="index" class="list-group list-group-flush">
            <li class="list-group-item" :style="{ borderLeft: status?.[peer.name]?.status === 'connected' ? '7px solid green' : '7px solid red' }">
                <div style="font-size:larger;font-weight:bold">{{ peer.name }}</div>
                <div><b>{{ aj.gettext('Public-Key') }}</b>: {{ peer.public_key }} | <b>{{ aj.gettext('IP-Address') }}</b>: {{ peer.ip }}</div>
                <div><b>{{ aj.gettext('Routes') }}</b>: <span v-for="(route, i) in peer.routes" :key="i" class="badge bg-secondary">{{ route }}</span></div>
                <div v-if="status?.[peer.name]?.status === 'connected'">
                    <b>{{ aj.gettext('Endpoint') }}</b>: {{ status[peer.name].endpoint }}
                    <b>{{ aj.gettext('Last Handshake') }}</b>: {{ number(status[peer.name].latest_handshake_difference, 0) }} seconds ago |
                    <i class="fa fa-arrow-down"></i> {{ number(status[peer.name].transfer?.received, 2) }} MiB | <i class="fa fa-arrow-up"></i> {{ number(status[peer.name].transfer?.send, 2) }} MiB
                </div>
                <div style="margin-top:10px">
                    <button class="btn btn-lmn" @click="showConfig(peer.name)">{{ aj.gettext('Configuration') }}</button>
                    <button class="btn btn-lmn" @click="showConfig(peer.name, true)">{{ aj.gettext('Show QR-Code') }}</button>
                    <button class="btn btn-danger" @click="remove(peer.name)">{{ aj.gettext('Delete') }}</button>
                </div>
            </li>
        </ul></div>
    </div>
    <div v-if="peers" class="floating-toolbar-padder"></div>
    <component :is="'floating-toolbar'" v-if="peers"><div class="container"><div class="row"><div :class="{ 'col-md-3': sidebar }"></div><div :class="sidebar ? 'col-md-9' : 'col-md-12'"><div class="bar row">
        <button class="btn btn-success" @click="create"><i class="fa fa-plus" title="Add"></i></button>
        <button class="btn btn-success" @click="importUsers"><i class="fa fa-upload" title="Import"></i></button>
        <button class="btn btn-danger pull-right" @click="restart()"><i class="fa fa-power-off"></i> {{ aj.gettext('Restart') }}</button>
        <button class="btn btn-lmn pull-right" @click="loadStatus"><i class="fa fa-refresh"></i> {{ aj.gettext('Query status') }}</button>
    </div></div></div></div></component>
</template>

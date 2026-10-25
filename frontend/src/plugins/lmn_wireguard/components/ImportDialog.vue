<script setup>
import { inject, ref } from 'vue';
const props = defineProps({ peers: [Array, Object] });
const emit = defineEmits(['close']);
const aj = inject('aj');
const users = ref([]), userstoimport = ref(), peerstodelete = ref();
const importstatus = ref(), importmax = ref(), importprogress = ref();
const prefix = 'lmn-user_';
for (const kind of ['students', 'teachers']) {
    aj.http.get('/api/lmn/sophomorixUsers/' + kind).then(({ data }) => { users.value = users.value.concat(data); }, () => {
        // Retain the original list; HTTP error handling belongs to the adapter.
    });
}
function checkUser() {
    const peers = Object.values(props.peers || {});
    userstoimport.value = users.value.filter(user => !peers.some(peer => peer.name == prefix + user.sAMAccountName));
    peerstodelete.value = peers.filter(peer => peer.name.includes(prefix) && !users.value.some(user => peer.name == prefix + user.sAMAccountName));
}
function run(importonly) {
    importstatus.value = 0;
    importmax.value = userstoimport.value.length + (importonly ? 0 : peerstodelete.value.length);
    const completed = () => {
        importstatus.value += 1;
        importprogress.value = importstatus.value / importmax.value * 100;
    };
    const failed = () => { /* Original leaves failed operations out of progress. */ };
    for (const user of userstoimport.value) {
        aj.http.post('/api/lmn/wireguard', { url: '/api/wireguard/peers', method: 'POST', data: { name: prefix + user.sAMAccountName } }).then(completed, failed);
    }
    if (!importonly) for (const peer of peerstodelete.value) {
        aj.http.post('/api/lmn/wireguard', { url: '/api/wireguard/peers/' + peer.name, method: 'DELETE' }).then(completed, failed);
    }
}
</script>
<template>
    <div class="modal-header"><h3>{{ aj.gettext('Import users') }}</h3></div>
    <div class="modal-body">
        <ol style="line-height:1.5em">
            <li>Found {{ users.length }} users on server <button class="btn btn-sm" @click="checkUser">Check users</button></li>
            <li>Found {{ userstoimport?.length }} users to import and {{ peerstodelete?.length }} users to delete
                <div v-if="userstoimport?.length > 0"><h4>Users to import</h4>
                    <table class="table table-bordered" style="background-color:#2af9231c"><thead><tr><th>Username</th><th>Firstname</th><th>Lastname</th></tr></thead><tbody><tr v-for="(user, index) in userstoimport" :key="index"><td>{{ user.sAMAccountName }}</td><td>{{ user.givenName }}</td><td>{{ user.sn }}</td></tr></tbody></table>
                </div>
                <div v-if="peerstodelete?.length > 0"><h4>Peers to delete</h4>
                    <table class="table table-bordered" style="background-color:#c202021c"><thead><tr><th>Peer-Name</th></tr></thead><tbody><tr v-for="(peer, index) in peerstodelete" :key="index"><td>{{ peer.name }}</td></tr></tbody></table>
                </div>
            </li>
            <li>Run import or import and delete!</li>
        </ol><br>
        <div v-if="importstatus" class="progress"><div class="progress-bar progress-bar-striped" role="progressbar" :style="{ width: importprogress + '%' }" :aria-valuenow="importprogress" aria-valuemin="0" aria-valuemax="100">{{ importstatus }} / {{ importmax }}</div></div>
    </div>
    <div class="modal-footer">
        <button :disabled="!userstoimport || userstoimport.length === 0" class="btn btn-success" @click="run(true)">{{ aj.gettext('Import') }}</button>
        <button :disabled="!userstoimport || peerstodelete.length === 0" class="btn btn-success" @click="run()">{{ aj.gettext('Import + Delete') }}</button>
        <button class="btn c5-button" @click="emit('close', !importstatus)">{{ aj.gettext('Close') }}</button>
    </div>
</template>

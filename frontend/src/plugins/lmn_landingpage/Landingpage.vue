<script setup>
import { computed, inject, onBeforeUnmount, ref, watch } from 'vue';
import { useSambaAccess } from '../../common/access.mjs';
import { groupsFor, isListAttr, ordered, quotasFor } from './model.mjs';
import CustomFields from './CustomFields.vue';
import WebappQR from './WebappQR.vue';
import Wireguard from './Wireguard.vue';
const aj = inject('aj');
const allowed = useSambaAccess(aj);
const user = ref(), fields = ref(), quotaData = ref(), options = ref(), status = ref();
const quotas = computed(() => quotaData.value && quotasFor(quotaData.value, aj.gettext));
const groups = computed(() => user.value && ordered(groupsFor(user.value.memberOf, aj.gettext), ['category', 'cn']));
const customFields = computed(() => ordered(fields.value, ['title']));
const hello = computed(() => aj.gettext('Hello {{user.givenName}} {{user.sn}},').replace('{{user.givenName}}', user.value.givenName ?? '').replace('{{user.sn}}', user.value.sn ?? ''));
const clients = [
    ['Windows', 'windows', 'https://download.wireguard.com/windows-client/wireguard-installer.exe'],
    ['Linux', 'linux', 'https://www.wireguard.com/install/'],
    ['Android', 'android', 'https://play.google.com/store/apps/details?id=com.wireguard.android'],
    ['iOS', 'apple', 'https://itunes.apple.com/us/app/wireguard/id1441195209?ls=1&mt=8'],
];
let timer, disposed = false;
aj.pageTitle.set(aj.gettext('Home'));
async function load(url, assign) {
    try { const { data } = await aj.http.get(url); if (!disposed) assign(data); }
    catch { /* Original keeps loading/previous values; adapter reports HTTP failures. */ }
}
async function wireguardRequest(suffix) {
    return aj.http.post('/api/lmn/wireguard', { url: `/api/wireguard/peers/lmn-user_${aj.identity.user}/${suffix}`, method: 'GET' });
}
async function refreshStatus() {
    try { const { data } = await wireguardRequest('status'); if (!disposed) status.value = data; }
    catch { /* Original keeps the previous connection status. */ }
}
load('/api/lmn/display_options', (data) => {
    options.value = data;
    if (data.show_wireguard) { refreshStatus(); timer = setInterval(refreshStatus, 30000); }
});
watch(() => aj.identity.user, (login) => {
    if (login == null || login === 'root') return;
    user.value = { ...aj.identity.profile };
    load(`/api/lmn/users/${login}/customfields`, (data) => { fields.value = data; });
    load(`/api/lmn/quota/user/${login}`, (data) => {
        quotaData.value = data;
        user.value = { ...user.value, sophomorixCloudQuotaCalculated: data.cloud, sophomorixMailQuotaCalculated: data.mail };
    });
}, { immediate: true });
async function customDialog() {
    try { await aj.modal.open(CustomFields, { fields: fields.value, user: user.value, onUpdateFields: (updated) => { fields.value = updated; } }); }
    catch { /* Closing via Escape, backdrop or Close dismisses the old modal too. */ }
    if (!disposed) aj.reload();
}
async function webappDialog() {
    try { await aj.modal.open(WebappQR, {}); }
    catch { /* Dialog dismissed. */ }
}
async function wireguardDialog(qr) {
    try {
        const { data } = await wireguardRequest(qr ? 'qr/b64' : 'config');
        if (!disposed) await aj.modal.open(Wireguard, { data, qr, peer: `lmn-user_${aj.identity.user}` });
    } catch { /* Adapter handles HTTP errors; modal dismissal has no side effect. */ }
}
onBeforeUnmount(() => { disposed = true; clearInterval(timer); });
</script>
<template>
    <div v-if="allowed">
        <h2>{{ aj.gettext('Welcome to Linuxmuster.net version 7.4 !') }}</h2><br>
        <component :is="'progress-spinner'" v-if="!user"><div><div class="one"></div><div class="two"></div></div></component>
        <div v-if="user">
            <div style="margin-left:10px"><h4>{{ hello }}</h4>
                <div v-if="user.sophomorixRole === 'teacher'">{{ aj.gettext('use the sidebar to navigate through the options. You can start by using the Enroll module to subscribe to your classes.') }}</div>
                <div v-if="['globaladministrator', 'schooladministrator'].includes(user.sophomorixRole)">{{ aj.gettext('Use the sidebar to navigate through the options.') }}<br>{{ aj.gettext('But keep in mind:') }}<br><b>{{ aj.gettext('With great power comes great responsibility!') }}</b></div>
            </div>
            <div class="flex-container info-cards width400" style="margin-top:10px">
                <div class="panel panel-info"><div class="panel-heading"><h4>{{ aj.gettext('Account Information') }}</h4></div>
                    <div class="panel-body">
                        {{ aj.gettext('Name:') }} <b>{{ user.givenName }} {{ user.sn }}</b><br>
                        {{ aj.gettext('Mail:') }} <b>{{ user.mail?.join(',') }}</b><br>
                        {{ aj.gettext('School:') }} <b>{{ user.sophomorixSchoolname }}</b><br>
                        {{ aj.gettext('Role:') }} <b>{{ user.sophomorixAdminClass }}</b><br>
                        <button class="btn btn-primary pull-right" style="margin-top:20px" @click="aj.navigate('/view/lmn/change-password')">{{ aj.gettext('Change password') }}</button>
                    </div>
                </div>
                <div class="panel panel-info"><div class="panel-heading"><h4>{{ aj.gettext('Quotas') }}</h4></div>
                    <div class="panel-body">
                        <div v-for="quota in quotas" :key="quota.share" style="margin-bottom:15px"><div class="widget-header">{{ quota.share }}</div>
                            <div class="progress"><div class="progress-bar" :class="`progress-bar-${quota.type}`" role="progressbar" :aria-valuenow="quota.usage" aria-valuemin="0" aria-valuemax="100" :style="{ width: `${Math.min(quota.usage, 100)}%` }"></div></div>
                            <div class="widget-value">{{ quota.used }} MiB <span v-if="quota.total != 0">/ {{ quota.total }}</span><sup v-if="quota.usage > 80"><span class="label label-danger"><i class="fa fa-warning"></i></span></sup></div>
                        </div>
                        <b>{{ aj.gettext('Cloudquota Calculated in MB:') }}</b> {{ user.sophomorixCloudQuotaCalculated }}<br>
                        <b>{{ aj.gettext('Mailquota Calculated in MB:') }}</b> {{ user.sophomorixMailQuotaCalculated }} MB
                    </div>
                </div>
                <div v-if="fields?.length > 0" class="panel panel-info"><div class="panel-heading"><h4>{{ aj.gettext('My informations') }}</h4></div>
                    <div class="panel-body"><ul class="list-unstyled" style="column-width:300px;padding:0">
                        <li v-for="(custom, index) in customFields" :key="index" data-custom class="cardlist" style="margin:0 15px 5px 0;justify-content:space-between"><div>{{ custom.title }}</div><div style="margin-right:10px;text-align:right">{{ isListAttr(custom.attr) ? custom.value?.join(' ') : custom.value }}</div></li>
                    </ul><button v-if="user.sophomorixRole !== 'student'" class="btn btn-primary pull-right" style="margin-top:20px" @click="customDialog">{{ aj.gettext('Change my data') }}</button></div>
                </div>
                <div v-if="options?.show_webdav" class="panel panel-info"><div class="panel-heading"><h4>{{ aj.gettext('Mobile access') }}</h4></div>
                    <div class="panel-body"><p>{{ aj.gettext('You can access the school server from many mobile devices. Select your operating system to see how it works.') }}</p><a @click="webappDialog"><i class="fab fa-apple fa-3x"></i></a></div>
                </div>
                <div class="panel panel-info"><div class="panel-heading"><h4>{{ aj.gettext('Groups') }}</h4></div>
                    <div class="panel-body"><ul class="list-unstyled" style="column-width:300px;padding:0"><li v-for="(group, i) in groups" :key="i" class="cardlist" style="margin:0 15px 5px 0">{{ group.cn }}<span style="position:absolute;right:10px">{{ group.category }}</span></li></ul></div>
                </div>
                <div v-if="options?.show_wireguard" class="panel panel-info"><div class="panel-heading"><h4>{{ aj.gettext('Wireguard VPN') }}</h4></div>
                    <div class="panel-body"><p>{{ aj.gettext('You can access the school network by using wireguard. You can download the client for the following operating systems:') }}</p>
                        <a v-for="[title, icon, url] in clients" :key="title" :href="url" target="_blank" style="margin-right:10px" :title="title"><i :class="`fab fa-${icon} fa-3x`"></i></a>
                        <a class="pull-right" style="margin-right:10px" title="Show QR-Code" @click="wireguardDialog(true)"><i class="fa fa-qrcode fa-3x"></i></a>
                        <a class="pull-right" style="margin-right:10px" title="Show Configuration" @click="wireguardDialog(false)"><i class="fa fa-download fa-3x"></i></a>
                        <div v-if="status?.status === 'connected'" class="alert alert-success" role="alert" style="margin-top:20px"><b>{{ aj.gettext('Endpoint') }}</b>: {{ status.endpoint }} <b>{{ aj.gettext('Last Handshake') }}</b>: {{ Number(status.latest_handshake_difference).toLocaleString('en-US', { maximumFractionDigits: 0 }) }} seconds ago |
                            <i class="fa fa-arrow-down"></i> {{ Number(status.transfer.received).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }} MiB | <i class="fa fa-arrow-up"></i> {{ Number(status.transfer.send).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }} MiB
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div v-else class="text-center root-access-blocker"><h1><i class="fas fa-exclamation-triangle"></i></h1><h4 class="alert alert-danger">{{ aj.gettext('You should not use WebUI as root user!') }}<br>{{ aj.gettext('If this is your first time running WebUI, proceed through the') }} <a href="/view/lmn/init/welcome">{{ aj.gettext('setup wizard') }}</a>.<br>{{ aj.gettext('Afterwards login using the global-admin account.') }}</h4></div>
</template>

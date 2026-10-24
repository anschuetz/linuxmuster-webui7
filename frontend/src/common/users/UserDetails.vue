<script setup>
import { computed, inject, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { createCustomFields, formatUserDate, groupDetails, mapCustomRole, quotaDetails } from './customFields.mjs';
const props = defineProps({ id: { type: String, required: true }, role: { type: String, required: true }, reloadPage: { type: Function, default: () => window.location.reload() } });
const emit = defineEmits(['cancel']);
const aj = inject('aj'), fields = createCustomFields(aj);
const user = ref(), groups = ref(), quotas = ref(), config = ref();
const showGroups = ref(true), showQuotas = ref(true), parentSearchVisible = ref(false), query = ref(''), parents = ref([]), parentIndex = ref(0);
let active = true;
onBeforeUnmount(() => { active = false; });
const admin = computed(() => aj.identity.profile.isAdmin);
const customColumn = computed(() => config.value && (mapCustomRole(props.role) === 'students' || config.value.proxyAddresses.show || Object.values(config.value.custom).some(v => v.show) || Object.values(config.value.customMulti).some(v => v.show)));
const error = () => { if (active) aj.notify.error(aj.gettext('Error, please verify the user and/or your values.')); };
onMounted(() => {
    aj.http.get(`/api/lmn/sophomorixUsers/${props.role}/${props.id}`).then(response => {
        if (!active) return;
        user.value = response.data[0];
        groups.value = groupDetails(user.value.memberOf);
    }).catch(error);
    aj.http.get(`/api/lmn/quota/user/${props.id}`).then(response => {
        if (active) quotas.value = quotaDetails(response.data, aj.gettext);
    }).catch(error);
});
// Identity arrives asynchronously, as identity.promise did in Angular.
watch(() => admin.value || aj.identity.user === 'root', async allowed => {
    await Promise.resolve();
    if (!active) return;
    if (allowed) fields.loadConfig(props.role).then(value => { if (active) config.value = value; }).catch(error);
    else config.value = undefined;
}, { immediate: true });
function setValue(key, value) { if (active) user.value = { ...user.value, [key]: value }; }
async function editCustom(index) {
    const key = `sophomorixCustom${index}`;
    try { setValue(key, await fields.editCustom(props.id, user.value[key], index)); } catch { /* Cancellation or service-reported error retains data. */ }
}
async function addValue(index) {
    const key = index ? `sophomorixCustomMulti${index}` : 'proxyAddresses';
    try {
        const value = await (index ? fields.addCustomMulti(props.id, index) : fields.addProxyAddresses(props.id));
        if (value) setValue(key, [...user.value[key], value]);
    } catch { /* Cancellation or service-reported error retains data. */ }
}
async function removeValue(index, value) {
    const key = index ? `sophomorixCustomMulti${index}` : 'proxyAddresses';
    try {
        await (index ? fields.removeCustomMulti(props.id, value, index) : fields.removeProxyAddresses(props.id, value));
        const position = user.value[key].indexOf(value);
        setValue(key, user.value[key].filter((_, i) => i !== position));
    } catch { /* Cancellation or service-reported error retains data. */ }
}
watch(query, async q => {
    parents.value = [];
    parentIndex.value = 0;
    if (q.length < 3) return;
    try {
        const response = await aj.http.post('/api/lmn/ldap-search', { role: '', login: q });
        if (active && q === query.value) parents.value = response.data.filter(entry => entry.role !== 'student' && !entry.role.includes('administrator') && !entry.role.includes('binduser'));
    } catch { error(); }
});
function searchKey(event) {
    if (!parents.value.length) return;
    if (['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) event.preventDefault();
    if (event.key === 'ArrowDown') parentIndex.value = (parentIndex.value + 1) % parents.value.length;
    if (event.key === 'ArrowUp') parentIndex.value = (parentIndex.value + parents.value.length - 1) % parents.value.length;
    if (event.key === 'Enter') parentAction(parents.value[parentIndex.value]);
}
async function parentAction(parent, remove = false) {
    try {
        const request = aj.http.post(`/api/lmn/sophomorixUsers/${remove ? 'remove' : 'add'}-parent`, { student: props.id, parent: remove ? parent.cn : parent.login });
        if (!remove) {
            if (active) {
                parentSearchVisible.value = false;
                query.value = '';
            }
            aj.notify.success(parent.displayName + aj.gettext(' added with default values in the list.'));
        }
        const response = await request;
        if (response.data !== '') { aj.notify.error(response.data); return; }
        aj.notify.success(aj.gettext(remove ? `Parent ${parent.displayname} removed from ${props.id}` : `Parent ${parent.label} assigned to ${props.id}`));
        if (active) setValue('parents', remove ? user.value.parents.filter(p => p !== parent) : [...user.value.parents, { cn: parent.login, displayname: parent.displayName }]);
    } catch { aj.notify.error(aj.gettext('Error, please verify the user and/or your values.')); }
}
async function killUser() {
    const u = user.value;
    try {
        await aj.messagebox.show({ title: aj.gettext('Kill user ' + u.cn), text: aj.gettext(`Do you really want to definitively remove the user ${u.cn}? This action is uncoverable.`), positive: 'Yes, definitively remove', negative: 'Cancel' });
    } catch { return; }
    try {
        const response = await aj.http.post('/api/lmn/sophomorixUsers/killuser', { user: u.cn });
        if (response.data !== true) {
            aj.notify.error(`There was an error during the process. Please try manually to execute the command 'sophomorix-kill --kill ${u.cn}' to get more informations.`);
            return;
        }
        aj.notify.success(aj.gettext(`User ${u.cn} successfully deleted!`));
    } catch { error(); return; }
    try {
        await aj.messagebox.show({ title: aj.gettext(`Clean up ${u.sophomorixAdminFile}`), text: aj.gettext(`The user account was deleted but you will have to manually remove the corresponding line in the file ${u.sophomorixAdminFile}.`), positive: 'OK, I understand' });
        props.reloadPage();
    } catch { /* Acknowledgement cancelled: do not reload. */ }
}
</script>
<template>
    <div class="modal-header"><h3>{{ $gettext('User Details') }}{{ user == null ? ' ...' : ` - ${user.givenName} ${user.sn}` }}</h3></div>
    <div v-if="user == null" class="spinner" role="status"><i class="fa fa-circle-o-notch fa-spin"></i></div>
    <div v-else style="padding:0 20px">
        <br><h4>{{ $gettext('Properties') }}</h4>
        <div style="display:flex;align-items:flex-start">
            <table class="table"><tbody>
                <tr><td><b>{{ $gettext('Loginname:') }}</b></td><td>{{ user.sAMAccountName }}</td></tr>
                <tr><td><b>{{ $gettext('Class:') }}</b></td><td>{{ user.sophomorixAdminClass }}</td></tr>
                <tr v-if="user.sophomorixBirthdate !== 'hidden'"><td><b>{{ $gettext('Birthday:') }}</b></td><td>{{ user.sophomorixBirthdate }}</td></tr>
                <tr><td><b>{{ $gettext('Sophomorix Status:') }}</b></td><td><span :class="`label label-${user.sophomorixStatus.color}`">{{ user.sophomorixStatus.tag }}</span></td></tr>
                <tr v-for="[label,key] in [['Role:','sophomorixRole'],['Schoolname:','sophomorixSchoolname'],['User ID (optional):','sophomorixUnid']]" :key="key"><td><b>{{ $gettext(label) }}</b></td><td>{{ user[key] }}</td></tr>
                <tr v-for="[label,key] in [['DeactivationDate:','sophomorixDeactivationDate'],['TolerationDate:','sophomorixTolerationDate'],['CreationDate:','sophomorixCreationDate']]" :key="key"><td><b>{{ $gettext(label) }}</b></td><td>{{ formatUserDate(user[key],aj.gettext) }}</td></tr>
            </tbody></table>
            <table v-if="customColumn" class="table"><tbody>
                <template v-if="user.sophomorixRole === 'student'">
                    <tr><td><b>{{ $gettext('Parents') }}</b></td><td>{{ user.parents.length === 0 ? $gettext('No parents found!') : '' }}</td><td><a data-action="parent-search" title="Add parent" @click="parentSearchVisible=true"><i class="fa fa-plus"></i></a></td></tr>
                    <tr v-for="(parent,i) in user.parents" :key="i"><td colspan="2" style="text-align:center;border-top:none">{{ parent.displayname }}</td><td><a data-action="remove-parent" title="Remove parent" @click="parentAction(parent,true)"><i class="fa fa-trash-o"></i></a></td></tr>
                </template>
                <tr v-if="config.proxyAddresses.show"><td><b>{{ config.proxyAddresses.title || 'Proxy addresses' }}</b></td><td><span v-for="(value,i) in user.proxyAddresses" :key="i" class="label label-info" data-action="remove-proxy" style="display:inline-block" @click="removeValue(null,value)">{{ value }} <i class="far fa-times-circle"></i></span></td><td><a data-action="add-proxy" @click="addValue(null)"><i class="fa fa-plus"></i></a></td></tr>
                <template v-for="n in [1,2,3,4,5]" :key="n">
                    <tr v-if="config.custom[n]?.show"><td><b>{{ config.custom[n].title || `Custom ${n}` }}</b></td><td>{{ user['sophomorixCustom'+n] }}</td><td><a :data-action="`edit-${n}`" @click="editCustom(n)"><i class="fa fa-pencil"></i></a></td></tr>
                </template>
                <template v-for="n in [1,2,3,4,5]" :key="n">
                    <tr v-if="config.customMulti[n]?.show"><td><b>{{ config.customMulti[n].title || `Multi Custom ${n}` }}</b></td><td><span v-for="(value,i) in user['sophomorixCustomMulti'+n]" :key="i" class="label label-info" style="display:inline-block" :data-action="`remove-multi-${n}`" @click="removeValue(n,value)">{{ value }} <i class="far fa-times-circle"></i></span></td><td><a :data-action="`add-multi-${n}`" @click="addValue(n)"><i class="fa fa-plus"></i></a></td></tr>
                </template>
            </tbody></table>
        </div>
        <div class="panel panel-info"><div class="panel-heading"><a class="btn btn-default btn-flat pull-right" data-action="groups" @click="showGroups=!showGroups">{{ $gettext(showGroups?'Hide':'Show') }}</a><h4>{{ $gettext('Group Membership:') }}</h4></div>
            <div v-show="showGroups" class="panel-body" data-section="groups"><ul class="list-unstyled" style="column-width:300px;padding:0"><li v-for="(group,i) in groups" :key="i" class="cardlist">{{ group.cn }} <span style="position:absolute;right:10px">{{ group.category }}</span></li></ul></div>
        </div>
        <div class="panel panel-info"><div class="panel-heading"><a class="btn btn-default btn-flat pull-right" data-action="quotas" @click="showQuotas=!showQuotas">{{ $gettext(showQuotas?'Hide':'Show') }}</a><h4>{{ $gettext('Quota:') }}</h4></div>
            <div v-show="showQuotas" class="panel-body" data-section="quotas" style="padding:15px 30px">
                <div v-for="quota in quotas" :key="quota.share" style="margin-bottom:15px"><div class="widget-header"><b>{{ quota.share }}</b><span :class="`label label-${quota.type} pull-right`">{{ quota.used }} MiB / {{ quota.total }} - {{ quota.usage }}%</span></div><div class="progress"><div :class="`progress-bar progress-bar-${quota.type}`" role="progressbar" :aria-valuenow="quota.usage" aria-valuemax="100" :style="{width:Math.min(100,Math.max(0,quota.usage))+'%'}"></div></div></div>
                <br><b>{{ $gettext('Cloudquota Calculated in MiB:') }}</b> {{ user.sophomorixCloudQuotaCalculated }}<br><b>{{ $gettext('Mailquota Calculated in MiB:') }}</b> {{ user.sophomorixMailQuotaCalculated }}
            </div>
        </div>
        <div class="modal-footer"><a v-if="admin" class="btn btn-danger pull-left" data-action="kill" title="Definitively remove the user's account" @click="killUser"><i class="fa fa-trash"></i> {{ $gettext('Remove account') }}</a><a class="btn btn-default btn-flat" @click="emit('cancel')">{{ $gettext('Close') }}</a></div>
    </div>
    <dialog v-show="parentSearchVisible" :open="parentSearchVisible" class="block-element animate-modal">
        <div class="modal" style="display:block"><div class="modal-dialog"><div class="modal-content">
        <div class="modal-header"><h3 class="modal-title">{{ $gettext('Add parent') }}</h3></div>
        <div class="modal-body"><input v-model.trim="query" type="text" class="form-control" placeholder="" @keydown="searchKey"><ul class="dropdown-menu" :style="{display:parents.length ? 'block' : 'none'}"><li v-for="(parent,i) in parents" :key="i" :class="{active:i===parentIndex}" @mouseenter="parentIndex=i"><a @click="parentAction(parent)">{{ parent.label }}</a></li></ul></div>
        <div class="modal-footer"><a class="btn btn-default btn-flat" @click="parentSearchVisible=false">{{ $gettext('Close') }}</a></div>
        </div></div></div>
    </dialog>
</template>

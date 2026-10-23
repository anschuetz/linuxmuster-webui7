<script setup>
import { computed, inject, onBeforeUnmount, ref, watch } from 'vue';
import { openWait } from '../../common/wait.mjs';
import ApplyDialog from './ApplyDialog.vue';
import UserSearch from './UserSearch.vue';
const aj = inject('aj');
const tabs = ['teacher', 'student', 'schooladministrator', 'schoolclass', 'project', 'quota_check'];
const titles = ['Teachers', 'Students', 'Schooladmins', 'Classes', 'Projects', 'Quota check'];
const quotaTypes = [
    ['QUOTA_DEFAULT_GLOBAL', 'Quota default global (MiB)'], ['QUOTA_DEFAULT_SCHOOL', 'Quota default school (MiB)'],
    ['CLOUDQUOTA_PERCENTAGE', 'Cloudquota (%)'], ['MAILQUOTA_DEFAULT', 'Mailquota default (MiB)'],
];
const groupTypes = [
    ['linuxmuster-global', 'Quota default global (MiB)', 'Add to default global (MiB)'],
    ['default-school', 'Quota default school (MiB)', 'Add to default school (MiB)'],
    ['mailquota', 'Mailquota default (MiB)', 'Add to mailquota (MiB)'],
];
const active = ref(0);
const nonDefault = ref();
const settings = ref();
const groups = ref();
const userChanges = ref({ teacher: {}, student: {}, schooladministrator: {} });
const groupChanges = ref({ adminclass: {}, project: {} });
const searchVisible = ref(false);
const checkUser = ref(null);
const checkReset = ref(0);
const checking = ref(false);
const checked = ref(false);
const directories = ref({});
const total = ref(0);
const checkTitle = computed(() => aj.gettext('Main quota use for the user {{_.quota_user_check.label}}').replace('{{_.quota_user_check.label}}', checkUser.value?.label || ''));
const role = computed(() => tabs[active.value]);
const groupType = computed(() => active.value === 3 ? 'adminclass' : 'project');
// Angular orderBy strings compare case-insensitively; stable sort retains ties.
const users = computed(() => [...(nonDefault.value?.[role.value]?.list ?? [])].sort((a, b) => {
    for (const field of ['sn', 'givenname']) {
        const x = a[field]?.toLowerCase(), y = b[field]?.toLowerCase();
        if (x !== y) return x === undefined ? 1 : y === undefined ? -1 : x < y ? -1 : 1;
    }
    return 0;
}));
const groupNames = computed(() => Object.keys(groups.value?.[groupType.value] ?? {}).sort());
aj.pageTitle.set(aj.gettext('Quotas'));
watch(() => aj.identity.user, async (user) => {
    if (user === null) return;
    try { [nonDefault.value, settings.value] = (await aj.http.get('/api/lmn/quota/quotas')).data; }
    catch { /* Original keeps the loading indicator; adapter presents HTTP errors. */ }
}, { immediate: true });
async function selectTab(index) {
    active.value = index;
    if (index === 5) {
        checked.value = false; checking.value = false; clearCheck(); directories.value = {}; total.value = 0;
    }
    if ((index === 3 || index === 4) && !groups.value) {
        const wait = openWait(aj, { status: 'Retrieving groups quotas ...', style: 'progressbar' });
        try { groups.value = (await aj.http.get('/api/lmn/quota/groups')).data; wait.close(); }
        catch { /* Original leaves the wait dialog open on failure. */ }
    }
}
// Angular validates badInput/typeMismatch, but step only when explicitly configured.
const number = (input) => input.validity.badInput || input.validity.typeMismatch ? undefined : input.value === '' ? null : Number(input.value);
function changeUser(login, quota, value) {
    const r = role.value;
    const user = nonDefault.value[r][login] ?? {};
    nonDefault.value = { ...nonDefault.value, [r]: { ...nonDefault.value[r], [login]: { ...user, QUOTA: { ...user.QUOTA, [quota]: value } } } };
    // Deliberately loose: Angular's original comparison accepts numeric defaults stored as strings.
    userChanges.value = { ...userChanges.value, [r]: { ...userChanges.value[r], [`${login}_${quota}`]: { login, quota, value: value != settings.value[`role.${r}`][quota] ? value : '---' } } };
}
function remove(user) {
    const r = role.value;
    for (const quota of ['QUOTA_DEFAULT_GLOBAL', 'QUOTA_DEFAULT_SCHOOL', 'MAILQUOTA_DEFAULT']) changeUser(user.login, quota, settings.value[`role.${r}`][quota]);
    const { [user.login]: removed, ...remaining } = nonDefault.value[r];
    nonDefault.value = { ...nonDefault.value, [r]: { ...remaining, list: remaining.list.filter((u) => u !== user) } };
}
function add(user) {
    const r = user.role;
    nonDefault.value = { ...nonDefault.value, [r]: { ...nonDefault.value[r], [user.login]: { QUOTA: { ...settings.value[`role.${r}`] }, displayName: user.displayName }, list: [...nonDefault.value[r].list, { sn: user.sn, login: user.login, givenname: user.givenName }] } };
    searchVisible.value = false;
    aj.notify.success(user.displayName + aj.gettext(' added with default values in the list.'));
}
function changeGroup(group, quota, value) {
    const type = groupType.value;
    const item = groups.value[type][group];
    groups.value = { ...groups.value, [type]: { ...groups.value[type], [group]: { ...item, QUOTA: { ...item.QUOTA, [quota]: { ...item.QUOTA[quota], value } } } } };
    groupChanges.value = { ...groupChanges.value, [type]: { ...groupChanges.value[type], [`${group}_${quota}`]: { group, quota, type, value: value != 0 ? value : '---' } } };
}
function resetGroup(group) { for (const [quota] of groupTypes) changeGroup(group, quota, 0); }
function clearCheck() { checkUser.value = null; checkReset.value += 1; }
async function check(user = checkUser.value) {
    if (!user) return;
    checkUser.value = user; checking.value = true; checked.value = false;
    try {
        const { data } = await aj.http.get(`/api/lmn/quota/check/${user.login}`);
        checking.value = false; checked.value = true; directories.value = data.directories; total.value = data.total;
    } catch { /* Original keeps its checking spinner on rejection. */ }
}
async function save() {
    const wait = openWait(aj, { status: 'Saving quotas ...', style: 'progressbar' });
    try {
        await aj.http.post('/api/lmn/quota/save', { users: userChanges.value, groups: groupChanges.value });
        wait.close();
        aj.modal.open(ApplyDialog, {}).then(() => aj.reload(), () => {});
    } catch { /* Original leaves the wait dialog open on failure. */ }
}
function hotkey(event) {
    if (!event.ctrlKey) return;
    if (event.key.toLowerCase() === 'f' && active.value <= 2) { event.preventDefault(); searchVisible.value = true; }
    if (event.key.toLowerCase() === 's') { event.preventDefault(); save(); }
}
window.addEventListener('keydown', hotkey);
onBeforeUnmount(() => window.removeEventListener('keydown', hotkey));
</script>
<template>
    <br>
    <component :is="'progress-spinner'" v-if="settings == null" role="progressbar"><div><div class="one"></div><div class="two"></div></div></component>
    <div v-else>
        <ul class="nav nav-tabs" role="tablist"><li v-for="(title, index) in titles" :key="title" :class="{ active: active === index }"><a href="" role="tab" :aria-selected="active === index" @click.prevent="selectTab(index)">{{ aj.gettext(title) }}</a></li></ul>
        <br>
        <template v-if="active <= 2">
            <div v-if="!nonDefault[role]" class="alert alert-info">{{ aj.gettext('There is no special quota here.') }}</div>
            <table v-else class="lm-table lm-table-padded">
                <thead><tr><th>{{ aj.gettext(active === 1 ? 'Name (login)' : 'Name') }}</th><th v-for="[quota, title] in quotaTypes" :key="quota">{{ aj.gettext(title) }}<br>{{ aj.gettext('Default: ') }}<span style="font-weight:bold;color:#dc3545">{{ settings[`role.${role}`][quota] }}</span></th><th></th></tr></thead>
                <tbody><tr v-for="(user, index) in users" :key="index">
                    <td>{{ nonDefault[role][user.login]?.displayName }}{{ active === 1 ? ` (${user.login})` : '' }}</td>
                    <td v-for="[quota] in quotaTypes" :key="quota"><input type="number" class="form-control" :class="{ nondefault: nonDefault[role][user.login]?.QUOTA?.[quota] != settings[`role.${role}`][quota] }" :value="nonDefault[role][user.login]?.QUOTA?.[quota]" :disabled="quota === 'CLOUDQUOTA_PERCENTAGE'" @input="changeUser(user.login, quota, number($event.target))"></td>
                    <td><button class="btn btn-default" title="Remove" @click="remove(user)"><i class="fa fa-trash-o"></i></button></td>
                </tr></tbody>
            </table>
        </template>
        <table v-else-if="active <= 4" class="lm-table lm-table-padded">
            <thead><tr><th>{{ aj.gettext('Name') }}</th><th v-for="[quota, classname, projname] in groupTypes" :key="quota">{{ aj.gettext(active === 3 ? classname : projname) }}</th><th></th></tr></thead>
            <tbody><tr v-for="name in groupNames" :key="name"><td>{{ name }}</td><td v-for="[quota] in groupTypes" :key="quota"><input type="number" class="form-control" :class="{ nondefault: groups[groupType][name].QUOTA[quota].value != 0 }" :value="groups[groupType][name].QUOTA[quota].value" @input="changeGroup(name, quota, number($event.target))"></td><td><button class="btn btn-default" title="Set to default" @click="resetGroup(name)"><i class="fa fa-trash-o"></i></button></td></tr></tbody>
        </table>
        <div v-else>
            <p class="alert alert-warning">{{ aj.gettext('This functionality is actually under development and displays imprecise values. It will not work with DFS shares or in multischool environment.') }}</p><br>
            <form style="margin-bottom:30px;min-height:50px" @submit.prevent="check()">
                <label class="col-md-3">{{ aj.gettext('List main directories for user:') }}</label>
                <div class="has-feedback col-md-6"><UserSearch :key="checkReset" role="" :label="checkUser?.label || ''" @select="check" @query="checkUser = null" /><span v-if="checkUser" aria-label="Clear" class="far fa-times-circle form-control-feedback" style="cursor:pointer;pointer-events:all;line-height:34px;right:17px" @click="clearCheck"></span></div>
                <div class="col-md-2"><button type="submit" class="btn btn-success" @click="check()">Check <i class="fas fa-check"></i></button></div>
            </form>
            <component :is="'progress-spinner'" v-if="checking" role="progressbar"><div><div class="one"></div><div class="two"></div></div></component><hr class="clearfix">
            <template v-if="checked"><h3>{{ checkTitle }}</h3><table class="table"><thead><tr><th>{{ aj.gettext('Directory') }}</th><th style="text-align:right">{{ aj.gettext('Size') }}</th></tr></thead><tbody><tr v-for="dir in Object.keys(directories).sort()" :key="dir"><td>{{ dir }}</td><td style="text-align:right">{{ directories[dir].total }}</td></tr><tr><th>{{ aj.gettext('Total') }}</th><th style="text-align:right">{{ total }}</th></tr></tbody></table></template>
        </div>
        <div v-show="searchVisible" class="modal" role="dialog" aria-modal="true" style="display:block;background:rgba(0,0,0,.5)"><div class="modal-dialog"><div class="modal-content">
            <div class="modal-header"><h3 class="modal-title">{{ aj.gettext('Add special quota') }}</h3></div>
            <div class="modal-body"><UserSearch :role="active < 3 ? role : ''" @select="add" /></div>
            <div class="modal-footer"><a class="btn btn-default btn-flat" @click="searchVisible = false">{{ aj.gettext('Close') }}</a></div>
        </div></div></div>
        <div class="floating-toolbar-padder"></div>
        <component :is="'floating-toolbar'"><div class="container"><div class="row"><div class="col-md-3"></div><div class="col-md-9"><div class="bar row">
            <a href="/view/lmn/schoolsettings#quota" class="btn btn-lmn pull-right">{{ aj.gettext('Configure default quota') }}</a>
            <button v-if="active <= 4" class="btn btn-lmn" @click="save">{{ aj.gettext('Save & apply') }}</button>
            <a v-if="active <= 2" class="btn btn-lmn" @click="searchVisible = true">{{ aj.gettext('Search & add user') }}</a>
        </div></div></div></div></component>
    </div>
</template>

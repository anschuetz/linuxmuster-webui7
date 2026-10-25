<script setup>
import { computed, inject, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { useSambaAccess } from '../../common/access.mjs';
import { createValidation } from '../../common/validation.mjs';
import { selfPayload, visibleGroups } from './model.mjs';
import Details from './Details.vue';
const aj = inject('aj'), smbclient = inject('smbclient');
const sambaAccess = useSambaAccess(aj), validation = createValidation(aj);
const lists = shallowRef({}), loading = shallowRef({ projects: true, printers: true, classes: true });
const shown = ref({ classes: true, printers: true, projects: true });
const filter = ref(''), sort = ref('groupname'), reverse = ref(false), objectsOpen = ref(false), sortOpen = ref(false);
const changeState = ref(false), needRefresh = ref(false);
// Keep the catalog key containing the legacy link; render only its text as HTML-free Vue content.
const refreshWarning = computed(() => aj.gettext("These changes can only take effect if the session is renewed, otherwise it will be active after the next\\n        logout/login.\\n        <a class=\"btn btn-default\" ng:click=\"refresh_krbcc()\" translate=\"\">Do it now</a>").split('<a ')[0].replaceAll('\\n', ' '));
const objectsMenu = ref(), sortMenu = ref();
function closeMenus(event) {
    if (!objectsMenu.value?.contains(event.target)) objectsOpen.value = false;
    if (!sortMenu.value?.contains(event.target)) sortOpen.value = false;
}
function keyMenus(event) {
    if (event.key !== 'Escape') return;
    if (objectsOpen.value) objectsMenu.value.querySelector('button:last-of-type').focus();
    if (sortOpen.value) sortMenu.value.querySelector('button').focus();
    objectsOpen.value = false; sortOpen.value = false;
}
onMounted(() => { document.addEventListener('click', closeMenus); document.addEventListener('keydown', keyMenus); });
const base = '/api/lmn/groupmembership/';
const definitions = [{ key: 'classes', title: 'Schoolclasses', kind: 'class', empty: 'There are no schoolclasses available. Ask the administrator to import students' }, { key: 'printers', title: 'Printer', kind: 'group', empty: 'There are no printers configured yet. Ask your administrator to configure one.' }, { key: 'projects', title: 'Projects', kind: 'project', empty: 'There are no projects yet. You can create a new project using the menu bar.' }];
const rows = computed(() => Object.fromEntries(definitions.map(({ key }) => [key, visibleGroups(lists.value[key], aj.identity.profile, filter.value, sort.value, reverse.value, true)])));
aj.pageTitle.set(aj.gettext('Enrolle'));
async function getGroups() {
    await Promise.all([['projects', 'projects'], ['printers', 'printers'], ['classes', 'schoolclasses']].map(async ([key, path]) => {
        try { const { data } = await aj.http.get(base + path); lists.value = { ...lists.value, [key]: data }; loading.value = { ...loading.value, [key]: false }; }
        catch { /* Original keeps each spinner on rejection; core reports HTTP errors. */ }
    }));
}
watch(() => aj.identity.user, (user) => { if (user !== undefined && user !== null && user !== 'root') getGroups(); }, { immediate: true });
function changeSort(field) { reverse.value = field === sort.value ? !reverse.value : false; sort.value = field; sortOpen.value = false; }
const joinable = (g) => g.sophomorixJoinable || aj.identity.profile.isAdmin || g.membership || g.admin;
async function setMembership(group, key) {
    changeState.value = true;
    try {
        const { data } = await aj.http.post(base + 'membership', selfPayload(group, aj.identity.user));
        if (data[0] === 'ERROR') aj.notify.error(data[1]);
        if (data[0] === 'LOG') {
            aj.notify.success(aj.gettext(data[1]));
            lists.value = { ...lists.value, [key]: lists.value[key].map((g) => g === group ? { ...g, membership: !g.membership } : g) };
            changeState.value = false; needRefresh.value = true;
            await aj.identity.refresh();
        }
    } catch { /* Preserve busy/refresh state; adapter reports transport/identity errors. */ }
}
async function refreshKrbcc() {
    try { await smbclient.refresh_krbcc(); needRefresh.value = false; }
    catch { /* Cancellation and ticket errors retain the refresh reminder. */ }
}
async function createProject() {
    objectsOpen.value = false; sortOpen.value = false;
    let message;
    try { message = await aj.messagebox.prompt(aj.gettext('Project Name'), ''); }
    catch { return; }
    if (!message.value) return;
    const valid = validation.isValidProjectName(message.value);
    if (valid !== true) { aj.notify.error(aj.gettext(valid)); return; }
    try {
        const { data } = await aj.http.post(base + 'projects/' + message.value);
        if (data[0] === 'ERROR') aj.notify.error(aj.gettext(data[1]));
        else if (data[0] === 'LOG') { aj.notify.success(aj.gettext('Project Created')); await aj.identity.refresh(); await getGroups(); }
        else aj.notify.info(aj.gettext('Something unusual happened'));
    } catch { /* Original relies on core HTTP handling, with no extra toast. */ }
}
async function showDetails(group) {
    try { const result = await aj.modal.open(Details, { groupType: group.type, groupName: group.groupname }); if (result?.response === 'refresh') await getGroups(); }
    catch { /* Closing the detail dialog leaves the lists as in the original. */ }
}
async function resetAll(type) {
    try { await aj.messagebox.show({ text: aj.gettext('Are you sure to reset all admin memberships for this? This is actually only necessary to start a new empty school year. This cannot be undone!'), positive: 'Delete', negative: 'Cancel' }); }
    catch { return; }
    const progress = aj.messagebox.show({ progress: true }); progress.catch(() => {});
    try {
        await aj.http.post(base + 'resetadmins', { type, all_groups: lists.value[type === 'class' ? 'classes' : 'projects'].map((g) => g.groupname + ',').join('') });
        aj.notify.success(aj.gettext('Admin membership reset'));
    } catch { /* Core handles HTTP errors. Original ignores response TYPE. */ }
    finally { progress.close(); }
}
onBeforeUnmount(() => {
    document.removeEventListener('click', closeMenus); document.removeEventListener('keydown', keyMenus);
    if (needRefresh.value) aj.messagebox.show({ text: 'These changes can only take effect if the session is renewed, otherwise it will be active after the next logout/login. It could be useful for the session plugin to do it now.', positive: 'Do it now', negative: 'Later' }).then(refreshKrbcc, () => {});
});
</script>
<template>
    <br>
    <div v-if="sambaAccess">
        <div v-if="changeState" class="spinner" role="status"><i class="fa fa-circle-o-notch fa-spin"></i></div>
        <div v-if="needRefresh" class="alert alert-info">{{ refreshWarning }} <a class="btn c4-button" @click="refreshKrbcc">{{ aj.gettext('Do it now') }}</a></div>
        <div class="input-group">
            <input v-model.trim="filter" type="search" class="form-control" placeholder="Filter" autofocus>
            <div ref="objectsMenu" class="btn-group c4-group-actions">
                <button class="btn c4-button" @click="createProject"><i class="fa fa-fw fa-flask"></i> {{ aj.gettext('New Project') }}</button>
                <button class="btn c4-button" @click="objectsOpen = !objectsOpen"><i class="fa fa-filter"></i> {{ aj.gettext('Objectsfilter') }} <span class="caret"></span></button>
                <ul v-if="objectsOpen" class="dropdown-menu show c4-menu" style="width:150px"><li v-for="[key, label] in [['classes', 'Classes'], ['printers', 'Printers'], ['projects', 'Projects']]" :key="key"><label><input :checked="shown[key]" type="checkbox" @change="shown = { ...shown, [key]: $event.target.checked }"> {{ aj.gettext(label) }}</label></li></ul>
            </div>
            <div ref="sortMenu" class="btn-group c4-group-actions">
                <button class="btn c4-button" @click="sortOpen = !sortOpen"><i class="fa fa-sort-amount-asc"></i> {{ aj.gettext(sort === 'groupname' ? 'Groupname' : 'Membership') }} <span class="caret"></span></button>
                <ul v-if="sortOpen" class="dropdown-menu dropdown-menu-end show c4-menu" style="width:150px"><li v-for="[field, label] in [['groupname', 'Groupname'], ['membership', 'Membership']]" :key="field"><a class="dropdown-item" @click="changeSort(field)"><i class="fa fa-sort-amount-asc"></i> {{ aj.gettext(label) }}</a></li></ul>
            </div>
        </div><br>
        <template v-for="(section, index) in definitions" :key="section.key">
            <hr v-if="index > 0">
            <div v-show="shown[section.key]">
                <button v-if="aj.identity.profile.isAdmin && section.key !== 'printers'" class="btn btn-danger float-end" title="Reset all memberships" @click="resetAll(section.kind)"><i class="fas fa-undo"></i></button>
                <h3>{{ aj.gettext(section.title) }}</h3><br>
                <div v-if="loading[section.key]" class="spinner" role="status"><i class="fa fa-circle-o-notch fa-spin"></i></div>
                <div v-if="lists[section.key]?.length === 0" class="alert alert-info"><i class="fa fa-info-circle"></i> {{ aj.gettext(section.empty) }}</div>
                <div class="flex-container lmn-container-list c4-membership-list" style="flex-direction:column" :style="{ maxHeight: lists[section.key] ? (section.key === 'printers' ? 25 : 45) * lists[section.key].length / 3 + 'px' : undefined }">
                    <div v-for="group in rows[section.key]" :key="group.groupname" class="membership-item" :style="{ padding: section.key === 'printers' ? '0 10px 0 0' : '3px 10px 3px 0' }">
                        <div v-show="!(group.sophomorixHidden && !group.admin && !aj.identity.profile.isAdmin && !group.membership)" :class="{ 'color-orange': group.admin }" :style="!joinable(group) ? { paddingLeft: '18px' } : {}">
                            <input v-show="joinable(group)" :id="group.groupname" type="checkbox" :checked="group.membership" @click="setMembership(group, section.key)">
                            <i :class="section.key === 'classes' ? 'fa fa-users' : section.key === 'printers' ? 'fa fa-fw fa-print' : 'fa fa-flask'"></i>
                            <a href="#" @click.prevent="showDetails(group)"><span v-if="section.key !== 'projects'">{{ aj.gettext(section.key === 'classes' ? 'Class' : 'Printer') }} </span><b style="word-wrap:break-word;-ms-word-break:break-all">{{ group.groupname }}</b></a>
                            <span v-if="section.key === 'classes'" class="badge c4-badge float-end" :class="group.members?.length === 0 ? 'bg-danger' : 'bg-secondary'" style="width:43px;height:28px" title="Member(s)">{{ group.sophomorixMembers.length }} {{ aj.gettext('stud.') }}<br>{{ group.sophomorixAdmins.length }} {{ aj.gettext('tea.') }}</span>
                            <template v-if="section.key === 'projects'">
                                <span v-if="!group.no_admin" class="badge c4-badge bg-danger float-end" style="width:43px;height:28px" title="Admin(s)">{{ group.sophomorixAdmins.length }} {{ aj.gettext('adm.') }}<br>{{ group.sophomorixAdminGroups.length }} {{ aj.gettext('gr.') }}</span>
                                <span v-else class="badge c4-badge bg-danger float-end" style="width:43px;height:28px;padding-top:10px" title="No admin(s) in this project!"><i class="fa fa-warning fa-xl"></i></span>
                                <span class="badge c4-badge bg-secondary float-end" style="width:43px;height:28px" title="Member(s)">{{ group.sophomorixMembers.length }} {{ aj.gettext('mem.') }}<br>{{ group.sophomorixMemberGroups.length }} {{ aj.gettext('gr.') }}</span>
                            </template>
                        </div>
                    </div>
                </div>
            </div>
        </template>
    </div>
    <div v-else class="text-center root-access-blocker"><h1><i class="fas fa-exclamation-triangle"></i></h1><h4 class="alert alert-danger">You should not use WebUI as root user!<br>If this is your first time running WebUI, proceed through the <a href="/view/lmn/init/welcome">setup wizard</a>.<br>Afterwards login using the global-admin account.</h4></div>
</template>

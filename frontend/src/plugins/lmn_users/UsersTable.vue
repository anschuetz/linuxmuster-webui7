<script setup>
import { computed, inject, onBeforeUnmount, ref, watch } from 'vue';
import { createUsers, pageUsers, selectUsers, sortOptions } from './users.mjs';
import { createCustomFields, isListAttr } from '../../common/users/customFields.mjs';
import { createPasswords } from '../../common/users/passwords.mjs';
import UserDetails from '../../common/users/UserDetails.vue';
const props = defineProps({ role: { type: String, required: true } });
const aj = inject('aj'), api = createUsers(aj), fields = createCustomFields(aj), passwords = createPasswords(aj);
const list = ref(), display = ref({ customDisplay: [], customTitle: [] }), quotas = ref(false);
const activeTab = ref('students'), queries = ref({ students: '', attic: '', main: '' });
const selected = ref({ students: false, attic: false, main: false });
const page = ref(1), pageSize = ref(50), sort = ref(sortOptions(props.role)[0][0]), menu = ref(''), blurred = ref(false);
const titles = { students: 'Students', teachers: 'Teachers', staff: 'Staff', parents: 'Parents' };
const empty = { students: 'There are no students to manage yet. You can add students using the list management module', teachers: 'There are no teachers to manage yet. You can add teachers using the list management module', staff: 'There are no staff members to manage yet. You can add staff members using the list management module', parents: 'There are no parents to manage yet. You can add parents using the list management module' };
let alive = true;
onBeforeUnmount(() => { alive = false; window.removeEventListener('click', closeMenu); window.removeEventListener('keydown', closeMenu); });
aj.pageTitle.set(aj.gettext(titles[props.role]));
api.load(props.role).then(data => { if (alive) list.value = data; }).catch(() => { /* Shell owns HTTP errors; retain the original spinner. */ });
fields.loadDisplay(props.role).then(data => { if (alive) display.value = data; }).catch(() => { /* Failed config does not turn a loaded user list into an empty list. */ });
const sections = computed(() => {
    const data = list.value;
    if (props.role !== 'students') return [{ key: 'main', users: data, shown: true, empty: data?.[0] === 'none', table: data != null && data[0] !== 'none' }];
    const students = data?.filter(user => user.sophomorixAdminClass !== 'attic');
    const attic = data?.filter(user => user.sophomorixAdminClass === 'attic');
    return [{ key: 'students', users: students, shown: true, empty: students?.length === 0, table: students?.length > 0 }, { key: 'attic', users: attic, shown: !!attic?.length, empty: false, table: data != null }];
});
// Both Angular pagination directives stay live, including the hidden attic tab.
const pageCounts = computed(() => sections.value.map(section => {
    const size = parseInt(pageSize.value, 10);
    const total = size < 1 ? 1 : Math.ceil((section.users?.length || 0) / size);
    return Math.max(total || 0, 1);
}));
const pageCount = computed(() => pageCounts.value[props.role === 'students' && activeTab.value === 'attic' ? 1 : 0]);
const pages = computed(() => {
    const end = Math.min(pageCount.value, Math.max(1, page.value - 5) + 9);
    const start = Math.max(1, end - 9);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
});
watch(pageCounts, (next, previous) => {
    next.forEach((count, index) => { if (count !== previous[index] && page.value > count) page.value = count; });
});
const shown = section => pageUsers(section.users || [], props.role, queries.value[section.key], sort.value, page.value, pageSize.value);
function setSize(value) { pageSize.value = value === '' ? null : value; }
function selectAll(section) {
    const next = selectUsers(section.users, queries.value[section.key], selected.value[section.key]);
    const changes = new Map(section.users.map((user, index) => [user, next[index]]));
    list.value = list.value.map(user => changes.get(user) ?? user);
}
function selectOne(user, checked) { list.value = list.value.map(row => row === user ? { ...row, selected: checked } : row); }
// Legacy staff writes to a missing $st scope, retaining Class and its ordering.
function setSort(key) { if (props.role !== 'staff') sort.value = key; menu.value = ''; }
function toggle(value) { menu.value = menu.value === value ? '' : value; }
function closeMenu(event) { if (event.type === 'click' || event.key === 'Escape') menu.value = ''; }
window.addEventListener('click', closeMenu); window.addEventListener('keydown', closeMenu);
async function password(action, user) {
    menu.value = '';
    try {
        if (action === 'show') { blurred.value = true; await passwords.showFirstPassword(user.sAMAccountName); if (alive) blurred.value = false; }
        else if (action === 'reset') await passwords.resetFirstPassword(user.sAMAccountName);
        else if (action === 'random') await passwords.setRandomFirstPassword(user.sAMAccountName);
        else await passwords.setCustomPassword(user, action);
    } catch { /* Cancellation retains Angular's first-password blur state. */ }
}
async function batch(section, cmd) {
    menu.value = '';
    try { await (cmd === 'print' ? passwords.printSelectedPasswords(section.users) : passwords.batchPasswords(section.users, cmd)); }
    catch { /* Custom-password dismissal makes no request. */ }
}
async function details(user) {
    try { await aj.modal.open(UserDetails, { id: user.sAMAccountName, role: props.role }); }
    catch { /* closed also runs for a dismissed Angular details dialog. */ }
    finally { if (alive && props.role === 'teachers') aj.reload(); }
}
async function getQuotas() {
    try { const result = await api.quotas(list.value); if (alive) quotas.value = result; }
    catch { /* The old all-or-nothing quota request leaves prior values on failure. */ }
}
function customValue(user, index) {
    const value = user[display.value.customDisplay[index]];
    return value === 'null' && !isListAttr(display.value.customDisplay[index]) ? '' : value;
}
</script>
<template>
    <br>
    <div v-if="list == null" class="progress-spinner" role="status"><i class="fa fa-spinner fa-spin"></i></div>
    <ul v-if="role === 'students'" class="nav nav-tabs">
        <li v-for="section in sections" v-show="list != null && section.shown" :key="section.key" :class="{active: activeTab === section.key}"><a :data-tab="section.key" @click="activeTab = section.key; menu = ''">{{ aj.gettext(section.key === 'attic' ? 'Attic' : 'Students') }}</a></li>
    </ul>
    <section v-for="section in sections" v-show="list != null && (role !== 'students' || activeTab === section.key)" :key="section.key" :data-section="section.key">
        <br v-if="role === 'students'">
        <div v-if="section.empty" class="alert alert-info"><i class="fa fa-info-circle"></i> {{ aj.gettext(empty[role]) }}.</div>
        <template v-if="section.table">
            <div class="input-group">
                <input v-model.trim="queries[section.key]" type="search" autofocus class="form-control" placeholder="Filter">
                <div class="input-group-btn" :class="{open: menu === 'sort'}" @click.stop>
                    <button class="btn btn-default" data-action="sort-menu" @click="toggle('sort')"><i class="fa fa-sort-amount-asc"></i> {{ aj.gettext(sortOptions(role).find(option => option[0] === sort)[1]) }} <span class="caret"></span></button>
                    <ul v-if="menu === 'sort'" class="dropdown-menu dropdown-menu-right" style="width:150px"><li v-for="[key,label] in sortOptions(role)" :key="key"><a :data-sort="key" @click="setSort(key)"><i class="fa fa-sort-amount-asc"></i> {{ aj.gettext(label) }}</a></li></ul>
                </div>
                <div class="input-group-btn" :class="{open: menu === 'rows'}" @click.stop>
                    <button class="btn btn-default" data-action="rows-menu" @click="toggle('rows')"><i class="fa fa-list-ol"></i> {{ aj.gettext('Rows') }} <span class="caret"></span></button>
                    <ul v-show="menu === 'rows'" class="dropdown-menu dropdown-menu-right" style="width:200px"><li v-for="size in [10,50,100,500,1000]" :key="size"><a :data-size="size" @click="setSize(size)"><i class="fa fa-list-ol"></i> {{ size }} {{ aj.gettext(role === 'staff' ? 'staff members' : role) }}</a></li><li><div class="input-group" style="display:table"><div class="input-group-addon">Other:</div><input v-model.number="pageSize" type="number" class="form-control" @change="setSize(pageSize)"></div></li></ul>
                </div>
            </div>
            <table class="table" :class="{'lmn-blurred': blurred}" style="width:100%"><thead><tr>
                <th><input v-model="selected[section.key]" type="checkbox" @change="selectAll(section)"></th>
                <th width="120">{{ role === 'teachers' ? 'Login' : aj.gettext(section.key === 'attic' ? 'Login / Old role' : 'Login / Class') }}<span v-if="role === 'teachers' && display.customTitle[1]"> / {{ display.customTitle[1] }}</span></th>
                <th>Name<span v-if="display.customTitle[role === 'teachers' ? 2 : 1]"> / {{ display.customTitle[role === 'teachers' ? 2 : 1] }}</span></th>
                <th>{{ display.customTitle[role === 'teachers' ? 3 : 2] }}</th><th v-if="role !== 'teachers'">{{ display.customTitle[3] }}</th>
                <th v-if="role === 'teachers'">{{ quotas ? aj.gettext('Quota') : '' }}</th><th></th><th></th><th>{{ aj.gettext('Status') }}</th>
            </tr></thead><tbody>
                <tr v-for="(user,index) in shown(section)" v-show="user.class?.[0] !== '#'" :key="user.sAMAccountName ?? index">
                    <td width="30" style="text-align:center"><input type="checkbox" :checked="user.selected" @change="selectOne(user, $event.target.checked)"></td>
                    <td><i>{{ user.sAMAccountName }}</i><template v-if="role !== 'teachers'"><br>{{ section.key === 'attic' ? user.sophomorixExitAdminClass : user.sophomorixAdminClass }}</template><template v-else><br><span v-if="isListAttr(display.customDisplay[1])"><span v-for="(value,i) in customValue(user,1)" :key="i" class="label label-info">{{ value }}</span></span><span v-else>{{ customValue(user,1) }}</span></template></td>
                    <td><b>{{ user.sn }} {{ user.givenName }}</b><br><span v-if="isListAttr(display.customDisplay[role === 'teachers' ? 2 : 1])"><span v-for="(value,i) in customValue(user,role === 'teachers' ? 2 : 1)" :key="i" class="label label-info">{{ value }}</span></span><span v-else>{{ customValue(user,role === 'teachers' ? 2 : 1) }}</span></td>
                    <td v-for="column in (role === 'teachers' ? [3] : [2,3])" :key="column"><span v-if="isListAttr(display.customDisplay[column])"><span v-for="(value,i) in customValue(user,column)" :key="i" class="label label-info">{{ value }}</span></span><span v-else>{{ customValue(user,column) }}</span></td>
                    <td v-if="role === 'teachers'" width="150"><template v-if="quotas"><span :class="`label label-${quotas[user.sAMAccountName]?.TYPE}`">{{ quotas[user.sAMAccountName]?.USED }} %</span><div class="progress"><div class="progress-bar" :class="`progress-bar-${quotas[user.sAMAccountName]?.TYPE}`" :style="{width: (quotas[user.sAMAccountName]?.USED || 0) + '%'}"></div></div></template></td>
                    <td width="1"><span class="dropup" :class="{open: menu === 'pw-' + user.sAMAccountName}" @click.stop><button class="btn btn-default" :data-action="'password-' + user.sAMAccountName" @click="toggle('pw-' + user.sAMAccountName)"><i class="fa fa-key"></i> <span class="caret"></span></button><ul v-if="menu === 'pw-' + user.sAMAccountName" class="dropdown-menu dropdown-menu-right" style="margin-bottom:-30px;margin-right:40px;z-index:4000">
                        <li v-for="[cmd,label] in [['show','Show initial password'],['reset','Restore initial password'],['random','Set random initial password'],['first','Set custom first password'],['current','Set current user password']]" :key="cmd"><a :data-action="(cmd === 'first' || cmd === 'current' ? 'custom-' : '') + cmd + '-' + user.sAMAccountName" @click="password(cmd,user)">{{ aj.gettext(label) }}</a></li>
                    </ul></span></td>
                    <td width="1"><button class="btn btn-default" data-action="details" @click="details(user)"><i class="fa fa-cog"></i></button></td>
                    <td width="1"><span :class="`label label-${user.sophomorixStatus?.color}`">{{ user.sophomorixStatus?.tag }}</span></td>
                </tr>
            </tbody></table>
            <br><ul v-if="section.users.length > pageSize" class="pagination"><li :class="{disabled:page === 1}"><a @click="page = 1">First</a></li><li :class="{disabled:page === 1}"><a @click="page = Math.max(1,page-1)">Previous</a></li><li v-for="n in pages" :key="n" :class="{active: page === n}"><a :data-page="n" @click="page = n">{{ n }}</a></li><li :class="{disabled:page === pageCount}"><a @click="page = Math.min(pageCount,page+1)">Next</a></li><li :class="{disabled:page === pageCount}"><a @click="page = pageCount">Last</a></li></ul>
            <div class="floating-toolbar-padder"></div><div class="users-toolbar"><component :is="'floating-toolbar'"><div class="container"><div class="row"><div class="col-md-3"></div><div class="col-md-9"><div class="bar row">
                <button v-if="role === 'teachers'" class="btn btn-lmn pull-right" data-action="quotas" @click="getQuotas()">{{ aj.gettext('Show quota') }}</button>
                <div v-if="section.users.some(user => user.selected)" class="btn-group dropup" :class="{open:menu === 'batch'}" @click.stop><button class="btn btn-lmn" data-action="batch-menu" @click="toggle('batch')"><i class="fa fa-key"></i> {{ aj.gettext('For selected') }} <span class="caret"></span></button><ul v-if="menu === 'batch'" class="dropdown-menu dropdown-menu-left"><li v-for="[cmd,key,label] in [['reset-first','reset','Set initial password'],['random-first','random','Set random password'],['custom-first','custom','Set custom password'],['print','print','Print passwords']]" :key="key"><a :data-action="'batch-' + key" @click="batch(section,cmd)">{{ aj.gettext(label) }}</a></li></ul></div>
            </div></div></div></div></component></div>
        </template>
    </section>
</template>

<script setup>
import { computed, inject, onBeforeUnmount, ref, watch } from 'vue';
import { createAdmins } from './admins.mjs';
import { sortedUsers, selectUsers } from './users.mjs';
import { createCustomFields, isListAttr } from '../../common/users/customFields.mjs';
import { createPasswords } from '../../common/users/passwords.mjs';
import UserDetails from '../../common/users/UserDetails.vue';
import AddAdminDialog from './AddAdminDialog.vue';
import ShowBindPasswordDialog from './ShowBindPasswordDialog.vue';
const props = defineProps({ level: { type: String, required: true } });
const aj = inject('aj'), api = createAdmins(aj), passwords = createPasswords(aj);
const list = ref(), binds = ref(), display = ref({ customDisplay: [], customTitle: [] });
const query = ref(''), selected = ref(false), page = ref(1), pageSize = ref(50), menu = ref(''), blurred = ref(false);
const role = props.level + 'admins';
// translate directives use the full markup msgid, including its indentation.
const loginLabel = computed(() => aj.gettext('Login\n                <span ng:show="customTitle[1]"> / {{customTitle[1]}}</span>').split('<span')[0].trim());
const nameLabel = computed(() => props.level === 'global' ? aj.gettext('Name\n                <span ng:show="customTitle[2]"> / {{customTitle[2]}}</span>').split('<span')[0].trim() : 'Name');
const batchLabel = computed(() => aj.gettext('<i class="fa fa-key"></i> For selected\n            <span class="caret"></span>').replace(/<[^>]*>/g, '').trim());
let alive = true;
function closeMenu(event) { if (event.type === 'click' || event.key === 'Escape') menu.value = ''; }
window.addEventListener('click', closeMenu); window.addEventListener('keydown', closeMenu);
onBeforeUnmount(() => { alive = false; window.removeEventListener('click', closeMenu); window.removeEventListener('keydown', closeMenu); });
aj.pageTitle.set(aj.gettext(props.level === 'global' ? 'Globaladmins' : 'Schooladmins'));
api.load(props.level).then(data => { if (alive) list.value = data; }).catch(() => { /* Original retains spinner. */ });
createCustomFields(aj).loadDisplay(role).then(data => { if (alive) display.value = data; }).catch(() => { /* List remains usable without custom config. */ });
api.binds(props.level).then(data => { if (alive) binds.value = data; }).catch(() => { /* Failed binds do not display empty message. */ });
// Angular filter:filter recursively searches public properties, including custom fields.
function matches(value, term) {
    if (term.startsWith('!')) return !matches(value, term.slice(1));
    if (value == null) return false;
    if (typeof value === 'object') return Object.entries(value).some(([key, item]) => !key.startsWith('$') && matches(item, term));
    return String(value).toLowerCase().includes(term);
}
const shown = computed(() => pageSize.value ? sortedUsers((list.value || []).filter(user => matches(user, query.value.toLowerCase())), 'sAMAccountName').slice((page.value - 1) * pageSize.value, page.value * pageSize.value) : []);
const pageCount = computed(() => Math.max(1, parseInt(pageSize.value, 10) < 1 ? 1 : Math.ceil((list.value?.length || 0) / parseInt(pageSize.value, 10)) || 1));
watch(pageCount, count => { if (page.value > count) page.value = count; });
const pages = computed(() => { const end = Math.min(pageCount.value, Math.max(1, page.value - 5) + 9); return Array.from({ length: end - Math.max(1, end - 9) + 1 }, (_, i) => Math.max(1, end - 9) + i); });
function selectAll() { list.value = selectUsers(list.value, query.value, selected.value); }
function selectOne(user, checked) { list.value = list.value.map(row => row === user ? { ...row, selected: checked } : row); }
function customValue(user, column) { const key = display.value.customDisplay[column]; return user[key] === 'null' && !isListAttr(key) ? '' : user[key]; }
function toggle(value) { menu.value = menu.value === value ? '' : value; }
async function open(Component, values, options) { try { await (options ? aj.modal.open(Component, values, options) : aj.modal.open(Component, values)); } catch { /* Dismissal makes no request. */ } }
async function showBind(user) {
    try {
        await aj.messagebox.show({ title: aj.gettext('Show bind user password'), text: aj.gettext('Do you really want to see this password ? It could be a security issue!'), positive: 'Show', negative: 'Cancel' });
        await open(ShowBindPasswordDialog, { user });
    } catch { /* Confirmation cancelled: no secret request. */ }
}
async function details(user) { await open(UserDetails, { id: user.sAMAccountName, role }, { size: 'lg' }); if (alive) aj.reload(); }
async function password(action, user) {
    menu.value = '';
    try {
        if (action === 'show') { blurred.value = true; await passwords.showFirstPassword(user.sAMAccountName); if (alive) blurred.value = false; }
        else if (action === 'reset') await passwords.resetFirstPassword(user.sAMAccountName);
        else if (action === 'random') await passwords.setRandomFirstPassword(user.sAMAccountName);
        else await passwords.setCustomPassword(user, action);
    } catch { /* First-password dismissal keeps blur, matching the controller. */ }
}
async function batch(cmd) { menu.value = ''; try { await passwords.batchPasswords(list.value, cmd); } catch { /* Custom dialog cancelled. */ } }
const batchCommands = computed(() => [...(props.level === 'school' ? [['reset-first','Set initial password']] : []), ['random-first','Set random password'], ['custom-first','Set custom password']]);
</script>
<template>
    <br><div v-if="list == null" class="progress-spinner" role="status"><i class="fa fa-spinner fa-spin"></i></div>
    <div v-else data-admins>
        <div v-if="list[0] === 'none'" class="alert alert-info"><i class="fa fa-info-circle"></i> {{ aj.gettext('There are no School-Administrator to manage yet. You can add a School-Administrator using the buttons below') }}.</div>
        <div v-else class="input-group">
            <input v-model.trim="query" type="search" autofocus class="form-control" placeholder="Filter">
            <div class="c10-menu-control" @click.stop><button class="btn btn-light c10-button" @click="toggle('sort')"><i class="fa fa-sort-amount-asc"></i> {{ aj.gettext('Login') }} <span class="dropdown-toggle aj-dropdown-marker"></span></button><ul v-if="menu==='sort'" class="dropdown-menu dropdown-menu-end show c10-menu"><li><a class="dropdown-item" @click="menu=''">{{ aj.gettext('Login') }}</a></li></ul></div>
            <div class="c10-menu-control" @click.stop><button class="btn btn-light c10-button" data-action="rows" @click="toggle('rows')"><i class="fa fa-list-ol"></i> {{ aj.gettext('Rows') }} <span class="dropdown-toggle aj-dropdown-marker"></span></button><ul v-show="menu==='rows'" :class="{show: menu==='rows'}" class="dropdown-menu dropdown-menu-end c10-menu" style="width:200px"><li v-for="size in [10,50,100,500,1000]" :key="size"><a class="dropdown-item" @click="pageSize=size">{{ size }} {{ aj.gettext(role) }}</a></li><li><div class="input-group"><div class="input-group-text c10-addon">Other:</div><input v-model.number="pageSize" type="number" class="form-control" @change="pageSize=pageSize===''?null:pageSize"></div></li></ul></div>
        </div>
        <br><h3><button class="btn btn-success float-end" data-action="add" @click="open(AddAdminDialog,{role:level+'admin'})"><i class="fa fa-plus"></i> {{ aj.gettext('Add '+level+' administrator') }}</button>{{ aj.gettext(level === 'global' ? 'Global admins' : 'School admins') }}</h3><br>
        <table v-if="list[0] !== 'none'" class="table" style="width:100%" :class="{'lmn-blurred':blurred}"><thead><tr><th><input v-model="selected" type="checkbox" @change="selectAll"></th><th width="120">{{ loginLabel }}<span v-if="display.customTitle[1]"> / {{ display.customTitle[1] }}</span></th><th>{{ nameLabel }}<span v-if="display.customTitle[2]"> / {{ display.customTitle[2] }}</span></th><th>{{ display.customTitle[3] }}</th><th></th><th></th><th></th></tr></thead><tbody>
            <tr v-for="(user,index) in shown" v-show="user.class?.[0] !== '#'" :key="user.sAMAccountName ?? index"><td width="30"><input type="checkbox" :checked="user.selected" @change="selectOne(user,$event.target.checked)"></td>
                <td v-for="column in [1,2,3]" :key="column"><template v-if="column===1"><i>{{ user.sAMAccountName }}</i><br></template><template v-if="column===2"><b>{{ user.givenName }} {{ user.sn }}</b><br></template><div v-if="isListAttr(display.customDisplay[column])"><span v-for="(value,i) in customValue(user,column)" :key="i" class="badge c10-badge bg-info">{{ value }}</span></div><div v-else>{{ customValue(user,column) }}</div></td>
                <td width="1"><span class="dropup" @click.stop><button class="btn btn-light c10-button" @click="toggle('pw-'+user.sAMAccountName)"><i class="fa fa-key"></i> <span class="dropdown-toggle aj-dropdown-marker"></span></button><ul v-if="menu==='pw-'+user.sAMAccountName" class="dropdown-menu dropdown-menu-end show c10-menu" style="margin-bottom:-30px;margin-right:40px;z-index:4000"><li v-for="[cmd,label] in [['show','Show initial password'],['reset','Restore initial password'],['random','Set random initial password'],['first','Set custom first password'],['current','Set current user password']]" :key="cmd"><a class="dropdown-item" @click="password(cmd,user)">{{ aj.gettext(label) }}</a></li></ul></span></td>
                <td width="1"><button class="btn btn-light c10-button" data-action="details" @click="details(user)"><i class="fa fa-cog"></i></button></td><td width="1"><button class="btn btn-light c10-button" @click="api.remove(level,[user])"><i class="fa fa-trash-o"></i></button></td>
            </tr>
        </tbody></table>
        <hr><h3><button class="btn btn-success float-end" data-action="add-bind" @click="api.addBind(level)"><i class="fa fa-plus"></i> {{ aj.gettext('Add '+level+' bind user') }}</button>{{ aj.gettext(level === 'global' ? 'Global bind users' : 'School bind users') }}</h3><br>
        <div v-if="binds?.length===0" class="alert alert-info">{{ aj.gettext('No '+level+' bind user found.') }}</div>
        <table v-if="binds?.length > 0" class="table" :class="{'lmn-blurred':blurred}"><thead><tr><th></th><th width="120">{{ aj.gettext('Login') }}</th><th>{{ aj.gettext('Name / DN / Comment') }}</th><th></th><th></th></tr></thead><tbody>
            <tr v-for="user in binds" :key="user.sAMAccountName"><td width="30"></td><td><i>{{ user.sAMAccountName }}</i></td><td class="c10-bind-details"><b>{{ user.givenName }} {{ user.sn }}</b><br>{{ user.DN }}<div class="alert alert-info" data-action="comment" @click="api.comment(user)">{{ user.sophomorixComment }}<i class="fa fa-pencil float-end"></i></div><br></td><td width="1"><button v-if="user.pw" class="btn btn-light c10-button" data-action="bind-password" @click="showBind(user)"><i class="fa fa-eye"></i></button></td><td width="1"><button class="btn btn-light c10-button" @click="api.remove(level,[user],true)"><i class="fa fa-trash-o"></i></button></td></tr>
        </tbody></table><br>
    </div>
    <ul v-if="list?.length > pageSize" class="pagination c10-pagination"><li class="page-item"><a class="page-link" @click="page=1">First</a></li><li class="page-item"><a class="page-link" @click="page=Math.max(1,page-1)">Previous</a></li><li class="page-item" v-for="n in pages" :key="n" :class="{active:page===n}"><a class="page-link" @click="page=n">{{ n }}</a></li><li class="page-item"><a class="page-link" @click="page=Math.min(pageCount,page+1)">Next</a></li><li class="page-item"><a class="page-link" @click="page=pageCount">Last</a></li></ul>
    <div class="floating-toolbar-padder"></div><component :is="'floating-toolbar'"><div class="container"><div class="row"><div class="col-md-3"></div><div class="col-md-9"><div class="bar row"><div v-if="list?.some(user=>user.selected)" class="btn-group dropup float-end" @click.stop><button class="btn btn-lmn" @click="toggle('batch')"><i class="fa fa-key"></i> {{ batchLabel }} <span class="dropdown-toggle aj-dropdown-marker"></span></button><ul v-if="menu==='batch'" class="dropdown-menu dropdown-menu-start show c10-menu"><li v-for="[cmd,label] in batchCommands" :key="cmd"><a class="dropdown-item" @click="batch(cmd)">{{ aj.gettext(label) }}</a></li></ul></div></div></div></div></div></component>
</template>

<script setup>
import { computed, inject, onBeforeUnmount, ref } from 'vue';
import { isStudent, participantSorts, sortedFiles, sortedParticipants } from './participants.mjs';
const props = defineProps({ store: Object, api: Object, files: Object });
const aj = inject('aj'), sort = ref(0);
const queries = ref(['', '']), results = ref([[], []]), selected = ref([0, 0]);
let versions = [0, 0], alive = true;
onBeforeUnmount(() => { alive = false; });
const joinLabel = () => aj.gettext('Join {{missing_schoolclasses}} to share').replace('{{missing_schoolclasses}}', props.api.missingClasses.value);
const rows = computed(() => sortedParticipants(props.store.state.current.members, sort.value));
const label = (user, kind) => kind === 0 ? `${user.sophomorixAdminClass} ${user.sn} ${user.givenName} (${user.sAMAccountName})` : `${user.cn} (${user.membersCount})`;
function reset(kind) {
    versions = versions.map((value, i) => i === kind ? value + 1 : value);
    results.value = results.value.map((value, i) => i === kind ? [] : value);
    selected.value = selected.value.map((value, i) => i === kind ? 0 : value);
}
async function search(kind) {
    reset(kind); const version = versions[kind];
    try {
        const data = await (kind === 0 ? props.api.findUsers(queries.value[kind]) : props.api.findClasses(queries.value[kind]));
        if (alive && version === versions[kind]) results.value = results.value.map((value, i) => i === kind ? data : value);
    } catch { /* Core owns HTTP errors; failed typeaheads display no choices. */ }
}
async function choose(user, kind) {
    reset(kind); queries.value = queries.value.map((value, i) => i === kind ? label(user, kind) : value);
    try {
        const added = await (kind === 0 ? props.api.addUser(user) : props.api.addClass(user));
        if (alive && added) queries.value = queries.value.map((value, i) => i === kind ? '' : value);
    } catch { /* Keep the selected label after failed userinfo, as Angular does. */ }
}
function key(event, kind) {
    if (!results.value[kind].length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault(); selected.value = selected.value.map((value, i) => i === kind ? (value + (event.key === 'ArrowDown' ? 1 : -1) + results.value[kind].length) % results.value[kind].length : value);
    } else if (event.key === 'Enter' || event.key === 'Tab') { event.preventDefault(); choose(results.value[kind][selected.value[kind]], kind); }
    else if (event.key === 'Escape') { event.stopPropagation(); reset(kind); }
}
async function action(fn) { try { await fn(); } catch { /* Shell interceptors/modal service own request errors and cancellations. */ } }
const icons = { powerpoint: 'powerpoint', text: 'alt', code: 'code', word: 'word', pdf: 'pdf', excel: 'excel', audio: 'audio', archive: 'archive', video: 'video', image: 'image' };
const icon = type => type === 'file' ? 'far fa-file' : icons[type] ? `far fa-file-${icons[type]}` : undefined;
function bytes(value) {
    if (Number.isNaN(parseFloat(value)) || !Number.isFinite(value)) return '-';
    if (value === 0) return aj.gettext('0 bytes');
    const index = Math.floor(Math.log(value) / Math.log(1024)), number = value / 1024 ** index;
    return `${index === 0 ? Math.floor(number) : number.toFixed(1)} ${aj.gettext(['bytes', 'KB', 'MB', 'GB', 'TB', 'PB'][index])}`;
}
</script>
<template>
    <div class="input-group">
        <div v-for="(placeholder, kind) in ['Add Student', 'Add Class']" :key="kind" :style="{ width: kind === 0 ? '70%' : '30%', position: 'relative', display: 'table-cell' }">
            <input v-model.trim="queries[kind]" type="text" class="form-control" :placeholder="aj.gettext(placeholder)" autocomplete="off" role="combobox" :aria-expanded="results[kind].length > 0" @input="search(kind)" @keydown="key($event, kind)" @blur="reset(kind)">
            <ul v-if="results[kind].length" class="dropdown-menu" style="display:block" role="listbox" :data-users="kind === 0 ? '' : undefined" :data-classes="kind === 1 ? '' : undefined">
                <li v-for="(user, index) in results[kind]" :key="index" :class="{ active: selected[kind] === index }"><button type="button" role="option" class="btn btn-link" :aria-selected="selected[kind] === index" @mousedown.prevent @click="choose(user, kind)">{{ label(user, kind) }}</button></li>
            </ul>
        </div>
        <div class="input-group-btn"><select v-model.number="sort" class="form-control" :aria-label="aj.gettext('Lastname')"><option v-for="(item, index) in participantSorts" :key="index" :value="index">{{ aj.gettext(item.name) }}</option></select></div>
        <slot name="actions" />
    </div>
    <br>
    <div v-if="store.state.current.members.length === 0" class="alert alert-info">{{ aj.gettext("There's currently no student in this group. You can add these with the input above.") }}</div>
    <table v-else class="table table-bordered" style="margin-bottom:60px">
        <thead><tr>
            <th style="text-align:center">{{ aj.gettext('Users') }}<br><span class="label label-info">{{ store.state.current.members.length }} {{ aj.gettext('student(s)') }}</span></th>
            <th style="text-align:center">{{ aj.gettext('Working directory') }}<br><span class="label label-default">transfer/{{ aj.identity.user }}/_collect</span>
                <button v-if="!files.active.value" data-files-start class="btn btn-default" :aria-label="aj.gettext('Start autorefresh')" @click="files.start"><i class="fas fa-sync"></i></button>
                <button v-else data-files-stop class="btn btn-default" :aria-label="aj.gettext('Stop autorefresh')" @click="files.stop"><i class="fas fa-sync fa-spin"></i></button>
            </th><th></th>
        </tr></thead>
        <tbody><tr v-for="(user, index) in rows" :key="index">
            <td><span v-if="user.computer" class="label label-success pull-right">{{ user.computer }}</span><a><b>{{ user.sn }}, {{ user.givenName }}</b></a><br><span class="label label-default pull-right">{{ user.sophomorixAdminClass }}</span><i>{{ user.sAMAccountName }}</i></td>
            <td v-if="!isStudent(user)"><div class="alert alert-danger">{{ aj.gettext("It's currently not possible to create share directory in other teacher's home or to handle their management groups.") }}</div></td>
            <td v-else style="text-align:center">
                <button v-if="user.files_error === 'NOTJOINED'" data-membership class="btn btn-danger" @click="action(api.fixMembership)">{{ joinLabel() }}</button>
                <button v-else-if="user.files_error" data-membership class="btn btn-danger" @click="action(api.fixMembership)">{{ user.files_error }}</button>
                <template v-else-if="user.files_error === ''"><div v-for="(item, itemIndex) in sortedFiles(user.files)" :key="itemIndex">
                    <span v-if="item.isDir"><i class="fa fa-fw fa-folder"></i> {{ item.name }}</span>
                    <span v-if="item.isFile"><i :class="icon(item.filetype)"></i> {{ item.name }} <span class="subtle">{{ bytes(item.size) }}</span></span>
                </div></template>
            </td>
            <td><slot name="files" :user="user" /><button v-if="!store.state.current.generated" data-remove class="btn btn-default" :aria-label="aj.gettext('Delete')" @click="action(() => api.remove(user))"><i class="fa fa-trash"></i></button></td>
        </tr></tbody>
    </table>
</template>

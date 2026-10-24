<script setup>
import { inject, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import ListTable from './ListTable.vue';
import AddUserDialog from './AddUserDialog.vue';
import { createLists, listTabs, hotkeyTabs, listLabels, validateListField, cleanupEmptyRow, newListUser } from './lists.mjs';
import { createValidation } from '../../common/validation.mjs';
import { openFileEditor } from '../../common/fileEditor.mjs';
import { openFileBackups } from '../../common/fileBackups.mjs';
import { openUsersCheck } from '../../common/users/check.mjs';
const aj = inject('aj'), api = createLists(aj), validation = createValidation(aj);
const active = ref(0), size = ref(50), lists = ref(Object.fromEntries([...listTabs, 'courses'].map(kind => [kind, '']))), encodings = ref({}), school = ref(), teacherSettings = ref();
const firstSave = ref({}), showErrors = ref(false), errorSummary = ref({ empty: 0, messages: [] });
const errors = { emptyCells: {}, errorMessages: {} };
let refreshPending = false;
function refreshErrors() {
    refreshPending = false;
    const next = { empty: Object.keys(errors.emptyCells).length, messages: Object.values(errors.errorMessages) };
    if (JSON.stringify(next) !== JSON.stringify(errorSummary.value)) errorSummary.value = next;
}
function validate(name, value, tab, index, page, pageSize) {
    const result = validateListField(errors, validation, aj.gettext, { name, value, tab, index, page, size: pageSize, lists: lists.value, firstSave: firstSave.value[tab] });
    if (!refreshPending) { refreshPending = true; queueMicrotask(refreshErrors); }
    return result;
}
async function load(kind, force = false) {
    if (lists.value[kind] && !force) return;
    if (kind === 'teachers') api.teacherSettings().then(data => { teacherSettings.value = data; }).catch(() => {});
    try {
        const { rows, encoding } = await api.load(kind);
        lists.value = { ...lists.value, [kind]: rows }; encodings.value = { ...encodings.value, [kind]: encoding };
    } catch { /* Original retains the empty-string table after a failed request. */ }
}
function update(kind, row, key, value) { lists.value = { ...lists.value, [kind]: lists.value[kind].map(item => item === row ? { ...item, [key]: value } : item) }; }
async function add(kind) {
    try {
        const row = kind === 'courses' ? newListUser(kind) : await aj.modal.open(AddUserDialog, { kind });
        if (row) lists.value = { ...lists.value, [kind]: kind === 'courses' ? [...lists.value[kind], row] : [row, ...lists.value[kind]] };
    } catch { /* Dismissed add dialogs never add a row. */ }
}
function remove(kind, row, index, page, pageSize) {
    if (row._isNew) cleanupEmptyRow(errors, kind, index, page, pageSize);
    lists.value = { ...lists.value, [kind]: lists.value[kind].filter(item => item !== row) };
}
async function save(kind, check = false) {
    // All visited cells contribute, including errors retained by hidden tabs/fields.
    const empty = Object.keys(errors.emptyCells).length, messages = Object.values(errors.errorMessages);
    errorSummary.value = { empty, messages };
    if (empty + messages.length) {
        firstSave.value = { ...firstSave.value, [kind]: true }; showErrors.value = true;
        document.querySelectorAll('.has-error-new').forEach(el => el.classList.add('has-error'));
        aj.notify.error(aj.gettext('Please check the errors.')); return;
    }
    showErrors.value = false; firstSave.value = { ...firstSave.value, [kind]: false };
    try { await api.save(kind, lists.value[kind], encodings.value); if (check) await openUsersCheck(aj); }
    catch { /* HTTP errors handled by shell; never proceed to Check on rejection. */ }
}
async function editor(kind) {
    try { await openFileEditor(aj, api.path(school.value, kind), ''); aj.reload(); }
    catch { /* Dismissal does not reload. */ }
}
async function backups(kind) {
    try { await openFileBackups(aj, api.path(school.value, kind), ''); }
    catch { /* Dismissal leaves the page intact. */ }
}
function hotkey(event) {
    if (!event.ctrlKey) return;
    const kind = hotkeyTabs[active.value], key = event.key.toUpperCase();
    if (key === 'B') backups(kind);
    // Tabs beyond the four-name map have no save handler in the original.
    else if (key === 'S' && kind) save(kind);
    else if (key === 'I' && kind) save(kind, true);
    else return;
    event.preventDefault(); event.stopPropagation();
}
watch(() => aj.identity.user, async user => {
    if (user === undefined || user === null || user === 'root') return;
    try { school.value = await api.school(); } catch { /* Preserve unset path. */ }
}, { immediate: true });
onMounted(() => { aj.pageTitle.set(aj.gettext('Listmanagement')); load('students'); document.addEventListener('keydown', hotkey); });
onBeforeUnmount(() => document.removeEventListener('keydown', hotkey));
</script>
<template>
    <br>
    <div v-if="showErrors && errorSummary.empty + errorSummary.messages.length" id="error_messages" class="alert alert-danger"><ul><li v-if="errorSummary.empty">{{ errorSummary.empty }} {{ aj.gettext('empty cells') }}.</li><li v-for="message in errorSummary.messages" :key="message">{{ message }}</li></ul></div>
    <ul class="nav nav-tabs"><li v-for="(kind,index) in listTabs" :key="kind" :class="{active:active === index}"><a href="#" :data-tab="kind" @click.prevent="active = index; load(kind)">{{ aj.gettext(listLabels[kind]) }}</a></li></ul>
    <ListTable v-for="(kind,index) in listTabs" v-show="active === index" :key="kind" :kind="kind" :rows="lists[kind]" :size="size" :first-save="firstSave[kind]" :validate="validate"
        @update="(row,key,value) => update(kind,row,key,value)" @remove="(row,i,page,n) => remove(kind,row,i,page,n)" @add="add(kind)" @save="save(kind)" @check="save(kind,true)" @editor="editor(kind)" @backups="backups(kind)" @size="size = $event" />
</template>

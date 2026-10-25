<script setup>
import ExtraInput from './ExtraInput.vue';
import { computed, inject, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { createExtras, extraFields, extraSorts, extraRows, fieldError } from './extras.mjs';
import { createValidation } from '../../common/validation.mjs';
import { openFileEditor } from '../../common/fileEditor.mjs';
import { openFileBackups } from '../../common/fileBackups.mjs';
import { openUsersCheck } from '../../common/users/check.mjs';
const props = defineProps({ kind: { type: String, required: true } });
const aj = inject('aj'), api = createExtras(aj, props.kind), validation = createValidation(aj);
// Preserve the original HTML msgid, then render its entity as plain text.
const saveCheckText = computed(() => aj.gettext('Save &amp; check').replaceAll('&amp;', '&'));
const rows = ref(), encoding = ref(), query = ref(''), page = ref(1), firstSave = ref(false), table = ref();
const fields = extraFields(props.kind), sorts = extraSorts(props.kind), sort = ref(sorts[0]), menu = ref(false);
const closeMenu = () => { menu.value = false; };
onMounted(() => document.addEventListener('click', closeMenu));
onBeforeUnmount(() => document.removeEventListener('click', closeMenu));
const visibleRows = computed(() => extraRows(rows.value || [], props.kind, query.value, sort.value));
const pages = computed(() => Math.ceil((rows.value?.length || 0) / 100));
watch(pages, count => { page.value = Math.max(1, Math.min(page.value, count)); });
const pageNumbers = computed(() => {
    const end = Math.min(pages.value, Math.max(1, page.value - 5) + 9);
    const start = Math.max(1, end - 9);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
});
const label = key => fields.find(field => field.key === key)?.label;
const error = (field, row) => fieldError(validation, field.validation, row[field.key], row._isNew, firstSave.value, rows.value, field.key === 'login' ? 'students' : undefined);
function update(row, key, value) {
    rows.value = rows.value.map(item => item === row ? { ...item, [key]: value } : item);
}
function add() {
    if (rows.value.length) page.value = Math.floor((rows.value.length - 1) / 100) + 1;
    rows.value = [...rows.value, { _isNew: true }];
}
function remove(row) { rows.value = rows.value.filter(item => item !== row); }
async function save(check = false) {
    // As in Angular, only rendered cells participate (filtered-out rows don't).
    if (table.value.querySelector('.c10-invalid, .c10-invalid-new')) {
        firstSave.value = true;
        aj.notify.error('Required data missing');
        return;
    }
    try {
        await api.save(rows.value, encoding.value);
        if (check) await openUsersCheck(aj);
    } catch { /* Shell handles HTTP errors; rejected saves never start Check. */ }
}
async function editor() {
    try { await openFileEditor(aj, api.path, encoding.value); aj.reload(); }
    catch { /* Editor cancellation does not reload. */ }
}
async function backups() {
    try { await openFileBackups(aj, api.path, encoding.value); }
    catch { /* Closing backups does not reload. */ }
}
onMounted(async () => {
    aj.pageTitle.set(aj.gettext(props.kind === 'students' ? 'Extra Students' : 'Extra Courses'));
    try { const data = await api.load(); encoding.value = data.encoding; rows.value = data.rows; }
    catch { /* Retain the loading state on rejection, as in Angular. */ }
});
</script>
<template>
    <br />
    <div v-if="rows == null" role="status" class="progress-spinner"><i class="fa fa-spinner fa-spin"></i></div>
    <div v-else>
        <div class="input-group">
            <input v-model.trim="query" type="search" autofocus class="form-control" placeholder="Filter" />
            <div class="c10-menu-control" @click.stop>
                <button class="btn btn-light c10-button" data-action="sort-menu" @click="menu = !menu"><i class="fa fa-sort-amount-asc"></i> {{ aj.gettext(label(sort)) }} <span class="dropdown-toggle aj-dropdown-marker"></span></button>
                <ul v-if="menu" class="dropdown-menu dropdown-menu-end show c10-menu" style="width:150px"><li v-for="key in sorts" :key="key"><a class="dropdown-item" :data-sort="key" @click="sort = key; menu = false"><i class="fa fa-sort-amount-asc"></i> {{ aj.gettext(label(key)) }}</a></li></ul>
            </div>
        </div>
        <br />
        <div class="c10-table-scroll"><table ref="table" class="lm-table lm-table-inputs">
            <thead><tr><th v-for="field in fields" :key="field.key">{{ aj.gettext(field.label) }}</th><th></th></tr></thead>
            <tbody><tr v-for="row in visibleRows" :key="rows.indexOf(row)" v-show="row[kind === 'students' ? 'class' : 'course']?.[0] !== '#'">
                <td v-for="field in fields" :key="field.key" class="c10-field" :class="{ 'c10-invalid': error(field, row) === 'has-error', 'c10-invalid-new': error(field, row) === 'has-error-new' }">
                    <ExtraInput :value="row[field.key]" :type="field.key === 'password' ? 'password' : 'text'" :placeholder="field.label" class="form-control" :class="{ 'is-invalid': error(field, row) === 'has-error' }" @commit="update(row, field.key, $event)" />
                </td>
                <td width="1"><button class="btn btn-light c10-button" data-action="remove" :title="aj.gettext('Remove')" @click="remove(row)"><i class="fa fa-trash-o"></i></button></td>
            </tr></tbody>
        </table></div>
        <br />
        <button class="btn btn-light c10-button" data-action="add" @click="add"><i class="fa fa-plus"></i> {{ aj.gettext(kind === 'students' ? 'Add a student' : 'Add a course') }}</button>
        <br />
        <ul v-if="kind === 'students' && pages > 1" class="pagination c10-pagination">
            <li class="page-item" :class="{disabled: page === 1}"><a class="page-link" href="#" @click.prevent="page = 1">First</a></li>
            <li class="page-item" :class="{disabled: page === 1}"><a class="page-link" href="#" @click.prevent="page = Math.max(1, page - 1)">Previous</a></li>
            <li class="page-item" v-for="n in pageNumbers" :key="n" :class="{active: n === page}"><a class="page-link" href="#" :data-page="n" @click.prevent="page = n">{{ n }}</a></li>
            <li class="page-item" :class="{disabled: page === pages}"><a class="page-link" href="#" @click.prevent="page = Math.min(pages, page + 1)">Next</a></li>
            <li class="page-item" :class="{disabled: page === pages}"><a class="page-link" href="#" @click.prevent="page = pages">Last</a></li>
        </ul>
        <div class="floating-toolbar-padder"></div>
        <component :is="'floating-toolbar'"><div class="container"><div class="row"><div class="col-md-3"></div><div class="col-md-9"><div class="bar row">
            <button class="btn btn-lmn float-end" data-action="backups" @click="backups"><i class="fa fa-history"></i></button>
            <button class="btn btn-lmn" data-action="save" @click="save()">{{ aj.gettext('Save') }}</button>
            <button class="btn btn-lmn" data-action="check" @click="save(true)">{{ saveCheckText }}</button>
            <button class="btn btn-lmn" data-action="editor" @click="editor">{{ aj.gettext('Edit CSV') }}</button>
        </div></div></div></div></component>
    </div>
</template>

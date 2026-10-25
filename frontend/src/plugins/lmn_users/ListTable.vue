<script setup>
import { computed, inject, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import ExtraInput from './ExtraInput.vue';
import { listFields, listRows, listSorts, addLabels } from './lists.mjs';
const props = defineProps({ kind: String, rows: [Array, String], size: Number, firstSave: Boolean, validate: Function });
const emit = defineEmits(['update', 'remove', 'add', 'save', 'check', 'editor', 'upload', 'backups', 'size']);
const aj = inject('aj'), query = ref(''), page = ref(1), sort = ref(), fields = ref(listFields(props.kind)), menu = ref('');
const sorts = listSorts(props.kind);
const closeMenu = () => { menu.value = ''; };
onMounted(() => document.addEventListener('click', closeMenu));
onBeforeUnmount(() => document.removeEventListener('click', closeMenu));
const visibleFields = computed(() => fields.value.filter(field => field.visible));
const visibleRows = computed(() => listRows(props.rows, props.kind, query.value, sort.value, page.value, props.size));
const pages = computed(() => Math.ceil((props.rows?.length || 0) / props.size));
watch(pages, n => { page.value = Math.max(1, Math.min(page.value, n || 1)); });
const pageNumbers = computed(() => {
    const start = Math.max(1, Math.min(page.value - 5, pages.value - 9));
    return Array.from({ length: Math.max(0, Math.min(10, pages.value - start + 1)) }, (_, i) => start + i);
});
function chooseSort(key) { if (props.kind !== 'staff') sort.value = key; menu.value = ''; }
function error(field, row, index) { return props.validate(field.validation, row[field.key], props.kind, index, page.value, props.size); }
function remove(row, index) { emit('remove', row, index, page.value, props.size); }
const saveCheckLabel = () => aj.gettext('Save &amp; check').replaceAll('&amp;', '&');
const loginHint = 'This entry is directly read from the CSV file and could differ from the actual login of the user (saved in LDAP)';
</script>
<template>
    <section :data-list="kind">
        <br>
        <div v-if="rows == null" role="status" class="progress-spinner"><i class="fa fa-spinner fa-spin"></i></div>
        <div v-else>
            <button class="btn btn-success float-end" data-action="add" @click="emit('add')"><i class="fa fa-plus"></i> {{ aj.gettext(addLabels[kind]) }}</button>
            <div class="input-group">
                <input v-model.trim="query" type="search" autofocus placeholder="Filter" class="form-control">
                <div class="c11-menu-control" @click.stop>
                    <button class="btn btn-light c11-button" data-action="sort-menu" @click="menu = menu === 'sort' ? '' : 'sort'"><i class="fa fa-sort-amount-asc"></i> {{ aj.gettext(sorts.find(s => s.key === sort)?.label || '') }} <span class="caret"></span></button>
                    <ul v-if="menu === 'sort'" class="dropdown-menu dropdown-menu-end show c11-menu"><li v-for="option in sorts" :key="option.key"><a class="dropdown-item" :data-sort="option.key" @click="chooseSort(option.key)"><i class="fa fa-sort-amount-asc"></i> {{ aj.gettext(option.label) }}</a></li></ul>
                </div>
                <div class="c11-menu-control" @click.stop>
                    <button class="btn btn-light c11-button" data-action="fields-menu" @click="menu = menu === 'fields' ? '' : 'fields'"><i class="fa fa-ellipsis-h"></i> {{ aj.gettext('Fields') }} <span class="caret"></span></button>
                    <ul class="dropdown-menu dropdown-menu-end c11-menu" :class="{show:menu === 'fields'}"><li v-for="field in fields" :key="field.key"><label><input v-model="field.visible" :data-field="field.key" type="checkbox"> {{ aj.gettext(field.label) }}</label></li></ul>
                </div>
                <div class="c11-menu-control" @click.stop>
                    <button class="btn btn-light c11-button" data-action="rows-menu" @click="menu = menu === 'rows' ? '' : 'rows'"><i class="fa fa-list-ol"></i> {{ aj.gettext('Rows') }} <span class="caret"></span></button>
                    <ul v-if="menu === 'rows'" class="dropdown-menu dropdown-menu-end show c11-menu"><li v-for="n in [10,50,100,500,1000]" :key="n"><a class="dropdown-item" :data-size="n" @click="emit('size',n); menu = ''">{{ n }} {{ kind }}</a></li><li><input :value="size" type="number" class="form-control" @input="emit('size',$event.target.value === '' ? null : Number($event.target.value))"></li></ul>
                </div>
            </div>
            <br>
            <table class="lm-table lm-table-inputs"><thead><tr><th v-for="field in visibleFields" :key="field.key">{{ aj.gettext(field.label) }} <i v-if="field.key === 'login'" class="fas fa-question-circle" :title="aj.gettext(loginHint)"></i></th><th></th></tr></thead>
                <tbody><template v-for="(row,index) in visibleRows" :key="rows.indexOf(row)"><tr v-if="row.class?.[0] !== '#'">
                    <td v-for="field in visibleFields" :key="field.key" class="c11-form" :class="{'c11-invalid': error(field,row,index).split(' ').includes('has-error'), 'c11-new': error(field,row,index).split(' ').includes('has-error-new')}">
                        <ExtraInput :class="{'is-invalid': error(field,row,index).split(' ').includes('has-error')}" :immediate="kind === 'teachers' && field.key === 'login'" :disabled="kind === 'teachers' && field.key === 'login' && !row._isNew" :value="row[field.key]" type="text" :placeholder="field.placeholder" @commit="emit('update',row,field.key,$event)">
                        </ExtraInput>
                    </td><td width="1"><button class="btn btn-light c11-button" title="Remove" data-action="remove" @click="remove(row,index)"><i class="fa fa-trash-o"></i></button></td>
                </tr></template></tbody>
            </table>
            <ul v-if="pages > 1" class="pagination c11-pagination">
                <li class="page-item" :class="{disabled:page === 1}"><a class="page-link" href="#" @click.prevent="page = 1">First</a></li>
                <li class="page-item" :class="{disabled:page === 1}"><a class="page-link" href="#" @click.prevent="page = Math.max(1,page - 1)">Previous</a></li>
                <li class="page-item" v-for="n in pageNumbers" :key="n" :class="{active:page === n}"><a class="page-link" href="#" :data-page="n" @click.prevent="page = n">{{ n }}</a></li>
                <li class="page-item" :class="{disabled:page === pages}"><a class="page-link" href="#" @click.prevent="page = Math.min(pages,page + 1)">Next</a></li>
                <li class="page-item" :class="{disabled:page === pages}"><a class="page-link" href="#" @click.prevent="page = pages">Last</a></li>
            </ul>
            <div class="floating-toolbar-padder"></div>
            <component :is="'floating-toolbar'"><div class="container"><div class="row"><div class="col-md-3"></div><div class="col-md-9"><div class="bar row">
                <button class="btn btn-lmn float-end" data-action="backups" @click="emit('backups')"><i class="fa fa-history"></i></button>
                <button class="btn btn-lmn" data-action="save" @click="emit('save')">{{ aj.gettext('Save') }}</button>
                <button class="btn btn-lmn" data-action="check" @click="emit('check')">{{ saveCheckLabel() }}</button>
                <button v-if="kind === 'extrastudents'" class="btn btn-lmn" data-action="editor" @click="emit('editor')">{{ aj.gettext('Edit CSV') }}</button>
                <div v-else class="btn-group dropup" @click.stop><button class="btn btn-lmn" data-action="csv-menu" @click="menu = menu === 'csv' ? '' : 'csv'">{{ aj.gettext('CSV') }} <span class="caret"></span></button><ul v-if="menu === 'csv'" class="dropdown-menu dropdown-menu-start show c11-menu"><li><a class="dropdown-item" data-action="editor" @click="emit('editor'); menu = ''">{{ aj.gettext('Edit CSV') }}</a></li><li><a class="dropdown-item" data-action="upload" @click="emit('upload'); menu = ''">{{ aj.gettext('Upload CSV') }}</a></li></ul></div>
            </div></div></div></div></component>
        </div>
    </section>
</template>

<script setup>
import { computed, inject, ref, watch } from 'vue';
import { useGlobalAdminAccess } from '../../../common/access.mjs';

const aj = inject('aj');
const allowed = useGlobalAdminAccess(aj);
const tabs = ref();
const school = ref();
const user = ref('globaladministrator');
const active = ref('normal_tasks');
const editing = ref(null);
const crontab = computed(() => tabs.value?.[user.value]);
const sections = [
    { type: 'normal_tasks', title: 'Jobs', singular: 'normal task', empty: 'There is no cronjob.' },
    { type: 'special_tasks', title: 'Special', singular: 'special task', empty: 'There is no special task.' },
    { type: 'env_settings', title: 'Environment variables', singular: 'environment variable', empty: 'There is no variables environment set.' },
];
const timeFields = [['minute', 'Minute', 'Minute'], ['hour', 'Hour', 'Hour'], ['day_of_month', 'Day (month)', 'Day of the month'], ['month', 'Month', 'Month'], ['day_of_week', 'Day (week)', 'Day of the week']];
const specials = ['@reboot', '@yearly', '@annually', '@monthly', '@weekly', '@daily', '@hourly'];
const defaults = {
    normal_tasks: { minute: '*', hour: '*', day_of_month: '*', month: '*', day_of_week: '*', command: '', comment: '' },
    special_tasks: { special: '@reboot', command: '', comment: '' },
    env_settings: { name: '', value: '', comment: '' },
};
const fields = computed(() => editing.value?.type === 'normal_tasks'
    ? [...timeFields.map(([name, , label]) => ({ name, label })), { name: 'command', label: 'Command', area: true }, { name: 'comment', label: 'Comment', area: true }]
    : editing.value?.type === 'special_tasks'
        ? [{ name: 'special', label: 'Special', select: true }, { name: 'command', label: 'Command', area: true }, { name: 'comment', label: 'Comment', area: true }]
        : [{ name: 'name', label: 'Name' }, { name: 'value', label: 'Value', area: true }, { name: 'comment', label: 'Comment', area: true }]);

aj.pageTitle.set(aj.gettext('Cron'));
watch(() => aj.identity.user, async (identity) => {
    if (identity == null) return;
    tabs.value = undefined;
    try {
        const { data } = await aj.http.get('/api/lmn/crontab');
        tabs.value = { globaladministrator: data[0], root: data[1] };
        school.value = data[2];
    } catch {
        // The adapter presents the HTTP error; the original leaves tables unset.
    }
}, { immediate: true });
function replace(type, jobs) {
    tabs.value = { ...tabs.value, [user.value]: { ...crontab.value, [type]: jobs } };
}
function toggleHoliday(index) {
    replace(active.value, crontab.value[active.value].map((item, i) => i === index ? { ...item, disable_holiday: !item.disable_holiday } : item));
}
function modify(type, index) {
    editing.value = { type, index, job: { ...crontab.value[type][index] } };
}
function add() {
    editing.value = { type: active.value, index: null, job: { ...defaults[active.value], school: school.value } };
}
function update(name, value) {
    const current = editing.value;
    const trimmed = typeof value === 'string' && name !== 'special' ? value.trim() : value;
    const job = { ...current.job, [name]: trimmed === '' && name !== 'comment' ? undefined : trimmed };
    editing.value = { ...current, job };
    // Angular binds existing jobs immediately, including when Cancel is pressed.
    if (current.index !== null) replace(current.type, crontab.value[current.type].map((item, i) => i === current.index ? job : item));
}
function accept() {
    const { type, index, job } = editing.value;
    if (index === null) replace(type, [...crontab.value[type], job]);
    editing.value = null;
}
async function save() {
    try {
        await aj.http.post('/api/lmn/crontab', { globaladministrator: tabs.value.globaladministrator, root: tabs.value.root });
        aj.notify.success(aj.gettext('Crontab successfully saved !'));
    } catch {
        aj.notify.error(aj.gettext('Failed to save crontab'));
    }
}
</script>

<template>
    <br>
    <div v-if="allowed">
        <div class="form-group" style="margin-bottom:50px;"><div class="row"><div class="col-md-4">
            <label for="cron-user">{{ aj.gettext('Choose which crontab you want to edit: ') }}</label>
            <select id="cron-user" v-model="user" class="form-control">
                <option value="globaladministrator">{{ aj.gettext('As globaladministrator') }}</option>
                <option value="root">{{ aj.gettext('As root') }}</option>
            </select>
        </div></div></div>
        <hr class="clearfix">
        <ul class="nav nav-tabs" role="tablist">
            <li v-for="section in sections" :key="section.type" :class="{ active: active === section.type }" role="presentation">
                <a href="" role="tab" :aria-selected="active === section.type" @click.prevent="active = section.type">{{ aj.gettext(section.title) }}</a>
            </li>
        </ul>
        <div v-for="section in sections.filter((s) => s.type === active)" :key="section.type" class="tab-pane active" role="tabpanel">
            <br>
            <div v-if="crontab?.[active]?.length === 0" class="alert alert-info">{{ aj.gettext(section.empty) }}</div>
            <table v-if="crontab?.[active]?.length > 0" class="table">
                <thead><tr>
                    <template v-if="active !== 'env_settings'">
                        <th>{{ aj.gettext('Disable holidays') }}</th>
                        <template v-if="active === 'normal_tasks'"><th v-for="[name, label] in timeFields" :key="name" class="text-center">{{ aj.gettext(label) }}</th></template>
                        <th v-else>{{ aj.gettext('Special') }}</th>
                        <th :class="{ 'text-center': active === 'normal_tasks' }">{{ aj.gettext('Command') }}</th>
                    </template>
                    <template v-else><th>{{ aj.gettext('Name') }}</th><th>{{ aj.gettext('Value') }}</th></template>
                    <th></th><th></th>
                </tr></thead>
                <tbody><tr v-for="(job, index) in crontab[active]" :key="index">
                    <template v-if="active !== 'env_settings'">
                        <td><span checkbox role="checkbox" tabindex="0" :class="{ active: job.disable_holiday }" :aria-checked="!!job.disable_holiday" :aria-label="aj.gettext('Disable holidays')" @click="toggleHoliday(index)" @keydown.space.prevent="toggleHoliday(index)"><i class="fa fa-square-o off"></i><i class="fa fa-check-square on"></i></span> ({{ job.school }})</td>
                        <template v-if="active === 'normal_tasks'"><td v-for="[name] in timeFields" :key="name" class="text-center" style="width:75px">{{ job[name] }}</td></template>
                        <td v-else>{{ job.special }}</td>
                        <td :class="{ 'text-center': active === 'normal_tasks' }">{{ job.command }}</td>
                    </template>
                    <template v-else><td>{{ job.name }}</td><td>{{ job.value }}</td></template>
                    <td style="width:1px"><button class="btn btn-default" title="Modify" @click="modify(active, index)"><i class="fa fa-cog"></i></button></td>
                    <td style="width:1px"><button class="btn btn-default" title="Remove" @click="replace(active, crontab[active].filter((_, i) => i !== index))"><i class="fa fa-trash-o"></i></button></td>
                </tr></tbody>
            </table>
            <button class="btn btn-default" @click="add">{{ aj.gettext('Add') }}</button>
        </div>
        <div v-if="editing" class="modal show" role="dialog" aria-modal="true" style="display:block;background:rgba(0,0,0,.5)">
            <div class="modal-dialog"><div class="modal-content">
                <div class="modal-header"><h4>{{ aj.gettext('Modify') }} {{ aj.gettext(sections.find((s) => s.type === editing.type).singular) }}</h4></div>
                <div class="modal-body scrollable">
                    <form class="form-group" @submit.prevent="accept">
                        <template v-for="field in fields" :key="field.name">
                            <label :for="`cron-${field.name}`">{{ aj.gettext(field.label) }}</label>
                            <div class="input-group">
                                <select v-if="field.select" :id="`cron-${field.name}`" class="form-control" :name="field.name" :value="editing.job[field.name]" @change="update(field.name, $event.target.value)"><option v-for="special in specials" :key="special">{{ special }}</option></select>
                                <textarea v-else-if="field.area" :id="`cron-${field.name}`" class="form-control" :name="field.name" :value="editing.job[field.name]" :required="field.name !== 'comment'" :rows="field.name === 'comment' ? 15 : undefined" cols="80" @input="update(field.name, $event.target.value)"></textarea>
                                <input v-else :id="`cron-${field.name}`" class="form-control" :name="field.name" :value="editing.job[field.name]" required size="80" @input="update(field.name, $event.target.value)">
                            </div>
                        </template>
                        <div v-if="editing.type !== 'env_settings'"><label for="cron-holiday">{{ aj.gettext('Disable holidays') }}</label> <input id="cron-holiday" type="checkbox" :checked="editing.job.disable_holiday" @change="update('disable_holiday', $event.target.checked)"></div>
                        <button type="button" class="btn btn-default btn-flat pull-right" @click="editing = null">{{ aj.gettext('Cancel') }}</button>
                        <button type="submit" class="btn btn-default btn-flat pull-right">{{ aj.gettext('OK') }}</button>
                    </form>
                </div>
            </div></div>
        </div>
        <component :is="'floating-toolbar'"><div class="container"><div class="row"><div class="col-md-3"></div><div class="col-md-9"><div class="bar row"><button class="btn btn-lmn" @click="save">{{ aj.gettext('Save') }}</button></div></div></div></div></component>
    </div>
    <div v-else class="text-center root-access-blocker"><h1><i class="fas fa-exclamation-triangle"></i></h1><h4 class="alert alert-danger">{{ aj.gettext('This page is restricted to global administrators!') }}</h4></div>
</template>

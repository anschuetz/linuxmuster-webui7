<script setup>
import { computed, inject, ref } from 'vue';
import { applySelection, statusName, summarySelection } from './check.mjs';
import ApplyDialog from './ApplyDialog.vue';
const props = defineProps({ data: { type: Object, required: true } });
const emit = defineEmits(['close', 'cancel']);
const aj = inject('aj');
const selected = ref(summarySelection(props.data));
const tab = ref('all');
const sections = [
    { mode: 'add', key: 'ADD', index: 1, color: 'info', title: 'Users to be added', heading: 'Added users', choice: 'Add new users', flag: 'doAdd' },
    { mode: 'move', key: 'UPDATE', index: 2, color: 'warning', title: 'Users to be updated', heading: 'Moved users', choice: 'Move users', flag: 'doMove' },
    { mode: 'kill', key: 'KILL', index: 3, color: 'danger', title: 'Users to be killed', heading: 'Killed users', choice: 'Kill users', flag: 'doKill' },
];
const count = section => props.data.SUMMARY[section.index][section.key].RESULT;
const visibleSections = computed(() => sections.filter(section => tab.value === 'all' || tab.value === section.mode));
const errorCount = computed(() => props.data.SUMMARY[5].ERROR.RESULT);
const actionLabel = computed(() => ({ all: 'Apply', add: 'Add user(s)', move: 'Move user(s)', kill: 'Kill user(s)', error: 'Errors' })[tab.value]);
function apply() {
    const params = applySelection(tab.value, selected.value);
    emit('close');
    aj.modal.open(ApplyDialog, { params }, { backdrop: 'static', size: 'lg' }).catch(() => {});
}
</script>
<template>
    <div class="modal-header"><h4>{{ $gettext('Check result') }}</h4></div>
    <div class="modal-body">
        <ul class="nav nav-tabs">
            <li :class="{ active: tab === 'all' }"><a href="#" @click.prevent="tab = 'all'">{{ $gettext('Summary') }}</a></li>
            <li v-for="section in sections" v-show="count(section) > 0" :key="section.mode" :class="{ active: tab === section.mode }"><a href="#" @click.prevent="tab = section.mode">{{ $gettext(section.heading) }}</a></li>
            <li v-show="errorCount > 0" :class="{ active: tab === 'error' }"><a href="#" @click.prevent="tab = 'error'">{{ $gettext('Errors') }}</a></li>
        </ul><br>
        <div v-show="tab === 'all' && data.error" class="alert alert-danger"><i class="fa fa-warning"></i> {{ $gettext('Check failed') }}: {{ data.error }}</div>
        <div v-show="tab !== 'all' || !data.error">
            <div v-for="section in visibleSections" :key="section.mode" class="panel" :class="`panel-${section.color}`">
                <div class="panel-heading"><i class="fa fa-info-circle"></i> {{ $gettext(section.title) }}: {{ count(section) }}</div>
                <div class="panel-body">
                    <table class="table table-bordered"><tbody>
                        <tr v-for="(item, id) in data.CHECK_RESULT[section.key]" :key="id">
                            <template v-if="section.mode === 'add'">
                                <td>{{ item.sophomorixAdminClass }}</td><td>{{ id }}</td><td>{{ item.sn }} {{ item.givenName }}</td><td>{{ item.sophomorixRole }}</td><td>{{ item.sophomorixSchoolname }}</td>
                            </template>
                            <template v-else-if="section.mode === 'move'">
                                <td>{{ id }}</td><td>
                                    <ul v-for="(values, type) in item" :key="type">
                                        <li v-if="type === 'sophomorixStatus'"><i>{{ $gettext('Status') }}</i> : {{ statusName(values.OLD) }} --&gt; {{ statusName(values.NEW) }}</li>
                                        <li v-else><i>{{ type.replace('sophomorix', '') }}</i> : {{ values.OLD }} --&gt; {{ values.NEW }} <span v-if="values.OLD === 'attic'" class="label label-danger pull-right"><i class="fa fa-warning fa-xl"></i></span></li>
                                    </ul>
                                </td>
                            </template>
                            <template v-else><td>{{ id }}</td><td>{{ item.IDENTIFIER_ASCII }}</td></template>
                        </tr>
                    </tbody></table>
                </div>
            </div>
            <div v-show="tab === 'all'">
                <div v-show="errorCount > 0" class="alert alert-danger"><i class="fa fa-warning"></i> {{ $gettext('Errors found') }}: {{ errorCount }}</div><br>
                <template v-for="section in sections" :key="section.mode"><label v-show="count(section)"><input :checked="selected[section.flag]" type="checkbox" @change="selected = { ...selected, [section.flag]: $event.target.checked }"> {{ $gettext(section.choice) }}</label><br v-if="section.mode !== 'kill'"></template>
            </div>
        </div>
        <table v-show="tab === 'error'"><tbody><tr v-for="(item, id) in data.CHECK_RESULT.ERROR" :key="id"><td><pre>{{ id }} {{ item.REASON }}</pre></td></tr></tbody></table>
    </div>
    <div class="modal-footer">
        <button class="btn btn-default btn-flat" :disabled="!selected.doAdd && !selected.doMove && !selected.doKill" @click="apply">{{ $gettext(actionLabel) }}</button>
        <button class="btn btn-default btn-flat" @click="emit('cancel')">{{ $gettext('Cancel') }}</button>
    </div>
</template>

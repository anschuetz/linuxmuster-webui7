<script setup>
import { inject, ref } from 'vue';
import { columnTitles, assignColumns, toggleColumn, moveColumn } from './import.mjs';
const props = defineProps({ userlist: String, columns: Array });
const emit = defineEmits(['close', 'cancel']), aj = inject('aj');
const state = ref(assignColumns(props.columns, columnTitles(props.userlist, aj.gettext), aj.gettext));
const custom = ref(false);
let dragged;
function rebuild(titles) { state.value = assignColumns(state.value.data, titles, aj.gettext); }
function toggle() { rebuild(toggleColumn(state.value.titles, props.userlist === 'students.csv' ? 'id' : 'password')); }
function drop(index) {
    if (dragged === undefined) return;
    rebuild(moveColumn(state.value.titles, dragged, index)); dragged = undefined;
}
</script>
<template>
    <div class="modal-header"><h3>{{ aj.gettext('Sort List') }}</h3></div>
    <div class="modal-body">
        <div class="alert alert-warning"><i class="fa fa-info"></i> <span>{{ aj.gettext('Linuxmuster needs to know which column contains which userdata. This is mandatory for importing the CSV list.<br>Please set the column into the right order.').split('<br>')[0] }}</span><br><span>{{ aj.gettext('Linuxmuster needs to know which column contains which userdata. This is mandatory for importing the CSV list.<br>Please set the column into the right order.').split('<br>')[1] }}</span></div>
        <h4>{{ aj.gettext('Customizations') }}</h4>
        <div v-if="userlist === 'students.csv'"><label>CSV contains custom student ID attribute (optional) <input v-model="custom" type="checkbox" @change="toggle"></label></div>
        <div v-if="userlist === 'teachers.csv'"><label>{{ aj.gettext('CSV contains custom teacher password attribute (optional)') }} <input v-model="custom" type="checkbox" @change="toggle"></label></div>
        <div class="csv-data" style="height:calc(60vh - 120px);overflow:auto;white-space:nowrap;border:1px solid #ccc;border-radius:5px">
            <div class="csv-titles"><div v-for="(title,index) in state.titles" :key="index" class="csv-cell" style="display:inline-block;padding:10px 20px;background:white;border:2px solid orange;border-radius:3px;margin:3px;min-width:200px;vertical-align:top;cursor:move" data-column-title draggable="true" @dragstart="dragged = index" @dragover.prevent @drop.prevent="drop(index)"><b>{{ title.name }}</b></div></div>
            <div class="csv-samples"><div v-for="(column,index) in state.data" :key="index" class="csv-cell" style="display:inline-block;padding:10px 20px;background:white;border:2px solid #ccc;border-radius:3px;margin:3px;min-width:200px;vertical-align:top"><div v-for="(value,i) in column.data" :key="i">{{ value || '\u00a0' }}</div></div></div>
        </div>
    </div>
    <div class="modal-footer"><button class="btn btn-light c11-button btn-flat" @click="emit('cancel')">{{ aj.gettext('Abort') }}</button><button class="btn btn-light c11-button btn-flat" @click="emit('close',state.data)">{{ aj.gettext('Accept Sorting') }}</button></div>
</template>

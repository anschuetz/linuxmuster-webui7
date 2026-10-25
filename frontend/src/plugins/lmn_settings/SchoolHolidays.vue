<script setup>
import { inject } from 'vue';
import Translated from './Translated.mjs';
defineProps(['s', 'customization']);
const aj = inject('aj');
</script>
<template>
<div v-if="s.holidays">
<Translated tag="h3" text="Configuration of holidays">
</Translated> <div class="alert alert-info" v-show="s.holidays?.length === 0">
<i class="fa fa-info-circle fa-2x">
</i> <Translated tag="span" text="No holidays found!">
</Translated>
</div> <table class="table" v-show="s.holidays">
<tbody>
<tr>
<Translated tag="th" text="Name">
</Translated> <Translated tag="th" text="Start">
</Translated> <Translated tag="th" text="End">
</Translated> <Translated tag="th" text="">
</Translated>
</tr> <template v-for="(holiday, index) in s.holidays" :key="index">
<tr>
<td>
<input v-model.lazy.trim="holiday.name" type="text" placeholder="Name" class="form-control">
</td> <td :class="{ 'c13-date-invalid': !!s.validateDate(holiday.start) }">
<input v-model.lazy.trim="holiday.start" type="text" placeholder="dd.mm.yyyy" class="form-control">
</td> <td :class="{ 'c13-date-invalid': !!s.validateDate(holiday.end) }">
<input v-model.lazy.trim="holiday.end" type="text" placeholder="dd.mm.yyyy" class="form-control">
</td> <td width="1">
<button class="btn c13-button" @click="s.removeHoliday(holiday)" :title="s.trans.remove">
<i class="fa fa-trash-o">
</i>
</button>
</td>
</tr>
</template>

</tbody>
</table> <button class="btn c13-button" @click="s.addHoliday()">
<i class="fa fa-plus">
</i> <Translated tag="span" text="Add holidays">
</Translated>
</button>
</div>
</template>

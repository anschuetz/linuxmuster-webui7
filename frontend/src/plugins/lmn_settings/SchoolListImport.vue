<script setup>
import { inject } from 'vue';
import Checkbox from './Checkbox.vue';
import Translated from './Translated.mjs';
defineProps(['s', 'customization']);
const aj = inject('aj');
</script>
<template>
<div>
<br> <Translated tag="h3" text="Username and Passwords">
</Translated> <table class="lm-table lm-table-padded">
<tbody>
<tr>
<th width="40%">
</th> <Translated tag="th" text="Students" class="text-center">
</Translated> <Translated tag="th" text="Teachers" class="text-center">
</Translated> <Translated tag="th" text="extrastudents" class="text-center">
</Translated>
</tr> <tr>
<td>
<Translated tag="label" text="Reverse Surname and Firstname in username">
</Translated>
</td> <td class="text-center">
<Checkbox v-model="s.settings['userfile.students.csv']['SURNAME_FIRSTNAME_REVERSE']">
</Checkbox>
</td> <td class="text-center">
<Checkbox v-model="s.settings['userfile.teachers.csv']['SURNAME_FIRSTNAME_REVERSE']">
</Checkbox>
</td> <td class="text-center">
<Checkbox v-model="s.settings['userfile.extrastudents.csv']['SURNAME_FIRSTNAME_REVERSE']">
</Checkbox>
</td>
</tr> <tr>
<td>
<Translated tag="label" text="Surname Characters">
</Translated>
</td> <td>
<input v-model.number="s.settings['userfile.students.csv']['SURNAME_CHARS']" @input="if ($event.target.validity.badInput) s.settings['userfile.students.csv']['SURNAME_CHARS'] = undefined; else if ($event.target.value === '') s.settings['userfile.students.csv']['SURNAME_CHARS'] = null; else if ($event.target.validity.rangeUnderflow || $event.target.validity.rangeOverflow) s.settings['userfile.students.csv']['SURNAME_CHARS'] = undefined;" type="number" class="form-control">
</td> <td>
<input v-model.number="s.settings['userfile.teachers.csv']['SURNAME_CHARS']" @input="if ($event.target.validity.badInput) s.settings['userfile.teachers.csv']['SURNAME_CHARS'] = undefined; else if ($event.target.value === '') s.settings['userfile.teachers.csv']['SURNAME_CHARS'] = null; else if ($event.target.validity.rangeUnderflow || $event.target.validity.rangeOverflow) s.settings['userfile.teachers.csv']['SURNAME_CHARS'] = undefined;" type="number" class="form-control">
</td> <td>
<input v-model.number="s.settings['userfile.extrastudents.csv']['SURNAME_CHARS']" @input="if ($event.target.validity.badInput) s.settings['userfile.extrastudents.csv']['SURNAME_CHARS'] = undefined; else if ($event.target.value === '') s.settings['userfile.extrastudents.csv']['SURNAME_CHARS'] = null; else if ($event.target.validity.rangeUnderflow || $event.target.validity.rangeOverflow) s.settings['userfile.extrastudents.csv']['SURNAME_CHARS'] = undefined;" type="number" class="form-control">
</td>
</tr> <tr>
<td>
<Translated tag="label" text="Firstname Chars">
</Translated>
</td> <td>
<input v-model.number="s.settings['userfile.students.csv']['FIRSTNAME_CHARS']" @input="if ($event.target.validity.badInput) s.settings['userfile.students.csv']['FIRSTNAME_CHARS'] = undefined; else if ($event.target.value === '') s.settings['userfile.students.csv']['FIRSTNAME_CHARS'] = null; else if ($event.target.validity.rangeUnderflow || $event.target.validity.rangeOverflow) s.settings['userfile.students.csv']['FIRSTNAME_CHARS'] = undefined;" type="number" class="form-control">
</td> <td>
<input v-model.number="s.settings['userfile.teachers.csv']['FIRSTNAME_CHARS']" @input="if ($event.target.validity.badInput) s.settings['userfile.teachers.csv']['FIRSTNAME_CHARS'] = undefined; else if ($event.target.value === '') s.settings['userfile.teachers.csv']['FIRSTNAME_CHARS'] = null; else if ($event.target.validity.rangeUnderflow || $event.target.validity.rangeOverflow) s.settings['userfile.teachers.csv']['FIRSTNAME_CHARS'] = undefined;" type="number" class="form-control">
</td> <td>
<input v-model.number="s.settings['userfile.extrastudents.csv']['FIRSTNAME_CHARS']" @input="if ($event.target.validity.badInput) s.settings['userfile.extrastudents.csv']['FIRSTNAME_CHARS'] = undefined; else if ($event.target.value === '') s.settings['userfile.extrastudents.csv']['FIRSTNAME_CHARS'] = null; else if ($event.target.validity.rangeUnderflow || $event.target.validity.rangeOverflow) s.settings['userfile.extrastudents.csv']['FIRSTNAME_CHARS'] = undefined;" type="number" class="form-control">
</td>
</tr> <tr>
<td>
<Translated tag="label" text="Password Length">
</Translated>
</td> <td>
<input v-model.number="s.settings['userfile.students.csv']['PWD_LENGTH']" @input="if ($event.target.validity.badInput) s.settings['userfile.students.csv']['PWD_LENGTH'] = undefined; else if ($event.target.value === '') s.settings['userfile.students.csv']['PWD_LENGTH'] = null; else if ($event.target.validity.rangeUnderflow || $event.target.validity.rangeOverflow) s.settings['userfile.students.csv']['PWD_LENGTH'] = undefined;" type="number" class="form-control">
</td> <td>
<input v-model.number="s.settings['userfile.teachers.csv']['PWD_LENGTH']" @input="if ($event.target.validity.badInput) s.settings['userfile.teachers.csv']['PWD_LENGTH'] = undefined; else if ($event.target.value === '') s.settings['userfile.teachers.csv']['PWD_LENGTH'] = null; else if ($event.target.validity.rangeUnderflow || $event.target.validity.rangeOverflow) s.settings['userfile.teachers.csv']['PWD_LENGTH'] = undefined;" type="number" class="form-control">
</td> <td>
<input v-model.number="s.settings['userfile.extrastudents.csv']['PWD_LENGTH']" @input="if ($event.target.validity.badInput) s.settings['userfile.extrastudents.csv']['PWD_LENGTH'] = undefined; else if ($event.target.value === '') s.settings['userfile.extrastudents.csv']['PWD_LENGTH'] = null; else if ($event.target.validity.rangeUnderflow || $event.target.validity.rangeOverflow) s.settings['userfile.extrastudents.csv']['PWD_LENGTH'] = undefined;" type="number" class="form-control">
</td>
</tr> <tr v-show="s.settings.lehrer_zufall_passwort || s.settings.schueler_zufall_passwort">
<td>
<Translated tag="label" text="Password length">
</Translated>
</td> <td>
<input v-model.number="s.settings['userfile.students.csv']['PWD_LENGTH']" @input="if ($event.target.validity.badInput) s.settings['userfile.students.csv']['PWD_LENGTH'] = undefined; else if ($event.target.value === '') s.settings['userfile.students.csv']['PWD_LENGTH'] = null; else if ($event.target.validity.rangeUnderflow || $event.target.validity.rangeOverflow) s.settings['userfile.students.csv']['PWD_LENGTH'] = undefined;" type="number" class="form-control">
</td> <td>
<input v-model.number="s.settings['userfile.teachers.csv']['PWD_LENGTH']" @input="if ($event.target.validity.badInput) s.settings['userfile.teachers.csv']['PWD_LENGTH'] = undefined; else if ($event.target.value === '') s.settings['userfile.teachers.csv']['PWD_LENGTH'] = null; else if ($event.target.validity.rangeUnderflow || $event.target.validity.rangeOverflow) s.settings['userfile.teachers.csv']['PWD_LENGTH'] = undefined;" type="number" class="form-control" v-show="s.settings.schueler_zufall_passwort">
</td> <td>
<input v-model.number="s.settings['userfile.extrastudents.csv']['PWD_LENGTH']" @input="if ($event.target.validity.badInput) s.settings['userfile.extrastudents.csv']['PWD_LENGTH'] = undefined; else if ($event.target.value === '') s.settings['userfile.extrastudents.csv']['PWD_LENGTH'] = null; else if ($event.target.validity.rangeUnderflow || $event.target.validity.rangeOverflow) s.settings['userfile.extrastudents.csv']['PWD_LENGTH'] = undefined;" type="number" class="form-control" v-show="s.settings.schueler_zufall_passwort">
</td>
</tr> <tr>
<td>
<Translated tag="label" text="Random password">
</Translated>
</td> <td class="text-center">
<Checkbox v-model="s.settings['userfile.students.csv']['RANDOM_PWD']">
</Checkbox>
</td> <td class="text-center">
<Checkbox v-model="s.settings['userfile.teachers.csv']['RANDOM_PWD']">
</Checkbox>
</td> <td class="text-center">
<Checkbox v-model="s.settings['userfile.extrastudents.csv']['RANDOM_PWD']">
</Checkbox>
</td>
</tr> <tr>
<td>
<Translated tag="label" text="Tolerance after departure (days)">
</Translated>
</td> <td>
<input v-model.number="s.settings['userfile.students.csv']['TOLERATION_TIME']" @input="if ($event.target.validity.badInput) s.settings['userfile.students.csv']['TOLERATION_TIME'] = undefined; else if ($event.target.value === '') s.settings['userfile.students.csv']['TOLERATION_TIME'] = null; else if ($event.target.validity.rangeUnderflow || $event.target.validity.rangeOverflow) s.settings['userfile.students.csv']['TOLERATION_TIME'] = undefined;" type="number" class="form-control">
</td> <td>
<input v-model.number="s.settings['userfile.teachers.csv']['TOLERATION_TIME']" @input="if ($event.target.validity.badInput) s.settings['userfile.teachers.csv']['TOLERATION_TIME'] = undefined; else if ($event.target.value === '') s.settings['userfile.teachers.csv']['TOLERATION_TIME'] = null; else if ($event.target.validity.rangeUnderflow || $event.target.validity.rangeOverflow) s.settings['userfile.teachers.csv']['TOLERATION_TIME'] = undefined;" type="number" class="form-control">
</td> <td>
<input v-model.number="s.settings['userfile.extrastudents.csv']['TOLERATION_TIME']" @input="if ($event.target.validity.badInput) s.settings['userfile.extrastudents.csv']['TOLERATION_TIME'] = undefined; else if ($event.target.value === '') s.settings['userfile.extrastudents.csv']['TOLERATION_TIME'] = null; else if ($event.target.validity.rangeUnderflow || $event.target.validity.rangeOverflow) s.settings['userfile.extrastudents.csv']['TOLERATION_TIME'] = undefined;" type="number" class="form-control">
</td>
</tr> <tr>
<td>
<Translated tag="label" text="Removal after departure (days)">
</Translated>
</td> <td>
<input v-model.number="s.settings['userfile.students.csv']['DEACTIVATION_TIME']" @input="if ($event.target.validity.badInput) s.settings['userfile.students.csv']['DEACTIVATION_TIME'] = undefined; else if ($event.target.value === '') s.settings['userfile.students.csv']['DEACTIVATION_TIME'] = null; else if ($event.target.validity.rangeUnderflow || $event.target.validity.rangeOverflow) s.settings['userfile.students.csv']['DEACTIVATION_TIME'] = undefined;" type="number" class="form-control">
</td> <td>
<input v-model.number="s.settings['userfile.teachers.csv']['DEACTIVATION_TIME']" @input="if ($event.target.validity.badInput) s.settings['userfile.teachers.csv']['DEACTIVATION_TIME'] = undefined; else if ($event.target.value === '') s.settings['userfile.teachers.csv']['DEACTIVATION_TIME'] = null; else if ($event.target.validity.rangeUnderflow || $event.target.validity.rangeOverflow) s.settings['userfile.teachers.csv']['DEACTIVATION_TIME'] = undefined;" type="number" class="form-control">
</td> <td>
<input v-model.number="s.settings['userfile.extrastudents.csv']['DEACTIVATION_TIME']" @input="if ($event.target.validity.badInput) s.settings['userfile.extrastudents.csv']['DEACTIVATION_TIME'] = undefined; else if ($event.target.value === '') s.settings['userfile.extrastudents.csv']['DEACTIVATION_TIME'] = null; else if ($event.target.validity.rangeUnderflow || $event.target.validity.rangeOverflow) s.settings['userfile.extrastudents.csv']['DEACTIVATION_TIME'] = undefined;" type="number" class="form-control">
</td>
</tr> <tr>
<td>
<Translated tag="label" text="Replace slash(/) in classname by hypen(-)">
</Translated>
</td> <td class="text-center">
<Checkbox v-model="s.settings['userfile.students.csv']['CLASSNAME_SLASH_TO_HYPHEN']">
</Checkbox>
</td> <td>
</td> <td>
</td>
</tr>

</tbody>
</table> <Translated tag="h3" text="Encoding">
</Translated> <table class="lm-table lm-table-padded">
<tbody>
<tr>
<th width="40%">
</th> <Translated tag="th" text="students.csv encoding" class="text-center">
</Translated> <Translated tag="th" text="teachers.csv encoding" class="text-center">
</Translated> <Translated tag="th" text="extrastudents.csv encoding" class="text-center">
</Translated> </tr> <tr>
<td>
<Translated tag="label" text="List encoding">
</Translated>
</td> <td>
<select v-model="s.settings['userfile.students.csv']['ENCODING']" class="form-control">
<option v-for="(x, optionIndex) in s.encodings" :key="optionIndex" :value="x">{{ x }}</option>
</select> <div v-show="s.settings['userfile.students.csv']['ENCODING'] === 'auto'">
</div>
</td> <td>
<select v-model="s.settings['userfile.teachers.csv']['ENCODING']" class="form-control">
<option v-for="(x, optionIndex) in s.encodings" :key="optionIndex" :value="x">{{ x }}</option>
</select> <div v-show="s.settings['userfile.teachers.csv']['ENCODING'] === 'auto'">
</div>
</td> <td>
<select v-model="s.settings['userfile.extrastudents.csv']['ENCODING']" class="form-control">
<option v-for="(x, optionIndex) in s.encodings" :key="optionIndex" :value="x">{{ x }}</option>
</select> <div v-show="s.settings['userfile.extrastudents.csv']['ENCODING'] === 'auto'">
</div>
</td> </tr> <tr>
<td>
<Translated tag="label" text="Detected encoding">
</Translated>
</td> <td class="text-center">{{ s.encoding['userfile.students.csv'] }}</td> <td class="text-center">{{ s.encoding['userfile.teachers.csv'] }}</td> <td class="text-center">{{ s.encoding['userfile.extrastudents.csv'] }}</td> </tr>

</tbody>
</table> <Translated tag="h3" text="Customs filters">
</Translated> <Translated tag="div" text="It's possible to apply a filter script to your newly exported csv file. You must give here the absolute path of the script and the script must be executable.<br />Please read the full documentation in <a href=&quot;https://github.com/linuxmuster/sophomorix4/wiki/Export-and-Filters#filters&quot;>sophomorix's wiki</a> about it." class="alert alert-info">
</Translated> <table class="lm-table lm-table-padded">
<tbody>
<tr>
<th width="40%">
</th> <Translated tag="th" text="students.csv" class="text-center">
</Translated> <Translated tag="th" text="teachers.csv" class="text-center">
</Translated> <Translated tag="th" text="extrastudents.csv" class="text-center">
</Translated> </tr> <tr>
<td>
<Translated tag="label" text="Path to filter script">
</Translated>
</td> <td class="text-center">
<input v-model.trim="s.settings['userfile.students.csv']['FILTERSCRIPT']" type="text" class="form-control" @blur="s.filterscriptNotEmpty()">
</td> <td class="text-center">
<input v-model.trim="s.settings['userfile.teachers.csv']['FILTERSCRIPT']" type="text" class="form-control" @blur="s.filterscriptNotEmpty()">
</td> <td class="text-center">
<input v-model.trim="s.settings['userfile.extrastudents.csv']['FILTERSCRIPT']" type="text" class="form-control" @blur="s.filterscriptNotEmpty()">
</td>
</tr>

</tbody>
</table>
</div>
</template>

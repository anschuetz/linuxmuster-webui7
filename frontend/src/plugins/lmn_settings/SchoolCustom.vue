<script setup>
import { inject } from 'vue';
import Checkbox from './Checkbox.vue';
import Translated from './Translated.mjs';
defineProps(['s', 'customization']);
const aj = inject('aj');
</script>
<template>
<div v-if="s.custom">
<br> <div class="c13-field aj-theme-columns">
<div class="aj-theme-wide-third">
<Translated tag="label" text="Choose a role to configure">
</Translated> <select v-model="s.custom_fields_role_selector" class="form-control">
<Translated tag="option" text="Students" value="students">
</Translated> <Translated tag="option" text="Teachers" value="teachers">
</Translated> <Translated tag="option" text="School administrators" value="schooladministrators">
</Translated> <Translated tag="option" text="Global administrators" value="globaladministrators">
</Translated>
</select>
</div>
</div> <br> <hr> <Translated tag="h3" text="Teachers" v-show="s.custom_fields_role_selector === 'teachers'">
</Translated> <table class="table" v-show="s.custom_fields_role_selector === 'teachers'">
<tbody>
<tr>
<th>
</th> <Translated tag="th" text="Title" class="text-center">
</Translated> <Translated tag="th" text="Show in user details" class="text-center">
</Translated> <Translated tag="th" text="User can edit" class="text-center">
</Translated>
</tr> <tr>
<th>Proxy addresses</th> <td class="text-center">
<input v-model.trim="s.customModels.proxyAddresses['teachers']['title']" type="text" class="form-control">
</td> <td class="text-center">
<Checkbox v-model="s.customModels.proxyAddresses['teachers']['show']">
</Checkbox>
</td> <td class="text-center">
<Checkbox v-model="s.customModels.proxyAddresses['teachers']['editable']">
</Checkbox>
</td>
</tr> <template v-for="(n, index) in [1,2,3,4,5]" :key="index">
<tr>
<th>Custom {{ n }}</th> <td class="text-center">
<input v-model.trim="s.customModels.custom['teachers'][n]['title']" type="text" class="form-control">
</td> <td class="text-center">
<Checkbox v-model="s.customModels.custom['teachers'][n]['show']">
</Checkbox>
</td> <td class="text-center">
<Checkbox v-model="s.customModels.custom['teachers'][n]['editable']">
</Checkbox>
</td>
</tr>
</template> <template v-for="(m, index) in [1,2,3,4,5]" :key="index">
<tr>
<th>Custom Multi {{ m }}</th> <td class="text-center">
<input v-model.trim="s.customModels.customMulti['teachers'][m]['title']" type="text" class="form-control">
</td> <td class="text-center">
<Checkbox v-model="s.customModels.customMulti['teachers'][m]['show']">
</Checkbox>
</td> <td class="text-center">
<Checkbox v-model="s.customModels.customMulti['teachers'][m]['editable']">
</Checkbox>
</td>
</tr>
</template>

</tbody>
</table> <Translated tag="h3" text="Students" v-show="s.custom_fields_role_selector === 'students'">
</Translated> <table class="table" v-show="s.custom_fields_role_selector === 'students'">
<tbody>
<tr>
<th>
</th> <Translated tag="th" text="Title" class="text-center">
</Translated> <Translated tag="th" text="Show in user details" class="text-center">
</Translated> <Translated tag="th" text="User can edit" class="text-center">
</Translated>
</tr> <tr>
<th>Proxy addresses</th> <td class="text-center">
<input v-model.trim="s.customModels.proxyAddresses['students']['title']" type="text" class="form-control">
</td> <td class="text-center">
<Checkbox v-model="s.customModels.proxyAddresses['students']['show']">
</Checkbox>
</td> <td class="text-center">
<Checkbox v-model="s.customModels.proxyAddresses['students']['editable']">
</Checkbox>
</td>
</tr> <template v-for="(n, index) in [1,2,3,4,5]" :key="index">
<tr>
<th>Custom {{ n }}</th> <td class="text-center">
<input v-model.trim="s.customModels.custom['students'][n]['title']" type="text" class="form-control">
</td> <td class="text-center">
<Checkbox v-model="s.customModels.custom['students'][n]['show']">
</Checkbox>
</td> <td class="text-center">
<Checkbox v-model="s.customModels.custom['students'][n]['editable']">
</Checkbox>
</td>
</tr>
</template> <template v-for="(m, index) in [1,2,3,4,5]" :key="index">
<tr>
<th>Custom Multi {{ m }}</th> <td class="text-center">
<input v-model.trim="s.customModels.customMulti['students'][m]['title']" type="text" class="form-control">
</td> <td class="text-center">
<Checkbox v-model="s.customModels.customMulti['students'][m]['show']">
</Checkbox>
</td> <td class="text-center">
<Checkbox v-model="s.customModels.customMulti['students'][m]['editable']">
</Checkbox>
</td>
</tr>
</template>

</tbody>
</table> <Translated tag="h3" text="School administrators" v-show="s.custom_fields_role_selector === 'schooladministrators'">
</Translated> <table class="table" v-show="s.custom_fields_role_selector === 'schooladministrators'">
<tbody>
<tr>
<th>
</th> <Translated tag="th" text="Title" class="text-center">
</Translated> <Translated tag="th" text="Show in user details" class="text-center">
</Translated> <Translated tag="th" text="User can edit" class="text-center">
</Translated>
</tr> <tr>
<th>Proxy addresses</th> <td class="text-center">
<input v-model.trim="s.customModels.proxyAddresses['schooladministrators']['title']" type="text" class="form-control">
</td> <td class="text-center">
<Checkbox v-model="s.customModels.proxyAddresses['schooladministrators']['show']">
</Checkbox>
</td> <td class="text-center">
<Checkbox v-model="s.customModels.proxyAddresses['schooladministrators']['editable']">
</Checkbox>
</td>
</tr> <template v-for="(n, index) in [1,2,3,4,5]" :key="index">
<tr>
<th>Custom {{ n }}</th> <td class="text-center">
<input v-model.trim="s.customModels.custom['schooladministrators'][n]['title']" type="text" class="form-control">
</td> <td class="text-center">
<Checkbox v-model="s.customModels.custom['schooladministrators'][n]['show']">
</Checkbox>
</td> <td class="text-center">
<Checkbox v-model="s.customModels.custom['schooladministrators'][n]['editable']">
</Checkbox>
</td>
</tr>
</template> <template v-for="(m, index) in [1,2,3,4,5]" :key="index">
<tr>
<th>Custom Multi {{ m }}</th> <td class="text-center">
<input v-model.trim="s.customModels.customMulti['schooladministrators'][m]['title']" type="text" class="form-control">
</td> <td class="text-center">
<Checkbox v-model="s.customModels.customMulti['schooladministrators'][m]['show']">
</Checkbox>
</td> <td class="text-center">
<Checkbox v-model="s.customModels.customMulti['schooladministrators'][m]['editable']">
</Checkbox>
</td>
</tr>
</template>

</tbody>
</table> <Translated tag="h3" text="Global administrators" v-show="s.custom_fields_role_selector === 'globaladministrators'">
</Translated> <table class="table" v-show="s.custom_fields_role_selector === 'globaladministrators'">
<tbody>
<tr>
<th>
</th> <Translated tag="th" text="Title" class="text-center">
</Translated> <Translated tag="th" text="Show in user details" class="text-center">
</Translated> <Translated tag="th" text="User can edit" class="text-center">
</Translated>
</tr> <tr>
<th>Proxy addresses</th> <td class="text-center">
<input v-model.trim="s.customModels.proxyAddresses['globaladministrators']['title']" type="text" class="form-control">
</td> <td class="text-center">
<Checkbox v-model="s.customModels.proxyAddresses['globaladministrators']['show']">
</Checkbox>
</td> <td class="text-center">
<Checkbox v-model="s.customModels.proxyAddresses['globaladministrators']['editable']">
</Checkbox>
</td>
</tr> <template v-for="(n, index) in [1,2,3,4,5]" :key="index">
<tr>
<th>Custom {{ n }}</th> <td class="text-center">
<input v-model.trim="s.customModels.custom['globaladministrators'][n]['title']" type="text" class="form-control">
</td> <td class="text-center">
<Checkbox v-model="s.customModels.custom['globaladministrators'][n]['show']">
</Checkbox>
</td> <td class="text-center">
<Checkbox v-model="s.customModels.custom['globaladministrators'][n]['editable']">
</Checkbox>
</td>
</tr>
</template> <template v-for="(m, index) in [1,2,3,4,5]" :key="index">
<tr>
<th>Custom Multi {{ m }}</th> <td class="text-center">
<input v-model.trim="s.customModels.customMulti['globaladministrators'][m]['title']" type="text" class="form-control">
</td> <td class="text-center">
<Checkbox v-model="s.customModels.customMulti['globaladministrators'][m]['show']">
</Checkbox>
</td> <td class="text-center">
<Checkbox v-model="s.customModels.customMulti['globaladministrators'][m]['editable']">
</Checkbox>
</td>
</tr>
</template>

</tbody>
</table> <hr> <Translated tag="h3" text="Which custom values display on user's lists ?">
</Translated> <table class="table" v-show="['teachers', 'students'].indexOf(s.custom_fields_role_selector) >= 0">
<tbody>
<tr>
<th>
</th> <Translated tag="th" text="Teachers" class="text-center">
</Translated> <Translated tag="th" text="Students" class="text-center">
</Translated>
</tr> <template v-for="(d, index) in [1,2,3]" :key="index">
<tr>
<th>Custom Display {{ d }}</th> <td class="text-center">
<select v-model="s.customModels.customDisplay['teachers'][d]" class="form-control">
<option v-for="(x, optionIndex) in s.customDisplayOptions" :key="optionIndex" :value="x">{{ x }}</option>
</select>
</td> <td class="text-center">
<select v-model="s.customModels.customDisplay['students'][d]" class="form-control">
<option v-for="(x, optionIndex) in s.customDisplayOptions" :key="optionIndex" :value="x">{{ x }}</option>
</select>
</td>
</tr>
</template>

</tbody>
</table> <table class="table" v-show="['schooladministrators', 'globaladministrators'].indexOf(s.custom_fields_role_selector) >= 0">
<tbody>
<tr>
<th>
</th> <Translated tag="th" text="Global administrators" class="text-center">
</Translated> <Translated tag="th" text="School administrators" class="text-center">
</Translated>
</tr> <template v-for="(d, index) in [1,2,3]" :key="index">
<tr>
<th>Custom Display {{ d }}</th> <td class="text-center">
<select v-model="s.customModels.customDisplay['globaladministrators'][d]" class="form-control">
<option v-for="(x, optionIndex) in s.customDisplayOptions" :key="optionIndex" :value="x">{{ x }}</option>
</select>
</td> <td class="text-center">
<select v-model="s.customModels.customDisplay['schooladministrators'][d]" class="form-control">
<option v-for="(x, optionIndex) in s.customDisplayOptions" :key="optionIndex" :value="x">{{ x }}</option>
</select>
</td>
</tr>
</template>

</tbody>
</table>
</div>
</template>

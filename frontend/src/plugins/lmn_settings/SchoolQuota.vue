<script setup>
import { inject } from 'vue';
import Translated from './Translated.mjs';
defineProps(['s', 'customization']);
const aj = inject('aj');
</script>
<template>
<div>
<br> <Translated tag="h3" text="Quota">
</Translated> <table class="lm-table lm-table-padded">
<tbody>
<tr>
<th width="40%">
</th> <Translated tag="th" text="Students">
</Translated> <Translated tag="th" text="Teachers">
</Translated> <Translated tag="th" text="Schooladministrator">
</Translated>
</tr> <tr>
<td>
<Translated tag="label" text="Quota Default Global in MiB">
</Translated>
</td> <td>
<input v-model.number="s.settings['role.student']['QUOTA_DEFAULT_GLOBAL']" @input="if ($event.target.validity.badInput) s.settings['role.student']['QUOTA_DEFAULT_GLOBAL'] = undefined; else if ($event.target.value === '') s.settings['role.student']['QUOTA_DEFAULT_GLOBAL'] = null; else if ($event.target.validity.rangeUnderflow || $event.target.validity.rangeOverflow) s.settings['role.student']['QUOTA_DEFAULT_GLOBAL'] = undefined;" type="number" class="form-control">
</td> <td>
<input v-model.number="s.settings['role.teacher']['QUOTA_DEFAULT_GLOBAL']" @input="if ($event.target.validity.badInput) s.settings['role.teacher']['QUOTA_DEFAULT_GLOBAL'] = undefined; else if ($event.target.value === '') s.settings['role.teacher']['QUOTA_DEFAULT_GLOBAL'] = null; else if ($event.target.validity.rangeUnderflow || $event.target.validity.rangeOverflow) s.settings['role.teacher']['QUOTA_DEFAULT_GLOBAL'] = undefined;" type="number" class="form-control">
</td> <td>
<input v-model.number="s.settings['role.schooladministrator']['QUOTA_DEFAULT_GLOBAL']" @input="if ($event.target.validity.badInput) s.settings['role.schooladministrator']['QUOTA_DEFAULT_GLOBAL'] = undefined; else if ($event.target.value === '') s.settings['role.schooladministrator']['QUOTA_DEFAULT_GLOBAL'] = null; else if ($event.target.validity.rangeUnderflow || $event.target.validity.rangeOverflow) s.settings['role.schooladministrator']['QUOTA_DEFAULT_GLOBAL'] = undefined;" type="number" class="form-control">
</td>
</tr> <tr>
<td>
<Translated tag="label" text="Quota Default School in MiB">
</Translated>
</td> <td>
<input v-model.number="s.settings['role.student']['QUOTA_DEFAULT_SCHOOL']" @input="if ($event.target.validity.badInput) s.settings['role.student']['QUOTA_DEFAULT_SCHOOL'] = undefined; else if ($event.target.value === '') s.settings['role.student']['QUOTA_DEFAULT_SCHOOL'] = null; else if ($event.target.validity.rangeUnderflow || $event.target.validity.rangeOverflow) s.settings['role.student']['QUOTA_DEFAULT_SCHOOL'] = undefined;" type="number" class="form-control">
</td> <td>
<input v-model.number="s.settings['role.teacher']['QUOTA_DEFAULT_SCHOOL']" @input="if ($event.target.validity.badInput) s.settings['role.teacher']['QUOTA_DEFAULT_SCHOOL'] = undefined; else if ($event.target.value === '') s.settings['role.teacher']['QUOTA_DEFAULT_SCHOOL'] = null; else if ($event.target.validity.rangeUnderflow || $event.target.validity.rangeOverflow) s.settings['role.teacher']['QUOTA_DEFAULT_SCHOOL'] = undefined;" type="number" class="form-control">
</td> <td>
<input v-model.number="s.settings['role.schooladministrator']['QUOTA_DEFAULT_SCHOOL']" @input="if ($event.target.validity.badInput) s.settings['role.schooladministrator']['QUOTA_DEFAULT_SCHOOL'] = undefined; else if ($event.target.value === '') s.settings['role.schooladministrator']['QUOTA_DEFAULT_SCHOOL'] = null; else if ($event.target.validity.rangeUnderflow || $event.target.validity.rangeOverflow) s.settings['role.schooladministrator']['QUOTA_DEFAULT_SCHOOL'] = undefined;" type="number" class="form-control">
</td>
</tr> <tr>
<td>
<Translated tag="label" text="Cloudquota Percentage">
</Translated>
</td> <td>
<input v-model.number="s.settings['role.student']['CLOUDQUOTA_PERCENTAGE']" @input="if ($event.target.validity.badInput) s.settings['role.student']['CLOUDQUOTA_PERCENTAGE'] = undefined; else if ($event.target.value === '') s.settings['role.student']['CLOUDQUOTA_PERCENTAGE'] = null; else if ($event.target.validity.rangeUnderflow || $event.target.validity.rangeOverflow) s.settings['role.student']['CLOUDQUOTA_PERCENTAGE'] = undefined;" type="number" class="form-control">
</td> <td>
<input v-model.number="s.settings['role.teacher']['CLOUDQUOTA_PERCENTAGE']" @input="if ($event.target.validity.badInput) s.settings['role.teacher']['CLOUDQUOTA_PERCENTAGE'] = undefined; else if ($event.target.value === '') s.settings['role.teacher']['CLOUDQUOTA_PERCENTAGE'] = null; else if ($event.target.validity.rangeUnderflow || $event.target.validity.rangeOverflow) s.settings['role.teacher']['CLOUDQUOTA_PERCENTAGE'] = undefined;" type="number" class="form-control">
</td> <td>
<input v-model.number="s.settings['role.schooladministrator']['CLOUDQUOTA_PERCENTAGE']" @input="if ($event.target.validity.badInput) s.settings['role.schooladministrator']['CLOUDQUOTA_PERCENTAGE'] = undefined; else if ($event.target.value === '') s.settings['role.schooladministrator']['CLOUDQUOTA_PERCENTAGE'] = null; else if ($event.target.validity.rangeUnderflow || $event.target.validity.rangeOverflow) s.settings['role.schooladministrator']['CLOUDQUOTA_PERCENTAGE'] = undefined;" type="number" class="form-control">
</td>
</tr> <tr>
<td>
<Translated tag="label" text="Mailquota Default in MiB">
</Translated>
</td> <td>
<input v-model.number="s.settings['role.student']['MAILQUOTA_DEFAULT']" @input="if ($event.target.validity.badInput) s.settings['role.student']['MAILQUOTA_DEFAULT'] = undefined; else if ($event.target.value === '') s.settings['role.student']['MAILQUOTA_DEFAULT'] = null; else if ($event.target.validity.rangeUnderflow || $event.target.validity.rangeOverflow) s.settings['role.student']['MAILQUOTA_DEFAULT'] = undefined;" type="number" class="form-control">
</td> <td>
<input v-model.number="s.settings['role.teacher']['MAILQUOTA_DEFAULT']" @input="if ($event.target.validity.badInput) s.settings['role.teacher']['MAILQUOTA_DEFAULT'] = undefined; else if ($event.target.value === '') s.settings['role.teacher']['MAILQUOTA_DEFAULT'] = null; else if ($event.target.validity.rangeUnderflow || $event.target.validity.rangeOverflow) s.settings['role.teacher']['MAILQUOTA_DEFAULT'] = undefined;" type="number" class="form-control">
</td> <td>
<input v-model.number="s.settings['role.schooladministrator']['MAILQUOTA_DEFAULT']" @input="if ($event.target.validity.badInput) s.settings['role.schooladministrator']['MAILQUOTA_DEFAULT'] = undefined; else if ($event.target.value === '') s.settings['role.schooladministrator']['MAILQUOTA_DEFAULT'] = null; else if ($event.target.validity.rangeUnderflow || $event.target.validity.rangeOverflow) s.settings['role.schooladministrator']['MAILQUOTA_DEFAULT'] = undefined;" type="number" class="form-control">
</td>
</tr>

</tbody>
</table>
</div>
</template>

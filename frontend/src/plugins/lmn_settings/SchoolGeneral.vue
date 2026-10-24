<script setup>
import { inject } from 'vue';
import Translated from './Translated.mjs';
defineProps(['s', 'customization']);
const aj = inject('aj');
</script>
<template>
<div>
<br> <Translated tag="h3" text="General">
</Translated> <table class="lm-table lm-table-padded">
<tbody>
<tr>
<td width="25%">
<Translated tag="label" text="Schoolname">
</Translated>
</td> <td>
<input v-model.trim="s.settings.school.SCHOOL_LONGNAME" type="text" class="form-control">
</td>
</tr>

</tbody>
</table> <Translated tag="h3" text="Email Domain">
</Translated> <table class="lm-table lm-table-padded">
<tbody>
<tr>
<td width="25%">
<Translated tag="label" text="Role Students">
</Translated>
</td> <td>
<input v-model.trim="s.settings['role.student']['MAILDOMAIN']" type="text" class="form-control" :placeholder="aj.gettext('e.g.: linuxmuster.net')">
</td>
</tr> <tr>
<td>
<Translated tag="label" text="Role Teachers">
</Translated>
</td> <td>
<input v-model.trim="s.settings['role.teacher']['MAILDOMAIN']" type="text" class="form-control" :placeholder="aj.gettext('e.g.: linuxmuster.net')">
</td>
</tr> <tr>
<td>
<Translated tag="label" text="Primary Group Adminclass">
</Translated>
</td> <td>
<input v-model.trim="s.settings['type.adminclass']['MAILDOMAIN']" type="text" class="form-control" :placeholder="aj.gettext('e.g.: linuxmuster.net')">
</td>
</tr> <tr>
<td>
<Translated tag="label" text="Primary Group Teacherclass">
</Translated>
</td> <td>
<input v-model.trim="s.settings['type.teacherclass']['MAILDOMAIN']" type="text" class="form-control" :placeholder="aj.gettext('e.g.: linuxmuster.net')">
</td>
</tr> <tr>
<td>
<Translated tag="label" text="Primary Group Project">
</Translated>
</td> <td>
<input v-model.trim="s.settings['type.project']['MAILDOMAIN']" type="text" class="form-control" :placeholder="aj.gettext('e.g.: linuxmuster.net')">
</td>
</tr>

</tbody>
</table> <Translated tag="h3" text="Printserver">
</Translated> <table class="lm-table lm-table-padded">
<tbody>
<tr>
<td width="25%">
<Translated tag="label" text="Printserver">
</Translated>
</td> <td>
<input v-model.trim="s.settings.school.PRINTSERVER" type="text" class="form-control" :placeholder="aj.gettext('default: server')">
</td>
</tr>

</tbody>
</table>
</div>
</template>

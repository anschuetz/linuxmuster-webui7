<script setup>
import { inject } from 'vue';
import Translated from './Translated.mjs';
defineProps(['s', 'customization']);
const aj = inject('aj');
</script>
<template>
<div v-if="s.allowed_roles">
<br> <Translated tag="p" text="This tab allow you to configure which roles are allowed to login into the Webui" class="alert alert-info">
</Translated> <table class="table">
<tbody>
<tr>
<Translated tag="th" text="Role">
</Translated> <Translated tag="th" text="Allowed ?">
</Translated>
</tr> <template v-for="(role, index) in s.all_roles" :key="index">
<tr>
<td>{{ role }}</td> <td v-show="role === 'globaladministrator'">
<input v-model="s.allowed_roles[role]" type="checkbox" disabled>
</td> <td v-show="role !== 'globaladministrator'">
<input v-model="s.allowed_roles[role]" type="checkbox">
</td>
</tr>
</template>

</tbody>
</table>
</div>
</template>

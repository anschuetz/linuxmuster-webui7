<script setup>
import { inject } from 'vue';
import Translated from './Translated.mjs';
defineProps(['s', 'customization']);
const aj = inject('aj');
</script>
<template>
<div v-if="s.LMNVersion">
<br> <table class="table">
<tbody>
<tr>
<Translated tag="th" text="Package">
</Translated> <Translated tag="th" text="Version">
</Translated>
</tr> <template v-for="(version, packageName, index) in s.LMNVersion" :key="index">
<tr>
<td>{{ packageName }}</td> <td>
<span class="label label-success">{{ version }}</span>
</td>
</tr>
</template>

</tbody>
</table>
</div>
</template>

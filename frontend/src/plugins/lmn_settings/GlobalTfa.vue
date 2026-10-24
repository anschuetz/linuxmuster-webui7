<script setup>
import { inject } from 'vue';
import Translated from './Translated.mjs';
defineProps(['s', 'customization']);
const aj = inject('aj');
</script>
<template>
<div v-if="s.tfaList">
<br> <table class="table">
<tbody>
<tr>
<Translated tag="th" text="User">
</Translated> <Translated tag="th" text="Description">
</Translated> <Translated tag="th" text="Created">
</Translated> <th>
</th>
</tr> <template v-for="(tfa, index) in s.tfaList" :key="index">
<tr>
<td>{{ tfa.user }}<br>
<span class="badge badge-info">{{ tfa.provider }}</span>
</td> <td>{{ tfa.desc }}</td> <td>{{ s.formatTfaDate(tfa.created*1000) }}</td> <td>
<a @click="s.deleteTfa(tfa)" class="btn btn-default">
<i class="fa fa-trash">
</i>
</a>
</td>
</tr>
</template>

</tbody>
</table>
</div>
</template>

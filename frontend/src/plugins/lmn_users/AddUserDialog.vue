<script setup>
import { inject, ref } from 'vue';
import { newListUser } from './lists.mjs';
const props = defineProps({ kind: String });
const emit = defineEmits(['close', 'cancel']);
const aj = inject('aj'), user = ref(newListUser(props.kind));
const labels = { class: props.kind === 'staff' ? 'Category:' : 'Schoolclass:', last_name: 'Last name:', first_name: 'First name:', birthday: 'Birthday:', id: 'Student-ID:', login: 'Desired Login:' };
const fields = [...(['students', 'extrastudents', 'staff'].includes(props.kind) ? ['class'] : []), 'last_name', 'first_name', ...(!['parents', 'staff'].includes(props.kind) ? ['birthday'] : []), ...(props.kind === 'students' ? ['id'] : []), ...(['teachers', 'extrastudents'].includes(props.kind) ? ['login'] : [])];
function add() { const { role, ...row } = user.value; emit('close',row); }
</script>
<template>
    <div class="modal-header"><h3>{{ aj.gettext('Add user') }} ({{ user.role }})</h3></div>
    <div class="modal-body"><form class="c11-form" @submit.prevent><table class="table"><tbody>
        <tr v-for="key in fields" :key="key"><td>{{ aj.gettext(labels[key]) }}<input v-model.trim="user[key]" :name="key" type="text" class="form-control"></td></tr>
    </tbody></table></form></div>
    <div class="modal-footer"><button class="btn btn-light c11-button" data-action="add" @click="add">{{ aj.gettext('Add') }}</button><button class="btn btn-light c11-button" data-action="cancel" @click="emit('cancel')">{{ aj.gettext('Cancel') }}</button></div>
</template>

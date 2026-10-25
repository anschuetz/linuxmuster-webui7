<script setup>
import { inject, onMounted, onBeforeUnmount, ref } from 'vue';
const props = defineProps({ username: { type: String, required: true } });
const emit = defineEmits(['close']);
const aj = inject('aj');
const password = ref(), status = ref(''), color = ref('');
let active = true;
onBeforeUnmount(() => { active = false; password.value = undefined; });
onMounted(() => {
    const user = props.username.replace('-exam', '');
    aj.http.get(`/api/lmn/users/passwords/${user}`).then(response => {
        if (active) password.value = response.data;
    }).catch(() => { if (active) aj.notify.error(aj.gettext('Error, please verify the user and/or your values.')); });
    if (user === props.username) aj.http.get(`/api/lmn/users/${user}/first-password-set`).then(response => {
        if (!active) return;
        status.value = response.data === true ? 'Still Set' : 'Changed from user';
        color.value = response.data === true ? 'green' : 'red';
    }).catch(() => { if (active) aj.notify.error(aj.gettext('Error, please verify the user and/or your values.')); });
});
</script>
<template>
    <div class="modal-header"><h3 class="modal-title common-user-title">{{ $gettext('Password Information') }}</h3></div>
    <div v-if="password == null" class="spinner" role="status"><i class="fa fa-circle-o-notch fa-spin"></i></div>
    <div v-else style="padding:0 20px">
        <br><table class="table"><tbody>
            <tr><td><b>{{ $gettext('Loginname:') }}</b></td><td>{{ username }}</td><td></td></tr>
            <tr>
                <td><b>{{ $gettext('Password:') }}</b></td>
                <td class="password">{{ password }}</td>
                <td><span :style="{color}">{{ $gettext(status) }}</span></td>
            </tr>
        </tbody></table>
        <div class="modal-footer"><a class="btn btn-light common-user-button btn-flat" @click="emit('close')">{{ $gettext('Close') }}</a></div>
    </div>
</template>

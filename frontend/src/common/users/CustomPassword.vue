<script setup>
import { computed, inject, onBeforeUnmount, ref } from 'vue';
const props = defineProps({ users: { type: [Array, Object], required: true }, pwtype: String });
const emit = defineEmits(['close']);
const aj = inject('aj');
const users = computed(() => Array.isArray(props.users) ? props.users : [props.users]);
// AngularJS input[type=password] never trims (input.js v1.8.3:72–74).
const password = ref('');
const label = computed(() => aj.gettext('Enter new {{action}} password for user:').replace('{{action}}', ''));
let active = true;
onBeforeUnmount(() => { active = false; password.value = ''; });
async function save() {
    if (!password.value) { aj.notify.error(aj.gettext('You have to enter a password')); return; }
    const usernames = users.value.flatMap(user => user.sAMAccountName).join(',').trim();
    const type = props.pwtype === 'current' ? 'current' : 'first';
    try {
        await aj.http.post(`/api/lmn/users/passwords/set-${type}`, { users: usernames, password: password.value });
        aj.notify.success(aj.gettext('New password set'), undefined, { sticky: true });
        if (active) emit('close');
    } catch (error) {
        aj.notify.error(aj.gettext('Password change failed: ') + (error.data?.message ?? ''), undefined, { sticky: true });
    }
}
</script>
<template>
    <div class="modal-header"><h3 class="modal-title common-user-title">{{ $gettext('Change Password') }}</h3></div>
    <div class="modal-body scrollable" style="height:200px">
        <div class="common-user-field mb-3"><label>{{ label }}</label>
            <ul v-for="(user, i) in users" :key="i"><li>{{ user.givenName }} {{ user.sn }} <b><i>{{ user.sAMAccountName }}</i></b> {{ user.sophomorixAdminClass }}</li></ul>
        </div>
        <input v-model="password" type="password" class="form-control" placeholder="Password" @keyup.enter="save">
        <br><p>{{ $gettext('Note: Minimal length is 7 characters. Use upper, lower and special characters or numbers. (e.g. Muster!)') }}</p><br>
    </div>
    <div class="modal-footer"><a class="btn btn-light common-user-button btn-flat" @click="emit('close')">{{ $gettext('Cancel') }}</a><a class="btn btn-light common-user-button btn-flat" @click="save">{{ $gettext('Accept') }}</a></div>
</template>

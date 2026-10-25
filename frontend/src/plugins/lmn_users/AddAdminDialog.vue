<script setup>
import { computed, inject, ref } from 'vue';
import { createAdmins } from './admins.mjs';
const props = defineProps({ role: { type: String, required: true } });
const emit = defineEmits(['cancel']);
const aj = inject('aj'), api = createAdmins(aj), username = ref();
const valid = computed(() => !username.value || /^[a-z0-9\-_]*$/.test(username.value));
function save() {
    if (!valid.value) return;
    if (!username.value) { aj.notify.error(aj.gettext('You have to enter a username')); return; }
    void api.add(props.role, username.value);
    emit('cancel');
}
</script>
<template>
    <div class="modal-header"><h3>{{ aj.gettext('Add Administrator') }}</h3></div>
    <div class="modal-body scrollable" style="height:200px"><div class="c11-form"><form @submit.prevent><label> New {{ role }}: </label><input id="username" v-model.trim="username" name="username" class="form-control" placeholder="username"><p v-if="!valid" style="color:red;margin-top:10px">{{ aj.gettext('Please only use lowercase characters, digits, hyphen or underscore.') }}</p></form></div></div>
    <div class="modal-footer"><a class="btn btn-light c11-button btn-flat" data-action="cancel" @click="emit('cancel')">{{ aj.gettext('Cancel') }}</a><a class="btn btn-light c11-button btn-flat" data-action="save" :disabled="!valid ? 'disabled' : undefined" @click="save">{{ aj.gettext('Accept') }}</a></div>
</template>

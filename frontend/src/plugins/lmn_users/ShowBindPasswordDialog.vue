<script setup>
import { inject, onBeforeUnmount, ref } from 'vue';
const props = defineProps({ user: { type: Object, required: true } });
const emit = defineEmits(['close']);
const aj = inject('aj'), password = ref(null);
let alive = true;
onBeforeUnmount(() => { alive = false; });
aj.http.get(`/api/lmn/users/${props.user.sAMAccountName}/bindpassword`).then(({ data }) => { if (alive) password.value = data; }).catch(() => { /* Preserve loading on failure. */ });
async function copy() {
    try { await navigator.clipboard.writeText(password.value); aj.notify.success(aj.gettext('Copied to clipboard!')); }
    catch { /* Original has no clipboard failure toast. */ }
}
</script>
<template>
    <div class="modal-header"><h3>{{ aj.gettext('Show bind user password') }}</h3></div>
    <div v-if="password == null" class="progress-spinner" role="status"><i class="fa fa-spinner fa-spin"></i></div>
    <div v-else style="padding:0 20px"><br><p><b>{{ aj.gettext('Loginname:') }}</b> {{ user.sAMAccountName }}</p><input type="text" readonly class="form-control" style="font-family:monospace" :value="password" @click="$event.target.select()"></div>
    <div class="modal-footer"><a v-if="password != null" class="btn btn-light c11-button btn-flat" data-action="copy" @click="copy"><i class="fa fa-copy"></i> {{ aj.gettext('Copy') }}</a><a class="btn btn-light c11-button btn-flat" data-action="close" @click="emit('close')">{{ aj.gettext('Close') }}</a></div>
</template>

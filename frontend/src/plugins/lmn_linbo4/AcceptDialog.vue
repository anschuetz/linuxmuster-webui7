<script setup>
import { inject } from 'vue';
const props = defineProps({ partition: String, disk: Object });
const emit = defineEmits(['close', 'cancel']);
const aj = inject('aj');
const message = () => aj.gettext('Remove Partition {{partition}}').replace('{{partition}}', props.partition);
</script>
<template>
    <div class="modal-header"><h4>{{ aj.gettext('Remove Partition?') }}</h4></div>
    <div class="modal-body">{{ message() }}</div>
    <div class="modal-footer">
        <button data-action="save" class="btn c9-button btn-flat" @click="emit('close', { response: 'accept' })">{{ aj.gettext('Remove') }}</button>
        <button data-action="cancel" class="btn c9-button btn-flat" @click="emit('cancel')">{{ aj.gettext('Cancel') }}</button>
    </div>
</template>

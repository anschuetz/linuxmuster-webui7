<script setup>
import { inject } from 'vue';
defineProps({ path: String, lines: { type: Array, required: true } });
const emit = defineEmits(['cancel']);
const aj = inject('aj');
const colors = { '>': 'red', '<': 'green', '@': 'blue' };
</script>
<template>
    <div class="modal-header"><h4>{{ aj.gettext('Differences') }} · {{ path }}</h4></div>
    <div class="modal-body">
        <p v-if="!lines.length" class="alert alert-info">{{ aj.gettext('No differences detected') }}</p>
        <pre v-for="(line, index) in lines" :key="index" :style="{ color: colors[line[0]] }">{{ line }}</pre>
    </div>
    <div class="modal-footer"><button class="btn btn-default" @click="emit('cancel')">{{ aj.gettext('Close') }}</button></div>
</template>

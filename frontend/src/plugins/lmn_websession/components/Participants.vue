<script setup>
import { inject } from 'vue';
defineProps({ participants: Array });
const aj = inject('aj');
</script>
<template>
    <div class="modal-header"><h4>{{ aj.gettext('Participants') }}</h4></div>
    <div class="modal-body"><table class="table table-hover"><tbody><tr v-for="(participant, index) in participants" :key="index"><td>{{ participant }}</td></tr></tbody></table></div>
</template>

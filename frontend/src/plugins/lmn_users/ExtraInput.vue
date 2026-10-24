<script setup>
import { ref, watch } from 'vue';
const props = defineProps({ value: String, type: String, placeholder: String });
const emit = defineEmits(['commit']);
const draft = ref(props.value ?? '');
watch(() => props.value, value => { draft.value = value ?? ''; });
</script>
<template>
    <input v-if="type === 'password'" v-model="draft" type="password" :placeholder="placeholder" class="form-control" @blur="emit('commit',draft)">
    <input v-else v-model.trim="draft" :type="type" :placeholder="placeholder" class="form-control" @blur="emit('commit',draft)">
</template>

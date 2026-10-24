<script setup>
import { computed, inject } from 'vue';
const props = defineProps({ modelValue: [String, Number, Boolean], label: String, type: { type: String, default: 'text' }, options: Array });
const emit = defineEmits(['update:modelValue']);
const aj = inject('aj');
const value = computed({ get: () => props.modelValue, set: value => emit('update:modelValue', props.type === 'number' && value === '' ? null : value) });
</script>
<template>
    <label class="form-group">
        {{ aj.gettext(label) }}
        <select v-if="options" v-model="value" class="form-control" :aria-label="aj.gettext(label)">
            <option v-for="option in options" :key="option.id ?? option" :value="option.id ?? option">{{ option.name ?? option }}</option>
        </select>
        <input v-else-if="type === 'checkbox'" v-model="value" type="checkbox" :aria-label="aj.gettext(label)">
        <input v-else-if="type === 'password'" v-model="value" type="password" class="form-control" :aria-label="aj.gettext(label)">
        <input v-else-if="type === 'number'" v-model.number="value" type="number" class="form-control" :aria-label="aj.gettext(label)">
        <input v-else v-model.trim="value" type="text" class="form-control" :aria-label="aj.gettext(label)">
    </label>
</template>

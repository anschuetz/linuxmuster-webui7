<script setup>
import CodeEditor from '../../common/CodeEditor.vue';
defineProps({ modelValue: String, field: String, active: Boolean });
const emit = defineEmits(['update:modelValue']);
</script>
<template>
    <CodeEditor :model-value="modelValue" :active="active" :data-model="'image.' + field" style="min-height:100px"
                @update:model-value="emit('update:modelValue', $event)" />
</template>

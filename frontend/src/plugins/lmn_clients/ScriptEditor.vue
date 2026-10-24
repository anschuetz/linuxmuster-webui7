<script setup>
import CodeEditor from '../../common/CodeEditor.vue';
defineProps({ content: { type: String, required: true } });
const emit = defineEmits(['update']);
</script>
<template>
    <CodeEditor :model-value="content" style="min-height:200px" @update:model-value="emit('update', $event)" />
</template>

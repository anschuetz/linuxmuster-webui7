<script setup>
defineProps(['modelValue', 'text']);
defineEmits(['update:modelValue']);
</script>
<template>
    <span checkbox :class="{ active: modelValue }" @click="$emit('update:modelValue', !modelValue)"><i class="fa fa-square-o off"></i><i class="fa fa-check-square on"></i> {{ text }}</span>
</template>

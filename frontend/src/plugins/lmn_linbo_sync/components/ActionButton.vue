<script setup>
defineProps({ icon: String, label: String, checked: Boolean });
// The Angular translate keys include the nested checkbox and do not match the
// catalog. The old-UI oracle confirms these labels remain English in German.
</script>
<template>
    <button type="button" class="btn" style="margin-left:10px;">
        <i :class="icon"></i> {{ label }}
        <input type="checkbox" class="float-end" :checked="checked">
    </button>
</template>

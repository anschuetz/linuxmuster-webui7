<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
const props = defineProps({ modelValue: String, field: String, active: Boolean });
const emit = defineEmits(['update:modelValue']);
const host = ref(null);
const hasAce = Boolean(window.ace);
let editor;
onMounted(() => {
    if (!hasAce) return;
    window.ace.config.set('basePath', '/resources/ace/resources/vendor/ace-builds/src-min-noconflict');
    editor = window.ace.edit(host.value);
    editor.$blockScrolling = Infinity;
    editor.setOptions({ theme: 'ace/theme/solarized_dark', autoScrollEditorIntoView: true, fontSize: '12px', maxLines: Infinity, scrollPastEnd: true, showGutter: true });
    editor.getSession().setUseWrapMode(true);
    editor.setValue(props.modelValue || '', -1);
    editor.on('change', () => emit('update:modelValue', editor.getValue()));
});
watch(() => props.modelValue, value => {
    if (editor && editor.getValue() !== (value || '')) editor.setValue(value || '', -1);
});
watch(() => props.active, () => editor?.resize(), { flush: 'post' });
onBeforeUnmount(() => editor?.destroy());
</script>

<template>
    <div v-if="hasAce" ref="host" :data-model="'image.' + field" style="min-height:100px"></div>
    <textarea v-else class="form-control" :data-model="'image.' + field" :value="modelValue" rows="8" @input="emit('update:modelValue', $event.target.value)"></textarea>
</template>

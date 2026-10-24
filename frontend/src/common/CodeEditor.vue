<script setup>
import { inject, onBeforeUnmount, onMounted, ref, watch } from 'vue';
const props = defineProps({
    modelValue: { type: String, default: '' }, path: String,
    options: { type: Object, default: () => ({}) }, aceOptions: { type: Object, default: () => ({}) },
    readonly: Boolean, active: Boolean,
});
const emit = defineEmits(['update:modelValue']);
const host = ref();
const aj = inject('aj', null);
const hasAce = Boolean(globalThis.ace?.edit);
let editor;
const changed = () => { if (!props.readonly) emit('update:modelValue', editor.getValue()); };
function configure() {
    editor.setOptions?.({ theme: 'ace/theme/solarized_dark', autoScrollEditorIntoView: true,
        fontSize: '12px', maxLines: Infinity, scrollPastEnd: true,
        showGutter: props.options.showGutter ?? true, ...props.aceOptions });
    (editor.getSession?.() || editor.session)?.setUseWrapMode(props.options.useWrapMode ?? true);
    editor.setReadOnly?.(props.readonly || Boolean(props.aceOptions.readOnly));
}
function mode() {
    if (!editor || !props.path) return;
    const modelist = globalThis.ace.require('ace/ext/modelist');
    (editor.getSession?.() || editor.session).setMode(modelist.getModeForPath(props.path).mode);
}
onMounted(() => {
    if (!hasAce) return;
    globalThis.ace.config?.set('basePath', `${aj?.prefix || ''}/resources/ace/resources/vendor/ace-builds/src-min-noconflict`);
    editor = globalThis.ace.edit(host.value);
    editor.$blockScrolling = Infinity;
    configure();
    editor.setValue(props.modelValue, -1);
    editor.on('change', changed);
    mode();
    editor.resize?.();
});
watch(() => props.modelValue, value => { if (editor && editor.getValue() !== value) editor.setValue(value, -1); });
watch(() => [props.readonly, props.options, props.aceOptions], () => { if (editor) configure(); }, { deep: true });
watch(() => props.path, mode);
watch(() => props.active, () => editor?.resize?.(), { flush: 'post' });
onBeforeUnmount(() => { editor?.off?.('change', changed); editor?.destroy(); });
</script>
<template>
    <div v-if="hasAce" ref="host" class="block-element" :class="{ 'full-screen': options.fullScreen }" :style="{ height: options.height, minHeight: options.fullScreen ? '100vh' : undefined }"></div>
    <textarea v-else :value="modelValue" :readonly="readonly || aceOptions.readOnly" class="form-control" rows="15"
              @input="emit('update:modelValue', $event.target.value)"></textarea>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';

const props = defineProps({ content: { type: String, required: true } });
const emit = defineEmits(['update']);
const host = ref(null);
const hasAce = Boolean(window.ace?.edit);
let editor;
const changed = () => emit('update', editor.getValue());
onMounted(() => {
    if (!hasAce) return;
    window.ace.config.set('basePath', '/resources/ace/resources/vendor/ace-builds/src-min-noconflict');
    editor = window.ace.edit(host.value);
    editor.setOptions({ theme: 'ace/theme/solarized_dark', autoScrollEditorIntoView: true,
        fontSize: '12px', maxLines: Infinity, scrollPastEnd: true, showGutter: true });
    editor.session.setUseWrapMode(true);
    editor.setValue(props.content, -1);
    editor.on('change', changed);
});
onBeforeUnmount(() => {
    editor?.off('change', changed);
    editor?.destroy();
});
</script>

<template>
    <div v-if="hasAce" ref="host" style="min-height:200px"></div>
    <textarea v-else :value="content" class="form-control" rows="15" @input="emit('update', $event.target.value)"></textarea>
</template>

<script setup>
import { computed, inject, nextTick, onMounted, onUnmounted, ref } from 'vue';

const props = defineProps({
    path: { type: String, required: true },
    lines: { type: Number, default: undefined },
});
/** @type {import('../adapter/aj.mjs').Aj} */
const aj = inject('aj');
const content = ref('');
const autoscroll = ref(true);
const log = ref(null);
const visibleContent = computed(() => {
    if (!props.lines) return content.value;
    const lines = content.value.split('\n');
    const complete = lines.at(-1) === '' ? lines.slice(0, -1) : lines;
    return complete.slice(-props.lines).join('\n');
});
let interval;
let active = false;

async function poll() {
    try {
        const { data } = await aj.http.get(`/api/lmn/log${props.path}?offset=${content.value.length}`);
        if (!active) return;
        content.value += data;
        await nextTick();
        if (active && autoscroll.value) log.value.scrollTop = log.value.scrollHeight;
    } catch {
        // The adapter's HTTP interceptor displays backend errors; retry next tick.
    }
}
onMounted(() => {
    active = true;
    interval = setInterval(poll, 1000);
});
onUnmounted(() => {
    active = false;
    clearInterval(interval);
});
</script>

<template>
    <pre ref="log" style="max-height: 300px; overflow-y: scroll">{{ visibleContent }}</pre>
    <div class="form-group">
        <label>{{ aj.gettext('Options') }}</label><br>
        <label><input v-model="autoscroll" type="checkbox"> {{ aj.gettext('Autoscroll') }}</label>
    </div>
</template>

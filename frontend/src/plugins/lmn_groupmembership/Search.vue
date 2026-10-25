<script setup>
import { inject, onBeforeUnmount, ref, watch } from 'vue';
const props = defineProps({ kind: String, groupName: String, resetKey: Number });
const emit = defineEmits(['select', 'no-results']);
const aj = inject('aj');
const query = ref(''), results = ref([]), selected = ref(0);
let version = 0;
onBeforeUnmount(() => { version += 1; });
watch(() => props.resetKey, () => { version += 1; query.value = ''; results.value = []; });
watch(query, async (value) => {
    const current = ++version;
    results.value = []; selected.value = 0;
    if (value.length < (['user', 'teacher'].includes(props.kind) ? 3 : 2)) return;
    emit('no-results', false);
    try {
        const { data } = props.kind === 'user' ? await aj.http.post('/api/lmn/find/user', { name: value }) : await aj.http.get('/api/lmn/find/' + props.kind + '/' + value);
        if (current !== version) return;
        results.value = props.kind === 'group' ? data.filter((group) => group !== props.groupName) : data;
        emit('no-results', results.value.length === 0);
    } catch { if (current === version) emit('no-results', true); /* HTTP errors are reported by core. */ }
});
function blur() { version += 1; results.value = []; }
function choose(item) { version += 1; query.value = ''; results.value = []; emit('select', item); }
function key(event) {
    if (!results.value.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); selected.value = (selected.value + (event.key === 'ArrowDown' ? 1 : -1) + results.value.length) % results.value.length; }
    if (event.key === 'Enter' || event.key === 'Tab') { event.preventDefault(); choose(results.value[selected.value]); }
    if (event.key === 'Escape') { event.stopPropagation(); results.value = []; }
}
const placeholders = { user: 'Type a name or login', teacher: 'Type a name or login', usergroup: 'Type the class, e.g. 10a', group: 'Type the group name, e.g. p_wifi' };
</script>
<template>
    <div style="position:relative">
        <input v-model.trim="query" class="form-control" type="text" :placeholder="aj.gettext(placeholders[kind])" autocomplete="off" autofocus @keydown="key" @blur="blur">
        <ul v-if="results.length" class="dropdown-menu show c4-menu" role="listbox">
            <li v-for="(item, index) in results" :key="index" @mousedown.prevent="choose(item)"><a class="dropdown-item" :class="{ active: selected === index }" href="#" @click.prevent="choose(item)">{{ typeof item === 'string' ? item : item.label }}</a></li>
        </ul>
    </div>
</template>

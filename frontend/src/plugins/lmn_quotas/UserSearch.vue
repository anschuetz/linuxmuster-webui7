<script setup>
import { inject, ref, onBeforeUnmount } from 'vue';
const props = defineProps({ role: { type: String, required: true }, label: { type: String, default: '' } });
const emit = defineEmits(['select', 'query']);
const aj = inject('aj');
const query = ref('');
const results = ref([]);
const selected = ref(0);
let revision = 0;
onBeforeUnmount(() => { revision += 1; });
async function search(value) {
    query.value = value;
    const login = value.trim();
    emit('query');
    const current = ++revision;
    results.value = [];
    selected.value = 0;
    if (login.length < 3) return;
    try {
        const { data } = await aj.http.post('/api/lmn/ldap-search', { role: props.role, login });
        if (revision === current) results.value = data;
    } catch { /* The adapter reports HTTP errors; leave suggestions empty. */ }
}
function choose(user) {
    revision += 1;
    query.value = user.label;
    results.value = [];
    emit('select', user);
}
function key(event) {
    if (!results.value.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        selected.value = (selected.value + (event.key === 'ArrowDown' ? 1 : -1) + results.value.length) % results.value.length;
    } else if (event.key === 'Enter') {
        event.preventDefault();
        choose(results.value[selected.value]);
    } else if (event.key === 'Escape') results.value = [];
}
</script>
<template>
    <div style="position:relative">
        <input type="text" class="form-control" :value="query || label" :placeholder="aj.gettext('Search user by login, firstname or lastname (min. 3 chars)')" role="combobox" :aria-expanded="!!results.length" autocomplete="off" autofocus @input="search($event.target.value)" @keydown="key">
        <ul v-if="results.length" class="dropdown-menu" role="listbox" style="display:block">
            <li v-for="(user, index) in results" :key="index" :class="{ active: index === selected }" role="option" :aria-selected="index === selected" @mousedown.prevent="choose(user)"><a href="" @click.prevent="choose(user)">{{ user.label }}</a></li>
        </ul>
    </div>
</template>

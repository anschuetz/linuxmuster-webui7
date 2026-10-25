<script setup>
import { ref, watch } from 'vue';
defineOptions({ inheritAttrs: false });
const props = defineProps(['modelValue', 'findUsers', 'placeholder']);
const emit = defineEmits(['update:modelValue']);
const query = ref(props.modelValue?.label || '');
const results = ref([]);
const shown = ref(false);
const active = ref(0);
watch(() => props.modelValue, user => { if (user !== undefined) query.value = user?.label || ''; });
async function search() {
    emit('update:modelValue', undefined);
    const current = query.value;
    if (current.length < 3) { results.value = []; shown.value = false; return; }
    try {
        const found = await props.findUsers(current);
        if (query.value === current) { results.value = found; shown.value = found.length > 0; active.value = 0; }
    } catch { results.value = []; shown.value = false; }
}
function select(user) { emit('update:modelValue', user); query.value = user.label; shown.value = false; }
function blur() { shown.value = false; if (!props.modelValue) query.value = ''; }
function move(delta) { if (shown.value) active.value = (active.value + delta + results.value.length) % results.value.length; }
</script>
<template>
    <div style="position: relative">
        <input v-model.trim="query" v-bind="$attrs" type="text" class="form-control" :placeholder="placeholder" @input="search" @blur="blur" @keydown.esc="shown = false" @keydown.down.prevent="move(1)" @keydown.up.prevent="move(-1)" @keydown.tab="shown && select(results[active])" @keydown.enter.prevent="shown && select(results[active])">
        <ul v-if="shown" role="listbox" class="dropdown-menu show c12-search">
            <li v-for="(user, index) in results" :key="index" role="option" @mouseenter="active = index" @mousedown.prevent="select(user)"><a class="dropdown-item" :class="{ active: active === index }">{{ user.label }}</a></li>
        </ul>
    </div>
</template>

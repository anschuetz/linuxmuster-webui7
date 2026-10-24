<script setup>
import { computed, ref } from 'vue';
const props = defineProps({ modelValue: String, groups: { type: Array, required: true } });
const emit = defineEmits(['update:modelValue']);
const open = ref(false);
const active = ref(0);
const matches = computed(() => props.modelValue ? props.groups.filter((group) => group.toLowerCase().includes(props.modelValue.toLowerCase())) : []);
const model = computed({ get: () => props.modelValue, set: (value) => emit('update:modelValue', value) });
function input() {
    active.value = 0;
    open.value = true;
}
function choose(group) {
    emit('update:modelValue', group);
    open.value = false;
}
function keydown(event) {
    if (!open.value || !matches.value.length) return;
    if (event.key === 'ArrowDown') active.value = (active.value + 1) % matches.value.length;
    else if (event.key === 'ArrowUp') active.value = (active.value + matches.value.length - 1) % matches.value.length;
    else if (event.key === 'Enter') choose(matches.value[active.value]);
    else if (event.key === 'Escape') open.value = false;
    else return;
    event.preventDefault();
    event.stopPropagation();
}
</script>
<template>
    <div style="position:relative">
        <input type="text" class="form-control" placeholder="Group" v-model.trim="model" role="combobox" :aria-expanded="open && matches.length > 0" autocomplete="off" @input="input" @keydown="keydown" @blur="open = false">
        <ul v-if="open && matches.length" class="dropdown-menu group-options" style="display:block" role="listbox">
            <li v-for="(group, index) in matches" :key="group" :class="{ active: active === index }" @mouseenter="active = index"><a role="option" :aria-selected="active === index" @mousedown.prevent="choose(group)">{{ group }}</a></li>
        </ul>
    </div>
</template>

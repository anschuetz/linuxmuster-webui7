<script setup>
import { managementGroups } from './exam.mjs';
const props = defineProps({ store: Object, api: Object, user: Object });
const icons = ['fas fa-wifi', 'fa fa-globe', 'fa fa-print'];
function classes(group) {
    const members = props.store.state.current.members, count = members.filter(u => u[group] === true).length;
    return { 'btn-lmn-success-inv': count === members.length, 'btn-lmn-danger-inv': count === 0, 'btn-light': count < members.length, 'c6-button': count < members.length };
}
async function toggle(group) {
    // The old ng:click sees the previous checkbox model; its directive toggles afterwards.
    const user = props.user, pending = props.api.setManagementGroup(group, user);
    props.store.replaceMembers(props.store.state.current.members.map(u => u === user ? { ...u, [group]: !user[group] } : u));
    try { await pending; } catch { /* Shell reports transport failures. */ }
}
async function all(group) { try { await props.api.setManagementGroupAll(group); } catch { /* Shell reports transport failures. */ } }
</script>
<template>
    <component :is="user ? 'td' : 'th'" v-for="(group, index) in managementGroups" :key="group" style="text-align:center" :width="user ? 1 : undefined">
        <input v-if="user" type="checkbox" :data-management="group" :data-management-wifi="group === 'wifi' ? '' : undefined" :data-management-internet="group === 'internet' ? '' : undefined" :data-management-printing="group === 'printing' ? '' : undefined" :checked="user[group]" :aria-label="group" @change="toggle(group)">
        <button v-else :data-management-all-wifi="group === 'wifi' ? '' : undefined" :data-management-all-internet="group === 'internet' ? '' : undefined" :data-management-all-printing="group === 'printing' ? '' : undefined" class="btn" :class="classes(group)" style="font-size:20px" :title="'Toggle ' + (group === 'printing' ? 'printer' : group) + ' for all'" @click="all(group)"><i :class="icons[index]"></i></button>
    </component>
</template>

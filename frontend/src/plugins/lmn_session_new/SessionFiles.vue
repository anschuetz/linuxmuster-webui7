<script setup>
import { computed, inject, ref } from 'vue';
import { isStudent } from './participants.mjs';
const props = defineProps({ store: Object, api: Object, user: Object });
const aj = inject('aj'), menu = ref(false);
const available = computed(() => !props.user || (isStudent(props.user) && !props.user.files_error && !(props.store.state.examViewGroups?.external ?? props.store.state.extExamUsers).includes(props.user)));
async function action(fn) {
    menu.value = false;
    try { await fn(); } catch { /* Modal cancellation and HTTP failures belong to the shell. */ }
}
</script>
<template>
    <span v-if="available" class="button-group" @focusout="event => { if (!event.currentTarget.contains(event.relatedTarget)) menu = false; }">
        <button :data-share-user="user ? '' : undefined" :data-share-all="!user ? '' : undefined" class="btn" :class="user ? 'btn-light c6-button active' : 'btn-lmn float-start'" @click="action(() => user ? api.shareUser(user) : api.shareAll())"><i class="fas fa-file-export"></i> {{ aj.gettext(user ? 'Share' : 'Share to all') }}</button>
        <span :class="[user ? 'dropdown' : 'dropup']" style="position:relative;display:inline-block">
            <button data-collect-toggle class="btn" :class="user ? 'btn-light c6-button active' : 'btn-lmn'" :aria-expanded="menu" @click="menu = !menu"><i class="fas fa-file-import"></i> {{ aj.gettext(user ? 'Collect' : 'Collect from all') }} <span class="dropdown-toggle aj-dropdown-marker"></span></button>
            <ul v-show="menu" class="dropdown-menu c6-menu" :class="{ show: menu, 'dropdown-menu-end': user }">
                <li v-for="operation in ['copy', 'move']" :key="operation"><a class="dropdown-item" href="" :data-collect-user-copy="user && operation === 'copy' ? '' : undefined" :data-collect-user-move="user && operation === 'move' ? '' : undefined" :data-collect-all-copy="!user && operation === 'copy' ? '' : undefined" :data-collect-all-move="!user && operation === 'move' ? '' : undefined" @click.prevent="action(() => user ? api.collectUser(operation, user) : api.collectAll(operation))"><i :class="operation === 'copy' ? 'fas fa-copy' : 'fas fa-cut'"></i> {{ aj.gettext(user ? (operation === 'copy' ? 'Copy' : 'Move') : (operation === 'copy' ? 'Copy _collect directory from all members' : 'Move _collect directory from all members')) }}</a></li>
            </ul>
        </span>
        <button v-if="!user" data-archive class="btn btn-lmn" @click="action(api.browseCollected)"><i class="fa-solid fa-file-arrow-down"></i> {{ aj.gettext('Browse collected files') }}</button>
    </span>
</template>

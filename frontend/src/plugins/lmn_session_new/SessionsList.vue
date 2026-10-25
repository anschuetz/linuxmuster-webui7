<script setup>
import { computed, inject, onUnmounted, ref, watch } from 'vue';
import { useSambaAccess } from '../../common/access.mjs';
import { getSessionStore } from './sessionStore.mjs';
import { createSessions, visibleGroups } from './sessions.mjs';
const noClasses = 'You are not member of any schoolclass. You can change your membership in the <a href="/view/lmn/groupmembership/">"Enroll" page</a>.';
const noProjects = `You don't own any project. You can create your project in the <a href="/view/lmn/groupmembership/">"Enroll" page</a>.`;
const aj = inject('aj'), store = getSessionStore(aj), api = createSessions(aj), allowed = useSambaAccess(aj);
const filter = ref(''), room = ref(), schoolclasses = ref(), projects = ref(), sessions = ref(), loading = ref(true);
let alive = true, generation = 0;
onUnmounted(() => { alive = false; generation += 1; });
aj.pageTitle.set(aj.gettext('Sessions list'));
async function loadRoom(token) {
    try { const { data } = await aj.http.get('/api/lmn/session/userInRoom'); if (alive && token === generation) { room.value = data; loading.value = false; } }
    catch { /* Existing HTTP interceptor owns request errors; keep loading as Angular does. */ }
}
async function loadLists(token = generation) {
    try { const data = await api.load(); if (alive && token === generation) [schoolclasses.value, projects.value, sessions.value] = data; }
    catch { /* No empty notices for unavailable lists. */ }
}
loadRoom(generation);
watch(() => aj.identity.user, (user, oldUser) => {
    if (oldUser !== undefined) {
        generation += 1; room.value = undefined; schoolclasses.value = undefined; projects.value = undefined; sessions.value = undefined;
        loading.value = true; loadRoom(generation);
    }
    if (user !== null && user !== undefined && user !== 'root') loadLists();
}, { immediate: true });
const sections = computed(() => [
    { key: 'room', title: 'This Room', items: room.value?.name !== '' ? [{ ...room.value, membersCount: room.value?.usersList?.length }] : [], image: 'room' },
    { key: 'schoolclass', title: 'My Classes', items: visibleGroups(schoolclasses.value, filter.value), image: 'classes' },
    { key: 'group', title: 'My groups', items: visibleGroups(sessions.value, filter.value, true), image: 'sessions' },
    { key: 'project', title: 'My projects', items: visibleGroups(projects.value, filter.value), image: 'classes' },
]);
async function act(action) {
    // Messagebox cancellation and HTTP errors already belong to the shell.
    try { await action(); } catch { /* No success changes on cancellation/failure. */ }
}
function start(item, type) {
    return act(() => type === 'group' ? store.start(item) : store.startGenerated(item.name, type === 'room' ? room.value.usersList : item.members, type));
}
function create(members) { return act(async () => { await api.new(members); await loadLists(); }); }
function rename(item) {
    return act(async () => {
        const name = await api.rename(item.sid, item.name);
        // Original also assigns undefined after an empty/invalid accepted prompt.
        if (alive) sessions.value = sessions.value.map(row => row === item ? { ...row, name } : row);
    });
}
function kill(item) {
    return act(async () => { await api.kill(item.sid, item.name); if (alive) sessions.value = sessions.value.filter(row => row !== item); });
}
</script>
<template>
    <br>
    <div v-if="allowed">
        <div class="input-group" style="width:100%"><input v-model.trim="filter" type="search" autofocus class="form-control" placeholder="Filter"></div>
        <br><div v-if="loading" role="status" class="progress-spinner"><i class="fa fa-spinner fa-spin"></i></div>
        <template v-for="(section, index) in sections" :key="section.key">
            <hr v-if="index">
            <div class="list-group">
                <button v-if="section.key === 'group'" class="btn btn-success float-end" @click="create()"><i class="fa fa-plus"></i> {{ aj.gettext('New group') }}</button>
                <h3 style="margin-bottom:30px">{{ aj.gettext(section.title) }}</h3>
                <div v-if="!loading && section.key === 'room' && room?.name === ''" class="alert alert-info">{{ aj.gettext("Currenty it's not possible to determine your room, are you logged on a school computer ?") }}</div>
                <div v-if="!loading && section.key === 'schoolclass' && schoolclasses?.length === 0" class="alert alert-info">
                    <span v-html="aj.gettext(noClasses)"></span>
                </div>
                <div v-if="!loading && section.key === 'group' && sessions?.length === 0" class="alert alert-info">{{ aj.gettext("There are no group yet. Create a new group using the 'New group' button bellow!") }}</div>
                <div v-if="!loading && section.key === 'project' && schoolclasses?.length === 0" class="alert alert-info">
                    <span v-html="aj.gettext(noProjects)"></span>
                </div>
                <div class="flex-container lmn-container-list">
                    <div v-for="(item, row) in section.items" :key="item.sid ?? row" class="list-group-item" :style="section.key !== 'room' ? 'margin-bottom:30px' : undefined" @click="start(item, section.key)">
                        <div style="float:left;width:50%"><div class="session_image" :class="'session_image_' + section.image"></div></div>
                        <div style="clear:right;float:right;width:50%"><div class="session_container">
                            <h4 style="word-break:break-all;height:2em">{{ item.name }}</h4><div class="session_hr"></div><i class="fa fa-users"></i> <span>{{ item.membersCount }}</span>
                            <div v-if="section.key === 'group'">
                                <a class="btn btn-flat float-end" style="padding:6px" @click.stop="kill(item)"><i class="fa fa-trash"></i></a>
                                <a class="btn btn-flat float-end" style="padding:6px" @click.stop="create(item.members)"><i class="fa-regular fa-copy"></i></a>
                                <a class="btn btn-flat float-end" style="padding:6px" @click.stop="rename(item)"><i class="fa fa-pencil"></i></a>
                            </div>
                        </div></div>
                    </div>
                </div>
            </div>
        </template>
    </div>
    <div v-else class="text-center root-access-blocker"><h1><i class="fas fa-exclamation-triangle"></i></h1><h4 class="alert alert-danger">You should not use WebUI as root user!<br>If this is your first time running WebUI, proceed through the <a href="/view/lmn/init/welcome">setup wizard</a>.<br>Afterwards login using the global-admin account.</h4></div>
</template>

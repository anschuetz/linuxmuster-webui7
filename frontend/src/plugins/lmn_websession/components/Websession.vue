<script setup>
import { inject, ref, watch } from 'vue';
import { useSambaAccess } from '../../../common/access.mjs';
import { browser } from '../browser.mjs';
import CreateSession from './CreateSession.vue';
import Participants from './Participants.vue';
const aj = inject('aj');
const allowed = useSambaAccess(aj);
const user = ref();
const enabled = ref();
const sessions = ref();
const base = '/api/lmn/websession/';
aj.pageTitle.set(aj.gettext('Websession'));
watch(() => aj.identity.user, async (identity) => {
    if (identity == null || identity === 'root') return;
    user.value = aj.identity.profile;
    try {
        const { data } = await aj.http.get(base + 'webConferenceEnabled');
        enabled.value = data === true;
        if (enabled.value) refresh();
    } catch {
        // The adapter owns HTTP errors. Keep the legacy loading/disabled state.
    }
}, { immediate: true });
async function refresh() {
    try { sessions.value = (await aj.http.get(base + 'webConferences')).data; }
    catch { /* Leave the last list (or undefined) intact, like the old controller. */ }
}
async function create() {
    try {
        await aj.modal.open(CreateSession);
        refresh();
        aj.notify.success(aj.gettext('Created successfully!'));
    } catch { /* Legacy dismiss(), Escape or backdrop does not refresh. */ }
}
async function join(session, password) {
    try {
        const { data } = await aj.http.post(base + 'joinWebConference', {
            id: session.id, password,
            name: `${aj.identity.profile.sn}, ${aj.identity.profile.givenName}`,
        });
        refresh();
        browser.open(data);
    } catch { /* HTTP policy belongs to the adapter. */ }
}
async function start(session) {
    try {
        const { data } = await aj.http.post(base + 'startWebConference', {
            sessionname: session.sessionname, id: session.id,
            attendeepw: session.attendeepw, moderatorpw: session.moderatorpw,
        });
        if (data.returncode === 'SUCCESS') join(session, session.moderatorpw);
        else aj.notify.error(aj.gettext('Cannot start websession! Try to reload page!'));
    } catch { /* HTTP policy belongs to the adapter. */ }
}
async function stop(session) {
    try {
        const { data } = await aj.http.post(base + 'endWebConference', { id: session.id, moderatorpw: session.moderatorpw });
        if (data.returncode === 'SUCCESS') {
            refresh();
            aj.notify.success(aj.gettext('Stopped successfully!'));
        } else aj.notify.error(aj.gettext('Cannot stop websession! Try to reload page!'));
    } catch { /* HTTP policy belongs to the adapter. */ }
}
async function remove(session) {
    try {
        await aj.messagebox.show({ text: `Delete ${session.id}?`, positive: 'Delete', negative: 'Cancel' });
        // Deliberately preserve $scope.websessionID (never set), not the supplied id.
        const { data } = await aj.http.delete(base + 'webConference/undefined');
        refresh();
        if (data.status === 'SUCCESS') aj.notify.success(aj.gettext('Successfully removed!'));
        else aj.notify.error(aj.gettext('Cannot delete entry!'));
    } catch { /* Cancellation or HTTP failure leaves the current table intact. */ }
}
function showUrl(id) {
    aj.messagebox.show({ text: browser.publicUrl(id), positive: 'Ok' }).catch(() => {});
}
function copyUrl(id) {
    browser.copy(browser.publicUrl(id));
    aj.notify.success(aj.gettext('Copied!'));
}
function participants(session) {
    aj.modal.open(Participants, { participants: session.participants }).catch(() => {});
}
</script>
<template>
    <div v-if="allowed">
        <component :is="'progress-spinner'" v-if="user == null"><div><div class="one"></div><div class="two"></div></div></component>
        <div v-else>
            <div v-if="!enabled" class="alert alert-info" style="margin-top:15px"><i class="fa fa-info-circle"></i> <span>{{ aj.gettext('Websession-Module not enabled! Please check Config-File!') }}</span></div>
            <div v-if="enabled" class="flex-container info-cards" style="margin-top:10px"><div class="card c7-session-card" style="width:100%">
                <div class="card-header" style="padding:10px;height:50px"><span style="font-size:18px;line-height:28px">{{ aj.gettext('Running Websession') }}</span><div style="float:right">
                    <button v-if="aj.identity.profile.sophomorixRole === 'teacher'" class="btn c7-button websession_btn" @click="create"><i class="fas fa-plus"></i></button>
                    <button class="btn c7-button websession_btn" @click="refresh"><i class="fas fa-sync"></i></button>
                </div></div>
                <div class="card-body">
                    <div v-if="sessions?.length === 0" class="alert alert-info" style="margin-top:15px"><i class="fa fa-info-circle"></i> <span>{{ aj.gettext('Currently no websession is running!') }}</span></div>
                    <table v-else class="table" style="margin-top:15px"><thead><tr><th></th><th v-for="title in ['Sessionname', 'Moderator', 'Password', 'Participants', 'Status']" :key="title">{{ aj.gettext(title) }}</th><th></th></tr></thead>
                        <tbody><tr v-for="(session, index) in sessions" :key="index" class="session_table">
                            <td style="text-align:center"><i v-if="session.moderator !== aj.identity.user" class="fas fa-lock" title="You can't edit this session because you aren't the owner"></i><i v-else class="fas fa-lock-open" title="This is your session"></i></td>
                            <td>{{ session.sessionname }}</td><td>{{ session.moderator }}</td><td><span v-if="session.sessionpassword">{{ session.sessionpassword }}</span><span v-else>{{ aj.gettext('no password') }}</span></td>
                            <td @click="participants(session)">{{ session.participants.length }}</td><td>{{ session.status }}</td>
                            <td>
                                <button v-if="session.status === 'stopped'" class="btn c7-button" :disabled="session.moderator !== aj.identity.user" :title="aj.gettext('Start')" @click="start(session)"><i class="fas fa-play"></i></button>
                                <button v-if="session.status === 'started'" class="btn c7-button" :title="aj.gettext(session.moderator === aj.identity.user ? 'Join as moderator' : 'Join as attendee')" @click="join(session, session.moderator === aj.identity.user ? session.moderatorpw : session.attendeepw)"><i class="fas fa-play"></i></button>
                                <template v-if="session.moderator === aj.identity.user">
                                    <button v-if="session.status === 'started' || session.status === 'stopped'" class="btn c7-button" :disabled="session.status === 'stopped'" :title="aj.gettext('Stop')" @click="stop(session)"><i class="fas fa-stop"></i></button>
                                    <button class="btn c7-button" :title="aj.gettext('Delete')" @click="remove(session)"><i class="fas fa-trash-alt"></i></button>
                                    <button class="btn c7-button" :title="aj.gettext('Show URL')" @click="showUrl(session.id)"><i class="fas fa-eye"></i></button>
                                    <button class="btn c7-button" :title="aj.gettext('Copy URL')" @click="copyUrl(session.id)"><i class="fas fa-clipboard"></i></button>
                                </template>
                            </td>
                        </tr></tbody>
                    </table>
                </div>
            </div></div>
        </div>
    </div>
    <div v-else class="text-center root-access-blocker"><h1><i class="fas fa-exclamation-triangle"></i></h1><h4 class="alert alert-danger">{{ aj.gettext('You should not use WebUI as root user!') }}<br>{{ aj.gettext('If this is your first time running WebUI, proceed through the') }} <a href="/view/lmn/init/welcome">{{ aj.gettext('setup wizard') }}</a>.<br>{{ aj.gettext('Afterwards login using the global-admin account.') }}</h4></div>
</template>

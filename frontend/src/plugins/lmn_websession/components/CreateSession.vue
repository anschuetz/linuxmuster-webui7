<script setup>
import { inject, ref, watch } from 'vue';
const aj = inject('aj');
const emit = defineEmits(['cancel']);
const sessionname = ref('');
const sessiontype = ref('public');
const sessionpassword = ref('');
const participants = ref([]);
const userQuery = ref('');
const classQuery = ref('');
const classes = ref([]);

aj.pageTitle.set(aj.gettext('Websession'));
// The original user typeahead calls $http.gett: it never produces suggestions.
// Keep that visible behavior without propagating a framework exception.
watch(classQuery, async (query) => {
    classes.value = [];
    if (!query) return;
    try {
        const { data } = await aj.http.get(`/api/lmn/session/schoolClass-search/${query}`);
        // The real search endpoint returns null for non-alphanumeric queries.
        classes.value = data ?? [];
    } catch {
        // HTTP errors are already handled by the adapter, as in the old modal.
    }
});
function addClass(schoolClass) {
    // E returns member rather than members; do not repair the legacy mismatch.
    participants.value = [...participants.value, ...Object.values(schoolClass.members ?? {})];
    classQuery.value = '';
    classes.value = [];
}
function removeParticipant(participant) {
    // indexOf removes the first occurrence of the same object, including duplicates.
    const index = participants.value.indexOf(participant);
    participants.value = participants.value.filter((_, i) => i !== index);
}
async function create() {
    if (!sessionname.value) {
        aj.notify.error(aj.gettext('You have to enter a name!'));
        return;
    }
    try {
        const { data } = await aj.http.post('/api/lmn/websession/webConferences', {
            sessionname: sessionname.value,
            sessiontype: sessiontype.value,
            sessionpassword: sessionpassword.value,
            participants: participants.value.map((participant) => participant.sAMAccountName),
        });
        if (data.status !== 'SUCCESS') aj.notify.error(aj.gettext('Create session failed! Try again later!'));
        // Legacy dismiss(), including on failure: parent does not refresh.
        emit('cancel');
    } catch {
        // Original leaves the modal open after a rejected HTTP request.
    }
}
</script>
<template>
    <div class="modal-header"><h3><span>{{ aj.gettext('Create new session') }}</span></h3></div>
    <div class="modal-body">
        <table width="100%"><tbody>
            <tr style="height:80px"><td colspan="3"><label for="websession-name">{{ aj.gettext('Name') }}</label><input id="websession-name" v-model.trim="sessionname" name="sessionname" type="text" class="form-control"></td></tr>
            <tr style="height:80px">
                <td style="width:49%"><label for="websession-type">{{ aj.gettext('Type') }}</label><select id="websession-type" v-model="sessiontype" class="form-control"><option value="public">{{ aj.gettext('Public') }}</option><option value="password">Password</option></select></td>
                <td style="width:10px"></td>
                <td v-show="sessiontype === 'password'" style="width:49%"><label for="websession-password">{{ aj.gettext('Password') }}</label><input id="websession-password" v-model.trim="sessionpassword" name="sessionpassword" type="text" class="form-control"></td>
            </tr>
            <tr style="height:80px">
                <td style="width:49%"><label for="websession-user">{{ aj.gettext('Add User') }}</label><input id="websession-user" v-model.trim="userQuery" name="userQuery" type="text" autocomplete="off" class="form-control"></td>
                <td style="width:10px"></td>
                <td style="width:49%;position:relative">
                    <label for="websession-class">{{ aj.gettext('Add Class') }}</label><input id="websession-class" v-model.trim="classQuery" name="classQuery" type="text" autocomplete="off" class="form-control">
                    <ul v-if="classes.length" class="dropdown-menu" style="display:block"><li v-for="(schoolClass, index) in classes.slice(0, 10)" :key="index" @click="addClass(schoolClass)"><button type="button" class="btn btn-link">{{ schoolClass.sophomorixAdminClass }}</button></li></ul>
                </td>
            </tr>
            <tr style="height:80px"><td colspan="3"><div class="flex-container info-cards"><div class="panel panel-info" style="width:100%">
                <div class="panel-heading" style="height:40px"><h4 style="line-height:15px">{{ aj.gettext('Users') }}</h4></div>
                <div class="panel-body"><div v-if="participants.length === 0" class="alert alert-info"><i class="fa fa-info-circle"></i> <span>{{ aj.gettext('No users selected!') }}</span></div>
                    <table v-else width="100%"><tbody><tr v-for="(participant, index) in participants" :key="index"><td><i class="fa fa-times-circle" @click="removeParticipant(participant)"></i> {{ participant.givenName }} {{ participant.sn }} ({{ participant.sAMAccountName }})</td></tr></tbody></table>
                </div>
            </div></div></td></tr>
        </tbody></table>
    </div>
    <div class="modal-footer"><a class="btn btn-default btn-flat pull-right" data-action="create" @click="create">{{ aj.gettext('Create') }}</a><a class="btn btn-default btn-flat pull-right" data-action="close" @click="emit('cancel')">{{ aj.gettext('Close') }}</a></div>
</template>

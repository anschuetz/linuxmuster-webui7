<script setup>
import { computed, inject, ref, watch } from 'vue';
import { useSambaAccess } from '../../common/access.mjs';
import PrintOptionsDialog from './PrintOptionsDialog.vue';
import { createPrint } from './print.mjs';
const aj = inject('aj'), gettext = aj.gettext, sambaAccess = useSambaAccess(aj), api = createPrint(aj);
const classes = ref(), selection = ref([]), adminWarning = ref(false), adminClass = ref();
const columns = computed(() => [classes.value?.slice(0, Math.ceil(classes.value.length / 2)), classes.value?.slice(Math.ceil(classes.value.length / 2))]);
// Reuse the original catalog entry; render its icon separately and interpolate as text.
const allUsers = computed(() => gettext('<i class="fa fa-asterisk"></i> All users {{identity.profile.activeSchool}}')
    .replace('<i class="fa fa-asterisk"></i>', '').replace('{{identity.profile.activeSchool}}', () => aj.identity.profile.activeSchool).trim());
aj.pageTitle.set(gettext('Print Passwords'));
watch(() => aj.identity.user, async user => {
    if (user === undefined || user === null || user === 'root') return;
    adminClass.value = aj.identity.profile.sophomorixAdminClass;
    try {
        const { data } = await aj.http.get('/api/lmn/activeschool');
        aj.identity.patch({ activeSchool: data });
        adminWarning.value = aj.identity.user === 'root' || ['globaladministrator', 'schooladministrator'].includes(aj.identity.profile.sophomorixRole);
        classes.value = (await aj.http.get('/api/lmn/users/classes')).data;
    } catch { /* Original leaves the existing list/spinner on HTTP rejection. */ }
}, { immediate: true });
const mixed = () => selection.value.includes('') && selection.value.length > 1;
const warn = () => aj.notify.warning(gettext("It's not possible to print all users and a class at the same time."));
function select(schoolclass) {
    selection.value = selection.value.includes(schoolclass) ? selection.value.filter(c => c !== schoolclass) : [...selection.value, schoolclass];
    if (mixed()) warn();
}
async function print(schoolclass) {
    if (mixed()) { warn(); return; }
    try { await aj.modal.open(PrintOptionsDialog, { schoolclass, user: aj.identity.user, adminClass: adminClass.value }); }
    catch { /* Cancel, Escape and backdrop dismiss without printing. */ }
}
</script>
<template>
    <br>
    <div v-if="sambaAccess" data-users-print>
        <span v-if="classes == null && aj.identity.user !== 'root'" role="status" class="fa fa-spinner fa-spin" />
        <div v-if="classes?.length === 0" class="alert alert-info"><i class="fa fa-info-circle" />
            {{ gettext(adminWarning ? 'No classes found. You have to create a class by importing userlist before you can print user passwords!' : 'No classes found. You first need to join a class in the groupmembership modul in order to print passwords.') }}
        </div>
        <div v-if="classes?.length > 0" class="alert alert-info"><i class="fa fa-info-circle" /> {{ gettext('You can directly print the password of one class through the icon, or select multiples classes to print all at once.') }}</div>
        <div v-if="classes != null" style="display:flex;align-items:flex-start;margin-bottom:35px">
            <div v-for="(column, side) in columns" :key="side" style="flex:1 0 0px">
                <table class="table" :style="side === 0 ? 'border-right:solid 1px #eeeeee' : ''">
                    <tbody><tr v-for="schoolclass in column" :key="schoolclass"><td>
                        <input :id="schoolclass" type="checkbox" :checked="selection.includes(schoolclass)" @change="select(schoolclass)">
                        <span v-if="schoolclass !== ''"><i class="fa fa-users" /> {{ schoolclass }}</span>
                        <span v-else><i class="fa fa-asterisk" /> {{ allUsers }}</span>
                        <span class="btn btn-light c11-button float-end" data-action="pdf" @click="print([schoolclass])"><i class="fa fa-print" /></span>
                        <span class="btn btn-light c11-button float-end" data-action="csv" @click="api.csv(schoolclass, side === 1 && schoolclass === '')"><i class="fa-solid fa-file-csv" /></span>
                    </td></tr></tbody>
                </table>
            </div>
        </div>
        <div class="floating-toolbar-padder"></div>
        <component :is="'floating-toolbar'"><div class="container"><div class="row"><div class="col-md-3"></div><div class="col-md-9"><div class="bar row"><button v-if="selection.length > 0" class="btn btn-lmn" data-action="selected" @click="print(selection)">{{ gettext('Print') }}</button></div></div></div></div></component>
    </div>
    <div v-else class="text-center root-access-blocker"><h1><i class="fas fa-exclamation-triangle"></i></h1><h4 class="alert alert-danger">You should not use WebUI as root user!<br>If this is your first time running WebUI, proceed through the <a href="/view/lmn/init/welcome">setup wizard</a>.<br>Afterwards login using the global-admin account.</h4></div>
</template>

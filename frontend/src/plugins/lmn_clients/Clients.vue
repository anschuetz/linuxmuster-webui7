<script setup>
import { computed, inject, ref, watch } from 'vue';
import { useSambaAccess } from '../../common/access.mjs';
import ScriptEditor from './ScriptEditor.vue';

const aj = inject('aj');
const allowed = useSambaAccess(aj);
const scripts = ref();
const drives = ref();
const letters = ref();
const active = ref('scripts');
const editing = ref(null);
const selected = computed(() => editing.value && scripts.value[editing.value.kind][editing.value.index]);
const warning = computed(() => aj.gettext('The following scripts are executed by Samba when the client boots, in root context, and after the\n                    execution of the postsync script of Linbo. <br>This must be handled with caution.').split('<br>'));
aj.pageTitle.set(aj.gettext('Lmn_clients'));
watch(() => aj.identity.user, async (user) => {
    if (user === null) return;
    try { scripts.value = (await aj.http.get('/api/lmn/clients/scripts')).data; }
    catch { /* Original leaves scripts unset; HTTP errors are handled by the adapter. */ }
}, { immediate: true });
function updateScript(content) {
    const { kind, index } = editing.value;
    scripts.value = { ...scripts.value, [kind]: scripts.value[kind].map((script, i) => i === index ? { ...script, content } : script) };
}
async function saveScript() {
    const { path, content } = selected.value;
    try {
        await aj.http.post('/api/lmn/clients/scripts', { path, content });
        editing.value = null;
        aj.notify.success(aj.gettext('Script saved !'));
    } catch { aj.notify.error(aj.gettext('Error while saving script')); }
}
async function loadDrives() {
    active.value = 'drives';
    try {
        const { data } = await aj.http.get('/api/lmn/samba/drives');
        [drives.value, letters.value] = data;
    } catch { /* Preserve the previous state, as in the original. */ }
}
function updateDrive(index, field, value) {
    const previous = drives.value[index].properties.letter;
    drives.value = drives.value.map((drive, i) => i !== index ? drive : field === 'disabled'
        ? { ...drive, disabled: value } : { ...drive, properties: { ...drive.properties, [field]: value } });
    if (field === 'letter') {
        // Keep the original new-then-old assignment order, including identical values.
        letters.value = letters.value.map((item) => ({ ...item,
            active: item.letter === previous ? false : item.letter === value ? true : item.active }));
    }
}
async function saveDrives() {
    try {
        await aj.http.post('/api/lmn/samba/drives', { drives: drives.value });
        aj.notify.success(aj.gettext('Saved !'));
    } catch (cause) { aj.notify.error(cause.data?.message); }
}
</script>

<template>
    <div v-if="allowed">
        <br>
        <ul class="nav nav-tabs" role="tablist">
            <li :class="{ active: active === 'scripts' }"><a href="" role="tab" :aria-selected="active === 'scripts'" @click.prevent="active = 'scripts'">{{ aj.gettext('Custom scripts') }}</a></li>
            <li :class="{ active: active === 'drives' }"><a href="" role="tab" :aria-selected="active === 'drives'" @click.prevent="loadDrives">{{ aj.gettext('Drives') }}</a></li>
        </ul>
        <div v-show="active === 'scripts'" class="tab-pane" role="tabpanel">
            <br>
            <div class="alert alert-info">{{ warning[0] }}<br>{{ warning[1] }}</div>
            <template v-for="kind in ['linux', 'windows']" :key="kind">
                <hr v-if="kind === 'windows'">
                <h3>{{ kind === 'linux' ? 'Linux' : 'Windows' }}</h3>
                <ul class="list-group">
                    <li v-for="(script, index) in scripts?.[kind]" :key="index" class="list-group-item">
                        <button class="btn btn-default pull-right" @click="editing = { kind, index }"><i class="fa fa-edit"></i></button>
                        {{ script.name }}
                    </li>
                </ul>
            </template>
            <div v-if="selected" class="modal show" role="dialog" aria-modal="true" style="display:block;background:rgba(0,0,0,.5)">
                <div class="modal-dialog modal-lg"><div class="modal-content">
                    <div class="modal-header"><h4>{{ aj.gettext('Edit custom script') }}</h4></div>
                    <div class="modal-body"><ScriptEditor :content="selected.content" @update="updateScript" /></div>
                    <div class="modal-footer">
                        <button class="btn btn-default btn-flat" @click="saveScript">{{ aj.gettext('Save') }}</button>
                        <button class="btn btn-default btn-flat" @click="editing = null">{{ aj.gettext('Close') }}</button>
                    </div>
                </div></div>
            </div>
        </div>
        <div v-show="active === 'drives'" class="tab-pane" role="tabpanel">
            <br>
            <div v-if="drives?.length === 0" class="alert alert-warning">{{ aj.gettext('Unable to find a Drives.xml in your policy directory. Does the file really exists ?') }}</div>
            <form v-if="drives?.length > 0" @submit.prevent>
                <table class="table">
                    <thead><tr><th v-for="heading in ['Label', 'Show letter', 'Letter', 'Disable']" :key="heading">{{ aj.gettext(heading) }}</th></tr></thead>
                    <tbody><tr v-for="(drive, index) in drives" :key="index">
                        <td>{{ drive.properties.label }}</td>
                        <td><span checkbox role="checkbox" tabindex="0" :class="{ active: drive.properties.useLetter }" :aria-checked="!!drive.properties.useLetter" :aria-label="aj.gettext('Show letter')" @click="updateDrive(index, 'useLetter', !drive.properties.useLetter)" @keydown.space.prevent="updateDrive(index, 'useLetter', !drive.properties.useLetter)"><i class="fa fa-square-o off"></i><i class="fa fa-check-square on"></i></span></td>
                        <td><select class="form-control" :value="drive.properties.letter" @change="updateDrive(index, 'letter', $event.target.value)"><option v-for="letter in letters.filter((l) => !l.active || l.letter === drive.properties.letter)" :key="letter.letter">{{ letter.letter }}</option></select></td>
                        <td><span checkbox role="checkbox" tabindex="0" :class="{ active: drive.disabled }" :aria-checked="!!drive.disabled" :aria-label="aj.gettext('Disable')" @click="updateDrive(index, 'disabled', !drive.disabled)" @keydown.space.prevent="updateDrive(index, 'disabled', !drive.disabled)"><i class="fa fa-square-o off"></i><i class="fa fa-check-square on"></i></span></td>
                    </tr></tbody>
                </table>
            </form>
            <component :is="'floating-toolbar'" v-if="drives?.length > 0"><div class="container"><div class="row"><div class="col-md-3"></div><div class="col-md-9"><div class="bar row"><button class="btn btn-lmn" @click="saveDrives">{{ aj.gettext('Save') }}</button></div></div></div></div></component>
        </div>
    </div>
    <div v-else class="text-center root-access-blocker">
        <h1><i class="fas fa-exclamation-triangle"></i></h1>
        <h4 class="alert alert-danger">{{ aj.gettext('You should not use WebUI as root user!') }}<br>{{ aj.gettext('If this is your first time running WebUI, proceed through the') }} <a href="/view/lmn/init/welcome">{{ aj.gettext('setup wizard') }}</a>.<br>{{ aj.gettext('Afterwards login using the global-admin account.') }}</h4>
    </div>
</template>

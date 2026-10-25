<script setup>
import { inject, onBeforeUnmount, ref, shallowRef } from 'vue';
import { copy, modelFields } from './config.mjs';
const props = defineProps({ partition: { type: Object, required: true }, os: Object });
const emit = defineEmits(['close', 'cancel']);
const aj = inject('aj');
const draft = shallowRef(copy(props.partition)), osDraft = shallowRef(copy(props.os));
const partition = modelFields(() => draft.value, next => { draft.value = next; });
const os = modelFields(() => osDraft.value, next => { osDraft.value = next; });
const iconMenu = ref(false), iconRoot = ref(null);
const outside = event => { if (!iconRoot.value?.contains(event.target)) iconMenu.value = false; };
const escape = event => { if (event.key === 'Escape') iconMenu.value = false; };
window.addEventListener('click', outside); window.addEventListener('keydown', escape);
onBeforeUnmount(() => { window.removeEventListener('click', outside); window.removeEventListener('keydown', escape); });
const icons = ref(), images = ref(), pngWarning = ref(false), advanced = ref(false), tab = ref('partition');
aj.http.get('/api/lmn/linbo4/icons').then(({ data }) => {
    icons.value = data; pngWarning.value = osDraft.value !== null && osDraft.value.IconName.endsWith('png');
}).catch(() => { /* Keep choices unset; shell owns HTTP errors. */ });
aj.http.get('/api/lmn/linbo4/images').then(({ data }) => {
    const names = data.map(image => image.name + '.qcow2');
    images.value = osDraft.value !== null && !names.includes(os.BaseImage) ? [...names, os.BaseImage] : names;
}).catch(() => { /* Do not substitute an empty successful response. */ });
async function newImage() {
    let result;
    try { result = await aj.messagebox.prompt('New image name', ''); } catch { return; }
    images.value = [...images.value, result.value];
}
function invalidLabel(event) { if (event.target.validity.patternMismatch) partition.Label = undefined; }
function save() { emit('close', { partition: draft.value, os: osDraft.value }); }
const iconUrl = name => '/api/lmn/linbo4/icons/' + name;
</script>
<template>
    <div class="modal-header"><h4>{{ partition.Dev }}</h4></div>
    <div class="modal-body">
        <ul class="nav nav-tabs c8-tabs"><li class="nav-item"><a class="nav-link" :class="{ active: tab === 'partition' }" href="" @click.prevent="tab = 'partition'">{{ aj.gettext('Partition') }}</a></li><li v-if="osDraft" class="nav-item"><a class="nav-link" :class="{ active: tab === 'os' }" href="" @click.prevent="tab = 'os'">{{ aj.gettext('OS') }}</a></li></ul>
        <div v-show="tab === 'partition'">
            <div class="c8-field"><label>{{ aj.gettext('Label') }}</label><input v-model.trim="partition.Label" @input="invalidLabel" data-model="partition.Label" pattern="[A-Za-z0-9_]{0,128}" class="form-control" type="text"></div>
            <div class="c8-field"><label>{{ aj.gettext('Size') }}</label><input v-model.trim="partition.Size" data-model="partition.Size" class="form-control" type="text"></div>
            <label>{{ aj.gettext('Flags') }}</label><label class="form-check aj-native-check"><input v-model="partition.Bootable" data-model="partition.Bootable" type="checkbox">Bootable</label>
            <div v-show="advanced" class="c8-field"><label>{{ aj.gettext('Partition type') }}</label><select v-model="partition.Id" data-model="partition.Id" class="form-control"><option value="c">c (Win95 FAT32)</option><option value="ef">ef (EFI)</option><option value="5">5 (Extended)</option><option value="7">7 (WinNT NTFS)</option><option value="82">82 (Linux-Swap)</option><option value="83">83 (Linux native)</option></select></div>
            <div v-show="advanced" class="c8-field"><label>{{ aj.gettext('Filesystem') }}</label><select v-model="partition.FSType" data-model="partition.FSType" class="form-control"><option value="">None</option><option value="vfat">FAT</option><option value="ntfs">NTFS</option><option value="ext3">Ext3</option><option value="ext4">Ext4</option><option value="swap">Swap</option><option value="reiserfs">ReiserFS</option></select></div>
        </div>
        <div v-if="osDraft" v-show="tab === 'os'">
            <p v-if="pngWarning" class="alert alert-warning">{{ aj.gettext('The icon format used here is png and you should change this to svg.') }}</p>
            <div class="row"><div class="col-sm-6 c8-field"><label>{{ aj.gettext('Name') }}</label><input v-model.trim="os.Name" data-model="os.Name" class="form-control" type="text"></div><div class="col-sm-6 c8-field"><label>{{ aj.gettext('Version') }}</label><input v-model.trim="os.Version" data-model="os.Version" class="form-control" type="text"></div></div>
            <div class="c8-field"><label>{{ aj.gettext('Default') }}</label><select v-model="os.DefaultAction" data-model="os.DefaultAction" class="form-control"><option value="start">Start</option><option value="sync">Sync &amp; start</option><option value="new">New start</option></select></div>
            <label>{{ aj.gettext('Icon') }}</label><div ref="iconRoot" class="dropdown" :class="{ show: iconMenu }"><button class="btn c8-button d-block w-100" :aria-expanded="iconMenu" @click="iconMenu = !iconMenu"><img :src="iconUrl(os.IconName)" style="max-width:32px" alt=""><i class="fa fa-caret-down"></i></button><ul v-show="iconMenu" class="dropdown-menu dropdown-menu-end c8-icon-menu" :class="{ show: iconMenu }"><li v-for="icon in icons?.filter(name => name.substring(0,6) !== 'linbo_' && name.includes('.svg'))" :key="icon"><a class="dropdown-item" :data-icon="icon" @click="os.IconName = icon; iconMenu = false"><img :src="iconUrl(icon)" style="max-width:32px" alt=""> {{ icon }}</a></li></ul></div>
            <div class="c8-field"><label>{{ aj.gettext('Base image') }}</label><select v-model="os.BaseImage" data-model="os.BaseImage" class="form-control"><option :value="null">None</option><option v-for="(image, i) in images" :key="i" :value="image">{{ image }}</option></select><button data-action="new-image" class="btn btn-flat" @click="newImage"><i class="fa fa-plus"></i></button></div>
            <label>{{ aj.gettext('Boot buttons') }}</label>
            <label v-for="[key, label] in [['StartEnabled','Start'],['SyncEnabled','Sync & start'],['NewEnabled','New start'],['Autostart','Autostart']]" :key="key" class="form-check aj-native-check"><input v-model="os[key]" :data-model="'os.' + key" type="checkbox">{{ label }}</label>
            <div v-show="os.Autostart" class="c8-field"><label>{{ aj.gettext('Autostart timeout') }}</label><input v-model.trim="os.AutostartTimeout" data-model="os.AutostartTimeout" class="form-control" type="text"></div>
            <div v-show="advanced" class="c8-field"><label>{{ aj.gettext('Kernel') }}</label><select v-if="partition.FSType === 'ntfs'" v-model="os.Kernel" data-model="os.Kernel" class="form-control"><option>auto</option><option>grub.exe</option><option>reboot</option></select><input v-else v-model.trim="os.Kernel" data-model="os.Kernel" class="form-control" type="text"></div>
            <div v-if="partition.FSType !== 'ntfs'" v-show="advanced" class="c8-field"><label>{{ aj.gettext('Initrd') }}</label><input v-model.trim="os.Initrd" data-model="os.Initrd" class="form-control" type="text"></div>
            <div v-show="advanced" class="c8-field"><label>{{ aj.gettext('Additional kernel parameters') }}</label><input v-model.trim="os.Append" data-model="os.Append" class="form-control" type="text"></div>
            <div v-show="advanced"><label>{{ aj.gettext('Restore Opsi state') }}</label><label class="form-check aj-native-check"><input v-model="os.RestoreOpsiState" data-model="os.RestoreOpsiState" type="checkbox">Restore Opsi state</label><label>{{ aj.gettext('Force Opsi setup') }}</label><input v-model.trim="os.ForceOpsiSetup" data-model="os.ForceOpsiSetup" class="form-control" type="text"><label>{{ aj.gettext('Options') }}</label><label class="form-check aj-native-check"><input v-model="os.Hidden" data-model="os.Hidden" type="checkbox">Hidden</label></div>
        </div>
    </div>
    <div class="modal-footer"><button data-action="save" class="btn c8-button btn-flat" @click="save">{{ aj.gettext('Save') }}</button><button v-if="!advanced" class="btn c8-button btn-flat" @click="advanced = true">{{ aj.gettext('Advanced') }}</button><button data-action="cancel" class="btn c8-button btn-flat" @click="emit('cancel')">{{ aj.gettext('Close') }}</button></div>
</template>

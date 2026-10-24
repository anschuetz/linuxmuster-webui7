<script setup>
import { inject, onMounted, ref, shallowRef } from 'vue';
import PartitionDialog from './PartitionDialog.vue';
import AcceptDialog from './AcceptDialog.vue';
import { configBackups, prepareEditor, rebuildDisks, addDisk, changeDiskType, addPartition, removePartition, partitionSize, partitionName, partitionColor, getOS, copy, modelFields, saveEditor } from './config.mjs';
const props = defineProps({ config: { type: Object, required: true }, vdiconfig: { type: Object, default: null } });
const emit = defineEmits(['close', 'cancel']);
const aj = inject('aj');
const state = shallowRef(prepareEditor(props.config, props.vdiconfig));
const header = ref(null);
onMounted(() => header.value?.closest('.modal-dialog')?.classList.add('modal-lg'));
const tab = ref('general'), expert = ref(false), privateConf = ref('School' in props.config.config.LINBO && props.config.config.LINBO.School !== 'default-school');
const newvmid = ref(), dragging = ref(null);
const linbo = modelFields(() => state.value.config.config.LINBO, next => {
    state.value = { ...state.value, config: { ...state.value.config, config: { ...state.value.config.config, LINBO: next } } };
});
const numericVDI = ['tag','cores','memory','minimum_vms','maximum_vms','prestarted_vms','timeout_building_clone','timeout_building_master'];
const vdiconfig = modelFields(() => state.value.vdiconfig, next => { state.value = { ...state.value, vdiconfig: next }; },
    (key, value) => numericVDI.includes(key) && value === '' ? null : value);
const kernelOptions = ['quiet','splash','acpi=noirq','acpi=off','irqpoll','dhcpretry=9'];
const partitionKinds = ['EFI','MSR','Windows','Linux','Swap','Data','Extended','Cache'];
const generalChecks = [['AutoPartition','Auto partition recovery'],['AutoFormat','Auto partition formatting'],['AutoInitCache','Auto update cache'],['UseMinimalLayout','Use minimal layout'],['clientDetailsVisibleByDefault','Display client details by default']];
// Angular inverts the scope model again, while its checkbox retains the user view.
function togglePrivate(event) { linbo.School = event.target.checked ? 'default-school' : aj.identity.profile.activeSchool; }
function diskType(index, event) { state.value = changeDiskType(state.value, index, event.target.value); }
function add(kind, index) { state.value = addPartition(state.value, index, kind); }
function removeDisk(index) { state.value = { ...state.value, disks: state.value.disks.filter((_, i) => i !== index) }; }
async function editPartition(diskIndex, index) {
    const partition = state.value.disks[diskIndex].partitions[index], os = getOS(state.value, partition);
    let result;
    try { result = await aj.modal.open(PartitionDialog, { partition: copy(partition), os: copy(os) }); } catch { return; }
    state.value = rebuildDisks({ ...state.value,
        disks: state.value.disks.map((disk, i) => i === diskIndex ? { ...disk, partitions: disk.partitions.map((part, j) => j === index ? result.partition : part) } : disk),
        config: { ...state.value.config, os: state.value.config.os.map(item => item === os ? result.os : item) },
    });
}
async function remove(diskIndex, index) {
    const disk = state.value.disks[diskIndex];
    let result;
    try { result = await aj.modal.open(AcceptDialog, { partition: disk.partitions[index].Dev, disk: copy(disk) }); } catch { return; }
    if (result.response === 'accept') state.value = removePartition(state.value, diskIndex, index);
}
function move(diskIndex, index) {
    const from = dragging.value;
    if (!from) return;
    const partition = state.value.disks[from.disk].partitions[from.index];
    const target = from.disk === diskIndex && from.index < index ? index - 1 : index;
    const disks = state.value.disks.map((disk, i) => {
        const parts = i === from.disk ? disk.partitions.filter((_, j) => j !== from.index) : disk.partitions;
        return { ...disk, partitions: i === diskIndex ? [...parts.slice(0, target), partition, ...parts.slice(target)] : parts };
    });
    state.value = rebuildDisks({ ...state.value, disks }); dragging.value = null;
}
function invalidNumber(key, event) { if (event.target.validity.badInput) vdiconfig[key] = undefined; }
function vmidAdd() { vdiconfig.vmids = [...vdiconfig.vmids, newvmid.value === '' ? null : newvmid.value]; newvmid.value = null; }
function vmidRemove(index) { vdiconfig.vmids = vdiconfig.vmids.filter((_, i) => i !== index); }
function invalidColor(event) { if (event.target.validity.patternMismatch) linbo.BackgroundColor = undefined; }
function save() { emit('close', saveEditor(state.value)); }
async function backups() {
    try { await configBackups(aj, linbo.Group); } catch { return; }
    emit('cancel');
}
// Images load independently in the original editor; their response does not gate the form.
const oses = ref();
aj.http.get('/api/lmn/linbo4/images').then(({ data }) => { oses.value = data; }).catch(() => { /* Shell owns rejection. */ });
function bytes(partition) {
    if (!partition.Size) return '∞';
    const value = partitionSize(partition);
    if (isNaN(parseFloat(value)) || !isFinite(value)) return '-';
    if (value === 0) return aj.gettext('0 bytes');
    const exponent = Math.floor(Math.log(value) / Math.log(1024));
    const amount = value / 1024 ** exponent;
    return (exponent === 0 ? Math.floor(amount) : amount.toFixed(1)) + ' ' + aj.gettext(['bytes','KB','MB','GB','TB','PB'][exponent]);
}

const vdiFields = [
    {
        "key": "name",
        "label": "VM-Name",
        "expert": false,
        "type": "text"
    },
    {
        "key": "bios",
        "label": "Bios Type",
        "expert": false,
        "type": "text",
        "options": [
            {
                "value": "seabios",
                "label": "SeaBIOS"
            },
            {
                "value": "uefi",
                "label": "UEFI"
            }
        ]
    },
    {
        "key": "ostype",
        "label": "OS-Type",
        "expert": false,
        "type": "text",
        "options": [
            {
                "value": "w2k",
                "label": "Windows 2000"
            },
            {
                "value": "wxp",
                "label": "Windows XP/2003"
            },
            {
                "value": "w2k8",
                "label": "Windows Vista/2008"
            },
            {
                "value": "win7",
                "label": "Windows 7/2008r2"
            },
            {
                "value": "wxp",
                "label": "Windows 8.x/2012/2012r2"
            },
            {
                "value": "win10",
                "label": "Windows 10/2016/2019"
            },
            {
                "value": "l26",
                "label": "Linux 5.x - 2.6 Kernel"
            },
            {
                "value": "l24",
                "label": "Linux 2.4 Kernel"
            },
            {
                "value": "solaris",
                "label": "Solaris Kernel"
            },
            {
                "value": "other",
                "label": "Other Kernel"
            }
        ]
    },
    {
        "key": "boot",
        "label": "Boot",
        "expert": true,
        "type": "text"
    },
    {
        "key": "hostname",
        "label": "Hostname",
        "expert": false,
        "type": "text"
    },
    {
        "key": "ip",
        "label": "IP-Address",
        "expert": false,
        "type": "text"
    },
    {
        "key": "mac",
        "label": "MAC-Address",
        "expert": false,
        "type": "text"
    },
    {
        "key": "bridge",
        "label": "Network-Bridge",
        "expert": false,
        "type": "text"
    },
    {
        "key": "tag",
        "label": "VLAN-Tag",
        "expert": true,
        "type": "number"
    },
    {
        "key": "cores",
        "label": "Cores",
        "expert": false,
        "type": "number"
    },
    {
        "key": "memory",
        "label": "Memory",
        "expert": false,
        "type": "number"
    },
    {
        "key": "size",
        "label": "Disk size",
        "expert": false,
        "type": "text"
    },
    {
        "key": "storage",
        "label": "Storage",
        "expert": false,
        "type": "text"
    },
    {
        "key": "scsihw",
        "label": "SCSI Hardware",
        "expert": true,
        "type": "text",
        "options": [
            {
                "value": "virtio-scsi-pci",
                "label": "VirtIO SCSI"
            },
            {
                "value": "lsi",
                "label": "LSI 53C895A"
            },
            {
                "value": "lsi53c810",
                "label": "LSI 53C810"
            },
            {
                "value": "megasas",
                "label": "MegaRAID SAS 8708EM2"
            },
            {
                "value": "virtio-scsi-single",
                "label": "VirtIO SCSI single"
            },
            {
                "value": "pvscsi",
                "label": "VMware PVSCSI"
            }
        ]
    },
    {
        "key": "usb0",
        "label": "USB 0",
        "expert": true,
        "type": "text",
        "options": [
            {
                "value": "host=spice,usb3=1",
                "label": "Spice USB 3.0"
            }
        ]
    },
    {
        "key": "audio",
        "label": "Audio",
        "expert": true,
        "type": "text",
        "options": [
            {
                "value": "device=ich9-intel-hda,driver=spice",
                "label": "Intel HDA ICH9"
            },
            {
                "value": "device=intel-hda,driver=spice",
                "label": "Intel HDA"
            },
            {
                "value": "device=AC97,driver=spice",
                "label": "AC97"
            }
        ]
    },
    {
        "key": "display",
        "label": "Display",
        "expert": true,
        "type": "text",
        "options": [
            {
                "value": "type=std,memory=16",
                "label": "Standard VGA"
            },
            {
                "value": "type=vmware,memory=16",
                "label": "VMWare compatible"
            },
            {
                "value": "type=qxl,memory=16",
                "label": "Spice"
            },
            {
                "value": "type=qxl2,memory=16",
                "label": "Spice (2 Monitor)"
            },
            {
                "value": "type=qxl3,memory=16",
                "label": "Spice (3 Monitor)"
            },
            {
                "value": "type=qxl4,memory=16",
                "label": "Spice (4 Monitor)"
            },
            {
                "value": "type=virtio,memory=16",
                "label": "VirtIO-GPU"
            }
        ]
    },
    {
        "key": "spice_enhancements",
        "label": "Spice enhancements",
        "expert": true,
        "type": "text",
        "options": [
            {
                "value": "foldersharing=1",
                "label": "Foldersharing"
            },
            {
                "value": "foldersharing=1,videostreaming=all",
                "label": "Foldersharing and Videostreaming"
            },
            {
                "value": "foldersharing=1,videostreaming=filter",
                "label": "Foldersharing and Videostreaming (Filter)"
            },
            {
                "value": "videostreaming=all",
                "label": "Videostreaming"
            },
            {
                "value": "videostreaming=filter",
                "label": "Videostreaming (Filter)"
            }
        ]
    },
    {
        "key": "minimum_vms",
        "label": "Minimum VMs",
        "expert": false,
        "type": "number"
    },
    {
        "key": "prestarted_vms",
        "label": "Prestarted VMs",
        "expert": false,
        "type": "number"
    },
    {
        "key": "maximum_vms",
        "label": "Maxmimum VMs",
        "expert": false,
        "type": "number"
    },
    {
        "key": "timeout_building_clone",
        "label": "Timeout building clone",
        "expert": true,
        "type": "number"
    },
    {
        "key": "timeout_building_master",
        "label": "Timeout building master",
        "expert": true,
        "type": "number"
    }
];
const fieldGroups = (labels) => labels.map(([label, keys]) => ({ label, fields: keys.map(key => vdiFields.find(field => field.key === key)) }));
const vdiSections = [
    { title: 'VM Template Settings', groups: fieldGroups([
        ['Settings',['name','bios','ostype','boot']], ['Network',['hostname','ip','mac','bridge','tag']],
        ['Hardware',['cores','memory','size','storage','scsihw','usb0','audio','display','spice_enhancements']],
    ]) },
    { title: 'Reserved Master VM-IDs', vmids: true },
    { title: 'VDI Konfiguration', groups: fieldGroups([['',['minimum_vms','prestarted_vms','maximum_vms']]]) },
    { title: 'Timeouts', expert: true, groups: fieldGroups([['',['timeout_building_clone','timeout_building_master']]]) },
];
</script>
<template>
    <div ref="header" class="modal-header"><h4>{{ linbo.Group }}</h4></div>
    <div class="modal-body">
        <ul class="nav nav-tabs"><li :class="{ active: tab === 'general' }"><a data-tab="general" href="" @click.prevent="tab = 'general'">{{ aj.gettext('General') }}</a></li><li :class="{ active: tab === 'partitions' }"><a data-tab="partitions" href="" @click.prevent="tab = 'partitions'">{{ aj.gettext('Partitions') }}</a></li><li v-if="state.vdiconfig !== null" :class="{ active: tab === 'vdi' }"><a data-tab="vdi" href="" @click.prevent="tab = 'vdi'">{{ aj.gettext('Virtual Desktop (VDI)') }}</a></li></ul>
        <div v-show="tab === 'general'">
            <div class="form-group"><label>{{ aj.gettext('Root logout timeout') }}</label><input v-model.trim="linbo.RootTimeout" data-model="config.config.LINBO.RootTimeout" class="form-control" type="text"></div>
            <div class="row"><div class="col-sm-6 form-group"><label>{{ aj.gettext('System type') }}</label><select v-model="linbo.SystemType" data-model="config.config.LINBO.SystemType" class="form-control"><option value="bios">BIOS</option><option value="bios64">BIOS 64Bit</option><option value="efi32">UEFI</option><option value="efi64">UEFI 64Bit</option></select></div><div class="col-sm-6 form-group"><label>{{ aj.gettext('Download type') }}</label><select v-model="linbo.DownloadType" data-model="config.config.LINBO.DownloadType" class="form-control"><option>rsync</option><option>multicast</option><option>torrent</option></select></div></div>
            <div class="row"><div class="col-sm-6"><label>{{ aj.gettext('Start options') }}</label>
                <label v-for="[key,label] in generalChecks.slice(0,3)" :key="key" class="checkbox"><input v-model="linbo[key]" :data-model="'config.config.LINBO.'+key" type="checkbox">{{ aj.gettext(label) }}</label>
                <label class="checkbox"><input v-model="privateConf" data-model="privateConf" type="checkbox" @change="togglePrivate">{{ aj.gettext('Only available for this school') }} ({{ aj.identity.profile.activeSchool }})</label>
            </div><div class="col-sm-6"><label>{{ aj.gettext('Linbo GUI customization') }}</label>
                <label v-for="[key,label] in generalChecks.slice(3)" :key="key" class="checkbox"><input v-model="linbo[key]" :data-model="'config.config.LINBO.'+key" type="checkbox">{{ aj.gettext(label) }}</label>
            </div></div>
            <div class="row"><div class="col-sm-6 form-group"><label>{{ aj.gettext('Language') }}</label><select v-model="linbo.Locale" data-model="config.config.LINBO.Locale" class="form-control"><option value="de-DE">{{ aj.gettext('German') }}</option><option value="en-GB">{{ aj.gettext('English') }}</option><option value="fr-FR">{{ aj.gettext('French') }}</option></select></div><div class="col-sm-6 form-group"><label>{{ aj.gettext('Background color') }}</label><p>{{ aj.gettext('The color of the foreground will be adjusted automatically') }}</p><input v-model.trim="linbo.BackgroundColor" @input="invalidColor" data-model="config.config.LINBO.BackgroundColor" class="form-control" type="text" pattern="#[a-fA-F\d]+"><input type="color" :value="/^#[a-fA-F\d]{6}$/.test(linbo.BackgroundColor) ? linbo.BackgroundColor : '#000000'" :aria-label="aj.gettext('Background color')" @input="linbo.BackgroundColor = $event.target.value"></div></div>
            <div class="form-group"><label>{{ aj.gettext('Kernel options') }}</label><input v-model.trim="linbo.KernelOptions" data-model="config.config.LINBO.KernelOptions" class="form-control" type="text"><details><summary>{{ aj.gettext('Add') }}</summary><button v-for="option in kernelOptions" :key="option" class="btn btn-default" @click="linbo.KernelOptions += ' ' + option">{{ option }}</button></details></div>
        </div>
        <div v-show="tab === 'partitions'">
            <div v-for="(disk, diskIndex) in state.disks" :key="diskIndex"><br><label>Disk Type</label><select data-model="disk.DiskType" class="form-control" :value="disk.DiskType" style="width:200px" @change="diskType(diskIndex, $event)"><option value="sata">SATA</option><option value="mmc">MMCBLK</option><option value="nvme">NVME</option><option value="disk">Disk (uniform name)</option></select><label>{{ disk.name }}</label>
                <div class="partition-disk" style="overflow:hidden;border:1px solid #ccc;border-radius:5px;min-height:60px" :data-disk="diskIndex" @dragover.prevent @drop.prevent="move(diskIndex, disk.partitions.length)">
                    <div v-for="(partition, index) in disk.partitions" :key="index" class="partition-block" style="float:left;height:60px;padding:10px 20px;background:white;border:2px solid #ccc;border-radius:3px;margin:5px;min-width:200px" :style="{ borderColor: partitionColor(state, partition) }" draggable="true" @dragstart="dragging = { disk: diskIndex, index }" @dragend="dragging = null" @dragover.prevent @drop.stop.prevent="move(diskIndex, index)">
                        <button :data-remove-partition="index" class="btn btn-default pull-right" @click="remove(diskIndex,index)"><i class="fa fa-trash-o"></i></button><button :data-edit-partition="index" class="btn btn-default pull-right" @click="editPartition(diskIndex,index)"><i class="fa fa-pencil"></i></button><div class="ellipsis">{{ partitionName(state, partition, aj.gettext) }}</div><div>{{ bytes(partition) }}</div>
                    </div>
                    <button v-if="!disk.partitions.length" class="btn btn-default" @click="removeDisk(diskIndex)"><i class="fa fa-trash-o"></i> {{ aj.gettext('Remove this disk') }}</button>
                    <div style="clear:both"><button v-for="kind in partitionKinds" :key="kind" :data-kind="kind" class="btn" :class="['Windows','Linux'].includes(kind) ? 'btn-info' : ['Swap','Cache'].includes(kind) ? 'btn-warning' : ['Data','Extended'].includes(kind) ? 'btn-success' : 'btn-default'" style="margin:6px" @click="add(kind,diskIndex)"><i class="fa fa-plus"></i> {{ ['Windows','Linux'].includes(kind) ? kind : aj.gettext(kind) }}</button></div>
                </div>
            </div><br><button data-action="add-disk" class="btn btn-default" @click="state = addDisk(state)"><i class="fa fa-plus"></i> {{ aj.gettext('New disk') }}</button>
        </div>
        <div v-if="state.vdiconfig !== null" v-show="tab === 'vdi'">
            <label class="checkbox"><input v-model="vdiconfig.activated" data-model="vdiconfig.activated" type="checkbox">{{ aj.gettext('Activated') }}</label>
            <div v-if="vdiconfig.activated">
                <template v-for="section in vdiSections" :key="section.title"><div v-if="!section.expert || expert" class="panel panel-default">
                    <div class="panel-heading">{{ aj.gettext(section.title) }}</div><div class="panel-body">
                        <template v-for="group in section.groups" :key="group.label"><h4 v-if="group.label">{{ aj.gettext(group.label) }}</h4><div class="row">
                            <template v-for="field in group.fields" :key="field.key"><div v-if="!field.expert || expert" class="form-group col-sm-6"><label>{{ aj.gettext(field.label) }}</label><span v-if="field.expert"> (Expert)</span>
                                <select v-if="field.options" v-model="vdiconfig[field.key]" :data-model="'vdiconfig.'+field.key" class="form-control"><option v-for="(option,index) in field.options" :key="index" :value="option.value">{{ option.label }}</option></select>
                                <input v-else-if="field.type === 'number'" v-model.number="vdiconfig[field.key]" :data-model="'vdiconfig.'+field.key" class="form-control" type="number" @input="invalidNumber(field.key, $event)">
                                <input v-else v-model.trim="vdiconfig[field.key]" :data-model="'vdiconfig.'+field.key" class="form-control" type="text">
                            </div></template>
                        </div></template>
                        <template v-if="section.vmids"><ul class="list-group"><li v-for="(vmid,index) in vdiconfig.vmids" :key="index" class="list-group-item">{{ vmid }}<button :data-remove-vmid="index" class="badge pull-right" @click="vmidRemove(index)"><i class="fa fa-minus"></i></button></li></ul><input v-model.number="newvmid" data-model="newvmid" class="form-control" type="number" @input="($event.target.validity.badInput) && (newvmid = undefined)"><button data-action="add-vmid" class="btn" @click="vmidAdd"><i class="fa fa-plus"></i> {{ aj.gettext('Add new VMID') }}</button></template>
                    </div>
                </div></template>
                <label class="checkbox"><input v-model="expert" data-model="expert" type="checkbox">{{ aj.gettext('Expert options') }}</label>
            </div>
        </div>
    </div>
    <div class="modal-footer"><button data-action="save" class="btn btn-default btn-flat" @click="save">{{ aj.gettext('Save') }}</button><button data-action="backups" class="btn btn-default btn-flat" @click="backups"><i class="fa fa-history"></i></button><button data-action="cancel" class="btn btn-default btn-flat" @click="emit('cancel')">{{ aj.gettext('Close') }}</button></div>
</template>

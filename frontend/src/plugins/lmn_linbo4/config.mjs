import { openFileBackups } from '../../common/fileBackups.mjs';
import ConfigDialog from './ConfigDialog.vue';

const base = '/api/lmn/linbo4';
export const copy = value => JSON.parse(JSON.stringify(value));
const json = value => JSON.stringify(value, (key, item) => key.startsWith('$$') ? undefined : item);
const linboPatch = (state, fields) => ({ ...state, config: { ...state.config, config: {
    ...state.config.config, LINBO: { ...state.config.config.LINBO, ...fields },
} } });
const deviceTypes = [
    ['nvme', '/dev/nvme0n1p', 'nvme'], ['mmcblk', '/dev/mmcblk0p', 'mmc'],
    ['sd', '/dev/sdX', 'sata'], ['disk', '/dev/disk0p', 'disk'],
];

export function prepareEditor(config, vdiconfig) {
    const draft = copy(config);
    const partitions = draft.partitions.map(partition => ({ ...partition, _isCache: partition.Dev === draft.config.LINBO.Cache }));
    const colored = draft.config.LINBO.BackgroundColor
        ? { ...draft.config.LINBO, BackgroundColor: '#' + draft.config.LINBO.BackgroundColor } : draft.config.LINBO;
    const data = { ...draft, partitions, config: { ...draft.config, LINBO: colored } };
    const disks = partitions.reduce((result, partition) => {
        const [, prefix, DiskType] = deviceTypes.find(([text]) => partition.Dev.includes(text));
        const name = partition.Dev.substring(0, prefix.length);
        const existing = result.find(disk => disk.name === name);
        return existing ? result.map(disk => disk === existing ? { ...disk, partitions: [...disk.partitions, partition] } : disk)
            : [...result, { name, DiskType, partitions: [partition] }];
    }, []).map(disk => ({ ...disk, partitions: [...disk.partitions].sort((a, b) => a.Dev > b.Dev ? 1 : -1) }));
    // The original snapshots after cache/color decoration, before lexical disk sorting.
    return { config: data, vdiconfig: copy(vdiconfig), disks, backup: json(data) };
}

export function rebuildDisks(state) {
    const mappings = state.disks.flatMap(disk => disk.partitions.flatMap((partition, i) => partition.Dev ? [[partition.Dev, disk.name + (i + 1)]] : []));
    const remap = Object.fromEntries(mappings);
    const disks = state.disks.map(disk => ({ ...disk, partitions: disk.partitions.map((partition, i) => ({ ...partition, Dev: disk.name + (i + 1) })) }));
    const cache = disks.flatMap(disk => disk.partitions).filter(partition => partition._isCache).at(-1);
    const next = { ...state, disks, config: { ...state.config, os: state.config.os.map(os => ({ ...os,
        ...(os.Boot ? { Boot: remap[os.Boot] } : {}), ...(os.Root ? { Root: remap[os.Root] } : {}),
    })) } };
    return cache ? linboPatch(next, { Cache: cache.Dev }) : next;
}

function nextDevice(disks, type) {
    const prefix = { sata: '/dev/sd', mmc: '/dev/mmcblk', nvme: '/dev/nvme', disk: '/dev/disk' }[type];
    const suffix = { sata: '', mmc: 'p', nvme: 'n1p', disk: 'p' }[type];
    let token = type === 'sata' ? 'a' : '0';
    while (disks.some(disk => disk.name === prefix + token + suffix)) token = String.fromCharCode(token.charCodeAt(0) + 1);
    return prefix + token + suffix;
}
export const addDisk = state => ({ ...state, disks: [...state.disks, { name: nextDevice(state.disks, 'sata'), DiskType: 'sata', partitions: [] }] });
export const changeDiskType = (state, index, type) => rebuildDisks({ ...state,
    disks: state.disks.map((disk, i) => i === index ? { ...disk, name: nextDevice(state.disks, type), DiskType: type } : disk),
});
const defaults = {
    EFI: [true, 'vfat', 'ef', 204800], MSR: [false, '', '0c01', 131072],
    Windows: [true, 'ntfs', '7', '40G'], Linux: [true, 'ext4', '83', '20G'],
    Swap: [false, 'swap', '82', '4G'], Data: [false, 'ntfs', '7', '10G'],
    Extended: [false, '', '5', ''], Cache: [false, 'ext4', '83', ''],
};
export function addPartition(state, diskIndex, kind) {
    const [Bootable, FSType, Id, Size] = defaults[kind];
    const partition = { Bootable, FSType, Id, Size, Label: '', ...(kind === 'Cache' ? { _isCache: true } : {}) };
    const old = state.disks[diskIndex].partitions;
    const index = kind === 'EFI' ? 0 : kind === 'MSR' ? Math.min(1, old.length) : old.length;
    const disks = state.disks.map((disk, i) => i === diskIndex ? { ...disk, partitions: [...old.slice(0, index), partition, ...old.slice(index)] } : disk);
    const next = rebuildDisks({ ...state, disks });
    if (!['Windows', 'Linux'].includes(kind)) return next;
    const windows = kind === 'Windows', Dev = next.disks[diskIndex].partitions[index].Dev;
    const os = {
        Name: windows ? 'Windows 10' : 'Ubuntu', Version: '', Description: windows ? 'Windows 10' : 'Ubuntu 16.04',
        // Parent Angular scope never initializes image_extension; keep that observable default.
        IconName: (windows ? 'win10.' : 'ubuntu.') + 'undefined', Image: '', BaseImage: '', Root: Dev, Boot: Dev,
        Kernel: windows ? 'auto' : 'vmlinuz', Initrd: windows ? '' : 'initrd.img', Append: windows ? '' : 'ro splash',
        StartEnabled: true, SyncEnabled: true, NewEnabled: true, Hidden: true, Autostart: false, AutostartTimeout: 5, DefaultAction: 'sync',
    };
    return { ...next, config: { ...next.config, os: [...next.config.os, os] } };
}
export const removePartition = (state, diskIndex, index) => rebuildDisks({ ...state,
    disks: state.disks.map((disk, i) => i === diskIndex ? { ...disk, partitions: disk.partitions.filter((_, j) => j !== index) } : disk),
});
export const getOS = (state, partition) => state.config.os.find(os => os.Root === partition.Dev) || null;
export function partitionSize(partition) {
    if (!partition.Size || !partition.Size.toLowerCase) return;
    const size = partition.Size.toLowerCase();
    return parseInt(size, 10) * 1024 * ({ m: 1024, g: 1024 ** 2, t: 1024 ** 3 }[size.at(-1)] || 1);
}
export function partitionName(state, partition, gettext) {
    return getOS(state, partition)?.Name || partition.Label || (partition.FSType === 'swap' ? gettext('Swap')
        : partition._isCache ? gettext('LINBO Cache') : partition.Id === 'ef' ? 'EFI' : partition.Id === '0c01' ? 'MSR' : 'Partition');
}
export function partitionColor(state, partition) {
    return partition.Dev === state.config.config.LINBO.Cache ? '#F3E000' : partition.FSType === 'swap' ? '#E09305'
        : ['ef', '0c01'].includes(partition.Id) ? '#737373' : getOS(state, partition) ? '#3232B7' : '#58B158';
}
export function saveEditor(state) {
    const data = { ...state.config, partitions: state.disks.flatMap(disk => disk.partitions) };
    const changed = json(data) !== state.backup;
    const color = data.config.LINBO.BackgroundColor;
    return [color ? { ...data, config: { ...data.config, LINBO: { ...data.config.LINBO, BackgroundColor: color.substring(1) } } } : data, state.vdiconfig, changed];
}

// v-model writes replace the local draft object; props and HTTP response objects stay untouched.
export function modelFields(read, write, normalize = (_, value) => value) {
    return new Proxy({}, { get: (_, key) => read()?.[key], set: (_, key, value) => { write({ ...read(), [key]: normalize(key, value) }); return true; } });
}

export async function editConfig(aj, name, changed) {
    let result;
    try {
        const config = await aj.http.get(`${base}/config/${name}`);
        const vdiconfig = await aj.http.get(`${base}/vdi/${name}.vdi`);
        result = await aj.modal.open(ConfigDialog, { config: config.data, vdiconfig: vdiconfig.data });
    } catch { return; /* Cancelled modal or shell-owned HTTP rejection. */ }
    if (!result) return;
    const writes = result[2] === true ? [aj.http.post(`${base}/config/${name}`, result[0]).then(() => {
        aj.notify.success(name + ' ' + aj.gettext('saved')); changed();
    })] : [];
    // VDI always saves, including null; independent of config POST success.
    await Promise.allSettled([...writes, aj.http.post(`${base}/vdi/${name}.vdi`, result[1]).then(() => aj.notify.success(aj.gettext('VDI config saved')))]);
}

/** Keep the LINBO editor's close-before-confirm and reopen-after-delete workflow. */
export function configBackups(aj, group) {
    const path = '/srv/linbo/start.conf.' + group;
    const show = () => openFileBackups(aj, path, undefined, { deleteAction });
    const deleteAction = async backup => {
        try {
            await aj.messagebox.show({ title: aj.gettext('Confirmation'),
                text: aj.gettext('Do you really want to delete') + backup.name + ' ?', positive: 'OK', negative: aj.gettext('Cancel') });
        } catch { return; /* Both editors have already closed, also on cancellation. */ }
        const deletion = aj.http.post('/api/lmn/remove-file', { filepath: '/srv/linbo/' + backup.name })
            .catch(() => { /* The original shell owns HTTP failures; reopening does not await deletion. */ });
        aj.notify.success(aj.gettext('Backup file removed'));
        show().catch(() => { /* Closing the reopened backup list is normal modal cancellation. */ });
        await deletion;
    };
    return show();
}

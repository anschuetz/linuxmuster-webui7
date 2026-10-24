export const editorConfig = () => ({
    config: { LINBO: { Group: 'p84', Server: '192.0.2.84', RootTimeout: '600', Cache: '/dev/sda3', School: 'default-school', BackgroundColor: '112233', KernelOptions: 'quiet', SystemType: 'efi64', DownloadType: 'torrent' } },
    partitions: [
        { Dev: '/dev/sda1', Bootable: true, FSType: 'vfat', Id: 'ef', Size: 204800, Label: '' },
        { Dev: '/dev/sda2', Bootable: true, FSType: 'ext4', Id: '83', Size: '20G', Label: 'Linux' },
        { Dev: '/dev/sda3', Bootable: false, FSType: 'ext4', Id: '83', Size: '', Label: '' },
    ],
    os: [{ Name: 'Ubuntu', Root: '/dev/sda2', Boot: '/dev/sda2', IconName: 'ubuntu.svg', BaseImage: 'missing.qcow2', Kernel: 'vmlinuz', Initrd: 'initrd.img', Append: 'ro splash', DefaultAction: 'sync', StartEnabled: true, SyncEnabled: true, NewEnabled: true, Hidden: true, Autostart: false, AutostartTimeout: 5 }],
});
export const editorVDI = () => ({ activated: true, name: 'p84-vdi', bios: 'uefi', ostype: 'l26', cores: 2, memory: 2048, vmids: [101, 102], minimum_vms: 1, maximum_vms: 5, prestarted_vms: 1 });

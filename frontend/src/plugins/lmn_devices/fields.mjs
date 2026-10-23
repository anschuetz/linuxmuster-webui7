export const fields = [
    ['room', 'Room', true, 'Room'], ['hostname', 'Hostname', true, 'Host'],
    ['group', 'Group', true, 'LinboConf'], ['mac', 'MAC', true, 'Mac'], ['ip', 'IP', true, 'IP'],
    ['officeKey', 'Office Key', false], ['windowsKey', 'Windows Key', false],
    ['dhcpOptions', 'DHCP-Options', false], ['sophomorixRole', 'Sophomorix-Role', true, 'Role'],
    ['lmnReserved10', 'LMN-Reserved 10', false], ['pxeFlag', 'PXE', true],
    ['lmnReserved12', 'LMN-Reserved 12', false], ['lmnReserved13', 'LMN-Reserved 13', false],
    ['lmnReserved14', 'LMN-Reserved 14', false], ['sophomorixComment', 'Sophomorix-Comment', false, 'Comment'],
];
export const roles = [
    ['classroom-studentcomputer', 'classroom-studentcomputer'], ['classroom-teachercomputer', 'classroom-teachercomputer'],
    ['staffcomputer', 'Staffcomputer'], ['faculty-teachercomputer', 'Faculty-Teachercomputer'],
    ['server', 'Server'], ['router', 'router'], ['switch', 'Switch'], ['printer', 'Printer'],
    ['thinclient', 'Thinclient'], ['byod', 'BYOD'], ['voip', 'VOIP'], ['wlan', 'WLan'],
    ['iponly', 'IP-Only'], ['mobile', 'Mobile'], ['addc', 'Domain-Controller'],
];
export const pxe = [['0', 'No PXE'], ['1', 'Linbo-PXE'], ['2', 'Linbo-PXE + OPSI-MGMT'], ['3', 'OPSI-PXE']];
export function newDevice() {
    return { ...Object.fromEntries(fields.map(([id]) => [id, ''])), _isNew: true, pxeFlag: '0', sophomorixRole: 'classroom-studentcomputer' };
}

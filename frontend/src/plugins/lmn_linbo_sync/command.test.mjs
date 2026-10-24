import { expect, it } from 'vitest';
import { groups, parameters } from '../../../e2e/fixtures/linboSync.mjs';
import { initialCommand, selectHost, changeOS, changeAuto, changePower, buildCommand, syncDate } from './command.mjs';
const group = () => groups().p52group;
const selected = hosts => ({ ...initialCommand(), host: hosts });
it('keeps initial, no host and no action states distinct', () => {
    expect(initialCommand()).toEqual({ cmd: [], cmd_parameters: [], show: false, host: [], target: 'clients' });
    expect(buildCommand('p52group', group(), initialCommand(), 'default-school')).toEqual({ cmd: '', cmd_parameters: [], show: false, host: [], target: 'clients' });
    expect(buildCommand('p52group', group(), selected(['192.0.2.1']), 'default-school').show).toEqual(false);
});
it('selects individual hosts in click order, promotes all to group and clears group selection', () => {
    const g = group(), before = initialCommand();
    let c = selectHost('p52group', g, before, '192.0.2.2');
    expect(c).toEqual({ ...before, host: ['192.0.2.2'] });
    c = selectHost('p52group', g, c, '192.0.2.1');
    c = selectHost('p52group', g, c, '192.0.2.2');
    expect(c.host).toEqual(['192.0.2.1']);
    c = selectHost('p52group', g, c, 'p52group');
    expect(c).toEqual({ ...before, host: ['192.0.2.1', '192.0.2.2', '192.0.2.3'], target: 'group' });
    expect(selectHost('p52group', g, c, 'p52group')).toEqual(before);
    expect(before.host).toEqual([]);
});
it('preserves new/sync parameter mismatch and creates independent host payloads in selection order', () => {
    const g = changeOS(group(), 0, 'new');
    const result = buildCommand('p52group', g, selected(['192.0.2.2', '192.0.2.1']), 'other-school');
    expect(result).toEqual({ host: ['192.0.2.2', '192.0.2.1'], target: 'clients', show: true,
        cmd: ['/usr/sbin/linbo-remote -s other-school -i 192.0.2.2 -c new:1', '/usr/sbin/linbo-remote -s other-school -i 192.0.2.1 -c new:1'],
        cmd_parameters: [parameters('192.0.2.2'), parameters()] });
    expect(result.cmd_parameters[0] === result.cmd_parameters[1]).toEqual(false);
});
it('formats, syncs and starts in original ordering with partition, WOL and all flags', () => {
    let g = changeOS(group(), 0, 'format'); g = changeOS(g, 0, 'sync'); g = changeOS(g, 1, 'start');
    for (const flag of ['partition', 'wol', 'disable_gui', 'broadcast', 'bypass', 'prestart']) g = changeAuto(g, flag);
    g = { ...changePower(g, 'reboot'), power: { halt: 'reboot', timeout: 42 } };
    const result = buildCommand('p52group', g, selected(g.hosts.map(h => h.ip)), 'default-school');
    expect(result.cmd).toEqual(['/usr/sbin/linbo-remote -g p52group -w 42 -d  -u  -n  -p  partition,format,format:1,sync:1,start:2,reboot']);
    expect(result.cmd_parameters).toEqual([parameters('p52group', { target: { type: 'group', host: 'p52group' }, timeout: 42, prestart: true, disable_gui: true, broadcast: true, bypass: true, partition: true, actions: { format: [1], sync: [1], start: [2] }, acpi: 'reboot' })]);
});
it('new resets format on both clicks; format cancels new but preserves sync', () => {
    let g = changeOS(group(), 0, 'format');
    expect(g.os[0].run_format).toEqual(1);
    g = changeOS(g, 0, 'new'); expect([g.os[0].run_format, g.os[0].run_sync]).toEqual([0, 'new']);
    g = changeOS(g, 0, 'new'); expect([g.os[0].run_format, g.os[0].run_sync]).toEqual([0, 0]);
    g = changeOS(g, 0, 'new'); g = changeOS(g, 0, 'format'); expect(g.os[0].run_sync).toEqual(0);
    g = changeOS(g, 0, 'format'); expect(g.os[0].run_format).toEqual(0);
    g = changeOS(g, 0, 'sync'); g = changeOS(g, 0, 'format'); expect(g.os[0].run_sync).toEqual('sync');
    g = changeOS(g, 0, 'sync'); expect(g.os[0].run_sync).toEqual(0);
});
it('allows one start except duplicate baseimages as in original; toggles power and auto', () => {
    const source = group(); let g = changeOS(source, 0, 'start'); g = changeOS(g, 1, 'start');
    expect(g.os.map(o => o.run_start)).toEqual([0, 1]);
    g = changeOS(g, 1, 'start'); expect(g.os.map(o => o.run_start)).toEqual([0, 0]);
    const duplicate = { ...source, os: [source.os[0], { ...source.os[0] }] };
    expect(changeOS(changeOS(duplicate, 0, 'start'), 1, 'start').os.map(o => o.run_start)).toEqual([1, 1]);
    expect(changePower(changePower(source, 'halt'), 'halt').power.halt).toEqual(0);
    expect(changePower(changePower(source, 'halt'), 'reboot').power.halt).toEqual('reboot');
    expect(changeAuto(changeAuto(source, 'bypass'), 'bypass').auto.bypass).toEqual(0);
    expect(source).toEqual(group());
});
it('ignores bypass without WOL, allows halt-only, and clears previews when last host removed', () => {
    const g = changeAuto(changePower(group(), 'halt'), 'bypass');
    const c = selected(['192.0.2.1']);
    expect(buildCommand('p52group', g, c, 'default-school').cmd_parameters).toEqual([parameters('192.0.2.1', { actions: { format: [], sync: [], start: [] }, acpi: 'halt' })]);
    expect(buildCommand('p52group', g, selectHost('p52group', g, c, '192.0.2.1'), 'default-school').cmd).toEqual('');
});
it('preserves numeric date display in local time and never marker', () => {
    const d = new Date(2024, 0, 1, 2, 3, 4);
    expect(syncDate(d.getTime() / 1000)).toEqual('01 Jan 2024 02:03:04');
    expect(syncDate('Never')).toEqual('');
});

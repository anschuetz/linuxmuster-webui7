export const initialCommand = () => ({ cmd: [], cmd_parameters: [], show: false, host: [], target: 'clients' });

export function selectHost(name, group, command, ip) {
    if (name === ip) {
        const select = command.target === 'clients';
        return { ...command, host: select ? group.hosts.map(h => h.ip) : [], target: select ? 'group' : 'clients' };
    }
    return { ...command, target: 'clients', host: command.host.includes(ip) ? command.host.filter(h => h !== ip) : [...command.host, ip] };
}

export function changeOS(group, index, action) {
    const current = group.os[index];
    const patch = action === 'new' ? { run_format: 0, run_sync: current.run_sync === 'new' ? 0 : 'new' }
        : action === 'sync' ? { run_sync: current.run_sync === 'sync' ? 0 : 'sync' }
            : action === 'format' ? { run_format: current.run_format === 1 ? 0 : 1,
                ...(current.run_format !== 1 && current.run_sync === 'new' ? { run_sync: 0 } : {}) }
                : { run_start: current.run_start === 1 ? 0 : 1 };
    return { ...group, os: group.os.map((os, i) => i === index ? { ...os, ...patch }
        : action === 'start' && os.baseimage !== current.baseimage ? { ...os, run_start: 0 } : os) };
}
export const changeAuto = (group, key) => ({ ...group, auto: { ...group.auto, [key]: 1 - group.auto[key] } });
export const changePower = (group, value) => ({ ...group, power: { ...group.power, halt: group.power.halt === value ? 0 : value } });

const append = (cmd, parts) => parts.length ? cmd + (cmd.length > 4 ? ',' : '') + parts.join() : cmd;
function actionsFor(group) {
    return {
        format: group.os.flatMap(os => os.run_format ? [os.partition] : []),
        sync: group.os.flatMap((os, i) => os.run_sync ? [i + 1] : []),
        start: group.os.flatMap((os, i) => os.run_start ? [i + 1] : []),
    };
}
function actionText(group, actions) {
    let cmd = group.auto.prestart > 0 ? ' -p ' : ' -c ';
    if (group.auto.partition > 0) cmd += ' partition,format';
    cmd = append(cmd, actions.format.map(p => `format:${p}`));
    // The preview says new; the structured payload intentionally only has sync positions.
    cmd = append(cmd, group.os.flatMap((os, i) => os.run_sync ? [`${os.run_sync}:${i + 1}`] : []));
    cmd = append(cmd, actions.start.map(p => `start:${p}`));
    return append(cmd, group.power.halt ? [group.power.halt] : []);
}
export function buildCommand(name, group, command, school) {
    const actions = actionsFor(group), cmd = actionText(group, actions);
    if (cmd.length <= 4 || command.host.length === 0) return { ...command, cmd: '', cmd_parameters: [], show: false };
    const auto = group.auto, wol = auto.wol > 0;
    const timeout = wol ? ` -w ${group.power.timeout}` : '';
    const flags = (auto.disable_gui > 0 ? ' -d ' : '') + (auto.broadcast > 0 ? ' -u ' : '') + (auto.bypass > 0 && timeout ? ' -n ' : '');
    const isGroup = command.target === 'group' || command.host.length === group.hosts.length;
    const type = isGroup ? 'group' : 'host', targets = isGroup ? [name] : command.host;
    const remote = school === undefined ? undefined : '/usr/sbin/linbo-remote' + (school === 'default-school' ? '' : ` -s ${school}`);
    return {
        ...command, target: isGroup ? 'group' : 'clients', show: true,
        cmd: targets.map(host => `${remote}${isGroup ? ' -g ' : ' -i '}${host}${timeout}${flags}${cmd}`),
        cmd_parameters: targets.map(host => ({
            target: { type, host }, timeout: wol ? group.power.timeout : 0,
            prestart: auto.prestart > 0, disable_gui: auto.disable_gui > 0, broadcast: auto.broadcast > 0,
            bypass: auto.bypass > 0 && Boolean(timeout), partition: auto.partition > 0,
            actions: { format: [...actions.format], sync: [...actions.sync], start: [...actions.start] }, acpi: group.power.halt || '',
        })),
    };
}
export function syncDate(seconds) {
    if (seconds === 'Never') return '';
    const date = new Date(seconds * 1000);
    if (!Number.isFinite(date.getTime())) return '';
    const pad = n => String(n).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${pad(date.getDate())} ${months[date.getMonth()]} ${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

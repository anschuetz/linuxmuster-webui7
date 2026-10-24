// Synthetic documentation-network clients: shared unchanged by both UI oracles.
export const groups = () => ({
    p52group: {
        hosts: [1, 2, 3].map(n => ({ hostname: `p52client${n}`, ip: `192.0.2.${n}`, mac: `02:00:00:00:00:0${n}`, image: [{ date: n === 1 ? 1704067200 : 'Never', status: n === 1 ? 'success' : 'danger' }, { date: 'Never', status: 'danger' }] })),
        os: [{ baseimage: 'p52linux', partition: 1, start_enabled: true, new_enabled: true }, { baseimage: 'p52windows', partition: 2, start_enabled: true, new_enabled: false }],
        auto: { partition: 0, prestart: 0, disable_gui: 0, broadcast: 0, bypass: 0, wol: 0 },
        power: { halt: 0, timeout: 60 },
    },
    second: { hosts: [], os: [], auto: { partition: 0, prestart: 0, disable_gui: 0, broadcast: 0, bypass: 0, wol: 0 }, power: { halt: 0, timeout: 60 } },
});
export const parameters = (host = '192.0.2.1', overrides = {}) => ({
    target: { type: 'host', host }, timeout: 0, prestart: false, disable_gui: false,
    broadcast: false, bypass: false, partition: false,
    actions: { format: [], sync: [1], start: [] }, acpi: '', ...overrides,
});

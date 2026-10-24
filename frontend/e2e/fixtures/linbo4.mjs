export const configs = () => [
    { file: 'start.conf.zulu', images: ['linux.qcow2', 'legacy.cloop'], settings: {} },
    { file: 'start.conf.other', images: [], settings: { School: 'other-school' } },
    { file: 'start.conf.alpha', images: ['linux.qcow2'], settings: { School: 'default-school' } },
    { file: 'start.conf.local', images: [], settings: { School: 'p83-school' } },
];
export const images = () => [{ name: 'linux', backups: { '20241001': { timestamp: 1 } } }];
export const config = () => ({ config: { LINBO: { Group: 'source', Server: '192.0.2.1', Cache: '/dev/sda3' } }, os: [], partitions: [] });
export const examples = ['start.conf.p83example'];

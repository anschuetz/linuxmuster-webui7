export function formatUptime(value) {
    if (value == null) return '--:--:--';
    const days = value >= 86400 ? `${Math.floor(value / 86400)}d ` : '';
    return days + [Math.floor(value / 3600) % 24, Math.floor(value / 60) % 60, Math.floor(value) % 60].map(x => String(x).padStart(2, '0')).join(':');
}
export function formatBytes(value, gettext = x => x) {
    if (isNaN(parseFloat(value)) || !isFinite(value)) return '-';
    if (value === 0) return gettext('0 bytes');
    const unit = Math.floor(Math.log(value) / Math.log(1024)), amount = value / 1024 ** unit;
    return `${unit === 0 ? Math.floor(amount) : amount.toFixed(1)} ${gettext(['bytes', 'KB', 'MB', 'GB', 'TB', 'PB'][unit])}`;
}
// Angular ships a static en-US $locale; this route uses its local-time date filter.
export function sessionDate(timestamp) {
    if (timestamp == null) return '';
    const date = new Date(timestamp * 1000), pad = x => String(x).padStart(2, '0');
    if (Number.isNaN(date.getTime())) return 'Invalid Date';
    const month = ['January','February','March','April','May','June','July','August','September','October','November','December'][date.getMonth()];
    return `${pad(date.getDate())} ${month} ${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

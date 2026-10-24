import { createValidation } from '../../common/validation.mjs';
import ImageDialog from './ImageDialog.vue';
const base = '/api/lmn/linbo4';

// Ajenti core bytes filter, including its invalid/zero and rounding behavior.
export function imageBytes(bytes, gettext) {
    if (isNaN(parseFloat(bytes)) || !isFinite(bytes)) return '-';
    if (bytes === 0) return gettext('0 bytes');
    const units = ['bytes', 'KB', 'MB', 'GB', 'TB', 'PB'].map(gettext);
    const number = Math.floor(Math.log(bytes) / Math.log(1024));
    const value = bytes / Math.pow(1024, number);
    return (number === 0 ? Math.floor(value) : value.toFixed(1)) + ' ' + units[number];
}
export const textRows = text => text ? text.split(/\r\n|\r|\n/).length + 1 : 1;
export const copyImage = image => JSON.parse(JSON.stringify(image));

export function createImageActions(aj, replaceImage = () => {}) {
    const validation = createValidation(aj);
    async function restartServices() {
        aj.notify.info(aj.gettext('Restarting multicast and torrent services, please wait ...'), '', { timeout: 7000 });
        try { await aj.http.get(`${base}/restart-services`); }
        catch {
            aj.notify.error(aj.gettext('Failed to restart multicast and torrent services. Please see the log files'));
            return;
        }
        aj.notify.success(aj.gettext('Multicast and torrent services restarted'));
        window.location.hash = 'images';
        aj.reload();
    }
    async function changeName(action, image) {
        let message;
        try { message = await aj.messagebox.prompt('New name', image.name); }
        catch { return; /* Cancelled prompt. */ }
        if (validation.isValidImage(message.value) !== true) {
            aj.notify.error(aj.gettext(message.value + ' is not a valid name for a linbo image.'));
            return;
        }
        try { await aj.http.post(`${base}/${action}/${image.name}`, { new_name: message.value }); }
        catch { return; /* Original shell owns HTTP rejection, without local success state. */ }
        await restartServices();
    }
    const renameImage = image => changeName('renameImage', image);
    const duplicateImage = image => changeName('duplicateImage', image);
    async function editImage(image, images) {
        let result;
        try { result = await aj.modal.open(ImageDialog, { image, images, renameImage }); }
        catch { return; /* Modal dismissal. */ }
        if (!result) return;
        // Angular copies the returned draft into its list even if POST later fails.
        replaceImage(image, result);
        try {
            if (result.backup) await aj.http.post(`${base}/saveBackupImage/${result.name}`, { data: result, timestamp: result.timestamp });
            else await aj.http.post(`${base}/images/${result.name}`, { data: result, diff: result.diff });
        } catch { return; /* Retain the already published draft, as in Angular. */ }
        aj.notify.success(aj.gettext(result.backup ? 'Backup saved' : 'Saved'));
        await restartServices();
    }
    return { restartServices, renameImage, duplicateImage, editImage };
}

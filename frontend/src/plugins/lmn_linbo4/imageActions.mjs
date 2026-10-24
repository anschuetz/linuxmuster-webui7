const base = '/api/lmn/linbo4';

/** Keep the backup map and list on the same replacement objects, as in Angular. */
export function replaceImage(images, original, result) {
    return images.map(image => {
        if (image === original) return {
            ...result, backups_list: result.backups_list?.map(backup => result.backups[backup.date]),
        };
        if (image.diff_image === original) return { ...image, diff_image: result };
        if (!Object.values(image.backups).includes(original)) return image;
        const backups = Object.fromEntries(Object.entries(image.backups)
            .map(([date, backup]) => [date, backup === original ? result : backup]));
        return { ...image, backups, backups_list: image.backups_list.map(backup => backup === original ? result : backup) };
    });
}

export function createDestructiveActions(aj, restartServices) {
    async function confirmed(options, requests, errorText, imagesHash = false) {
        try { await aj.messagebox.show({ ...options, negative: 'Cancel' }); }
        catch { return; /* Cancelled confirmation. */ }
        try { await requests(); }
        catch (error) {
            aj.notify.error(aj.gettext(errorText) + error.data?.message);
            return;
        }
        const restart = restartServices();
        if (imagesHash) window.location.hash = 'images';
        await restart;
    }
    const deleteImage = image => confirmed({
        title: `Delete '${image.name}' ?`,
        text: `This deletes the whole directory /srv/linbo/images/${image.name}, with its backups, its differential image and every file in it, including files added by hand.`,
        positive: 'Delete',
    }, () => aj.http.delete(`${base}/images/${image.name}`), 'Failed to delete image :', true);
    const deleteDiffImage = image => confirmed({
        text: `Delete '${image.name}' differential image?`, positive: 'Delete',
    }, () => aj.http.delete(`${base}/deleteDiffImage/${image.name}`), 'Failed to delete backup :');
    const deleteBackupImage = (image, date) => confirmed({
        title: `Delete the backup of '${image.name}' ?`,
        text: `This deletes the whole backup directory of ${date} in /srv/linbo/images/${image.name}/backups, including files added by hand.`,
        positive: 'Delete',
    }, () => aj.http.post(`${base}/deleteBackupImage/${image.name}`, { date }), 'Failed to delete backup :');
    const restoreBackup = (image, date) => confirmed({
        text: `Do you really want to restore the backup at '${date}'? This will move the actual image to a backup.`, positive: 'Restore',
    }, () => aj.http.post(`${base}/restoreBackupImage/${image.name}`, { date }), 'Failed to restore backup! ');
    const deleteImages = images => confirmed({
        title: `Delete '${images.map(image => image.name).toString()}' ?`,
        text: 'This deletes the whole directory of each image in /srv/linbo/images, with its backups, its differential image and every file in it, including files added by hand.',
        positive: 'Delete',
    }, () => Promise.all(images.map(image => aj.http.delete(`${base}/images/${image.name}`))), 'Failed to delete image :', true);
    return { deleteImage, deleteDiffImage, deleteBackupImage, restoreBackup, deleteImages };
}

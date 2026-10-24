import FileBackupsDialog from './FileBackupsDialog.vue';

/** options.deleteAction(backup) owns confirmation/removal/reopening after the dialog closes. */
export function openFileBackups(aj, path, encoding, options = {}) {
    return aj.modal.open(FileBackupsDialog, { ...options, path, encoding });
}

import FileBackupsDialog from './FileBackupsDialog.vue';

export function openFileBackups(aj, path, encoding) {
    return aj.modal.open(FileBackupsDialog, { path, encoding });
}

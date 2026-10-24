import FileEditorDialog from './FileEditorDialog.vue';

export function openFileEditor(aj, path, encoding) {
    return aj.modal.open(FileEditorDialog, { path, encoding });
}

export { filesystemUrl as fileUrl } from './filesystem.mjs';

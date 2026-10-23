import FileEditorDialog from './FileEditorDialog.vue';

export function openFileEditor(aj, path, encoding) {
    return aj.modal.open(FileEditorDialog, { path, encoding });
}

// Keep separators intact; escape filename/query characters before using filesystem routes.
export function fileUrl(operation, path, encoding = 'utf-8') {
    const escaped = path.split('/').map(encodeURIComponent).join('/');
    return `/api/filesystem/${operation}/${escaped}?encoding=${encodeURIComponent(encoding || 'utf-8')}`;
}

import { reactive } from 'vue';
import ImportDialog from './ImportDialog.vue';

/** LINBO's import controller: failure toggles rather than unconditionally showing the log. */
export function createImport(aj) {
    const state = reactive({ working: true, logVisible: true });
    const toggleLog = () => { state.logVisible = !state.logVisible; };
    aj.http.post('/api/lmn/devices/import').then(() => {
        state.working = false;
        aj.notify.success(aj.gettext('Import complete'));
    }, cause => {
        aj.notify.error(aj.gettext('Import failed'), cause.data?.message);
        state.working = false;
        toggleLog();
    });
    return { state, toggleLog };
}

export async function importDevices(aj, clearChanged) {
    const result = aj.modal.open(ImportDialog, {}, { backdrop: 'static' });
    // Angular clears config_change as soon as open() returns, even on failure/Escape.
    clearChanged();
    try { await result; }
    catch { return; /* Escape/navigation dismisses without the explicit close/reload action. */ }
    aj.reload();
}

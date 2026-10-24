import CheckDialog from './CheckDialog.vue';

export function summarySelection(data) {
    return {
        doAdd: data.SUMMARY[1].ADD.RESULT > 0,
        doMove: data.SUMMARY[2].UPDATE.RESULT > 0,
        doKill: data.SUMMARY[3].KILL.RESULT > 0,
    };
}

export function applySelection(mode, selected) {
    if (['add', 'move', 'kill'].includes(mode)) {
        return { doAdd: mode === 'add', doMove: mode === 'move', doKill: mode === 'kill' };
    }
    // The Errors tab deliberately uses the Summary selection, as in Angular.
    return { ...selected };
}

const statuses = {
    U: 'Usable (U)', A: 'Activated (A)', E: 'Enabled (E)', S: 'Self-activated (S)',
    P: 'Permanent (P)', T: 'Tolerated (T)', L: 'Locked (L)', D: 'Deactivated (D)',
    F: 'Frozen (F)', R: 'Removable (R)', K: 'Killable (K)', X: 'Exam (X)', M: 'Managed (M)',
};
export function statusName(status) {
    return Object.hasOwn(statuses, status) ? statuses[status] : status;
}

/** Shared workflow entry for Settings and the later users/list-management ports. */
export function openUsersCheck(aj) {
    return aj.modal.open(CheckDialog, {}, { backdrop: 'static' });
}

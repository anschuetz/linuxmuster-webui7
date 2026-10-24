// Synthetic sophomorix response shared by both UIs. Never apply a real user list.
export function result({ add = 1, move = 1, kill = 1, errors = 1 } = {}) {
    return {
        OUTPUT: [{ TYPE: 'INFO', MESSAGE_EN: 'fixture check' }],
        SUMMARY: [{}, { ADD: { RESULT: add } }, { UPDATE: { RESULT: move } }, { KILL: { RESULT: kill } }, {}, { ERROR: { RESULT: errors } }],
        CHECK_RESULT: {
            ERRORLIST: [],
            ADD: add ? { 'p119-new': { sophomorixAdminClass: 'p119-class', sn: 'Synthetic', givenName: 'New', sophomorixRole: 'student', sophomorixSchoolname: 'default-school' } } : {},
            UPDATE: move ? { 'p119-move': { sophomorixStatus: { OLD: 'U', NEW: 'K' }, sophomorixAdminClass: { OLD: 'attic', NEW: 'p119-class' }, custom: { OLD: 'before', NEW: 'after' } } } : {},
            KILL: kill ? { 'p119-kill': { IDENTIFIER_ASCII: 'Synthetic_Kill' } } : {},
            ERROR: errors ? { 'p119-error': { REASON: 'Synthetic reason' } } : {},
        },
    };
}

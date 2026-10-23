import { computed } from 'vue';

// UI visibility only; backend authorization remains mandatory.
// The adapter exposes user=null before identity.promise resolves. Like the
// original directives, leave content visible until that snapshot arrives.
const useAccess = (aj, permits) => computed(() =>
    aj.identity.user === null || permits(aj.identity.profile.sophomorixRole));

/** adminAccess.es:14-18. Use v-if with an explanatory v-else blocker. */
export const useAdminAccess = (aj) => useAccess(aj, (role) =>
    role == 'globaladministrator' || role == 'schooladministrator');

/** globalAdminAccess.es:14-18. Use v-if with an explanatory v-else blocker. */
export const useGlobalAdminAccess = (aj) => useAccess(aj, (role) =>
    role == 'globaladministrator');

/** sambaAccess.es:16-20 checks role truthiness, not a named permission. */
export const useSambaAccess = (aj) => useAccess(aj, (role) => Boolean(role));

/** teacherAccess.es:14-18 denies only students, including no other role filter. */
export const useTeacherAccess = (aj) => useAccess(aj, (role) => role != 'student');

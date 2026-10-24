import { createApp } from 'vue';
import Students from './Students.vue';
import ListManagement from './ListManagement.vue';
import Teachers from './Teachers.vue';
import Staff from './Staff.vue';
import Parents from './Parents.vue';
import ExtraStudents from './ExtraStudents.vue';
import ExtraCourses from './ExtraCourses.vue';
import PrintPasswords from './PrintPasswords.vue';
import GlobalAdmins from './GlobalAdmins.vue';
import SchoolAdmins from './SchoolAdmins.vue';
const views = { globaladmins: GlobalAdmins, schooladmins: SchoolAdmins, listmanagement: ListManagement, students: Students, teachers: Teachers, staff: Staff, parents: Parents, 'extra-students': ExtraStudents, 'extra-courses': ExtraCourses, 'print-passwords': PrintPasswords };
// Admin and printing routes are active; P118/P120 tables remain available to the fixture harness.
// P123 adds listmanagement only for the fixture harness; its Angular route stays active.
export function mount(element, aj, { view = element.getAttribute('view') || 'students' } = {}) {
    const app = createApp(views[view]);
    app.provide('aj', aj);
    app.config.globalProperties.$gettext = aj.gettext;
    app.mount(element);
    return () => app.unmount();
}

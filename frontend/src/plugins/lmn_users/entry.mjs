import { createApp } from 'vue';
import Students from './Students.vue';
import Teachers from './Teachers.vue';
import Staff from './Staff.vue';
import Parents from './Parents.vue';
const views = { students: Students, teachers: Teachers, staff: Staff, parents: Parents };
// Fixture mount only in P118. Existing Angular routes/templates stay active.
export function mount(element, aj, { view = element.getAttribute('view') || 'students' } = {}) {
    const app = createApp(views[view]);
    app.provide('aj', aj);
    app.config.globalProperties.$gettext = aj.gettext;
    app.mount(element);
    return () => app.unmount();
}

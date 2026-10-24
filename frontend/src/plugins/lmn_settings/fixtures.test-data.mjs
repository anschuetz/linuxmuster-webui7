export function schoolSettings() {
    const files = Object.fromEntries(['students', 'teachers', 'extrastudents', 'extraclasses'].map(role => [`userfile.${role}.csv`, { ENCODING: 'UTF8', FILTERSCRIPT: '---' }]));
    const roles = Object.fromEntries(['role.student', 'role.teacher', 'role.schooladministrator', 'type.adminclass', 'type.teacherclass', 'type.project'].map(role => [role, {}]));
    return { ...files, ...roles, school: { SCHOOL_LONGNAME: 'Test School', PRINTSERVER: 'server' } };
}
export function customConfig() {
    const roles = ['students', 'teachers', 'schooladministrators', 'globaladministrators'];
    const fields = () => Object.fromEntries(roles.map(role => [role, Object.fromEntries([1, 2, 3, 4, 5].map(n => [n, { title: '', show: false, editable: false }]))]));
    return { custom: fields(), customMulti: fields(), customDisplay: Object.fromEntries(roles.map(role => [role, {}])), proxyAddresses: Object.fromEntries(roles.map(role => [role, { title: '', show: false, editable: false }])), passwordTemplates: { individual: '/individual.tex', multiple: '/multiple.tex' } };
}
export function globalConfig() {
    return { language: 'de', session_max_time: 3600, bind: { mode: 'tcp' }, ssl: { enable: true, certificate: '/cert.pem', fqdn_certificate: '/cert.pem', client_auth: { force: false, certificates: [] } }, trusted_domains: ['school.test'], trusted_proxies: ['127.0.0.1'], email: { enable: false, templates: { reset_email: '' } } };
}
export function responses() {
    return {
        '/api/lmn/schoolsettings': schoolSettings(),
        '/api/lmn/schoolsettings/latex-templates': [[{ path: '/individual.tex', filename: 'individual.tex' }], [{ path: '/multiple.tex', filename: 'multiple.tex' }]],
        '/api/lmn/config/customfields/': customConfig(),
        '/api/lmn/holidays': [],
        '/api/lmn/activeschool': 'default-school',
        '/api/lmn/config/passwordconstraints': { default: {}, schools: {} },
        '/api/core/config': globalConfig(),
        '/api/core/languages': ['de', 'en'],
        '/api/lmn/subnets': [],
        '/api/core/smtp-config': { smtp: { server: 'mail.test', port: 'ssl', user: '', password: '', sender: '' } },
        '/api/core/tfa-config': {},
        '/api/lmn/apisettings': { keys: {}, enable_host_auth: true },
        '/api/lmn/webuisettings/allowed_roles': ['teacher'],
        '/api/lmn/edulution/api-status': { api_installed: true, api_running: false },
        '/api/lmn/sophomorixUsers/bindusers/global': [],
        '/api/lmn/version': { webui: 'test' },
    };
}

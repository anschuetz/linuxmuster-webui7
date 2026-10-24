import { reactive } from 'vue';

/** Stock authenticated WebUI sessions, unrelated to lmn_session_new teaching groups. */
export function createSessionList(aj, initialConfig = {}) {
    const state = reactive({ sessions: undefined, number: undefined, session_max_time: undefined });
    let alive = true, timer;
    async function refresh() {
        try {
            const { data } = await aj.http.get('/api/session_list/sessions');
            if (!alive) return;
            state.sessions = data; state.number = Object.keys(data).length; state.session_max_time = initialConfig.session_max_time;
        } catch { /* The shared HTTP owner reports errors; no false empty state. */ }
    }
    return { state, aj, refresh,
        start() { aj.pageTitle.set(aj.gettext('List all sessions')); const request = refresh(); timer = setInterval(() => { void refresh(); }, 15000); return request; },
        dispose() { alive = false; clearInterval(timer); },
    };
}

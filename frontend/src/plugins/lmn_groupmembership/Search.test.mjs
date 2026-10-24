import { afterEach, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import Search from './Search.vue';
const wrappers = [];
afterEach(() => { wrappers.forEach((w) => w.unmount()); wrappers.length = 0; });
function setup(kind = 'user', values = []) {
    const aj = { gettext: (s) => s, http: { post: vi.fn(async () => ({ data: values })), get: vi.fn(async () => ({ data: values })) } };
    const w = mount(Search, { props: { kind, groupName: 'current' }, global: { provide: { aj } } }); wrappers.push(w); return { w, aj };
}
it.each([['user', 'post', '/api/lmn/find/user', 3], ['teacher', 'get', '/api/lmn/find/teacher/', 3], ['usergroup', 'get', '/api/lmn/find/usergroup/', 2], ['group', 'get', '/api/lmn/find/group/', 2]])('%s threshold, ngTrim and request contract', async (kind, method, url, min) => {
    const { w, aj } = setup(kind); const input = w.find('input'); await input.setValue('x'); await flushPromises(); expect(aj.http[method].mock.calls).toEqual([]);
    await input.setValue(' x'.padEnd(min + 1, 'x') + ' '); await flushPromises(); const query = 'x'.repeat(min);
    expect(aj.http[method].mock.calls).toEqual([method === 'post' ? [url, { name: query }] : [url + query]]);
    input.element.value = ''; for (const char of 'a b') { input.element.value += char; await input.trigger('input'); }
    expect(input.element.value).toBe('a b');
});
it('does not limit results, excludes current group and supports keyboard and pointer selection', async () => {
    const values = ['current', ...Array.from({ length: 12 }, (_, n) => `group${n}`)]; const { w } = setup('group', values);
    await w.find('input').setValue('gr'); await flushPromises(); expect(w.findAll('li')).toHaveLength(12);
    await w.find('input').trigger('keydown', { key: 'ArrowDown' }); await w.find('input').trigger('keydown', { key: 'ArrowUp' }); await w.find('input').trigger('keydown', { key: 'Enter' });
    expect(w.emitted('select')).toEqual([['group0']]); expect(w.find('input').element.value).toBe('');
    await w.find('input').setValue('gr'); await flushPromises(); await w.find('input').trigger('keydown', { key: 'Tab' }); expect(w.emitted('select')).toEqual([['group0'], ['group0']]);
    await w.find('input').setValue('gr'); await flushPromises(); await w.find('li').trigger('mousedown'); expect(w.emitted('select')).toEqual([['group0'], ['group0'], ['group0']]);
    await w.find('input').setValue('gr'); await flushPromises(); await w.find('input').trigger('keydown', { key: 'Escape' }); expect(w.findAll('li')).toHaveLength(0);
});
it('handles rejected lookups and ignores a stale async response', async () => {
    const { w, aj } = setup(); let finish; aj.http.post.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    await w.find('input').setValue('first'); await w.find('input').setValue('second'); await flushPromises(); finish({ data: [{ login: 'stale', label: 'Stale' }] }); await flushPromises(); expect(w.findAll('li')).toHaveLength(0);
    aj.http.post.mockRejectedValueOnce(new Error('HTTP')); await w.find('input').setValue('third'); await flushPromises(); expect(w.findAll('li')).toHaveLength(0); expect(w.emitted('no-results').slice(-2)).toEqual([[false], [true]]);
});

it('closes suggestions on blur and ignores a late lookup result', async () => {
    const { w, aj } = setup('user', [{ label: 'User', login: 'user' }]);
    await w.find('input').setValue('use'); await flushPromises(); expect(w.findAll('li')).toHaveLength(1);
    await w.find('input').trigger('blur'); expect(w.findAll('li')).toHaveLength(0);
    let finish; aj.http.post.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    await w.find('input').setValue('user'); await w.find('input').trigger('blur'); finish({ data: [{ label: 'Late', login: 'late' }] }); await flushPromises(); expect(w.findAll('li')).toHaveLength(0);
});

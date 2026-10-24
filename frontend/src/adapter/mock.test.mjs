import { describe, expect, it, vi } from 'vitest';
import { isReactive } from 'vue';
import { createMockAj } from './mock.mjs';

describe('aj mock contract', () => {
    it.each(['get', 'delete', 'post', 'put', 'patch'])('%s returns the response and forwards its arguments', async (method) => {
        const response = { data: { ok: true }, status: 201 };
        const http = vi.fn().mockResolvedValue(response);
        const aj = createMockAj({ http });
        const cfg = { headers: { 'X-Test': 'demo' } };
        const data = { name: 'demo' };
        const hasBody = ['post', 'put', 'patch'].includes(method);
        const result = await aj.http[method]('/api/demo', ...(hasBody ? [data, cfg] : [cfg]));
        expect(result).toBe(response);
        expect(http).toHaveBeenCalledWith({ method, url: '/api/demo', data: hasBody ? data : undefined, cfg });
    });

    it('preserves HTTP rejections for the consumer', async () => {
        const failure = { status: 403, data: 'Forbidden' };
        const aj = createMockAj({ http: vi.fn().mockRejectedValue(failure) });
        await expect(aj.http.get('/api/demo')).rejects.toBe(failure);
    });

    it.each(['success', 'info', 'warning', 'error'])('forwards %s notifications', (level) => {
        const notify = vi.fn();
        const aj = createMockAj({ notify });
        aj.notify[level]('Title', 'Text');
        expect(notify).toHaveBeenCalledWith(level, 'Title', 'Text');
    });

    it('provides translation, navigation and reactive identity', () => {
        const gettext = vi.fn((text) => `translated: ${text}`);
        const navigate = vi.fn();
        const aj = createMockAj({ gettext, navigate, identity: { user: 'teacher', profile: { school: 'demo' }, isSuperuser: false } });
        expect(aj.gettext('Hello')).toBe('translated: Hello');
        aj.navigate('/view/demo');
        expect(navigate).toHaveBeenCalledWith('/view/demo');
        expect(isReactive(aj.identity)).toBe(true);
        expect(aj.identity.user).toBe('teacher');
        expect(aj.identity.profile).toEqual({ school: 'demo' });
        expect(aj.identity.isSuperuser).toBe(false);
        aj.identity.patch({ activeSchool: 'new' });
        expect(aj.identity.profile).toEqual({ school: 'demo', activeSchool: 'new' });
    });

    it('offers isolated defaults without backend access', async () => {
        const aj = createMockAj();
        expect(await aj.http.get('/api/demo')).toEqual({ data: null, status: 200 });
        expect(aj.gettext('Hello')).toBe('Hello');
        expect(aj.identity).toEqual({ user: null, profile: {}, isSuperuser: false, patch: expect.any(Function) });
        expect(aj.identity).not.toBe(createMockAj().identity);
        expect(aj.notify.info('Title')).toBeUndefined();
        expect(aj.navigate('/view/demo')).toBeUndefined();
    });
});

it('exposes route reload with optional observer', () => {
    expect(() => createMockAj().reload()).not.toThrow();
    const reload = vi.fn();
    createMockAj({ reload }).reload();
    expect(reload).toHaveBeenCalledOnce();
});

import { expect, it, vi } from 'vitest';
import { createAjentiAdapter } from './ajenti.mjs';
import { createMockAj } from './mock.mjs';

it('HEAD retains the response/rejection and cfg without a body in both adapters', async () => {
    const response = { data: '', status: 200 }, failure = { data: { message: 'missing' }, status: 404 };
    const cfg = { headers: { 'X-Test': 'p88' } };
    const head = vi.fn().mockResolvedValueOnce(response).mockRejectedValueOnce(failure);
    const http = vi.fn().mockResolvedValueOnce(response).mockRejectedValueOnce(failure);
    const real = createAjentiAdapter({ $http: { head }, identity: {}, notify: {}, gettextCatalog: {}, $location: {} });
    const mock = createMockAj({ http });
    for (const aj of [real, mock]) {
        expect(await aj.http.head('/api/file', cfg)).toEqual(response);
        await expect(aj.http.head('/api/file', cfg)).rejects.toEqual(failure);
    }
    expect(head.mock.calls).toEqual([['/api/file', cfg], ['/api/file', cfg]]);
    expect(http.mock.calls.map(([request]) => request)).toEqual(Array(2).fill({ method: 'head', url: '/api/file', data: undefined, cfg }));
});

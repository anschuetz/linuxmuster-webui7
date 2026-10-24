import { expect, it, vi } from 'vitest';
import { download } from './download.mjs';
it('assigns the download URL to location.href like the Angular controller', () => {
 const browserLocation = { href: '/view/lmn_vdi_dashboard' };
 vi.stubGlobal('window', { location: browserLocation });
 try {
  download('/api/lmn/vdi/dashboard/download/p60.vv');
  expect(browserLocation).toEqual({ href: '/api/lmn/vdi/dashboard/download/p60.vv' });
 } finally { vi.unstubAllGlobals(); }
});

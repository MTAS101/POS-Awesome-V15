import { vi, it, expect } from 'vitest';
import { usePosProfile } from './usePosProfile.js';

vi.mock('../../offline/index.js', () => ({
  getCachedPosProfile: vi.fn(() => ({ name: 'Retail', modified: '1' })),
  savePosProfile: vi.fn(),
}));

global.frappe = { boot: { pos_profile: { name: 'Retail', modified: '1' } }, call: vi.fn() };

it('returns cached profile when available', async () => {
  const { loadProfile } = usePosProfile();
  const profile = await loadProfile('Retail');
  expect(profile.name).toBe('Retail');
});

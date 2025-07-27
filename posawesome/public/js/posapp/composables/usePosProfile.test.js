import { describe, it, expect, vi } from 'vitest'
import { usePosProfile } from './usePosProfile.js'

vi.mock('../../offline/index.js', () => ({
  getCachedPosProfile: vi.fn(() => null),
  savePosProfile: vi.fn()
}))

globalThis.frappe = {
  call: vi.fn(async () => ({ message: { name: 'Test' } })),
  boot: { pos_profile: null }
}

describe('usePosProfile', () => {
  it('fetches profile via API', async () => {
    const { profile, loadProfile } = usePosProfile()
    await loadProfile('Test')
    expect(profile.value.name).toBe('Test')
  })
})

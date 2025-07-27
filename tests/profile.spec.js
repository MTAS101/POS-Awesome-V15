import { describe, it, expect } from 'vitest';
import { usePosProfile } from '../posawesome/public/js/posapp/composables/usePosProfile.js';

describe('usePosProfile', () => {
  it('exports a function', () => {
    expect(typeof usePosProfile).toBe('function');
  });
});

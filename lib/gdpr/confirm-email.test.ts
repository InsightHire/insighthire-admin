import { describe, expect, it } from 'vitest';
import { confirmEmailMatches } from './confirm-email';

describe('confirmEmailMatches', () => {
  it('accepts the exact email, ignoring case and spaces', () => {
    expect(confirmEmailMatches('  Dana@Agency.com ', 'dana@agency.com')).toBe(true);
  });
  it('rejects empty, partial and different emails', () => {
    expect(confirmEmailMatches('', 'dana@agency.com')).toBe(false);
    expect(confirmEmailMatches('dana@agency', 'dana@agency.com')).toBe(false);
    expect(confirmEmailMatches('dan@agency.com', 'dana@agency.com')).toBe(false);
  });
});

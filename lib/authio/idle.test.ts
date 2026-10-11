import { describe, expect, it } from 'vitest';
import { IDLE_TIMEOUT_MS, idleCookie, isIdleExpired } from './idle';

describe('staff idle timeout', () => {
  const now = 1_800_000_000_000;
  it('is live within 30 minutes of the last activity', () => {
    expect(isIdleExpired(String(now - IDLE_TIMEOUT_MS + 1000), now)).toBe(false);
  });
  it('expires after 30 minutes without activity', () => {
    expect(isIdleExpired(String(now - IDLE_TIMEOUT_MS - 1), now)).toBe(true);
  });
  it('treats a missing or garbled cookie as expired', () => {
    expect(isIdleExpired(undefined, now)).toBe(true);
    expect(isIdleExpired('', now)).toBe(true);
    expect(isIdleExpired('abc', now)).toBe(true);
    expect(isIdleExpired('-5', now)).toBe(true);
  });
  it('is an HttpOnly cookie the page script cannot change', () => {
    expect(idleCookie(now, true)).toMatchObject({ value: String(now), httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
  });
});

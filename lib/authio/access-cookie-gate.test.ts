import { describe, it, expect, vi, afterEach } from 'vitest';
import { SignJWT } from 'jose';
import { accessCookieLooksValid, accessTokenRemainingSec } from './access-cookie-gate';

const secret = new TextEncoder().encode('test-secret');

async function mintJwt(
  claims: Record<string, unknown>,
  opts: { expOffsetSec?: number } = {},
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + (opts.expOffsetSec ?? 900);
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('user_1')
    .setExpirationTime(exp)
    .sign(secret);
}

describe('authio/access-cookie-gate', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('accepts a valid unexpired customer token', async () => {
    const token = await mintJwt({ kind: 'customer' });
    expect(accessCookieLooksValid(token)).toBe(true);
  });

  it('rejects expired tokens', async () => {
    const token = await mintJwt({ kind: 'customer' }, { expOffsetSec: -120 });
    expect(accessCookieLooksValid(token)).toBe(false);
  });

  it('rejects non-customer token kind', async () => {
    const token = await mintJwt({ kind: 'platform' });
    expect(accessCookieLooksValid(token)).toBe(false);
  });

  it('computes remaining lifetime for cookie maxAge', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const token = await mintJwt({ kind: 'customer' }, { expOffsetSec: 600 });
    expect(accessTokenRemainingSec(token)).toBe(600);
  });
});

/**
 * Cheap edge check: is the access cookie worth trusting for middleware
 * bypass? Full JWKS verification happens server-side in `auth()`; this
 * only rejects malformed JWTs, wrong token kind, and obviously-expired
 * tokens so middleware can fall through to /api/auth/refresh.
 */
import { decodeJwt } from 'jose';

/** Clock skew allowance when comparing JWT exp to wall time. */
const EXP_SKEW_MS = 30_000;

export function accessCookieLooksValid(token: string | undefined): boolean {
  if (!token) return false;
  try {
    const payload = decodeJwt(token);
    if (payload.kind && payload.kind !== 'customer') return false;
    if (typeof payload.exp === 'number') {
      if (payload.exp * 1000 < Date.now() - EXP_SKEW_MS) return false;
    }
    return typeof payload.sub === 'string' && payload.sub.length > 0;
  } catch {
    return false;
  }
}

/** Seconds until JWT exp (for cookie maxAge). Returns undefined if exp is missing. */
export function accessTokenRemainingSec(token: string): number | undefined {
  try {
    const payload = decodeJwt(token);
    if (typeof payload.exp !== 'number') return undefined;
    const remaining = payload.exp - Math.floor(Date.now() / 1000);
    return remaining > 0 ? remaining : 0;
  } catch {
    return undefined;
  }
}

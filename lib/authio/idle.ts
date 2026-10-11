/**
 * Staff idle timeout. The BFF keeps the time of the last real user activity in
 * an HttpOnly cookie. The browser bumps it (POST ACTIVITY_PATH) while someone is
 * actually using the page; background polling does not count. After
 * IDLE_TIMEOUT_MS with no activity the tRPC proxy and the refresh handler refuse
 * the session, so it ends even if the tab was closed or its JS stopped.
 */
export const IDLE_COOKIE = 'ih_admin_active';
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
export const IDLE_WARNING_MS = 2 * 60 * 1000;
export const ACTIVITY_PATH = '/api/auth/activity';
export const IDLE_HEADER = 'x-ih-session';

/** A missing or unreadable cookie counts as expired, so a session can't dodge the timeout by dropping it. */
export function isIdleExpired(cookieValue: string | undefined, now: number): boolean {
  const last = Number(cookieValue);
  if (!cookieValue || !Number.isFinite(last) || last <= 0) return true;
  return now - last > IDLE_TIMEOUT_MS;
}

export function idleCookie(now: number, secure: boolean) {
  return {
    name: IDLE_COOKIE,
    value: String(now),
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 12 * 60 * 60,
  };
}

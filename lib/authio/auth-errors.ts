import { NextResponse, type NextRequest } from 'next/server';

/** Short-lived HttpOnly flash cookie — never put auth errors in the URL. */
export const AUTH_LOGIN_ERROR_COOKIE = 'authio_login_error';

export const AUTH_ERROR_MESSAGES: Record<string, string> = {
  missing_tokens: 'Sign-in did not return a session. Please try again.',
  token_exchange_failed: 'We could not complete sign-in. Please try again.',
  csrf_mismatch: 'Sign-in security check failed. Please try again.',
  csrf_state_missing: 'Sign-in session expired. Please try again.',
  csrf_state_unreadable: 'Sign-in session was corrupted. Please try again.',
  invalid_token: 'Sign-in returned an invalid session. Please try again.',
  sso_org_unconfigured: 'Sign-in is misconfigured. Please contact support.',
  refresh_failed: 'Your session ended. Please sign in again.',
  refresh_threw: 'We could not refresh your session. Please try again.',
};

function isProd() {
  return process.env.NODE_ENV === 'production';
}

function publicOrigin(req: NextRequest): string {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') || (isProd() ? 'https' : 'http');
  if (host) return `${proto}://${host}`;
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  return req.nextUrl.origin;
}

export function redirectWithAuthError(
  req: NextRequest,
  code: keyof typeof AUTH_ERROR_MESSAGES | string,
  landingPath = '/sign-in',
): NextResponse {
  const res = NextResponse.redirect(new URL(landingPath, publicOrigin(req)));
  res.cookies.set({
    name: AUTH_LOGIN_ERROR_COOKIE,
    value: code,
    httpOnly: true,
    secure: isProd(),
    sameSite: 'lax',
    path: '/sign-in',
    maxAge: 120,
  });
  return res;
}

export function authErrorMessage(code: string | undefined | null): string | null {
  if (!code) return null;
  return AUTH_ERROR_MESSAGES[code] ?? 'Sign-in failed. Please try again.';
}

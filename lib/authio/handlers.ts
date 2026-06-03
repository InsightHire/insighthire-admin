/**
 * BFF route handlers — sign-in, callback, refresh, sign-out — for Authio's hosted UI.
 *
 * Mirrors the @authio/nextjs createAuthio*Handler() factory shape documented at
 * https://docs.authio.com/sdks/nextjs. Swap the imports in
 * `app/api/auth/*` for the real package when it ships.
 *
 * Security notes:
 *   - Sign-in handler mints a 32-byte CSRF nonce, writes it to an HttpOnly cookie,
 *     and forwards it to the hosted UI. Callback rejects mismatched / missing nonces.
 *     (The "D1 login-CSRF" defense documented in Authio's security model.)
 *   - Cookies are HttpOnly + Secure (in prod) + SameSite=Lax + path=/.
 *   - All routes are dynamic (no caching).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import {
  AUTHIO_API_URL,
  AUTHIO_HOSTED_UI_URL,
  AUTHIO_PROJECT_ID,
  CALLBACK_PATH,
  CALLBACK_STATE_COOKIE,
  REFRESH_COOKIE,
  SESSION_COOKIE,
  SIGN_IN_PATH,
  assertConfig,
} from './config';

const FIVE_MIN = 5 * 60;
const THIRTY_DAYS = 30 * 24 * 60 * 60;

function isProd() {
  return process.env.NODE_ENV === 'production';
}

/**
 * Return the public origin for this request. Behind a proxy (Railway, Vercel,
 * Cloudflare) `req.nextUrl.origin` is the *internal* address (e.g. 0.0.0.0:3000),
 * not the public hostname — useless for redirect_uri / return_to. Prefer the
 * forwarded headers the edge sets, then NEXT_PUBLIC_APP_URL, then the raw origin.
 */
function publicOrigin(req: NextRequest): string {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') || (isProd() ? 'https' : 'http');
  if (host) return `${proto}://${host}`;
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  return req.nextUrl.origin;
}

function publicUrl(req: NextRequest, path: string): URL {
  return new URL(path, publicOrigin(req));
}

function callbackUrl(req: NextRequest): string {
  return publicUrl(req, CALLBACK_PATH).toString();
}

function setSessionCookies(
  res: NextResponse,
  tokens: { accessToken: string; refreshToken: string; accessExpiresInSec?: number },
) {
  res.cookies.set({
    name: SESSION_COOKIE,
    value: tokens.accessToken,
    httpOnly: true,
    secure: isProd(),
    sameSite: 'lax',
    path: '/',
    maxAge: tokens.accessExpiresInSec ?? 60 * 60, // 1h default; silent refresh rotates
  });
  res.cookies.set({
    name: REFRESH_COOKIE,
    value: tokens.refreshToken,
    httpOnly: true,
    secure: isProd(),
    sameSite: 'lax',
    path: '/',
    maxAge: THIRTY_DAYS,
  });
}

function clearSessionCookies(res: NextResponse) {
  for (const name of [SESSION_COOKIE, REFRESH_COOKIE, CALLBACK_STATE_COOKIE]) {
    res.cookies.set({ name, value: '', path: '/', maxAge: 0 });
  }
}

// ─── Sign-in ────────────────────────────────────────────────────────────────────

export function createAuthioSignInHandler() {
  return async function GET(req: NextRequest) {
    assertConfig();
    const next = req.nextUrl.searchParams.get('next') || '/';
    const nonce = randomBytes(32).toString('base64url');

    const hosted = new URL(AUTHIO_HOSTED_UI_URL);
    hosted.searchParams.set('project_id', AUTHIO_PROJECT_ID);
    hosted.searchParams.set('redirect_uri', callbackUrl(req));
    hosted.searchParams.set('client_state_nonce', nonce);
    hosted.searchParams.set('return_to', next);

    const res = NextResponse.redirect(hosted);
    res.cookies.set({
      name: CALLBACK_STATE_COOKIE,
      value: JSON.stringify({ nonce, next }),
      httpOnly: true,
      secure: isProd(),
      sameSite: 'lax',
      path: '/',
      maxAge: FIVE_MIN,
    });
    return res;
  };
}

// ─── Callback ───────────────────────────────────────────────────────────────────

export interface CallbackHandlerOptions {
  /** Where to land users after a successful sign-in. Default `/`. Overridden by `?next`. */
  signedInRedirect?: string;
}

export function createAuthioCallbackHandler(opts: CallbackHandlerOptions = {}) {
  return async function GET(req: NextRequest) {
    assertConfig();

    const accessToken = req.nextUrl.searchParams.get('access_token');
    const refreshToken = req.nextUrl.searchParams.get('refresh_token');
    const urlNonce = req.nextUrl.searchParams.get('client_state_nonce');

    if (!accessToken || !refreshToken) {
      return NextResponse.redirect(publicUrl(req, `/sign-in?error=missing_tokens`));
    }

    // CSRF: cookie nonce must equal the URL nonce.
    const stateCookie = req.cookies.get(CALLBACK_STATE_COOKIE)?.value;
    let nextPath = opts.signedInRedirect ?? '/';
    if (stateCookie) {
      try {
        const { nonce: cookieNonce, next } = JSON.parse(stateCookie) as {
          nonce?: string;
          next?: string;
        };
        if (!cookieNonce || cookieNonce !== urlNonce) {
          return NextResponse.redirect(publicUrl(req, `/sign-in?error=csrf_mismatch`));
        }
        if (next && next.startsWith('/') && !next.startsWith('//')) {
          nextPath = next;
        }
      } catch {
        return NextResponse.redirect(publicUrl(req, `/sign-in?error=csrf_state_unreadable`));
      }
    } else {
      // Per the docs, pre-v0.3 SDKs degraded to a warned legacy path. We refuse
      // because our admin app is greenfield and there's no legacy traffic.
      return NextResponse.redirect(publicUrl(req, `/sign-in?error=csrf_state_missing`));
    }

    const res = NextResponse.redirect(publicUrl(req, nextPath));
    setSessionCookies(res, { accessToken, refreshToken });
    res.cookies.set({ name: CALLBACK_STATE_COOKIE, value: '', path: '/', maxAge: 0 });
    return res;
  };
}

// ─── Refresh ────────────────────────────────────────────────────────────────────

export function createAuthioRefreshHandler() {
  return async function GET(req: NextRequest) {
    assertConfig();
    const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
    const returnTo = req.nextUrl.searchParams.get('return_to') || '/';

    if (!refreshToken) {
      return NextResponse.redirect(
        publicUrl(req, `${SIGN_IN_PATH}?next=${encodeURIComponent(returnTo)}`),
      );
    }

    try {
      const apiRes = await fetch(`${AUTHIO_API_URL}/v1/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Authio-Project': AUTHIO_PROJECT_ID,
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!apiRes.ok) {
        const res = NextResponse.redirect(
          publicUrl(req, `${SIGN_IN_PATH}?next=${encodeURIComponent(returnTo)}&error=refresh_failed`),
        );
        clearSessionCookies(res);
        return res;
      }
      const body = (await apiRes.json()) as {
        access_token: string;
        refresh_token: string;
        expires_in?: number;
      };
      const res = NextResponse.redirect(publicUrl(req, returnTo));
      setSessionCookies(res, {
        accessToken: body.access_token,
        refreshToken: body.refresh_token,
        accessExpiresInSec: body.expires_in,
      });
      return res;
    } catch {
      const res = NextResponse.redirect(
        publicUrl(req, `${SIGN_IN_PATH}?next=${encodeURIComponent(returnTo)}&error=refresh_threw`),
      );
      clearSessionCookies(res);
      return res;
    }
  };
}

// ─── Sign-out ──────────────────────────────────────────────────────────────────

export function createAuthioSignOutHandler() {
  async function handle(req: NextRequest) {
    assertConfig();
    const accessToken = req.cookies.get(SESSION_COOKIE)?.value;

    if (accessToken) {
      try {
        await fetch(`${AUTHIO_API_URL}/v1/auth/sign-out`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            'X-Authio-Project': AUTHIO_PROJECT_ID,
          },
        });
      } catch {
        /* best-effort revoke; we always clear cookies below */
      }
    }
    const res = NextResponse.redirect(publicUrl(req, '/sign-in'));
    clearSessionCookies(res);
    return res;
  }
  return { GET: handle, POST: handle };
}

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
import { randomBytes, timingSafeEqual } from 'node:crypto';
import {
  AUTHIO_AUTH_CORE_URL,
  AUTHIO_HOSTED_UI_URL,
  AUTHIO_ORGANIZATION_ID,
  AUTHIO_PROJECT_ID,
  AUTHIO_SSO_CONNECTION_ID,
  AUTHIO_SSO_HOST,
  CALLBACK_PATH,
  CALLBACK_STATE_COOKIE,
  REFRESH_COOKIE,
  SESSION_COOKIE,
  SIGN_IN_PATH,
  assertConfig,
  authCoreHeaders,
  safeNext,
} from './config';
import { verifyAccessToken } from './session';
import { exchangeAuthorizationCode, hashBootstrapHtml } from './token-exchange';
import { redirectWithAuthError } from './auth-errors';
import { generatePkcePair } from './pkce';

/** Query-string key used to round-trip our cookie-bound CSRF nonce through the
 * SP-initiated flow (which doesn't accept `client_state_nonce` as a top-level
 * param the way Lobby does). Authio echoes the redirect_uri verbatim, so any
 * query we plant in it comes back unchanged. */
const NONCE_PARAM = 'ihx_nonce';

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

function callbackUrl(req: NextRequest, extraQuery: Record<string, string> = {}): string {
  const url = publicUrl(req, CALLBACK_PATH);
  for (const [k, v] of Object.entries(extraQuery)) {
    url.searchParams.set(k, v);
  }
  return url.toString();
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

/**
 * Length-checked constant-time string comparison for the callback-state nonce,
 * so the cookie ⟷ URL check can't leak the nonce through a timing oracle. The
 * length guard is required because `timingSafeEqual` throws on unequal-length
 * buffers.
 */
function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// ─── Sign-in ────────────────────────────────────────────────────────────────────

export function createAuthioSignInHandler() {
  return async function GET(req: NextRequest) {
    assertConfig();
    const next = safeNext(req.nextUrl.searchParams.get('next'));
    const nonce = randomBytes(32).toString('base64url');
    const pkce = generatePkcePair();

    // Two flows, picked by config:
    //   1. SP-initiated (preferred when AUTHIO_SSO_CONNECTION_ID is set):
    //      https://sso.authio.com/v1/sso/connections/{conn_id}/initiate?…
    //      Browser goes straight to the customer IdP — no Lobby UI at all.
    //   2. Hosted UI fallback: https://auth.insighthire.com/?project_id=…&organization_id=…
    //      Renders the method picker (or auto-advances if the org has one method).
    //
    // SP-initiated doesn't accept Lobby's `client_state_nonce` top-level param, so
    // we embed the nonce in the redirect_uri itself (Authio echoes redirect_uri
    // verbatim on the callback hop). The callback handler accepts the nonce from
    // either source.
    let destination: URL;
    if (AUTHIO_SSO_CONNECTION_ID) {
      if (!AUTHIO_ORGANIZATION_ID) {
        return redirectWithAuthError(req, 'sso_org_unconfigured');
      }
      destination = new URL(
        `${AUTHIO_SSO_HOST}/v1/sso/connections/${encodeURIComponent(AUTHIO_SSO_CONNECTION_ID)}/initiate`,
      );
      destination.searchParams.set('project_id', AUTHIO_PROJECT_ID);
      destination.searchParams.set('organization_id', AUTHIO_ORGANIZATION_ID);
      destination.searchParams.set('redirect_uri', callbackUrl(req, { [NONCE_PARAM]: nonce }));
    } else {
      destination = new URL(AUTHIO_HOSTED_UI_URL);
      destination.searchParams.set('project_id', AUTHIO_PROJECT_ID);
      // Allow-list is exact-match — never append app params to redirect_uri.
      destination.searchParams.set('redirect_uri', callbackUrl(req));
      destination.searchParams.set('client_state_nonce', nonce);
      destination.searchParams.set('code_challenge', pkce.codeChallenge);
      destination.searchParams.set('code_challenge_method', 'S256');
      if (AUTHIO_ORGANIZATION_ID) {
        destination.searchParams.set('organization_id', AUTHIO_ORGANIZATION_ID);
      }
    }

    const res = NextResponse.redirect(destination);
    res.cookies.set({
      name: CALLBACK_STATE_COOKIE,
      value: JSON.stringify({ nonce, next, codeVerifier: pkce.codeVerifier }),
      httpOnly: true,
      secure: isProd(),
      sameSite: 'lax',
      path: '/',
      maxAge: FIVE_MIN,
    });
    return res;
  };
}

function hashTokenBootstrapResponse(): NextResponse {
  return new NextResponse(hashBootstrapHtml(), {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

async function resolveCallbackTokens(
  req: NextRequest,
  codeVerifier?: string,
): Promise<{ accessToken: string; refreshToken: string } | null> {
  let accessToken = req.nextUrl.searchParams.get('access_token');
  let refreshToken = req.nextUrl.searchParams.get('refresh_token');
  if (accessToken && refreshToken) {
    return { accessToken, refreshToken };
  }

  const code = req.nextUrl.searchParams.get('code');
  if (code && codeVerifier) {
    const exchanged = await exchangeAuthorizationCode(
      code,
      callbackUrl(req),
      codeVerifier,
    );
    if (exchanged) return exchanged;
  }

  return null;
}

// ─── Callback ───────────────────────────────────────────────────────────────────

export interface CallbackHandlerOptions {
  /** Where to land users after a successful sign-in. Default `/`. Overridden by `?next`. */
  signedInRedirect?: string;
}

export function createAuthioCallbackHandler(opts: CallbackHandlerOptions = {}) {
  return async function GET(req: NextRequest) {
    assertConfig();

    const oauthError = req.nextUrl.searchParams.get('error');
    if (oauthError) {
      return redirectWithAuthError(req, oauthError);
    }

    const stateCookie = req.cookies.get(CALLBACK_STATE_COOKIE)?.value;
    let parsedState: { nonce?: string; next?: string; codeVerifier?: string } = {};
    if (stateCookie) {
      try {
        parsedState = JSON.parse(stateCookie) as typeof parsedState;
      } catch {
        return redirectWithAuthError(req, 'csrf_state_unreadable');
      }
    }

    const tokens = await resolveCallbackTokens(req, parsedState.codeVerifier);
    const accessToken = tokens?.accessToken;
    const refreshToken = tokens?.refreshToken;
    const urlNonce =
      req.nextUrl.searchParams.get('client_state_nonce') ||
      req.nextUrl.searchParams.get(NONCE_PARAM);

    if (!accessToken || !refreshToken) {
      if (req.nextUrl.searchParams.get('code')) {
        return redirectWithAuthError(req, 'token_exchange_failed');
      }
      return hashTokenBootstrapResponse();
    }

    // CSRF: cookie nonce must equal the URL nonce.
    let nextPath = opts.signedInRedirect ?? '/';
    if (stateCookie) {
      try {
        const { nonce: cookieNonce, next } = parsedState;
        if (!cookieNonce || !urlNonce || !constantTimeEqual(cookieNonce, urlNonce)) {
          return redirectWithAuthError(req, 'csrf_mismatch');
        }
        const safe = safeNext(next);
        if (safe !== '/') {
          nextPath = safe;
        }
      } catch {
        return redirectWithAuthError(req, 'csrf_state_unreadable');
      }
    } else {
      return redirectWithAuthError(req, 'csrf_state_missing');
    }

    const verified = await verifyAccessToken(accessToken);
    if (!verified) {
      const bad = redirectWithAuthError(req, 'invalid_token');
      bad.cookies.set({ name: CALLBACK_STATE_COOKIE, value: '', path: '/', maxAge: 0 });
      return bad;
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
    const returnTo = safeNext(req.nextUrl.searchParams.get('return_to'));

    if (!refreshToken) {
      return NextResponse.redirect(
        publicUrl(req, `${SIGN_IN_PATH}?next=${encodeURIComponent(returnTo)}`),
      );
    }

    try {
      // Refresh is an auth-core operation, NOT a mgmt-API one — must go to
      // identity.authio.com, not api.authio.com (which returns 404).
      const apiRes = await fetch(`${AUTHIO_AUTH_CORE_URL}/v1/auth/refresh`, {
        method: 'POST',
        headers: authCoreHeaders(),
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!apiRes.ok) {
        const res = redirectWithAuthError(req, 'refresh_failed');
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
      const res = redirectWithAuthError(req, 'refresh_threw');
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
      // Belt + suspenders: try the new alias first, then the legacy URL. 401
      // (already revoked) is treated as success on both, per the SDK's
      // `signOutPaths` fallback pattern documented in the migration guide.
      const signOutPaths = ['/v1/auth/sign-out', '/v1/sessions/revoke'];
      for (const path of signOutPaths) {
        try {
          const res = await fetch(`${AUTHIO_AUTH_CORE_URL}${path}`, {
            method: 'POST',
            headers: authCoreHeaders({ Authorization: `Bearer ${accessToken}` }),
          });
          if (res.ok || res.status === 401) break; // 401 = already revoked, treat as success
        } catch {
          /* try next path */
        }
      }
    }
    const res = NextResponse.redirect(publicUrl(req, '/sign-in'));
    // no-store so neither this redirect nor its cookie-clearing Set-Cookie
    // headers can be served from a browser / bfcache / CDN cache, which
    // would otherwise let a stale authenticated render survive sign-out
    // until a manual refresh.
    res.headers.set('Cache-Control', 'no-store, private');
    clearSessionCookies(res);
    return res;
  }
  return { GET: handle, POST: handle };
}

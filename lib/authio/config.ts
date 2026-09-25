/**
 * Authio (authio.com) integration config — single source of truth for env vars and URLs.
 *
 * This is a hand-rolled adapter (no `@authio/nextjs` SDK installed yet; not on public
 * npm). The handlers in `lib/authio/handlers.ts` and middleware in `middleware.ts`
 * mirror the documented SDK shape so when the real package ships we can swap imports.
 */

export const AUTHIO_PROJECT_ID = process.env.AUTHIO_PROJECT_ID ?? '';
/**
 * Org to pin on the hosted-UI sign-in URL (auth.insighthire.com). Pinning the org
 * sends users straight to InsightHire's Entra connection instead of the generic
 * method picker. Defaults to InsightHire's org id; override per-environment via
 * the AUTHIO_ORGANIZATION_ID env var.
 */
export const AUTHIO_ORGANIZATION_ID =
  process.env.AUTHIO_ORGANIZATION_ID || 'org_h8k2m9qx4n1v7p3r6w5t0';
/**
 * Management API host (`manage.authio.com`, legacy alias `api.authio.com`).
 * This is the REST surface used for user lookups (`GET /v1/users/:id`) and
 * other dashboard-style calls — it does NOT sign access tokens and does NOT
 * serve the JWKS. Keep it distinct from the auth-core host below.
 */
export const AUTHIO_API_URL = (process.env.AUTHIO_API_URL || 'https://api.authio.com').replace(/\/$/, '');
export const AUTHIO_HOSTED_UI_URL = (
  process.env.AUTHIO_HOSTED_UI_URL || 'https://auth.insighthire.com'
).replace(/\/$/, '');

/**
 * SSO service host that serves the SP-initiated login URL pattern documented at
 * https://docs.authio.com/lobby/sso-login-url . When `AUTHIO_SSO_CONNECTION_ID`
 * is set, the sign-in handler builds
 *   ${AUTHIO_SSO_HOST}/v1/sso/connections/${conn_id}/initiate?…
 * and sends the browser straight to the customer's IdP — no hosted UI method picker,
 * one redirect, WorkOS-style. Without `AUTHIO_SSO_CONNECTION_ID`, we fall back
 * to AUTHIO_HOSTED_UI_URL (org-pinned so it still skips the picker for that org).
 */
export const AUTHIO_SSO_HOST = (
  process.env.AUTHIO_SSO_HOST || 'https://sso.authio.com'
).replace(/\/$/, '');

/**
 * Authio SSO connection id (`sso_…`) for the InsightHire admin org's One-click
 * Microsoft connection. Surfaced on Org → Features → Single Sign-On in the
 * Authio dashboard. Required for the SP-initiated direct-to-IdP flow; if blank,
 * sign-in falls through to AUTHIO_HOSTED_UI_URL.
 */
export const AUTHIO_SSO_CONNECTION_ID = process.env.AUTHIO_SSO_CONNECTION_ID ?? '';

/**
 * Auth-core host (`identity.authio.com`). This is the service that MINTS and
 * SIGNS access tokens (Ed25519/EdDSA) and serves the JWKS at
 * `/v1/auth/.well-known/jwks.json`. The token's `iss` claim is this host —
 * NOT the management API host — so JWKS + issuer must be derived from here.
 * (The legacy `auth-api.authio.com` alias 301-redirects here.)
 */
export const AUTHIO_AUTH_CORE_URL = (
  process.env.AUTHIO_AUTH_CORE_URL || 'https://identity.authio.com'
).replace(/\/$/, '');

/** JWKS + issuer. Derived from the auth-core host (token signer), not the management API. */
export const AUTHIO_JWKS_URL =
  process.env.AUTHIO_JWKS_URL || `${AUTHIO_AUTH_CORE_URL}/v1/auth/.well-known/jwks.json`;
export const AUTHIO_JWT_ISSUER = process.env.AUTHIO_JWT_ISSUER || AUTHIO_AUTH_CORE_URL;
export const AUTHIO_JWT_AUDIENCE = process.env.AUTHIO_JWT_AUDIENCE || 'authio';

/** Cookie names from the @authio/nextjs docs. */
export const SESSION_COOKIE = 'authio_session';
export const REFRESH_COOKIE = 'authio_refresh';
/** 32-byte CSRF nonce shared between sign-in handler and callback handler. */
export const CALLBACK_STATE_COOKIE = 'authio_callback_state';

export const SIGN_IN_PATH = '/api/auth/sign-in';
export const CALLBACK_PATH = '/api/auth/callback';
export const REFRESH_PATH = '/api/auth/refresh';
export const SIGN_OUT_PATH = '/api/auth/sign-out';

/**
 * Hand-port version tag sent as `X-Authio-SDK` on every auth-core fetch so HQ
 * can attribute SDK usage. Mirrors `@authio/nextjs@0.3.2` (`nextjs/0.3.2`).
 */
export const AUTHIO_SDK_HEADER = 'nextjs/0.3.2';

/** Standard auth-core request headers (SDK version + project resolution). */
export function authCoreHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Authio-SDK': AUTHIO_SDK_HEADER,
    'X-Authio-Project': AUTHIO_PROJECT_ID,
    ...extra,
  };
}

/** Public paths that bypass the auth gate. */
export const DEFAULT_PUBLIC_PATHS = [
  '/sign-in',
  '/login',
  '/api/auth/',
  // Same-origin tRPC BFF proxy — enforces auth itself (401 when the session
  // cookie is absent), so it must not be redirected to sign-in by middleware.
  '/api/trpc',
  '/_next/',
  '/favicon',
];

export function assertConfig() {
  if (!AUTHIO_PROJECT_ID) {
    throw new Error('AUTHIO_PROJECT_ID is not set');
  }
}

/**
 * Constrain a `?next=` / `return_to` redirect target to same-origin paths so the
 * sign-in / callback / refresh handlers can't be turned into open redirects
 * (`?return_to=https://evil` or `?next=//evil`). Mirrors the @authio/nextjs
 * `safeNext` helper. Returns '/' when the value is missing, not a root-relative
 * path, or a protocol-relative path.
 */
export function safeNext(raw: string | null | undefined): string {
  if (!raw) return '/';
  if (!raw.startsWith('/')) return '/';
  if (raw.startsWith('//')) return '/';
  return raw;
}

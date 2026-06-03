/**
 * Authio (authio.com) integration config — single source of truth for env vars and URLs.
 *
 * This is a hand-rolled adapter (no `@authio/nextjs` SDK installed yet; not on public
 * npm). The handlers in `lib/authio/handlers.ts` and middleware in `middleware.ts`
 * mirror the documented SDK shape so when the real package ships we can swap imports.
 */

export const AUTHIO_PROJECT_ID = process.env.AUTHIO_PROJECT_ID ?? '';
export const AUTHIO_API_URL = (process.env.AUTHIO_API_URL || 'https://api.authio.com').replace(/\/$/, '');
export const AUTHIO_HOSTED_UI_URL = (
  process.env.AUTHIO_HOSTED_UI_URL || 'https://lobby.authio.com'
).replace(/\/$/, '');

/** JWKS + issuer. Override with env vars if Authio finalizes a different host. */
export const AUTHIO_JWKS_URL =
  process.env.AUTHIO_JWKS_URL || `${AUTHIO_API_URL}/.well-known/jwks.json`;
export const AUTHIO_JWT_ISSUER = process.env.AUTHIO_JWT_ISSUER || AUTHIO_API_URL;
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

/** Public paths that bypass the auth gate. */
export const DEFAULT_PUBLIC_PATHS = [
  '/sign-in',
  '/login',
  '/api/auth/',
  '/_next/',
  '/favicon',
];

export function assertConfig() {
  if (!AUTHIO_PROJECT_ID) {
    throw new Error('AUTHIO_PROJECT_ID is not set');
  }
}

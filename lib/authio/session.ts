/**
 * Server-side `auth()` helper — reads the `authio_session` cookie and verifies it
 * against Authio's JWKS. Mirrors the @authio/nextjs/server `auth()` shape so when
 * the real SDK is available we swap the import.
 */
import 'server-only';
import { cookies } from 'next/headers';
import { jwtVerify, createRemoteJWKSet, type JWTPayload } from 'jose';
import {
  AUTHIO_JWKS_URL,
  AUTHIO_JWT_ISSUER,
  AUTHIO_JWT_AUDIENCE,
  SESSION_COOKIE,
} from './config';

const JWKS = createRemoteJWKSet(new URL(AUTHIO_JWKS_URL));

export interface AuthioSession {
  userId: string;
  email?: string;
  orgId: string | null;
  role: string | null;
  sessionId: string | null;
  accessToken: string;
}

export interface AuthioJwtPayload extends JWTPayload {
  sub: string;
  email?: string;
  name?: string;
  org_id?: string | null;
  role?: string | null;
  session_id?: string | null;
  kind?: string;
}

/**
 * Verify a raw Authio access JWT against the JWKS (signature + issuer + audience
 * + kind), returning the decoded payload or null on any failure. Algorithm is
 * pinned to EdDSA — Authio's auth-core signs access tokens with an Ed25519 key
 * (the JWKS advertises `alg: EdDSA`), so pinning it forecloses any algorithm-
 * confusion downgrade.
 *
 * Shared by `auth()` (cookie path) and the callback handler, which verifies the
 * token straight off the redirect URL before persisting it as a cookie.
 */
export async function verifyAccessToken(token: string): Promise<AuthioJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: AUTHIO_JWT_ISSUER,
      audience: AUTHIO_JWT_AUDIENCE,
      algorithms: ['EdDSA'],
    });
    const p = payload as AuthioJwtPayload;
    if (p.kind && p.kind !== 'customer') return null;
    if (!p.sub) return null;
    return p;
  } catch {
    return null;
  }
}

/**
 * Read the current session, verifying the JWT freshly. Returns null if no cookie,
 * invalid signature, expired, or wrong kind.
 *
 * Note: this is intentionally not cached across the request because middleware may
 * have already rotated the cookie. Cheap (cached JWKS).
 */
export async function auth(): Promise<AuthioSession | null> {
  const cookieStore = cookies();
  const accessToken = cookieStore.get(SESSION_COOKIE)?.value;
  if (!accessToken) return null;

  const p = await verifyAccessToken(accessToken);
  if (!p) return null;
  return {
    userId: p.sub,
    email: p.email,
    orgId: p.org_id ?? null,
    role: p.role ?? null,
    sessionId: p.session_id ?? null,
    accessToken,
  };
}

/** Cheap predicate when the caller only needs a yes/no without the payload. */
export async function isAuthenticated(): Promise<boolean> {
  return (await auth()) !== null;
}

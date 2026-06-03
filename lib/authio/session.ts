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

  try {
    const { payload } = await jwtVerify(accessToken, JWKS, {
      issuer: AUTHIO_JWT_ISSUER,
      audience: AUTHIO_JWT_AUDIENCE,
    });
    const p = payload as AuthioJwtPayload;
    if (p.kind && p.kind !== 'customer') return null;
    if (!p.sub) return null;
    return {
      userId: p.sub,
      email: p.email,
      orgId: p.org_id ?? null,
      role: p.role ?? null,
      sessionId: p.session_id ?? null,
      accessToken,
    };
  } catch {
    return null;
  }
}

/** Cheap predicate when the caller only needs a yes/no without the payload. */
export async function isAuthenticated(): Promise<boolean> {
  return (await auth()) !== null;
}

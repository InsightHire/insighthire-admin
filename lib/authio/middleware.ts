/**
 * Edge middleware — gates protected routes and triggers silent refresh.
 *
 * Mirrors @authio/nextjs `createAuthioMiddleware()` (docs:
 * https://docs.authio.com/sdks/nextjs).
 *
 * Behavior:
 *   - If the access cookie is present, allow the request (we don't verify here to
 *     keep the hot path cheap — verification happens server-side via `auth()`).
 *   - If access is missing but refresh is present, redirect to the refresh handler
 *     which will rotate cookies and bounce back to the original URL.
 *   - If both are missing, redirect to the sign-in page with `?next=<original>`.
 *   - Public paths bypass the gate entirely.
 */
import { NextResponse, type NextRequest } from 'next/server';
import {
  DEFAULT_PUBLIC_PATHS,
  REFRESH_COOKIE,
  REFRESH_PATH,
  SESSION_COOKIE,
  SIGN_IN_PATH,
} from './config';

export interface AuthioMiddlewareOptions {
  publicPaths?: string[];
  signInPath?: string;
  refreshPath?: string;
}

function publicOrigin(req: NextRequest): string {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const proto =
    req.headers.get('x-forwarded-proto') ||
    (process.env.NODE_ENV === 'production' ? 'https' : 'http');
  if (host) return `${proto}://${host}`;
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  }
  return req.nextUrl.origin;
}

export function createAuthioMiddleware(opts: AuthioMiddlewareOptions = {}) {
  const publicPaths = opts.publicPaths ?? DEFAULT_PUBLIC_PATHS;
  const signInPath = opts.signInPath ?? '/sign-in';
  const refreshPath = opts.refreshPath ?? REFRESH_PATH;

  return function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    if (publicPaths.some((p) => pathname === p || pathname.startsWith(p))) {
      return NextResponse.next();
    }

    const hasAccess = req.cookies.has(SESSION_COOKIE);
    const hasRefresh = req.cookies.has(REFRESH_COOKIE);

    if (hasAccess) return NextResponse.next();

    const returnTo = `${pathname}${req.nextUrl.search}`;
    const origin = publicOrigin(req);

    if (hasRefresh) {
      const refresh = new URL(refreshPath, origin);
      refresh.searchParams.set('return_to', returnTo);
      return NextResponse.redirect(refresh);
    }

    const signIn = new URL(signInPath, origin);
    signIn.searchParams.set('next', returnTo);
    return NextResponse.redirect(signIn);
  };
}

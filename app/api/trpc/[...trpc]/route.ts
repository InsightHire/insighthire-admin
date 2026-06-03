/**
 * Same-origin BFF proxy for tRPC.
 *
 * The browser tRPC client (`lib/trpc.ts`) points at this route on the admin
 * origin instead of calling `api.insighthire.com` directly. The proxy reads the
 * Authio access token from the HttpOnly `authio_session` cookie *server-side*
 * and attaches it as `Authorization: Bearer …` before forwarding to the API.
 *
 * This keeps the access JWT entirely server-side: it is never serialized into a
 * response body or otherwise exposed to client JS, so an XSS on admin.insighthire.com
 * can't exfiltrate it. (Replaces the old `/api/auth/access-token` bridge.)
 *
 * Auth is enforced here (401 when the cookie is absent), so this path is listed
 * in `DEFAULT_PUBLIC_PATHS` to bypass the middleware redirect-to-sign-in gate —
 * the client surfaces a 401 by bouncing to the sign-in page, exactly as it did
 * when the API returned 401 cross-origin.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '@/lib/authio/config';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/$/, '');

async function proxy(req: NextRequest, ctx: { params: { trpc?: string[] } }): Promise<NextResponse> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) {
    return new NextResponse(null, { status: 401 });
  }

  const path = (ctx.params.trpc ?? []).join('/');
  const target = `${API_BASE}/trpc/${path}${req.nextUrl.search}`;

  // Forward the inbound headers, swapping in the server-held bearer and dropping
  // headers that must not travel cross-origin (the admin cookies) or that would
  // be wrong for the rewritten request (host, content-length).
  const headers = new Headers(req.headers);
  headers.set('authorization', `Bearer ${token}`);
  headers.delete('cookie');
  headers.delete('host');
  headers.delete('content-length');

  const init: RequestInit = {
    method: req.method,
    headers,
    redirect: 'manual',
  };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await req.arrayBuffer();
  }

  const upstream = await fetch(target, init);

  // `fetch` transparently decompresses the body, so strip encoding/length
  // headers that would otherwise misdescribe the proxied stream.
  const resHeaders = new Headers(upstream.headers);
  resHeaders.delete('content-encoding');
  resHeaders.delete('content-length');
  resHeaders.delete('transfer-encoding');

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: resHeaders,
  });
}

export { proxy as GET, proxy as POST };

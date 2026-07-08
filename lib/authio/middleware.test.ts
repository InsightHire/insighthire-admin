import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { SignJWT } from 'jose';
import { createAuthioMiddleware } from './middleware';

const secret = new TextEncoder().encode('test-secret');

async function mintJwt(expOffsetSec: number): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ kind: 'customer' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('user_1')
    .setExpirationTime(now + expOffsetSec)
    .sign(secret);
}

function makeReq(
  url: string,
  init: { cookies?: Record<string, string>; method?: string } = {},
): NextRequest {
  const cookieHeader = Object.entries(init.cookies ?? {})
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
  const headers = new Headers();
  if (cookieHeader) headers.set('cookie', cookieHeader);
  return new NextRequest(new URL(url), {
    method: init.method ?? 'GET',
    headers,
  });
}

describe('authio/middleware', () => {
  it('passes through with a valid access cookie', async () => {
    const mw = createAuthioMiddleware();
    const token = await mintJwt(900);
    const res = mw(
      makeReq('https://admin.test/projects', {
        cookies: { authio_session: token },
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });

  it('redirects to refresh when access is expired but refresh exists', async () => {
    const mw = createAuthioMiddleware();
    const token = await mintJwt(-60);
    const res = mw(
      makeReq('https://admin.test/projects?tab=1', {
        cookies: { authio_session: token, authio_refresh: 'rt-1' },
      }),
    );
    expect(res.status).toBe(307);
    const loc = res.headers.get('location')!;
    expect(loc).toContain('/api/auth/refresh');
    expect(loc).toContain('return_to=%2Fprojects%3Ftab%3D1');
  });

  it('redirects to sign-in when neither cookie is present', () => {
    const mw = createAuthioMiddleware();
    const res = mw(makeReq('https://admin.test/projects'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')!).toContain('/sign-in');
  });

  it('does not silently refresh on POST even with refresh cookie', async () => {
    const mw = createAuthioMiddleware();
    const token = await mintJwt(-60);
    const res = mw(
      makeReq('https://admin.test/projects', {
        cookies: { authio_session: token, authio_refresh: 'rt-1' },
        method: 'POST',
      }),
    );
    expect(res.status).toBe(307);
    expect(res.headers.get('location')!).toContain('/sign-in');
  });
});

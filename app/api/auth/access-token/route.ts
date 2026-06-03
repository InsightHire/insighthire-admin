/**
 * Same-origin bridge: hand the Authio access token to the client tRPC layer so it
 * can attach `Authorization: Bearer …` to cross-origin API calls.
 *
 * The Authio cookies are HttpOnly + scoped to admin.insighthire.com, so the
 * browser can't read them directly and they don't travel to api.insighthire.com.
 * This route reads the cookie server-side and returns the JWT to the client.
 */
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '@/lib/authio/config';

export const dynamic = 'force-dynamic';

export async function GET() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) {
    return new NextResponse(null, { status: 401 });
  }
  return NextResponse.json({ accessToken: token });
}

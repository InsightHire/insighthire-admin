/** Bumps the staff idle-timeout cookie while someone is actually using the page (see lib/authio/idle.ts). */
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '@/lib/authio/config';
import { IDLE_COOKIE, IDLE_HEADER, idleCookie, isIdleExpired } from '@/lib/authio/idle';

export const dynamic = 'force-dynamic';

export async function POST(): Promise<NextResponse> {
  const jar = cookies();
  if (!jar.get(SESSION_COOKIE)?.value) return new NextResponse(null, { status: 401 });
  const now = Date.now();
  if (isIdleExpired(jar.get(IDLE_COOKIE)?.value, now)) {
    return new NextResponse(null, { status: 401, headers: { [IDLE_HEADER]: 'idle' } });
  }
  const res = new NextResponse(null, { status: 204 });
  res.cookies.set(idleCookie(now, process.env.NODE_ENV === 'production'));
  return res;
}

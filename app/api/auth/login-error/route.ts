export const dynamic = 'force-dynamic';

import { type NextRequest } from 'next/server';
import { redirectWithAuthError } from '@/lib/authio/auth-errors';

/** Sets a short-lived flash cookie and redirects to /sign-in with a clean URL. */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code') || 'unknown';
  return redirectWithAuthError(req, code);
}

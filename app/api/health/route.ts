import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Public health endpoint, polled by the API's getReleaseStatus. */
export function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      commit: process.env.RAILWAY_GIT_COMMIT_SHA || null,
      timestamp: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}

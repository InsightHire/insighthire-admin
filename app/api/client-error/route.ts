/**
 * Same-origin sink for browser runtime errors.
 *
 * The client reporter (`components/devops/client-error-reporter.tsx`) and the
 * route error boundaries POST here when an uncaught exception / unhandled
 * rejection happens. We forward to the devops worker's internal hook using the
 * server-held internal token so a client exception becomes a tracked incident
 * (Slack + GitHub issue) WITHOUT anyone needing to open the browser console.
 *
 * Public on purpose (no auth) so pre-auth crashes are still captured. Middleware
 * skips `/api/*`, so this is reachable without a session cookie.
 */
import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const WORKER_BASE = (process.env.DEVOPS_WORKER_URL || '').replace(/\/+$/, '');
const WORKER_TOKEN = process.env.DEVOPS_INTERNAL_TOKEN || '';
const APP_NAME = process.env.NEXT_PUBLIC_DEVOPS_APP_NAME || 'insighthire-admin';

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!WORKER_BASE || !WORKER_TOKEN) {
    return NextResponse.json({ ok: false, reason: 'not_configured' }, { status: 202 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, reason: 'bad_json' }, { status: 400 });
  }

  const message = String(body.message ?? '').trim();
  if (!message) {
    return NextResponse.json({ ok: false, reason: 'missing_message' }, { status: 400 });
  }

  const payload = {
    app: String(body.app ?? APP_NAME),
    message: message.slice(0, 500),
    stack: typeof body.stack === 'string' ? body.stack.slice(0, 5000) : undefined,
    source: typeof body.source === 'string' ? body.source.slice(0, 300) : undefined,
    url: typeof body.url === 'string' ? body.url.slice(0, 500) : undefined,
    kind: typeof body.kind === 'string' ? body.kind.slice(0, 60) : undefined,
    release: typeof body.release === 'string' ? body.release.slice(0, 60) : undefined,
    userAgent: req.headers.get('user-agent')?.slice(0, 300) ?? undefined,
  };

  try {
    const res = await fetch(`${WORKER_BASE}/hooks/client-error`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-devops-internal-token': WORKER_TOKEN,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json({ ok: res.ok, ...data }, { status: res.ok ? 200 : 202 });
  } catch {
    return NextResponse.json({ ok: false, reason: 'worker_unreachable' }, { status: 202 });
  }
}

import { NextResponse } from 'next/server';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/$/, '');

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const slug = params.slug;
  const upstream = await fetch(`${API_BASE}/cdn/v/${encodeURIComponent(slug)}/stream`, {
    redirect: 'manual',
    cache: 'no-store',
  });

  if (upstream.status >= 300 && upstream.status < 400) {
    const location = upstream.headers.get('location');
    if (location) {
      return NextResponse.redirect(location, 302);
    }
  }

  if (upstream.status === 404) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ error: 'Stream unavailable' }, { status: 502 });
}

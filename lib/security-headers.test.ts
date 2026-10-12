import { describe, it, expect } from 'vitest';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const nextConfig = require('../next.config.js');

async function headerMap(): Promise<{ source: string; headers: Record<string, string> }[]> {
  const rules: { source: string; headers: { key: string; value: string }[] }[] = await nextConfig.headers();
  return rules.map((r) => ({
    source: r.source,
    headers: Object.fromEntries(r.headers.map((h) => [h.key.toLowerCase(), h.value])),
  }));
}

describe('admin security headers', () => {
  it('sends HSTS, nosniff, anti-framing and referrer policy on every path', async () => {
    const rules = await headerMap();
    const all = rules.find((r) => r.source === '/:path*');
    expect(all).toBeDefined();
    expect(all!.headers['strict-transport-security']).toMatch(/max-age=\d{8,}/);
    expect(all!.headers['x-content-type-options']).toBe('nosniff');
    expect(all!.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(all!.headers['content-security-policy']).toContain("frame-ancestors 'self'");
    expect(all!.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });

  it('does not allow any origin on the staff API routes', async () => {
    const rules = await headerMap();
    for (const r of rules) {
      expect(r.headers['access-control-allow-origin']).toBeUndefined();
    }
  });
});

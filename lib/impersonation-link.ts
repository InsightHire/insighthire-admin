/**
 * Impersonation results carry a one-time-code link only. The session token
 * stays server-side; the customer app redeems the code and sets its own
 * httpOnly cookie. Anything that looks like a token in the URL is refused.
 */
const CODE_LINK = /\/api\/auth\/impersonate\?code=[a-f0-9]{64}$/;

export function assertImpersonationLink(loginUrl: unknown): string {
  if (typeof loginUrl !== 'string' || !CODE_LINK.test(loginUrl)) {
    throw new Error('Impersonation link is not a one-time code link');
  }
  return loginUrl;
}

export function openImpersonationLink(
  result: { loginUrl?: unknown },
  open: (url: string, target: string, features: string) => unknown = (u, t, f) => window.open(u, t, f),
): void {
  open(assertImpersonationLink(result.loginUrl), '_blank', 'noopener');
}

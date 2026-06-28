import { AUTHIO_AUTH_CORE_URL, authCoreHeaders } from './config';

export interface AuthioTokenPair {
  accessToken: string;
  refreshToken: string;
}

/** Exchange an OAuth authorization code from the hosted UI callback for session tokens. */
export async function exchangeAuthorizationCode(
  code: string,
  redirectUri: string,
): Promise<AuthioTokenPair | null> {
  try {
    const payload: Record<string, string> = {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    };
    const secret = process.env.AUTHIO_SECRET_KEY;
    if (secret) payload.client_secret = secret;

    const res = await fetch(`${AUTHIO_AUTH_CORE_URL}/v1/auth/token`, {
      method: 'POST',
      headers: authCoreHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
    };
    if (!body.access_token || !body.refresh_token) return null;
    return {
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
    };
  } catch {
    return null;
  }
}

export function hashBootstrapHtml(signInErrorPath = '/sign-in'): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Completing sign in…</title></head>
<body><p style="font-family:system-ui;text-align:center;margin-top:40vh">Completing sign in…</p>
<script>
(function () {
  var merged = new URLSearchParams(window.location.search);
  var hash = window.location.hash.replace(/^#/, '');
  if (hash) {
    new URLSearchParams(hash).forEach(function (v, k) { merged.set(k, v); });
  }
  if (merged.get('access_token') && merged.get('refresh_token')) {
    window.location.replace(window.location.pathname + '?' + merged.toString());
    return;
  }
  if (merged.get('code')) {
    window.location.replace(window.location.pathname + '?' + merged.toString());
    return;
  }
  var err = merged.get('error') || 'missing_tokens';
  window.location.replace('${signInErrorPath}?error=' + encodeURIComponent(err));
})();
</script></body></html>`;
}

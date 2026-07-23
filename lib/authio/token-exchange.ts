import { AUTHIO_AUTH_CORE_URL, AUTHIO_PROJECT_ID, authCoreHeaders } from './config';

export interface AuthioTokenPair {
  accessToken: string;
  refreshToken: string;
  accessExpiresInSec?: number;
}

/** Exchange Authio Lobby/magic-link session-handoff `code` for session tokens. */
export async function exchangeSessionHandoff(
  code: string,
  redirectUri: string,
  clientStateNonce?: string | null,
): Promise<AuthioTokenPair | null> {
  try {
    const res = await fetch(
      `${AUTHIO_AUTH_CORE_URL}/v1/auth/session-handoff/exchange`,
      {
        method: 'POST',
        headers: authCoreHeaders(),
        body: JSON.stringify({
          code,
          redirect_uri: redirectUri,
          ...(clientStateNonce ? { client_state_nonce: clientStateNonce } : {}),
        }),
      },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    if (!body.access_token || !body.refresh_token) return null;
    return {
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      accessExpiresInSec: body.expires_in,
    };
  } catch {
    return null;
  }
}

/** Exchange an OAuth authorization code from the hosted UI callback for session tokens. */
export async function exchangeAuthorizationCode(
  code: string,
  redirectUri: string,
  codeVerifier: string,
): Promise<AuthioTokenPair | null> {
  try {
    const payload: Record<string, string> = {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: AUTHIO_PROJECT_ID,
      code_verifier: codeVerifier,
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
      expires_in?: number;
    };
    if (!body.access_token || !body.refresh_token) return null;
    return {
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      accessExpiresInSec: body.expires_in,
    };
  } catch {
    return null;
  }
}

export function hashBootstrapHtml(loginErrorPath = '/api/auth/login-error'): string {
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
  window.location.replace('${loginErrorPath}?code=' + encodeURIComponent(err));
})();
</script></body></html>`;
}

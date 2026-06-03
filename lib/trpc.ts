import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';

export const trpc = createTRPCReact<any>();

/**
 * Authio access-token cache.
 *
 * The Authio session lives in an HttpOnly cookie on this origin (admin.insighthire.com).
 * Our API lives on a different origin (api.insighthire.com), so we can't share the
 * cookie cross-origin. Instead, we fetch the JWT from the same-origin
 * `/api/auth/access-token` bridge and forward it as `Authorization: Bearer …`.
 *
 * Cache for 60s — the access JWT is good for ~15min in Authio's default profile, and
 * any 401 from the API triggers a re-fetch (which itself goes through Authio's
 * silent refresh in middleware if the access cookie has aged out).
 */
const TOKEN_CACHE_TTL_MS = 60_000;
let tokenCache: { token: string; expiresAt: number } | null = null;
let tokenInflight: Promise<string | null> | null = null;

async function fetchAuthioToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  if (tokenCache && tokenCache.expiresAt > Date.now()) return tokenCache.token;
  if (tokenInflight) return tokenInflight;

  tokenInflight = (async () => {
    try {
      const res = await fetch('/api/auth/access-token', {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!res.ok) {
        tokenCache = null;
        return null;
      }
      const body = (await res.json()) as { accessToken: string };
      tokenCache = { token: body.accessToken, expiresAt: Date.now() + TOKEN_CACHE_TTL_MS };
      return body.accessToken;
    } catch {
      tokenCache = null;
      return null;
    } finally {
      tokenInflight = null;
    }
  })();
  return tokenInflight;
}

function invalidateTokenCache() {
  tokenCache = null;
}

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: process.env.NEXT_PUBLIC_API_URL
        ? `${process.env.NEXT_PUBLIC_API_URL}/trpc`
        : 'http://localhost:4000/trpc',
      async fetch(url, options) {
        const token = await fetchAuthioToken();

        const headers = {
          ...options?.headers,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };

        return fetch(url, {
          ...options,
          credentials: 'include',
          headers,
        }).then(async (res) => {
          // Hard 401/403 — token rotated or revoked. Invalidate cache and bounce to
          // sign-in. Middleware will do the silent refresh if a refresh cookie is
          // still around.
          if (res.status === 401 || res.status === 403) {
            invalidateTokenCache();
            if (typeof window !== 'undefined') {
              window.location.href = `/sign-in?next=${encodeURIComponent(
                window.location.pathname + window.location.search,
              )}`;
            }
            return res;
          }

          // tRPC batch errors come back as HTTP 200 with per-op errors in the body.
          // Inspect to catch UNAUTHORIZED / FORBIDDEN that don't surface as HTTP 401.
          try {
            const cloned = res.clone();
            const body = await cloned.json();
            const results = Array.isArray(body) ? body : [body];
            const hasAuthError = results.some(
              (r: any) =>
                r?.error?.data?.code === 'UNAUTHORIZED' || r?.error?.data?.code === 'FORBIDDEN',
            );
            if (hasAuthError && typeof window !== 'undefined') {
              invalidateTokenCache();
              window.location.href = `/sign-in?next=${encodeURIComponent(
                window.location.pathname + window.location.search,
              )}`;
            }
          } catch {
            /* not JSON — let tRPC handle */
          }

          return res;
        });
      },
    }),
  ],
});

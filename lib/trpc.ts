import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import { REFRESH_PATH } from '@/lib/authio/config';

export const trpc = createTRPCReact<any>();

/**
 * tRPC client.
 *
 * Calls route through the same-origin BFF proxy at `/api/trpc/*`
 * (see `app/api/trpc/[...trpc]/route.ts`). That proxy reads the Authio access
 * token from the HttpOnly `authio_session` cookie server-side and attaches it as
 * `Authorization: Bearer …` before forwarding to api.insighthire.com. The token
 * is therefore never exposed to client JS — an XSS can't steal it.
 *
 * On the server (SSR) a relative URL can't be fetched, so we build an absolute
 * one from NEXT_PUBLIC_APP_URL; in the browser we use the relative path.
 */
const TRPC_URL =
  typeof window !== 'undefined'
    ? '/api/trpc'
    : `${(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3011').replace(/\/$/, '')}/api/trpc`;

function redirectToSessionRefresh() {
  if (typeof window === 'undefined') return;
  const returnTo = window.location.pathname + window.location.search;
  const refresh = new URL(REFRESH_PATH, window.location.origin);
  refresh.searchParams.set('return_to', returnTo);
  window.location.href = refresh.toString();
}

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: TRPC_URL,
      async fetch(url, options) {
        return fetch(url, {
          ...options,
          credentials: 'include',
        }).then(async (res) => {
          // Hard 401/403 — access JWT expired or revoked. Route through the BFF
          // refresh handler so the refresh cookie can rotate a new access token.
          if (res.status === 401 || res.status === 403) {
            redirectToSessionRefresh();
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
            if (hasAuthError) {
              redirectToSessionRefresh();
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

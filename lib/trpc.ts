import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';

// Create tRPC React hooks
export const trpc = createTRPCReact<any>();

// Create tRPC client
export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: process.env.NEXT_PUBLIC_API_URL
        ? `${process.env.NEXT_PUBLIC_API_URL}/trpc`
        : 'http://localhost:4000/trpc',
      fetch(url, options) {
        // Admin app always uses admin_token
        const token = typeof window !== 'undefined'
          ? localStorage.getItem('admin_token')
          : null;

        const headers = {
          ...options?.headers,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };

        return fetch(url, {
          ...options,
          credentials: 'include',
          headers,
        }).then(async (res) => {
          // Handle auth failures - redirect to admin login
          // Check HTTP status first (non-batch endpoints)
          if (res.status === 401 || res.status === 403) {
            if (typeof window !== 'undefined') {
              localStorage.removeItem('admin_token');
              localStorage.removeItem('admin_user');
              window.location.href = '/login';
            }
            return res;
          }

          // For tRPC batch responses (HTTP 200), check the response body for auth errors
          // We need to clone the response so tRPC can still read it
          const cloned = res.clone();
          try {
            const body = await cloned.json();
            const results = Array.isArray(body) ? body : [body];
            const hasAuthError = results.some(
              (r: any) => r?.error?.data?.code === 'UNAUTHORIZED' || r?.error?.data?.code === 'FORBIDDEN'
            );
            if (hasAuthError && typeof window !== 'undefined') {
              localStorage.removeItem('admin_token');
              localStorage.removeItem('admin_user');
              window.location.href = '/login';
            }
          } catch {
            // If we can't parse the body, just let tRPC handle it
          }

          return res;
        });
      },
    }),
  ],
});

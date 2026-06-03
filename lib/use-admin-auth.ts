'use client';

/**
 * Compat shim. Auth gating is now done by middleware.ts (Authio cookies). Any client
 * code that previously called `useAdminAuth()` to gate its render gets an immediate
 * `isAuthenticated: true` — if the request reached this React tree at all, middleware
 * already verified or refreshed the session.
 *
 * Kept exported so we don't break callers in a single commit; new code should use
 * `auth()` from `@/lib/authio/session` in Server Components instead.
 */
export function useAdminAuth() {
  return { isAuthenticated: true, isLoading: false };
}

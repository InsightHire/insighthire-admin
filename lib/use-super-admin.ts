import { trpc } from '@/lib/trpc';

/**
 * Client-side check for the SUPER_ADMIN tier — used to hide destructive
 * controls (impersonation, IP blocks, flag/announcement deletes, org
 * suspend/archive/delete). Server-side `superAdminProcedure` is the real
 * guard; this only avoids showing a button that will 403.
 */
export function useIsSuperAdmin(): boolean {
  const { data: me } = (trpc as any).platformAdmin.me.useQuery(undefined, { staleTime: 60_000 });
  return me?.platformRoleName === 'platform_super_admin' || me?.platformRole === 'SUPER_ADMIN';
}

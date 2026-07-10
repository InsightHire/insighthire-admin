'use client';

import { usePathname } from 'next/navigation';
import { AppShell } from '@/components/admin/app-shell';

/**
 * Auth gating lives in middleware.ts. This layout only provides chrome.
 * Sign-in / login / accept-invite render without the ops shell.
 */
export function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (
    pathname === '/sign-in' ||
    pathname === '/login' ||
    pathname === '/accept-invite'
  ) {
    return <>{children}</>;
  }

  return <AppShell>{children}</AppShell>;
}

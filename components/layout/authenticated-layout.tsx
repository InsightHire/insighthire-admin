'use client';

import { usePathname } from 'next/navigation';
import { PlatformAdminNav } from '../platform-admin/admin-nav';
import { AlertBanner } from './alert-banner';

/**
 * Auth gating now lives in `middleware.ts` (Authio session cookie). By the time this
 * layout renders, the user is signed in — we just chrome the page.
 */
export function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // /sign-in (and /login redirect) render their own shell.
  if (pathname === '/sign-in' || pathname === '/login') {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AlertBanner />
      <PlatformAdminNav />
      {children}
    </div>
  );
}

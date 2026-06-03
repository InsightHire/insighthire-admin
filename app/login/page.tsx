/**
 * Legacy admin login route. Authentication now happens via Authio (Microsoft 365)
 * at /sign-in. This page only exists so old bookmarks / external links don't 404.
 */
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function LegacyAdminLoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const next =
    searchParams.next && searchParams.next.startsWith('/') ? `?next=${encodeURIComponent(searchParams.next)}` : '';
  redirect(`/sign-in${next}`);
}

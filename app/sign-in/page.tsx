/**
 * Admin sign-in. Single button → Authio hosted UI (Microsoft 365 only per project
 * config at dashboard.authio.com/settings/security). No password form, no passkey
 * UI in our code — Authio renders whichever methods you toggled on for the project.
 */
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { auth } from '@/lib/authio/session';
import { StaffSignIn } from '@/components/auth/staff-sign-in';
import { SIGN_IN_PATH } from '@/lib/authio/config';
import { AUTH_LOGIN_ERROR_COOKIE, authErrorMessage } from '@/lib/authio/auth-errors';

export const dynamic = 'force-dynamic';

export default async function AdminSignInPage({
  searchParams,
}: {
  searchParams: { next?: string; error?: string };
}) {
  if (searchParams.error) {
    redirect(`/api/auth/login-error?code=${encodeURIComponent(searchParams.error)}`);
  }

  const session = await auth();
  if (session) {
    redirect(searchParams.next && searchParams.next.startsWith('/') ? searchParams.next : '/');
  }

  const flashCode = cookies().get(AUTH_LOGIN_ERROR_COOKIE)?.value;
  const errorMessage = authErrorMessage(flashCode);

  const next = searchParams.next && searchParams.next.startsWith('/') ? searchParams.next : '/';
  const signInHref =
    next === '/' ? SIGN_IN_PATH : `${SIGN_IN_PATH}?next=${encodeURIComponent(next)}`;

  return <StaffSignIn signInHref={signInHref} errorMessage={errorMessage} />;
}

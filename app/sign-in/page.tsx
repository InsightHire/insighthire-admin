/**
 * Admin sign-in. Single button → Authio hosted UI (Microsoft 365 only per project
 * config at dashboard.authio.com/settings/security). No password form, no passkey
 * UI in our code — Authio renders whichever methods you toggled on for the project.
 */
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { auth } from '@/lib/authio/session';
import { InsighthireAuthLogo, AuthPageLayout } from '@/components/auth/auth-shell';
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
  const signInHref = `${SIGN_IN_PATH}?next=${encodeURIComponent(next)}`;

  return (
    <AuthPageLayout>
      <InsighthireAuthLogo />

      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-white tracking-tight">Sign in</h1>
        <p className="text-sm text-zinc-400 mt-2">
          Use your Microsoft 365 account to access the InsightHire admin.
        </p>
      </div>

      <div className="bg-zinc-900 rounded-2xl shadow-2xl p-8 border border-zinc-800">
        {errorMessage && (
          <div className="mb-6 bg-red-950/60 border border-red-800/80 text-red-200 px-4 py-3 rounded-lg text-sm">
            {errorMessage}
          </div>
        )}

        <a
          href={signInHref}
          className="block w-full text-center bg-gradient-to-r from-indigo-600 to-violet-600 text-white py-3 px-6 rounded-lg font-medium hover:from-indigo-500 hover:to-violet-500 transition-colors shadow-lg shadow-indigo-900/20"
        >
          Continue with Microsoft 365
        </a>

        <p className="mt-6 pt-6 border-t border-zinc-800 text-center text-xs text-zinc-500">
          Secure access · Authorized users only
        </p>
      </div>

      <div className="mt-6 rounded-xl border border-amber-900/40 bg-amber-950/25 text-amber-100/90 px-4 py-3 text-xs leading-relaxed">
        <strong className="text-amber-200">Security notice:</strong> This portal is for
        authorized InsightHire operators only. Access and actions are logged.
      </div>
    </AuthPageLayout>
  );
}

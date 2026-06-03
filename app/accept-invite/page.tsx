'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { InsighthireAuthLogo, AuthPageLayout, AuthPageSuspenseFallback } from '@/components/auth/auth-shell';

function AcceptInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  // Note: admin sign-in moved to Microsoft 365 via Authio. This invite-accept
  // flow still works (legacy) but on success we redirect to /sign-in. The
  // password you set won't actually be checked anymore; sign in with 365.
  const acceptMutation = trpc.auth.acceptPlatformAdminInvite.useMutation({
    onSuccess: () => {
      router.push('/sign-in?accepted=1');
    },
    onError: (e) => {
      setError(e.message);
    },
  });

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing invitation link');
    }
  }, [token]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (!token) return;
    acceptMutation.mutate({ token, password });
  };

  const shell = (children: React.ReactNode) => (
    <AuthPageLayout>
      <InsighthireAuthLogo />
      {children}
    </AuthPageLayout>
  );

  if (!token) {
    return shell(
      <div className="bg-zinc-900 rounded-2xl p-8 border border-zinc-800 shadow-2xl">
        <div className="text-center text-red-400">
          <p className="font-medium text-lg">Invalid invitation link</p>
          <p className="text-sm mt-3 text-zinc-400 leading-relaxed">
            This link may be expired or invalid. Ask an admin to resend your invitation.
          </p>
        </div>
        <a
          href="/sign-in"
          className="block mt-8 text-center text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors"
        >
          Back to sign in
        </a>
      </div>
    );
  }

  return shell(
    <>
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-white tracking-tight">Accept invitation</h1>
        <p className="text-zinc-400 mt-2 text-sm leading-relaxed">Create a password</p>
      </div>

      <div className="bg-zinc-900 rounded-2xl shadow-2xl p-8 border border-zinc-800">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="accept-password" className="block text-sm font-medium text-zinc-300 mb-2">
              Password
            </label>
            <input
              id="accept-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-950 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-shadow"
              placeholder="At least 8 characters"
              required
              minLength={8}
              autoFocus
              autoComplete="new-password"
            />
          </div>
          <div>
            <label htmlFor="accept-password-confirm" className="block text-sm font-medium text-zinc-300 mb-2">
              Confirm password
            </label>
            <input
              id="accept-password-confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-950 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-shadow"
              placeholder="Repeat password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          {error && (
            <div className="bg-red-950/60 border border-red-800/80 text-red-200 px-4 py-3 rounded-lg text-sm">{error}</div>
          )}

          <button
            type="submit"
            disabled={acceptMutation.isPending}
            className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white py-3 px-6 rounded-lg font-medium hover:from-indigo-500 hover:to-violet-500 transition-colors disabled:opacity-50 shadow-lg shadow-indigo-900/20"
          >
            {acceptMutation.isPending ? 'Setting up…' : 'Set password & continue'}
          </button>
        </form>
      </div>
    </>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<AuthPageSuspenseFallback />}>
      <AcceptInviteContent />
    </Suspense>
  );
}

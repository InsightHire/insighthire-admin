'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { InsighthireAuthLogo, AuthPageLayout } from '@/components/auth/auth-shell';

/**
 * Admin app login — password auth (not customer WorkOS).
 */
export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [acceptedMsg, setAcceptedMsg] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('accepted') === '1') {
      setAcceptedMsg(true);
    }
  }, []);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      if (!data.user?.isPlatformAdmin || data.user.organizationId !== 'platform_00000000000000000') {
        setError('Not a platform administrator');
        return;
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem('admin_token', data.accessToken);
        localStorage.setItem('admin_user', JSON.stringify(data.user));
      }

      router.push('/organizations');
    },
    onError: (err: any) => {
      console.error('Login error:', err);
      setError(err.message || 'Login failed');
    },
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    loginMutation.mutate({
      email,
      password,
      rememberMe: false,
    });
  };

  return (
    <AuthPageLayout>
      <InsighthireAuthLogo />

      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-white tracking-tight">Sign in</h1>
      </div>

      <div className="bg-zinc-900 rounded-2xl shadow-2xl p-8 border border-zinc-800">
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="login-email" className="block text-sm font-medium text-zinc-300 mb-2">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-950 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-shadow"
              placeholder="you@company.com"
              required
              autoFocus
              autoComplete="email"
            />
          </div>

          <div>
            <label htmlFor="login-password" className="block text-sm font-medium text-zinc-300 mb-2">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-950 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-shadow"
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          {acceptedMsg && (
            <div className="bg-emerald-950/50 border border-emerald-800/80 text-emerald-200 px-4 py-3 rounded-lg text-sm">
              Password set successfully. You can now log in.
            </div>
          )}
          {error && (
            <div className="bg-red-950/60 border border-red-800/80 text-red-200 px-4 py-3 rounded-lg text-sm">{error}</div>
          )}

          <button
            type="submit"
            disabled={loginMutation.isLoading}
            className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white py-3 px-6 rounded-lg font-medium hover:from-indigo-500 hover:to-violet-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-900/20"
          >
            {loginMutation.isLoading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 pt-6 border-t border-zinc-800 text-center text-xs text-zinc-500">Secure access · Authorized users only</p>
      </div>

      <div className="mt-6 rounded-xl border border-amber-900/40 bg-amber-950/25 text-amber-100/90 px-4 py-3 text-xs leading-relaxed">
        <strong className="text-amber-200">Security notice:</strong> This portal is for authorized InsightHire operators only.
        Access and actions are logged.
      </div>
    </AuthPageLayout>
  );
}

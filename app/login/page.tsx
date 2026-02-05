'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { ShieldCheckIcon } from '@heroicons/react/24/outline';

/**
 * Platform Admin Login
 * Separate from customer WorkOS auth - uses password authentication
 *
 * Default credentials:
 * Email: admin@insighthire.com
 * Password: Admin@2024!
 */
export default function PlatformAdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {


      // Verify this is a platform admin
      if (!data.user?.isPlatformAdmin || data.user.organizationId !== 'platform_00000000000000000') {
        setError('Not a platform administrator');
        return;
      }

      // Store admin token
      if (typeof window !== 'undefined') {
        localStorage.setItem('admin_token', data.accessToken);
        localStorage.setItem('admin_user', JSON.stringify(data.user));
      }



      // Redirect to admin dashboard
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-4">
            <ShieldCheckIcon className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Platform Admin
          </h1>
          <p className="text-gray-400">
            InsightHire System Administration
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-gray-800 rounded-2xl shadow-2xl p-8 border border-gray-700">
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Admin Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="admin@insighthire.com"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loginMutation.isLoading}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-6 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loginMutation.isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-700">
            <p className="text-sm text-gray-400 text-center">
              🔒 Secure admin-only access
            </p>
          </div>
        </div>

        {/* Warning */}
        <div className="mt-6 bg-yellow-900 border border-yellow-700 text-yellow-200 px-4 py-3 rounded-lg text-sm">
          <strong>⚠️ Security Notice:</strong> This portal is for InsightHire platform administrators only.
          All actions are logged and monitored.
        </div>
      </div>
    </div>
  );
}

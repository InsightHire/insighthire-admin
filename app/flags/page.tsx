'use client';
export const dynamic = 'force-dynamic';

/**
 * Feature flags / kill switches. Toggles apply platform-wide within ~30s
 * (the API caches flag reads briefly) — no deploy needed.
 */
import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';

export default function FlagsPage() {
  useAdminAuth();
  const utils = (trpc as any).useUtils();
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const list = (trpc as any).platformAdmin.listFlags.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const invalidate = () => (utils as any).platformAdmin.listFlags.invalidate();

  const create = (trpc as any).platformAdmin.createFlag.useMutation({
    onSuccess: () => { setKey(''); setDescription(''); setError(null); invalidate(); },
    onError: (e: { message: string }) => setError(e.message),
  });
  const update = (trpc as any).platformAdmin.updateFlag.useMutation({
    onSuccess: invalidate,
    onError: (e: { message: string }) => setError(e.message),
  });
  const remove = (trpc as any).platformAdmin.deleteFlag.useMutation({
    onSuccess: invalidate,
    onError: (e: { message: string }) => setError(e.message),
  });

  const rows: any[] = list.data ?? [];

  return (
    <AuthenticatedLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Feature flags</h1>
          <p className="text-sm text-gray-500">
            Platform-wide kill switches. Changes take effect within ~30 seconds — no deploy.
            A feature gated behind a missing or disabled flag is off.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">New flag</h2>
          <div className="flex flex-wrap gap-3">
            <input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="key (lowercase, e.g. tenant_announcements)"
              className="flex-1 min-w-56 rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this flag control?"
              className="flex-[2] min-w-64 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              onClick={() => create.mutate({ key: key.trim(), description: description.trim() || undefined })}
              disabled={create.isPending || !/^[a-z0-9_.-]{2,80}$/.test(key.trim())}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {create.isPending ? 'Creating…' : 'Create (off)'}
            </button>
          </div>
          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow divide-y divide-gray-50">
          {list.isLoading ? (
            <p className="px-4 py-6 text-sm text-gray-400">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-400">No flags yet.</p>
          ) : (
            rows.map((f) => (
              <div key={f.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => update.mutate({ id: f.id, enabled: !f.enabled })}
                  disabled={update.isPending}
                  role="switch"
                  aria-checked={f.enabled}
                  className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
                    f.enabled ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 mt-0.5 rounded-full bg-white shadow transform transition-transform ${
                      f.enabled ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-mono font-medium text-gray-900">
                    {f.key}
                    <span className={`ml-2 px-1.5 py-0.5 text-xs rounded font-sans ${
                      f.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {f.enabled ? 'on' : 'off'}
                    </span>
                  </p>
                  {f.description && <p className="text-sm text-gray-600">{f.description}</p>}
                  <p className="text-xs text-gray-400 mt-0.5">
                    Updated {new Date(f.updatedAt).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (window.confirm(`Delete flag ${f.key}? Gated features will read it as OFF.`)) {
                      remove.mutate({ id: f.id });
                    }
                  }}
                  disabled={remove.isPending}
                  className="px-2.5 py-1 text-xs rounded-lg border border-red-200 text-red-700 hover:bg-red-50 shrink-0"
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </AuthenticatedLayout>
  );
}

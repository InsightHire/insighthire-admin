'use client';
export const dynamic = 'force-dynamic';

/**
 * Platform announcements — create and manage banners that appear in every
 * tenant dashboard (maintenance windows, incidents, product notices).
 */
import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { useIsSuperAdmin } from '@/lib/use-super-admin';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';

const SEVERITIES = [
  ['info', 'Info', 'bg-blue-100 text-blue-800'],
  ['maintenance', 'Maintenance', 'bg-amber-100 text-amber-800'],
  ['incident', 'Incident', 'bg-red-100 text-red-800'],
] as const;

const SEVERITY_STYLE: Record<string, string> = {
  info: 'bg-blue-100 text-blue-800',
  maintenance: 'bg-amber-100 text-amber-800',
  incident: 'bg-red-100 text-red-800',
};

export default function AnnouncementsPage() {
  useAdminAuth();
  const isSuperAdmin = useIsSuperAdmin();
  const utils = (trpc as any).useUtils();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [severity, setSeverity] = useState<'info' | 'maintenance' | 'incident'>('info');
  const [endsAt, setEndsAt] = useState('');
  const [error, setError] = useState<string | null>(null);

  const list = (trpc as any).platformAdmin.listAnnouncements.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const invalidate = () => (utils as any).platformAdmin.listAnnouncements.invalidate();

  const create = (trpc as any).platformAdmin.createAnnouncement.useMutation({
    onSuccess: () => { setTitle(''); setBody(''); setEndsAt(''); setError(null); invalidate(); },
    onError: (e: { message: string }) => setError(e.message),
  });
  const update = (trpc as any).platformAdmin.updateAnnouncement.useMutation({
    onSuccess: invalidate,
    onError: (e: { message: string }) => setError(e.message),
  });
  const remove = (trpc as any).platformAdmin.deleteAnnouncement.useMutation({
    onSuccess: invalidate,
    onError: (e: { message: string }) => setError(e.message),
  });

  const rows: any[] = list.data ?? [];
  const now = Date.now();

  return (
    <AuthenticatedLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
          <p className="text-sm text-gray-500">
            Active announcements appear as a banner in every tenant dashboard.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">New announcement</h2>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (e.g. Scheduled maintenance Saturday 02:00–04:00 UTC)"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Details shown under the title…"
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1">
              {SEVERITIES.map(([value, label, style]) => (
                <button
                  key={value}
                  onClick={() => setSeverity(value)}
                  className={`px-2.5 py-1 text-xs rounded-full font-medium ${
                    severity === value ? style : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              Ends
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
              />
              <span className="text-xs text-gray-400">(empty = until deactivated)</span>
            </label>
            <button
              onClick={() => create.mutate({
                title, body, severity,
                endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
              })}
              disabled={create.isPending || !title.trim() || !body.trim()}
              className="ml-auto px-4 py-2 text-sm font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {create.isPending ? 'Publishing…' : 'Publish to all tenants'}
            </button>
          </div>
          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow divide-y divide-gray-50">
          <div className="px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">History</h2>
          </div>
          {list.isLoading ? (
            <p className="px-4 py-6 text-sm text-gray-400">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-400">No announcements yet.</p>
          ) : (
            rows.map((a) => {
              const live = a.active
                && new Date(a.startsAt).getTime() <= now
                && (!a.endsAt || new Date(a.endsAt).getTime() > now);
              return (
                <div key={a.id} className="px-4 py-3 flex flex-wrap items-start gap-3">
                  <span className={`px-1.5 py-0.5 text-xs rounded shrink-0 ${SEVERITY_STYLE[a.severity] ?? 'bg-gray-100 text-gray-600'}`}>
                    {a.severity}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {a.title}
                      {live && (
                        <span className="ml-2 px-1.5 py-0.5 text-xs rounded bg-green-100 text-green-800">live</span>
                      )}
                    </p>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{a.body}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(a.startsAt).toLocaleString()}
                      {a.endsAt ? ` → ${new Date(a.endsAt).toLocaleString()}` : ' → until deactivated'}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => update.mutate({ id: a.id, active: !a.active })}
                      disabled={update.isPending}
                      className="px-2.5 py-1 text-xs rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                    >
                      {a.active ? 'Deactivate' : 'Reactivate'}
                    </button>
                    {isSuperAdmin && (
                      <button
                        onClick={() => remove.mutate({ id: a.id })}
                        disabled={remove.isPending}
                        className="px-2.5 py-1 text-xs rounded-lg border border-red-200 text-red-700 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </AuthenticatedLayout>
  );
}

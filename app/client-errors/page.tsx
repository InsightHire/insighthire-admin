'use client';
export const dynamic = 'force-dynamic';

/**
 * Browser-side errors reported by the tenant app (error boundaries and the
 * candidate journey reporter), grouped by fingerprint. The intake is the web
 * app's /api/errors route, which forwards to the API's /client-errors sink.
 */
import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';

const DAY_OPTIONS = [1, 7, 30] as const;

function ErrorGroupDetail({ fingerprint }: { fingerprint: string }) {
  const detail = (trpc as any).platformAdmin.getClientErrorGroup.useQuery(
    { fingerprint },
    { refetchOnWindowFocus: false },
  );
  const events: any[] = detail.data ?? [];
  if (detail.isLoading) return <p className="text-xs text-gray-400 px-3 py-2">Loading events…</p>;
  return (
    <div className="space-y-2 px-3 py-2 bg-gray-50 rounded-lg">
      {events.map((e) => (
        <div key={e.id} className="text-xs text-gray-600 border-b border-gray-100 pb-2 last:border-0 last:pb-0">
          <p className="text-gray-500">
            {new Date(e.createdAt).toLocaleString()}
            {e.url ? <span className="ml-2 text-gray-400">{e.url}</span> : null}
            {e.ip ? <span className="ml-2 font-mono text-gray-400">{e.ip}</span> : null}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {e.organizationName ? (
              <span className="rounded bg-indigo-50 px-1.5 py-0.5 font-medium text-indigo-700">
                {e.organizationName}
              </span>
            ) : (
              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-500">no tenant</span>
            )}
            {e.userEmail ? <span className="text-gray-700">{e.userEmail}</span> : null}
            {e.userRole ? <span className="text-gray-400">{e.userRole}</span> : null}
            {e.impersonating ? (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800">impersonating</span>
            ) : null}
            {e.journeySessionId ? (
              <span className="font-mono text-gray-400">session {e.journeySessionId}</span>
            ) : null}
            {e.viewport ? <span className="font-mono text-gray-400">{e.viewport}</span> : null}
            {e.releaseSha ? <span className="font-mono text-gray-400">build {e.releaseSha.slice(0, 8)}</span> : null}
          </p>
          {e.stack && (
            <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-gray-500">
              {e.stack}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}

export default function ClientErrorsPage() {
  useAdminAuth();
  const [days, setDays] = useState<number>(7);
  const [open, setOpen] = useState<string | null>(null);
  const [recovered, setRecovered] = useState<string | null>(null);

  const list = (trpc as any).platformAdmin.listClientErrors.useQuery(
    { days },
    { refetchOnWindowFocus: false },
  );
  const groups: any[] = list.data ?? [];

  /**
   * Re-resolve the tenant for rows recorded before the URL was parsed. Every
   * journey crash carries its session in the URL, so this is recoverable
   * history — it also runs nightly, this is just the impatient path.
   */
  const backfill = (trpc as any).platformAdmin.backfillClientErrorTenants.useMutation({
    onSuccess: (res: { scanned: number; resolved: number; stillUnknown: number }) => {
      setRecovered(`Recovered ${res.resolved} of ${res.scanned} — ${res.stillUnknown} have no tenant signal in their URL.`);
      void list.refetch();
    },
    onError: (err: { message?: string }) => setRecovered(err?.message ?? 'Backfill failed'),
  });

  return (
    <AuthenticatedLayout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Client errors</h1>
            <p className="text-sm text-gray-500">
              Browser crashes reported by the tenant app, grouped by fingerprint.
            </p>
          </div>
          <div className="flex gap-1">
            {DAY_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-2.5 py-1 text-xs rounded-full font-medium ${
                  days === d ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {d === 1 ? '24h' : `${d}d`}
              </button>
            ))}
            <button
              onClick={() => backfill.mutate({})}
              disabled={backfill.isPending}
              title="Re-resolve tenants from the session id in each error's URL"
              className="ml-2 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200 disabled:opacity-50"
            >
              {backfill.isPending ? 'Recovering…' : 'Recover tenants'}
            </button>
          </div>
        </div>

        {recovered ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-xs text-gray-700">{recovered}</div>
        ) : null}

        <div className="bg-white rounded-lg shadow divide-y divide-gray-50">
          {list.isLoading ? (
            <p className="px-4 py-6 text-sm text-gray-400">Loading…</p>
          ) : groups.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-400">
              No client errors reported in the last {days === 1 ? '24 hours' : `${days} days`}. Good sign.
            </p>
          ) : (
            groups.map((g) => (
              <div key={g.fingerprint} className="px-4 py-3">
                <button
                  onClick={() => setOpen(open === g.fingerprint ? null : g.fingerprint)}
                  className="w-full text-left flex flex-wrap items-start gap-3"
                >
                  <span className={`px-1.5 py-0.5 text-xs rounded shrink-0 font-semibold ${
                    g.count >= 10 ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    ×{g.count}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {g.sample?.message ?? g.fingerprint}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      <span className="font-mono">{g.sample?.source}</span>
                      {g.sample?.kind ? <span className="ml-2 font-mono">{g.sample.kind}</span> : null}
                      {g.sample?.url ? <span className="ml-2">{g.sample.url}</span> : null}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                      {/* Blast radius. "Every tenant" and "one customer" are
                          the same message but completely different problems. */}
                      {g.organizationCount > 0 ? (
                        g.organizations.slice(0, 3).map((o: any) => (
                          <span key={o.id} className="rounded bg-indigo-50 px-1.5 py-0.5 font-medium text-indigo-700">
                            {o.name}
                          </span>
                        ))
                      ) : (
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-500">no tenant recorded</span>
                      )}
                      {g.organizationCount > 3 ? (
                        <span className="text-gray-500">+{g.organizationCount - 3} more tenants</span>
                      ) : null}
                      {g.userCount > 0 ? (
                        <span className="text-gray-500">
                          {g.userCount} {g.userCount === 1 ? 'user' : 'users'}
                        </span>
                      ) : null}
                      {g.sample?.userEmail && g.userCount === 1 ? (
                        <span className="text-gray-600">{g.sample.userEmail}</span>
                      ) : null}
                      {g.sample?.impersonating ? (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800">
                          impersonating
                        </span>
                      ) : null}
                      {g.unattributed > 0 && g.organizationCount > 0 ? (
                        <span className="text-gray-400">{g.unattributed} unattributed</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      First {new Date(g.firstSeen).toLocaleString()} · Last {new Date(g.lastSeen).toLocaleString()}
                    </p>
                  </div>
                </button>
                {open === g.fingerprint && (
                  <div className="mt-2">
                    <ErrorGroupDetail fingerprint={g.fingerprint} />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </AuthenticatedLayout>
  );
}

'use client';
export const dynamic = 'force-dynamic';

/**
 * Release status — what is actually live right now. The API pings each
 * service's health endpoint and reports the running commit and latency.
 */
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';

const SERVICE_LABELS: Record<string, { label: string; repo: string }> = {
  web: { label: 'Tenant app (www)', repo: 'insighthire-web' },
  api: { label: 'API', repo: 'insighthire-api' },
  admin: { label: 'Admin app', repo: 'insighthire-admin' },
};

export default function ReleasesPage() {
  useAdminAuth();
  const status = (trpc as any).platformAdmin.getReleaseStatus.useQuery(undefined, {
    refetchOnWindowFocus: false,
    refetchInterval: 60_000,
  });

  const services: any[] = status.data?.services ?? [];

  return (
    <AuthenticatedLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Releases</h1>
            <p className="text-sm text-gray-500">
              Live commit and health per service, checked from the API. Refreshes every minute.
            </p>
          </div>
          <button
            onClick={() => status.refetch()}
            disabled={status.isFetching}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {status.isFetching ? 'Checking…' : 'Check now'}
          </button>
        </div>

        <div className="bg-white rounded-lg shadow divide-y divide-gray-50">
          {status.isLoading ? (
            <p className="px-4 py-6 text-sm text-gray-400">Checking services…</p>
          ) : (
            services.map((s) => {
              const meta = SERVICE_LABELS[s.name] ?? { label: s.name, repo: s.name };
              return (
                <div key={s.name} className="px-4 py-4 flex flex-wrap items-center gap-3">
                  <span
                    className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                      s.ok ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {meta.label}
                      <span className="ml-2 text-xs text-gray-400">{meta.repo}</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {s.ok ? `healthy · ${s.latencyMs}ms` : `DOWN (status ${s.status || 'timeout'})`}
                      {s.detail && s.detail !== 'ok' ? ` · ${s.detail}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {s.commit ? (
                      <a
                        href={`https://github.com/InsightHire/${meta.repo}/commit/${s.commit}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-mono text-purple-700 hover:underline"
                      >
                        {String(s.commit).slice(0, 7)}
                      </a>
                    ) : (
                      <span className="text-xs text-gray-400">commit unknown</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {status.data?.checkedAt && (
          <p className="text-xs text-gray-400">
            Last checked {new Date(status.data.checkedAt).toLocaleString()} ·{' '}
            <a
              href="https://railway.app/project/52bfec78-3459-4916-bfff-2a99e0a09d45"
              target="_blank"
              rel="noreferrer"
              className="text-purple-700 hover:underline"
            >
              Open Railway
            </a>
          </p>
        )}
      </div>
    </AuthenticatedLayout>
  );
}

'use client';
export const dynamic = 'force-dynamic';

/**
 * Release status — what is actually live right now. The API pings each
 * service's health endpoint and reports the running commit and latency.
 */
import Link from 'next/link';
import { ExternalLink, RefreshCw, Rocket, Server } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { AdminPageChrome } from '@/components/admin/page-chrome';
import { SectionCard } from '@/components/admin/section-card';
import { StatusPill } from '@/components/admin/status-pill';
import { buttonClass } from '@/components/admin/controls';

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
      <AdminPageChrome
        width="narrow"
        icon={<Rocket />}
        breadcrumbs={[{ label: 'Operations' }, { label: 'Releases' }]}
        title="Releases"
        description={
          <>
            Live commit and health per service, checked from the API. Refreshes every minute.{' '}
            <Link href="/incidents" className="font-medium text-admin-accent hover:text-admin-accent-ink">View incident history →</Link>
          </>
        }
        actions={
          <button onClick={() => status.refetch()} disabled={status.isFetching} className={buttonClass.secondary}>
            <RefreshCw className="h-4 w-4" />
            {status.isFetching ? 'Checking…' : 'Check now'}
          </button>
        }
      >
        <SectionCard
          icon={<Server />}
          title="Services"
          description="Health endpoint status and running commit"
          padded={false}
          footer={
            status.data?.checkedAt ? (
              <span className="flex flex-wrap items-center gap-1">
                Last checked {new Date(status.data.checkedAt).toLocaleString()} ·
                <a
                  href="https://railway.app/project/52bfec78-3459-4916-bfff-2a99e0a09d45"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 font-medium text-admin-accent hover:text-admin-accent-ink"
                >
                  Open Railway <ExternalLink className="h-3 w-3" />
                </a>
              </span>
            ) : undefined
          }
        >
          <div className="divide-y divide-admin-border">
            {status.isLoading ? (
              <p className="px-5 py-6 text-sm text-admin-muted">Checking services…</p>
            ) : (
              services.map((s) => {
                const meta = SERVICE_LABELS[s.name] ?? { label: s.name, repo: s.name };
                return (
                  <div key={s.name} className="flex flex-wrap items-center gap-3 px-5 py-4">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${s.ok ? 'bg-admin-ok' : 'bg-admin-danger'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-admin-ink">
                        {meta.label}
                        <span className="ml-2 admin-mono text-xs font-normal text-admin-muted">{meta.repo}</span>
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-admin-muted">
                        <StatusPill tone={s.ok ? 'success' : 'danger'}>
                          {s.ok ? `healthy · ${s.latencyMs}ms` : `DOWN (status ${s.status || 'timeout'})`}
                        </StatusPill>
                        {s.detail && s.detail !== 'ok' ? <span>{s.detail}</span> : null}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {s.commit ? (
                        <a
                          href={`https://github.com/InsightHire/${meta.repo}/commit/${s.commit}`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-admin-sm border border-admin-border bg-admin-bg px-2 py-1 font-mono text-xs text-admin-accent-ink hover:border-admin-accent-border hover:bg-admin-accent-soft"
                        >
                          {String(s.commit).slice(0, 7)}
                        </a>
                      ) : (
                        <span className="text-xs text-admin-muted">commit unknown</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </SectionCard>
      </AdminPageChrome>
    </AuthenticatedLayout>
  );
}

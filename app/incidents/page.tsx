'use client';
export const dynamic = 'force-dynamic';

/**
 * "What happened while I was asleep" — production smoke-test failures and
 * the rollbacks they triggered, read from GitHub issues opened by the smoke
 * workflow (5 min cache on the API side).
 */
import { AlertTriangle, CheckCircle2, ExternalLink, History } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { AdminPageChrome } from '@/components/admin/page-chrome';
import { SectionCard } from '@/components/admin/section-card';
import { StatusPill } from '@/components/admin/status-pill';
import { EmptyState } from '@/components/admin/empty-state';

export default function IncidentsPage() {
  useAdminAuth();
  const incidents = (trpc as any).platformAdmin.listIncidents.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const rows: any[] = incidents.data ?? [];

  return (
    <AuthenticatedLayout>
      <AdminPageChrome
        width="narrow"
        icon={<AlertTriangle />}
        breadcrumbs={[{ label: 'Operations' }, { label: 'Incidents' }]}
        title="Incident history"
        description="Production smoke failures and rollbacks, from GitHub issues in insighthire-web."
      >
        <SectionCard icon={<History />} title="Incidents" description="Newest first, linked to the GitHub issue" padded={false}>
          {incidents.isLoading ? (
            <p className="px-5 py-6 text-sm text-admin-muted">Loading…</p>
          ) : incidents.isError ? (
            <p className="px-5 py-6 text-sm text-admin-danger">
              Couldn't load incidents — check GITHUB_TOKEN is set on the API.
            </p>
          ) : rows.length === 0 ? (
            <EmptyState compact className="border-0 shadow-none" icon={<CheckCircle2 />} title="No incidents recorded." />
          ) : (
            <div className="divide-y divide-admin-border">
              {rows.map((incident) => (
                <a
                  key={incident.url}
                  href={incident.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-admin-bg/70"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill tone={incident.state === 'open' ? 'danger' : 'neutral'}>
                        {incident.state === 'open' ? 'Open' : 'Closed'}
                      </StatusPill>
                      <p className="text-sm font-medium text-admin-ink">{incident.title}</p>
                    </div>
                    <p className="mt-1 text-xs text-admin-muted">
                      Opened {new Date(incident.openedAt).toLocaleString()}
                      {incident.closedAt && ` · Closed ${new Date(incident.closedAt).toLocaleString()}`}
                    </p>
                  </div>
                  <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-admin-muted group-hover:text-admin-accent" />
                </a>
              ))}
            </div>
          )}
        </SectionCard>
      </AdminPageChrome>
    </AuthenticatedLayout>
  );
}

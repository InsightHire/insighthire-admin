'use client';
export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { ReliabilitySubnav } from '@/components/admin/reliability-subnav';
import { DevopsIncidentDetailPanel } from '@/components/devops/incident-detail-panel';
import { DevopsMonitoringPanel } from '@/components/devops/monitoring-panel';
import { AdminPage, AdminPageChrome } from '@/components/admin/page-chrome';
import { SectionCard } from '@/components/admin/section-card';
import { StatGrid, StatTile } from '@/components/admin/stat-tile';
import { StatusPill } from '@/components/admin/status-pill';
import { EmptyState } from '@/components/admin/empty-state';
import { DataTableEl, Th, Td } from '@/components/admin/data-table';
import { buttonClass } from '@/components/admin/controls';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Database,
  ExternalLink,
  RefreshCw,
  Server,
  ShieldAlert,
  Wrench,
} from 'lucide-react';

function SeverityBadge({ severity }: { severity: string }) {
  const tone = severity === 'p0' ? 'danger' : severity === 'p1' ? 'warn' : 'info';
  return (
    <StatusPill tone={tone} dot={false} className="font-semibold uppercase">
      {severity}
    </StatusPill>
  );
}

function StatusBadge({ status }: { status: string }) {
  const closed = status === 'closed' || status === 'false_positive';
  return (
    <StatusPill tone={closed ? 'neutral' : 'brand'} dot={false}>
      {closed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
      {status.replace(/_/g, ' ')}
    </StatusPill>
  );
}

function DevopsPageContent() {
  useAdminAuth();
  const searchParams = useSearchParams();
  const selectedIncidentId = searchParams.get('incident')?.trim() ?? '';

  const configQuery = trpc.platformAdmin.getDevopsConfig.useQuery();
  const healthQuery = trpc.platformAdmin.getDevopsHealth.useQuery(undefined, {
    refetchInterval: 60_000,
  });
  const metricsQuery = trpc.platformAdmin.getDevopsMetrics.useQuery();
  const incidentsQuery = trpc.platformAdmin.listDevopsIncidents.useQuery({ limit: 50 });

  const config = configQuery.data;
  const workerStatus = healthQuery.data?.worker?.status ?? 'unknown';

  if (selectedIncidentId) {
    return (
      <AdminPage width="narrow">
        <a
          href="/devops"
          className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-admin-muted hover:text-admin-accent-ink"
        >
          <ArrowLeft className="h-4 w-4" /> Back to DevOps
        </a>
        <DevopsIncidentDetailPanel incidentId={selectedIncidentId} />
      </AdminPage>
    );
  }

  return (
    <AdminPageChrome
      icon={<Wrench />}
      breadcrumbs={[{ label: 'Operations' }, { label: 'Reliability', href: '/reliability' }, { label: 'AI DevOps' }]}
      title="AI DevOps"
      description="Uptime, Railway health, incidents, and Cursor auto-fix — all in admin. No separate devops URL needed."
      actions={
        <>
          {config?.axiomStreamUrl && (
            <a href={config.axiomStreamUrl} target="_blank" rel="noopener noreferrer" className={buttonClass.secondary}>
              Axiom logs <ExternalLink className="h-4 w-4" />
            </a>
          )}
          <Link href="/devops/skills" className={buttonClass.secondary}>
            <BookOpen className="h-4 w-4" /> Skills
          </Link>
          <button
            type="button"
            onClick={() => {
              void incidentsQuery.refetch();
              void healthQuery.refetch();
              void metricsQuery.refetch();
            }}
            className={buttonClass.primary}
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </>
      }
    >
      <ReliabilitySubnav />

      <StatGrid cols={4} className="mb-6">
        <StatTile
          label="Worker"
          icon={Server}
          tone={config?.enabled ? 'brand' : 'warn'}
          value={<span className="capitalize">{String(workerStatus)}</span>}
          hint={config?.enabled ? 'Configured' : 'Not configured — set DEVOPS_WORKER_URL on API'}
        />
        <StatTile label="Open incidents" icon={Activity} tone="info" value={metricsQuery.data?.open ?? '—'} />
        <StatTile label="P0 open" icon={ShieldAlert} tone="critical" value={metricsQuery.data?.p0Open ?? '—'} />
        <StatTile
          label="Axiom dataset"
          icon={Database}
          value={<span className="admin-mono text-base font-medium">{config?.axiomDataset ?? '—'}</span>}
        />
      </StatGrid>

      {config?.enabled && (
        <DevopsMonitoringPanel
          worker={healthQuery.data?.worker}
          workerInfo={healthQuery.data?.workerInfo}
        />
      )}

      <SectionCard icon={<Activity />} title="Incidents" description="Latest 50, newest first" padded={false}>
        {incidentsQuery.isLoading ? (
          <div className="p-8 text-center text-sm text-admin-muted">Loading…</div>
        ) : !incidentsQuery.data?.incidents.length ? (
          <EmptyState
            compact
            className="border-0 shadow-none"
            icon={<CheckCircle2 />}
            title="No incidents yet."
            description="Failed E2E runs will open incidents automatically when the devops worker is live."
          />
        ) : (
          <div className="overflow-x-auto">
            <DataTableEl>
              <thead>
                <tr>
                  <Th className="px-6">Status</Th>
                  <Th className="px-6">Severity</Th>
                  <Th className="px-6">Title</Th>
                  <Th className="px-6">Service</Th>
                  <Th className="px-6">Detected</Th>
                  <Th className="px-6" />
                </tr>
              </thead>
              <tbody>
                {incidentsQuery.data.incidents.map((inc) => (
                  <tr key={inc.id}>
                    <Td className="whitespace-nowrap px-6">
                      <StatusBadge status={inc.status} />
                    </Td>
                    <Td className="whitespace-nowrap px-6">
                      <SeverityBadge severity={inc.severity} />
                    </Td>
                    <Td className="max-w-md truncate px-6 text-admin-ink">{inc.title}</Td>
                    <Td className="whitespace-nowrap px-6">
                      {inc.primaryService ?? '—'}
                    </Td>
                    <Td className="whitespace-nowrap px-6">
                      {new Date(inc.createdAt).toLocaleString()}
                    </Td>
                    <Td className="whitespace-nowrap px-6 text-right">
                      <a
                        href={`/devops?incident=${encodeURIComponent(inc.id)}`}
                        className="text-sm font-medium text-admin-accent hover:text-admin-accent-ink"
                      >
                        View
                      </a>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </DataTableEl>
          </div>
        )}
      </SectionCard>
    </AdminPageChrome>
  );
}

export default function DevopsPage() {
  return (
    <AuthenticatedLayout>
      <Suspense
        fallback={
          <AdminPage className="text-sm text-admin-muted">Loading DevOps…</AdminPage>
        }
      >
        <DevopsPageContent />
      </Suspense>
    </AuthenticatedLayout>
  );
}

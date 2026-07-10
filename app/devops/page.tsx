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
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Wrench,
} from 'lucide-react';

function SeverityBadge({ severity }: { severity: string }) {
  const colors =
    severity === 'p0'
      ? 'bg-red-100 text-red-800'
      : severity === 'p1'
        ? 'bg-amber-100 text-amber-800'
        : 'bg-blue-100 text-blue-800';
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${colors}`}>
      {severity}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const closed = status === 'closed' || status === 'false_positive';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        closed ? 'bg-gray-100 text-gray-700' : 'bg-indigo-100 text-indigo-800'
      }`}
    >
      {closed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
      {status.replace(/_/g, ' ')}
    </span>
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <a
          href="/devops"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> Back to DevOps
        </a>
        <DevopsIncidentDetailPanel incidentId={selectedIncidentId} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <ReliabilitySubnav />
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Wrench className="h-7 w-7 text-teal-700" />
            AI DevOps
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Uptime, Railway health, incidents, and Cursor auto-fix — all in admin. No separate devops URL needed.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {config?.axiomStreamUrl && (
            <a
              href={config.axiomStreamUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Axiom logs <ExternalLink className="h-4 w-4" />
            </a>
          )}
          <Link
            href="/devops/skills"
            className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <BookOpen className="h-4 w-4" /> Skills
          </Link>
          <button
            type="button"
            onClick={() => {
              void incidentsQuery.refetch();
              void healthQuery.refetch();
              void metricsQuery.refetch();
            }}
            className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase">Worker</p>
          <p className="mt-1 text-lg font-semibold text-gray-900 capitalize">{String(workerStatus)}</p>
          <p className="text-xs text-gray-500 mt-1">
            {config?.enabled ? 'Configured' : 'Not configured — set DEVOPS_WORKER_URL on API'}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase">Open incidents</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">{metricsQuery.data?.open ?? '—'}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase">P0 open</p>
          <p className="mt-1 text-lg font-semibold text-red-700">{metricsQuery.data?.p0Open ?? '—'}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase">Axiom dataset</p>
          <p className="mt-1 text-sm font-mono text-gray-900">{config?.axiomDataset ?? '—'}</p>
        </div>
      </div>

      {config?.enabled && (
        <DevopsMonitoringPanel
          worker={healthQuery.data?.worker}
          workerInfo={healthQuery.data?.workerInfo}
        />
      )}

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
          <Activity className="h-5 w-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900">Incidents</h2>
        </div>

        {incidentsQuery.isLoading ? (
          <div className="p-8 text-center text-sm text-gray-500">Loading…</div>
        ) : !incidentsQuery.data?.incidents.length ? (
          <div className="p-8 text-center text-sm text-gray-500">
            No incidents yet. Failed E2E runs will open incidents automatically when the devops worker is live.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Severity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Detected</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {incidentsQuery.data.incidents.map((inc) => (
                  <tr key={inc.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={inc.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <SeverityBadge severity={inc.severity} />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-md truncate">{inc.title}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {inc.primaryService ?? '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(inc.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <a
                        href={`/devops?incident=${encodeURIComponent(inc.id)}`}
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                      >
                        View
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DevopsPage() {
  return (
    <AuthenticatedLayout>
      <Suspense
        fallback={
          <div className="max-w-7xl mx-auto px-4 py-8 text-sm text-gray-500">Loading DevOps…</div>
        }
      >
        <DevopsPageContent />
      </Suspense>
    </AuthenticatedLayout>
  );
}

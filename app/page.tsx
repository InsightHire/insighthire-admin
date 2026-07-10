'use client';

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { PageHeader } from '@/components/admin/page-header';
import { StatStrip } from '@/components/admin/stat-strip';
import { SeverityBadge } from '@/components/admin/severity-badge';
import { EmptyState } from '@/components/admin/empty-state';
import { cn } from '@/lib/cn';

function attentionReasonLabel(reason: string): { label: string; severity: 'critical' | 'warn' | 'info' | 'muted' } {
  switch (reason) {
    case 'failed_processing':
      return { label: 'Failed step', severity: 'critical' };
    case 'stuck_at_gate':
      return { label: 'Scoring gate', severity: 'warn' };
    case 'pending_too_long':
      return { label: 'Queue delay', severity: 'info' };
    case 'inactive_24h':
      return { label: 'Quiet 24h+', severity: 'muted' };
    default:
      return { label: reason, severity: 'muted' };
  }
}

export default function DashboardPage() {
  const { data: healthData, isLoading } = trpc.platformAdmin.getJourneyHealthSummary.useQuery(undefined, {
    refetchInterval: 30_000,
  });

  const { data: stuckData } = trpc.platformAdmin.getStuckCandidates.useQuery(
    { stuckType: 'all', limit: 5 },
    { refetchInterval: 30_000 },
  );

  const { data: topOrgs } = (trpc.platformAdmin as any).getTopOrgsByAttentionFailures.useQuery(
    { limit: 5 },
    { refetchInterval: 60_000 },
  );

  const { data: e2eData } = (trpc as any).platformAdmin.listE2eRuns.useQuery(
    { limit: 1 },
    { refetchInterval: 120_000, retry: false },
  );

  const alerts = healthData?.alerts || { critical: 0, warning: 0, info: 0, total: 0 };
  const analytics = healthData?.analytics;
  const techBreakdown = healthData?.technicalSessionBreakdown;
  const hasIssues = alerts.total > 0;
  const lastE2e = e2eData?.runs?.[0];

  return (
    <AuthenticatedLayout>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <PageHeader
          eyebrow="Command center"
          title="Platform ops"
          description="Technical failures and pipeline health — not candidates who simply gave up."
        />

        {hasIssues ? (
          <Link
            href="/attention"
            className={cn(
              'mb-6 flex flex-col gap-3 rounded-admin border p-5 transition-transform hover:scale-[1.005] sm:flex-row sm:items-center sm:justify-between',
              alerts.critical > 0
                ? 'border-admin-danger/30 bg-admin-danger-soft'
                : alerts.warning > 0
                  ? 'border-admin-warn/30 bg-admin-warn-soft'
                  : 'border-admin-info/30 bg-admin-info-soft',
            )}
          >
            <div>
              <p className="text-sm font-semibold text-admin-ink">
                {alerts.critical > 0 &&
                  `${alerts.critical} session${alerts.critical !== 1 ? 's' : ''} with failed or stuck processing`}
                {alerts.critical === 0 &&
                  alerts.warning > 0 &&
                  `${alerts.warning} location anomaly record${alerts.warning !== 1 ? 's' : ''} (7 days)`}
                {alerts.critical === 0 &&
                  alerts.warning === 0 &&
                  alerts.info > 0 &&
                  `${alerts.info} session${alerts.info !== 1 ? 's' : ''} in the processing queue over 1 hour`}
              </p>
              <p className="mt-1 text-xs text-admin-secondary">
                Quiet 24h+ abandoners are excluded from these alerts — see Attention → Engagement.
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-admin-ink">
              Open attention <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        ) : (
          <div className="mb-6 flex items-center gap-2 rounded-admin border border-admin-ok/20 bg-admin-ok-soft px-4 py-3 text-sm text-admin-ok">
            <CheckCircle2 className="h-4 w-4" />
            No technical attention items right now.
          </div>
        )}

        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-admin-muted">Severity</p>
        <StatStrip
          className="mb-8"
          items={[
            {
              label: 'Critical sessions',
              value: isLoading ? '…' : techBreakdown?.combinedUniqueSessions ?? alerts.critical,
              severity: alerts.critical > 0 ? 'critical' : 'ok',
              hint: `Failed ${techBreakdown?.failedResponses ?? '—'} · stuck ${techBreakdown?.stuckProcessing ?? '—'}`,
              href: '/attention',
            },
            {
              label: 'Queue delays',
              value: isLoading ? '…' : healthData?.metrics?.pendingTooLong ?? 0,
              severity: alerts.info > 0 ? 'info' : 'muted',
              hint: 'Video PENDING >1h',
              href: '/attention?tab=needs_action',
            },
            {
              label: 'Geo anomalies (7d)',
              value: isLoading ? '…' : healthData?.metrics?.locationAnomalies ?? 0,
              severity: alerts.warning > 0 ? 'warn' : 'muted',
              href: '/anomalies',
            },
            {
              label: 'Quiet 24h+ (engagement)',
              value: isLoading
                ? '…'
                : analytics?.lowEngagementSessions24h ?? healthData?.metrics?.inactiveCandidates ?? 0,
              severity: 'muted',
              hint: 'Not an alert',
              href: '/attention?tab=engagement',
            },
          ]}
        />

        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-admin-muted">Funnel</p>
        <StatStrip
          className="mb-8"
          items={[
            {
              label: 'In progress',
              value: isLoading ? '…' : healthData?.activeSessions ?? 0,
              severity: 'ok',
            },
            {
              label: 'Started (24h)',
              value: isLoading ? '…' : analytics?.sessionsStartedLast24h ?? '—',
              severity: 'info',
            },
            {
              label: 'Completed (24h)',
              value: isLoading ? '…' : healthData?.completedLast24h ?? 0,
              severity: 'ok',
            },
            {
              label: 'Awaiting review',
              value: isLoading ? '…' : analytics?.sessionsAwaitingReview ?? '—',
              severity: 'muted',
            },
          ]}
        />

        <div className="mb-8 grid gap-4 lg:grid-cols-2">
          <section className="admin-panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-admin-border px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-admin-ink">Attention queue</h2>
                <p className="text-xs text-admin-muted">Technical only — failed, gate, queue</p>
              </div>
              <Link href="/attention" className="text-xs font-semibold text-admin-accent-ink hover:underline">
                View all
              </Link>
            </div>
            {(stuckData?.candidates?.length ?? 0) === 0 ? (
              <EmptyState
                className="border-0 shadow-none"
                icon={<CheckCircle2 className="h-6 w-6 text-admin-ok" />}
                title="Queue clear"
                description="No technical sessions need action."
              />
            ) : (
              <ul className="divide-y divide-admin-border">
                {stuckData!.candidates.map((c: any) => {
                  const meta = attentionReasonLabel(c.stuckReason);
                  return (
                    <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-admin-ink">{c.candidateName}</p>
                        <p className="truncate text-xs text-admin-muted">
                          {c.organizationName}
                          {c.positionTitle ? ` · ${c.positionTitle}` : ''}
                        </p>
                      </div>
                      <SeverityBadge severity={meta.severity}>{meta.label}</SeverityBadge>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="admin-panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-admin-border px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-admin-ink">Top orgs by failures</h2>
                <p className="text-xs text-admin-muted">Failed response volume (excl. dismissed / e2e)</p>
              </div>
              <Link href="/organizations" className="text-xs font-semibold text-admin-accent-ink hover:underline">
                Orgs
              </Link>
            </div>
            {(topOrgs?.orgs?.length ?? 0) === 0 ? (
              <EmptyState
                className="border-0 shadow-none"
                title="No failure hotspots"
                description="No org is accumulating failed responses right now."
              />
            ) : (
              <ul className="divide-y divide-admin-border">
                {topOrgs.orgs.map((o: any) => (
                  <li key={o.organizationId} className="flex items-center justify-between px-4 py-3">
                    <Link
                      href={`/attention?org=${o.organizationId}`}
                      className="truncate text-sm font-medium text-admin-ink hover:text-admin-accent-ink"
                    >
                      {o.name || o.organizationId}
                    </Link>
                    <span className="admin-mono text-sm font-semibold text-admin-danger">{o.failureCount}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="admin-panel p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-admin-ink">Reliability glance</h2>
              <p className="text-xs text-admin-muted">Latest E2E run · open DevOps from Reliability</p>
            </div>
            <div className="flex gap-2">
              <Link
                href="/reliability"
                className="rounded-admin-sm border border-admin-border px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
              >
                Reliability
              </Link>
              <Link
                href="/pipeline"
                className="rounded-admin-sm border border-admin-border px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
              >
                Pipeline
              </Link>
            </div>
          </div>
          {lastE2e ? (
            <p className="mt-3 text-sm text-admin-secondary">
              Last E2E <span className="font-semibold">{lastE2e.suite || lastE2e.jobName}</span>:{' '}
              <SeverityBadge
                severity={
                  lastE2e.status === 'passed' ? 'ok' : lastE2e.status === 'failed' ? 'critical' : 'muted'
                }
              >
                {lastE2e.status}
              </SeverityBadge>{' '}
              <span className="admin-mono text-xs text-admin-muted">
                {lastE2e.passed ?? 0}p / {lastE2e.failed ?? 0}f
              </span>
            </p>
          ) : (
            <p className="mt-3 text-xs text-admin-muted">No recent E2E run summary available.</p>
          )}
        </section>
      </div>
    </AuthenticatedLayout>
  );
}

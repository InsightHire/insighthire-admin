'use client';

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FlaskConical,
  Gauge,
  History,
  LayoutGrid,
  MapPin,
  Moon,
  PlayCircle,
  ShieldAlert,
  Video,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { AdminPage } from '@/components/admin/page-chrome';
import { PageHeader } from '@/components/admin/page-header';
import { StatGrid, StatTile } from '@/components/admin/stat-tile';
import { SectionCard } from '@/components/admin/section-card';
import { SeverityBadge } from '@/components/admin/severity-badge';
import { StatusPill } from '@/components/admin/status-pill';
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

function relativeTime(value: string | Date): string {
  const date = new Date(value);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function humanizeAction(action: string): string {
  const text = action.replace(/[._]+/g, ' ').trim().toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-admin-muted">{children}</p>
  );
}

const QUICK_LINKS = [
  { href: '/organizations', label: 'Organizations', icon: Building2 },
  { href: '/tenant-features', label: 'Tenant features', icon: LayoutGrid },
  { href: '/pipeline', label: 'Pipeline', icon: Activity },
  { href: '/reliability', label: 'Reliability', icon: FlaskConical },
  { href: '/anomalies', label: 'Anomalies', icon: Gauge },
  { href: '/audit', label: 'Audit log', icon: History },
];

export default function DashboardPage() {
  const { data: healthData, isLoading } = trpc.platformAdmin.getJourneyHealthSummary.useQuery(undefined, {
    refetchInterval: 30_000,
  });

  const { data: stuckData, isLoading: stuckLoading } = trpc.platformAdmin.getStuckCandidates.useQuery(
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

  const { data: videoTrend } = (trpc as any).platformAdmin.getVideoGenerationTrend.useQuery(
    { days: 14 },
    { refetchInterval: 120_000, retry: false },
  );

  const { data: auditData, isLoading: auditLoading, error: auditError } = (trpc as any).platformAdmin.getAuditLogs.useQuery(
    { page: 1, limit: 6 },
    { refetchInterval: 60_000, retry: false },
  );

  const alerts = healthData?.alerts || { critical: 0, warning: 0, info: 0, total: 0 };
  const analytics = healthData?.analytics;
  const techBreakdown = healthData?.technicalSessionBreakdown;
  const hasIssues = alerts.total > 0;
  const lastE2e = e2eData?.runs?.[0];
  const videoDays: Array<{ date: string; created: number; completed: number; failed: number }> = videoTrend?.days ?? [];
  const videoMax = Math.max(1, ...videoDays.map((x) => x.created));
  const recentLogs = auditData?.logs ?? [];

  return (
    <AuthenticatedLayout>
      <AdminPage>
        <PageHeader
          eyebrow="Command center"
          title="Platform ops"
          description="Technical failures and pipeline health — not candidates who simply gave up."
          actions={
            <>
              <Link
                href="/pipeline"
                className="inline-flex items-center gap-1.5 rounded-full border border-admin-border bg-white px-3.5 py-2 text-sm font-medium text-admin-ink shadow-sm hover:border-admin-border-strong"
              >
                <Activity className="h-4 w-4 text-admin-muted" /> Pipeline
              </Link>
              <Link
                href="/attention"
                className="inline-flex items-center gap-1.5 rounded-full bg-admin-accent px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-admin-accent-ink"
              >
                Open attention <ArrowRight className="h-4 w-4" />
              </Link>
            </>
          }
        />

        {hasIssues ? (
          <Link
            href="/attention"
            className={cn(
              'admin-panel-hover mb-8 flex flex-col gap-3 rounded-admin border p-4 sm:flex-row sm:items-center sm:justify-between',
              alerts.critical > 0
                ? 'border-admin-danger/20 bg-admin-danger-soft'
                : alerts.warning > 0
                  ? 'border-admin-warn/25 bg-admin-warn-soft'
                  : 'border-admin-info/20 bg-admin-info-soft',
            )}
          >
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-sm',
                  alerts.critical > 0 ? 'text-admin-danger' : alerts.warning > 0 ? 'text-admin-warn' : 'text-admin-info',
                )}
              >
                <AlertCircle className="h-5 w-5" />
              </span>
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
                <p className="mt-0.5 text-xs text-admin-secondary">
                  Quiet 24h+ abandoners are excluded from these alerts — see Attention → Engagement.
                </p>
              </div>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 self-start rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-admin-ink shadow-sm sm:self-auto">
              Open attention <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </Link>
        ) : (
          <div className="mb-8 flex items-center gap-3 rounded-admin border border-admin-accent-border bg-admin-accent-soft px-4 py-3 text-sm font-medium text-admin-accent-ink">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-sm">
              <CheckCircle2 className="h-4 w-4 text-admin-accent" />
            </span>
            No technical attention items right now.
          </div>
        )}

        <SectionLabel>Technical health</SectionLabel>
        <StatGrid className="mb-8">
          <StatTile
            label="Critical sessions"
            icon={ShieldAlert}
            loading={isLoading}
            value={techBreakdown?.combinedUniqueSessions ?? alerts.critical}
            tone={alerts.critical > 0 ? 'critical' : 'ok'}
            hint={`Failed ${techBreakdown?.failedResponses ?? '—'} · stuck ${techBreakdown?.stuckProcessing ?? '—'}`}
            href="/attention"
          />
          <StatTile
            label="Queue delays"
            icon={Clock}
            loading={isLoading}
            value={healthData?.metrics?.pendingTooLong ?? 0}
            tone={alerts.info > 0 ? 'info' : 'muted'}
            hint="Video PENDING >1h"
            href="/attention?tab=needs_action"
          />
          <StatTile
            label="Geo anomalies (7d)"
            icon={MapPin}
            loading={isLoading}
            value={healthData?.metrics?.locationAnomalies ?? 0}
            tone={alerts.warning > 0 ? 'warn' : 'muted'}
            hint="Location mismatches"
            href="/anomalies"
          />
          <StatTile
            label="Quiet 24h+ (engagement)"
            icon={Moon}
            loading={isLoading}
            value={analytics?.lowEngagementSessions24h ?? healthData?.metrics?.inactiveCandidates ?? 0}
            tone="muted"
            hint="Not an alert"
            href="/attention?tab=engagement"
          />
        </StatGrid>

        <SectionLabel>Journey funnel</SectionLabel>
        <StatGrid cols={5} className="mb-8">
          <StatTile
            label="In progress"
            icon={PlayCircle}
            loading={isLoading}
            value={healthData?.activeSessions ?? 0}
            tone="brand"
            hint="Journeys open now"
          />
          <StatTile
            label="Started (24h)"
            icon={Activity}
            loading={isLoading}
            value={analytics?.sessionsStartedLast24h ?? '—'}
            tone="info"
            hint="New sessions"
          />
          <StatTile
            label="Completed (24h)"
            icon={CheckCircle2}
            loading={isLoading}
            value={healthData?.completedLast24h ?? 0}
            tone="ok"
            hint="Finished journeys"
          />
          <StatTile
            label="Awaiting review"
            icon={ClipboardCheck}
            loading={isLoading}
            value={analytics?.sessionsAwaitingReview ?? '—'}
            tone="muted"
            hint="Ready for hiring teams"
          />
          <StatTile
            label="AI videos (14d)"
            icon={Video}
            loading={!videoTrend}
            value={videoTrend?.total ?? '—'}
            tone={(videoTrend?.totalFailed ?? 0) > 0 ? 'warn' : 'brand'}
            hint={`${videoTrend?.totalCompleted ?? '—'} completed · ${videoTrend?.totalFailed ?? '—'} failed`}
            spark={videoDays.map((d) => d.created)}
            href="/background-jobs"
          />
        </StatGrid>

        <div className="mb-6 grid gap-6 lg:grid-cols-3">
          <SectionCard
            className="lg:col-span-2"
            icon={<AlertCircle />}
            title="Attention queue"
            description="Technical only — failed, gate, queue"
            href="/attention"
            padded={false}
          >
            {stuckLoading ? (
              <div className="space-y-3 p-5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-10 animate-pulse rounded-admin-sm bg-slate-100" />
                ))}
              </div>
            ) : (stuckData?.candidates?.length ?? 0) === 0 ? (
              <EmptyState
                compact
                className="border-0 shadow-none"
                icon={<CheckCircle2 className="text-admin-ok" />}
                title="Queue clear"
                description="No technical sessions need action."
              />
            ) : (
              <ul className="divide-y divide-admin-border">
                {stuckData!.candidates.map((c: any) => {
                  const meta = attentionReasonLabel(c.stuckReason);
                  return (
                    <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-admin-bg/60">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-admin-secondary">
                          {(c.candidateName || '?').slice(0, 1).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-admin-ink">{c.candidateName}</p>
                          <p className="truncate text-xs text-admin-muted">
                            {c.organizationName}
                            {c.positionTitle ? ` · ${c.positionTitle}` : ''}
                          </p>
                        </div>
                      </div>
                      <SeverityBadge severity={meta.severity}>{meta.label}</SeverityBadge>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            icon={<Building2 />}
            title="Top orgs by failures"
            description="Failed responses, excluding dismissed and e2e"
            href="/organizations"
            hrefLabel="Orgs"
            padded={false}
          >
            {(topOrgs?.orgs?.length ?? 0) === 0 ? (
              <EmptyState
                compact
                className="border-0 shadow-none"
                icon={<CheckCircle2 className="text-admin-ok" />}
                title="No failure hotspots"
                description="No org is accumulating failed responses right now."
              />
            ) : (
              <ul className="divide-y divide-admin-border">
                {topOrgs.orgs.map((o: any, i: number) => {
                  const max = Math.max(1, ...topOrgs.orgs.map((x: any) => x.failureCount));
                  return (
                    <li key={o.organizationId} className="px-5 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <Link
                          href={`/attention?org=${o.organizationId}`}
                          className="flex min-w-0 items-center gap-2 text-sm font-medium text-admin-ink hover:text-admin-accent-ink"
                        >
                          <span className="w-4 shrink-0 text-xs tabular-nums text-admin-muted">{i + 1}</span>
                          <span className="truncate">{o.name || o.organizationId}</span>
                        </Link>
                        <span className="admin-mono text-sm font-semibold text-admin-danger">{o.failureCount}</span>
                      </div>
                      <div className="ml-6 mt-1.5 h-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-admin-danger/60"
                          style={{ width: `${Math.max(4, Math.round((o.failureCount / max) * 100))}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>
        </div>

        <div className="mb-6 grid gap-6 lg:grid-cols-3">
          <SectionCard
            className="lg:col-span-2"
            icon={<Video />}
            title="AI videos generated"
            description="Question videos rendered per day — last 14 days"
            href="/background-jobs"
            hrefLabel="Queue"
          >
            <div className="mb-4 flex flex-wrap gap-2">
              <StatusPill tone="neutral">
                <span className="admin-mono font-semibold">{videoTrend?.total ?? '—'}</span> created
              </StatusPill>
              <StatusPill tone="success">
                <span className="admin-mono font-semibold">{videoTrend?.totalCompleted ?? '—'}</span> completed
              </StatusPill>
              <StatusPill tone="danger">
                <span className="admin-mono font-semibold">{videoTrend?.totalFailed ?? '—'}</span> failed
              </StatusPill>
            </div>
            {videoDays.length > 0 ? (
              <div className="flex h-36 items-end gap-1.5">
                {videoDays.map((d) => {
                  const pct = Math.round((d.created / videoMax) * 100);
                  return (
                    <div key={d.date} className="group relative flex h-full flex-1 flex-col justify-end">
                      <div
                        className={cn(
                          'w-full rounded-t-md transition-opacity group-hover:opacity-80',
                          d.failed > 0 ? 'bg-admin-danger/70' : d.created > 0 ? 'bg-admin-accent/80' : 'bg-slate-100',
                        )}
                        style={{ height: d.created > 0 ? `${Math.max(pct, 6)}%` : '3px' }}
                      />
                      <p className="mt-1.5 truncate text-center text-[10px] text-admin-muted">{d.date.slice(5)}</p>
                      <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-admin-ink px-2 py-1 text-[10px] text-white shadow-lg group-hover:block">
                        {d.date}: {d.created} created · {d.completed} completed · {d.failed} failed
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                compact
                className="border-dashed shadow-none"
                icon={<Video />}
                title="No video activity"
                description="No video generation activity in the last 14 days."
              />
            )}
          </SectionCard>

          <SectionCard
            icon={<FlaskConical />}
            title="Reliability glance"
            description="Latest end-to-end test run"
            href="/reliability"
            hrefLabel="Reliability"
          >
            {lastE2e ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate text-sm font-semibold text-admin-ink">{lastE2e.suite || lastE2e.jobName}</p>
                  <SeverityBadge
                    severity={lastE2e.status === 'passed' ? 'ok' : lastE2e.status === 'failed' ? 'critical' : 'muted'}
                  >
                    {lastE2e.status}
                  </SeverityBadge>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-admin-sm border border-admin-border bg-admin-bg/60 p-3">
                    <p className="text-[11px] font-medium text-admin-muted">Passed</p>
                    <p className="admin-mono mt-0.5 text-xl font-semibold text-admin-ok">{lastE2e.passed ?? 0}</p>
                  </div>
                  <div className="rounded-admin-sm border border-admin-border bg-admin-bg/60 p-3">
                    <p className="text-[11px] font-medium text-admin-muted">Failed</p>
                    <p
                      className={cn(
                        'admin-mono mt-0.5 text-xl font-semibold',
                        (lastE2e.failed ?? 0) > 0 ? 'text-admin-danger' : 'text-admin-ink',
                      )}
                    >
                      {lastE2e.failed ?? 0}
                    </p>
                  </div>
                </div>
                <Link
                  href="/pipeline"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-admin-accent-ink hover:underline"
                >
                  Open pipeline <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : (
              <EmptyState
                compact
                className="border-dashed shadow-none"
                icon={<FlaskConical />}
                title="No recent run"
                description="No recent E2E run summary available."
              />
            )}
          </SectionCard>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <SectionCard
            className="lg:col-span-2"
            icon={<History />}
            title="Recent staff activity"
            description="Latest actions in the admin audit log"
            href="/audit"
            hrefLabel="Audit log"
            padded={false}
          >
            {auditLoading ? (
              <div className="space-y-3 p-5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-9 animate-pulse rounded-admin-sm bg-slate-100" />
                ))}
              </div>
            ) : auditError ? (
              <p className="px-5 py-6 text-sm text-admin-muted">Activity isn&apos;t available for your role.</p>
            ) : recentLogs.length === 0 ? (
              <EmptyState
                compact
                className="border-0 shadow-none"
                icon={<History />}
                title="No recent activity"
                description="Staff actions will show here as they happen."
              />
            ) : (
              <ul className="divide-y divide-admin-border">
                {recentLogs.map((log: any) => (
                  <li key={log.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-admin-accent-soft text-[11px] font-semibold text-admin-accent-ink">
                      {(log.user?.name || '?').slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-admin-ink">
                        <span className="font-medium">{log.user?.name ?? 'Unknown'}</span>{' '}
                        <span className="text-admin-secondary">{humanizeAction(log.action).toLowerCase()}</span>
                      </p>
                      {log.targetOrgName ? (
                        <p className="truncate text-xs text-admin-muted">{log.targetOrgName}</p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-xs text-admin-muted">{relativeTime(log.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Quick links" description="Jump to the busiest admin screens">
            <div className="grid grid-cols-2 gap-2">
              {QUICK_LINKS.map((l) => {
                const Icon = l.icon;
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="group flex items-center gap-2 rounded-admin-sm border border-admin-border px-3 py-2.5 text-sm font-medium text-admin-ink transition-colors hover:border-admin-accent-border hover:bg-admin-accent-soft"
                  >
                    <Icon className="h-4 w-4 text-admin-muted group-hover:text-admin-accent" />
                    <span className="truncate">{l.label}</span>
                  </Link>
                );
              })}
            </div>
          </SectionCard>
        </div>
      </AdminPage>
    </AuthenticatedLayout>
  );
}

'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  RotateCcw,
  Undo2,
  XCircle,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { PageHeader } from '@/components/admin/page-header';
import { StatStrip } from '@/components/admin/stat-strip';
import { FilterBar, FilterSelect } from '@/components/admin/filter-bar';
import { EmptyState } from '@/components/admin/empty-state';
import { SeverityBadge } from '@/components/admin/severity-badge';
import { cn } from '@/lib/cn';

type AttentionReason = 'failed_processing' | 'inactive_24h' | 'pending_too_long' | 'stuck_at_gate';
type Tab = 'needs_action' | 'dismissed' | 'engagement';
type StuckFilter = 'all' | 'failed_processing' | 'pending_too_long' | 'stuck_at_gate';

function parseTab(raw: string | null): Tab {
  if (raw === 'dismissed' || raw === 'engagement' || raw === 'needs_action') return raw;
  return 'needs_action';
}

function reasonBadge(reason: AttentionReason) {
  switch (reason) {
    case 'failed_processing':
      return <SeverityBadge severity="critical">Failed step</SeverityBadge>;
    case 'stuck_at_gate':
      return <SeverityBadge severity="warn">Scoring gate</SeverityBadge>;
    case 'pending_too_long':
      return <SeverityBadge severity="info">Queue delay</SeverityBadge>;
    case 'inactive_24h':
      return <SeverityBadge severity="muted">Quiet 24h+</SeverityBadge>;
    default:
      return null;
  }
}

function formatTimeAgo(dateString: string | Date | null | undefined) {
  if (!dateString) return '—';
  const date = new Date(dateString);
  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  return 'Just now';
}

function AttentionPageInner() {
  const { isLoading: authLoading } = useAdminAuth();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => parseTab(searchParams.get('tab')));
  const [stuckTypeFilter, setStuckTypeFilter] = useState<StuckFilter>('all');
  const [orgFilter, setOrgFilter] = useState<string>(() => searchParams.get('org') || '');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [confirm, setConfirm] = useState<
    | { kind: 'dismiss'; sessionId: string }
    | { kind: 'bulk' }
    | { kind: 'retry'; candidateId: string }
    | null
  >(null);

  useEffect(() => {
    setOrgFilter(searchParams.get('org') || '');
    setTab(parseTab(searchParams.get('tab')));
    setCursor(undefined);
  }, [searchParams]);

  const { data: healthData, refetch: refetchHealth } = trpc.platformAdmin.getJourneyHealthSummary.useQuery(
    undefined,
    { enabled: !authLoading, refetchInterval: 30_000 },
  );

  const { data: orgsData } = trpc.platformAdmin.listOrganizations.useQuery(
    { page: 1, limit: 100 },
    { enabled: !authLoading, staleTime: 60_000 },
  );

  const attentionQuery = trpc.platformAdmin.getStuckCandidates.useQuery(
    {
      stuckType: stuckTypeFilter,
      limit: 50,
      cursor,
      organizationId: orgFilter || undefined,
    },
    { enabled: !authLoading && tab === 'needs_action', refetchInterval: 30_000 },
  );

  const dismissedQuery = (trpc.platformAdmin as any).listDismissedAttention.useQuery(
    { limit: 50, organizationId: orgFilter || undefined },
    { enabled: !authLoading && tab === 'dismissed', refetchInterval: 30_000 },
  );

  const engagementQuery = (trpc.platformAdmin as any).getEngagementQuietSessions.useQuery(
    { limit: 50, organizationId: orgFilter || undefined },
    { enabled: !authLoading && tab === 'engagement', refetchInterval: 60_000 },
  );

  const { data: pipelineData, isLoading: loadingPipeline } =
    trpc.platformAdmin.getProcessingPipelineStatus.useQuery(
      { candidateId: expanded || '' },
      { enabled: !!expanded },
    );

  const retryMutation = trpc.platformAdmin.retryStuckCandidate.useMutation({
    onSuccess: () => {
      void attentionQuery.refetch();
      void refetchHealth();
    },
  });
  const bulkRetryMutation = trpc.platformAdmin.bulkRetryStuckCandidates.useMutation({
    onSuccess: () => {
      void attentionQuery.refetch();
      void refetchHealth();
    },
  });
  const dismissMutation = trpc.platformAdmin.dismissStuckCandidate.useMutation({
    onSuccess: () => {
      void attentionQuery.refetch();
      void dismissedQuery.refetch?.();
      void refetchHealth();
    },
  });
  const clearDismissalMutation = (trpc.platformAdmin as any).clearStuckDismissal.useMutation({
    onSuccess: () => {
      void dismissedQuery.refetch?.();
      void attentionQuery.refetch();
      void refetchHealth();
    },
  });

  const orgOptions = useMemo(() => {
    const rows = (orgsData as any)?.organizations || [];
    return [
      { value: '', label: 'All orgs' },
      ...rows.map((o: any) => ({ value: o.id, label: o.name || o.domain || o.id })),
    ];
  }, [orgsData]);

  const alerts = healthData?.alerts || { critical: 0, warning: 0, info: 0, total: 0 };
  const summary = attentionQuery.data?.summary;

  if (authLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-admin-accent border-t-transparent" />
      </div>
    );
  }

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'needs_action', label: 'Needs action' },
    { id: 'dismissed', label: 'Dismissed' },
    { id: 'engagement', label: 'Engagement' },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <PageHeader
        eyebrow="Operations"
        title="Attention"
        description="Technical and pipeline sessions InsightHire can act on. Quiet abandoners live under Engagement — they are not stuck."
        actions={
          tab === 'needs_action' ? (
            <button
              type="button"
              onClick={() => setConfirm({ kind: 'bulk' })}
              className="inline-flex items-center gap-1.5 rounded-admin-sm bg-admin-ink px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Bulk retry technical
            </button>
          ) : null
        }
      />

      <StatStrip
        className="mb-6"
        items={[
          {
            label: 'Critical sessions',
            value: alerts.critical,
            severity: alerts.critical > 0 ? 'critical' : 'ok',
            hint: 'Failed or stuck processing',
          },
          {
            label: 'Queue delays',
            value: summary?.pendingTooLong ?? alerts.info,
            severity: 'info',
            hint: 'Video PENDING >1h',
          },
          {
            label: 'Scoring gates',
            value: summary?.stuckAtGate ?? 0,
            severity: 'warn',
          },
          {
            label: 'Quiet 24h+ (not alerts)',
            value: healthData?.metrics?.lowEngagementSessions24h ?? summary?.inactive24h ?? 0,
            severity: 'muted',
            hint: 'Engagement only',
          },
        ]}
      />

      <div className="mb-4 flex gap-1 border-b border-admin-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              setCursor(undefined);
              setExpanded(null);
            }}
            className={cn(
              'relative px-3 py-2 text-sm font-medium transition-colors',
              tab === t.id ? 'text-admin-ink' : 'text-admin-muted hover:text-admin-secondary',
            )}
          >
            {t.label}
            {tab === t.id ? (
              <span className="nav-indicator absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-admin-accent" />
            ) : null}
          </button>
        ))}
      </div>

      <FilterBar>
        <FilterSelect
          label="Organization"
          value={orgFilter}
          onChange={(v) => {
            setOrgFilter(v);
            setCursor(undefined);
          }}
          options={orgOptions}
        />
        {tab === 'needs_action' ? (
          <FilterSelect
            label="Reason"
            value={stuckTypeFilter}
            onChange={(v) => {
              setStuckTypeFilter(v as StuckFilter);
              setCursor(undefined);
            }}
            options={[
              { value: 'all', label: 'All technical' },
              { value: 'failed_processing', label: 'Failed step' },
              { value: 'stuck_at_gate', label: 'Scoring gate' },
              { value: 'pending_too_long', label: 'Queue delay' },
            ]}
          />
        ) : null}
      </FilterBar>

      {tab === 'needs_action' && (
        <>
          {attentionQuery.isLoading ? (
            <div className="admin-panel py-16 text-center text-sm text-admin-muted">Loading…</div>
          ) : (attentionQuery.data?.candidates?.length ?? 0) === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="h-8 w-8 text-admin-ok" />}
              title="Nothing needs action"
              description="No technical or pipeline sessions in this filter. Quiet abandoners are under Engagement."
            />
          ) : (
            <div className="admin-panel divide-y divide-admin-border overflow-hidden">
              {attentionQuery.data!.candidates.map((row: any) => {
                const isOpen = expanded === row.candidateId;
                return (
                  <div key={row.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-admin-ink">{row.candidateName}</p>
                          {reasonBadge(row.stuckReason)}
                        </div>
                        <p className="mt-0.5 text-xs text-admin-muted">
                          {row.organizationName || 'Unknown org'}
                          {row.positionTitle ? ` · ${row.positionTitle}` : ''}
                          {row.journeyName ? ` · ${row.journeyName}` : ''}
                        </p>
                        <p className="admin-mono mt-1 text-[11px] text-admin-muted">
                          session {row.id} · {formatTimeAgo(row.stuckSince)}
                          {row.failedResponseCount > 0 ? ` · ${row.failedResponseCount} failed` : ''}
                          {row.pendingResponseCount > 0 ? ` · ${row.pendingResponseCount} pending` : ''}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/organizations/${row.organizationId}/positions`}
                          className="rounded-admin-sm px-2 py-1 text-xs font-medium text-admin-accent-ink hover:bg-admin-accent-soft"
                        >
                          Org
                        </Link>
                        <Link
                          href={`/candidate/${row.candidateId}`}
                          className="rounded-admin-sm px-2 py-1 text-xs font-medium text-admin-secondary hover:bg-slate-100"
                        >
                          Forensics
                        </Link>
                        <button
                          type="button"
                          onClick={() => setExpanded(isOpen ? null : row.candidateId)}
                          className="inline-flex items-center gap-1 rounded-admin-sm px-2 py-1 text-xs font-medium text-admin-secondary hover:bg-slate-100"
                        >
                          Pipeline
                          {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirm({ kind: 'retry', candidateId: row.candidateId })}
                          className="inline-flex items-center gap-1 rounded-admin-sm bg-admin-ink px-2 py-1 text-xs font-medium text-white hover:bg-slate-800"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Retry
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirm({ kind: 'dismiss', sessionId: row.id })}
                          className="inline-flex items-center gap-1 rounded-admin-sm px-2 py-1 text-xs font-medium text-admin-muted hover:bg-slate-100"
                        >
                          <XCircle className="h-3 w-3" />
                          Dismiss
                        </button>
                      </div>
                    </div>
                    {isOpen ? (
                      <div className="mt-3 rounded-admin-sm border border-admin-border bg-slate-50/80 p-3">
                        {loadingPipeline ? (
                          <p className="text-xs text-admin-muted">Loading pipeline…</p>
                        ) : (
                          <ul className="space-y-2">
                            {(pipelineData as any)?.pipeline?.map((p: any) => (
                              <li key={p.id} className="flex items-start justify-between gap-2 text-xs">
                                <span className="min-w-0 truncate text-admin-secondary">{p.questionText}</span>
                                <SeverityBadge
                                  severity={
                                    p.overallStatus === 'failed'
                                      ? 'critical'
                                      : p.overallStatus === 'completed'
                                        ? 'ok'
                                        : p.overallStatus === 'pending'
                                          ? 'info'
                                          : 'warn'
                                  }
                                >
                                  {p.overallStatus}
                                </SeverityBadge>
                              </li>
                            )) || (
                              <li className="text-xs text-admin-muted">No pipeline rows</li>
                            )}
                          </ul>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
          {attentionQuery.data?.nextCursor ? (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => setCursor(attentionQuery.data!.nextCursor!)}
                className="rounded-admin-sm border border-admin-border bg-white px-4 py-2 text-sm font-medium text-admin-secondary hover:bg-slate-50"
              >
                Load more
              </button>
            </div>
          ) : null}
        </>
      )}

      {tab === 'dismissed' && (
        <>
          {dismissedQuery.isLoading ? (
            <div className="admin-panel py-16 text-center text-sm text-admin-muted">Loading…</div>
          ) : (dismissedQuery.data?.items?.length ?? 0) === 0 ? (
            <EmptyState
              icon={<Clock className="h-8 w-8" />}
              title="No dismissed sessions"
              description="Dismissed attention items appear here so you can undo."
            />
          ) : (
            <div className="admin-panel divide-y divide-admin-border">
              {dismissedQuery.data!.items.map((row: any) => (
                <div key={row.sessionId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="font-medium text-admin-ink">{row.candidateName}</p>
                    <p className="text-xs text-admin-muted">
                      {row.organizationName} · dismissed {formatTimeAgo(row.dismissedAt)}
                      {row.dismissedBy ? ` by ${row.dismissedBy}` : ''}
                    </p>
                    {row.reason ? <p className="mt-1 text-xs text-admin-secondary">{row.reason}</p> : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => clearDismissalMutation.mutate({ sessionId: row.sessionId })}
                    className="inline-flex items-center gap-1 rounded-admin-sm border border-admin-border px-2 py-1 text-xs font-medium hover:bg-slate-50"
                  >
                    <Undo2 className="h-3 w-3" />
                    Undo dismiss
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'engagement' && (
        <>
          <div className="mb-3 rounded-admin border border-admin-border bg-slate-50 px-3 py-2 text-xs text-admin-muted">
            These sessions went quiet for 24h+. That is candidate drop-off, not a platform failure — no red badges.
          </div>
          {engagementQuery.isLoading ? (
            <div className="admin-panel py-16 text-center text-sm text-admin-muted">Loading…</div>
          ) : (engagementQuery.data?.sessions?.length ?? 0) === 0 ? (
            <EmptyState
              icon={<AlertTriangle className="h-8 w-8" />}
              title="No quiet sessions"
              description="No in-progress journeys idle for 24h+ in this filter."
            />
          ) : (
            <div className="admin-panel divide-y divide-admin-border">
              {engagementQuery.data!.sessions.map((row: any) => (
                <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-admin-ink">{row.candidateName}</p>
                      {reasonBadge('inactive_24h')}
                    </div>
                    <p className="text-xs text-admin-muted">
                      {row.organizationName}
                      {row.positionTitle ? ` · ${row.positionTitle}` : ''} · last activity{' '}
                      {formatTimeAgo(row.lastActivityAt)}
                    </p>
                  </div>
                  <Link
                    href={`/candidate/${row.candidateId}`}
                    className="text-xs font-medium text-admin-accent-ink hover:underline"
                  >
                    Forensics
                  </Link>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {confirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Close"
            onClick={() => setConfirm(null)}
          />
          <div className="relative w-full max-w-md rounded-admin border border-admin-border bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-admin-ink">
              {confirm.kind === 'dismiss'
                ? 'Dismiss from attention?'
                : confirm.kind === 'bulk'
                  ? 'Bulk retry technical jobs?'
                  : 'Retry this candidate?'}
            </h2>
            <p className="mt-2 text-sm text-admin-muted">
              {confirm.kind === 'dismiss'
                ? 'The session leaves Needs action. You can undo from the Dismissed tab.'
                : confirm.kind === 'bulk'
                  ? 'Retries failed and stuck processing responses across the technical queue.'
                  : 'Re-queues failed / stuck processing jobs for this candidate.'}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirm(null)}
                className="rounded-admin-sm border border-admin-border px-3 py-1.5 text-sm font-medium text-admin-secondary hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (confirm.kind === 'dismiss') {
                    await dismissMutation.mutateAsync({
                      sessionId: confirm.sessionId,
                      reason: 'Dismissed from attention UI',
                    } as any);
                  } else if (confirm.kind === 'bulk') {
                    await bulkRetryMutation.mutateAsync({ stuckType: 'all' });
                  } else if (confirm.kind === 'retry') {
                    await retryMutation.mutateAsync({
                      candidateId: confirm.candidateId,
                      retryType: 'all',
                    });
                  }
                  setConfirm(null);
                }}
                className="rounded-admin-sm bg-admin-ink px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function AttentionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-admin-accent border-t-transparent" />
        </div>
      }
    >
      <AttentionPageInner />
    </Suspense>
  );
}

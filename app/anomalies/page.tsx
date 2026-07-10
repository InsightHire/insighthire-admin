'use client';

export const dynamic = 'force-dynamic';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, MapPin, X } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { PageHeader } from '@/components/admin/page-header';
import { StatStrip } from '@/components/admin/stat-strip';
import { FilterBar, FilterSelect } from '@/components/admin/filter-bar';
import { EmptyState } from '@/components/admin/empty-state';
import { SeverityBadge, type Severity } from '@/components/admin/severity-badge';
import { cn } from '@/lib/cn';

type StatusFilter = 'all' | 'ok' | 'warn' | 'critical' | 'anomalies';
type TrafficStatus = 'ok' | 'warn' | 'critical' | 'muted';

function statusToSeverity(status: TrafficStatus): Severity {
  switch (status) {
    case 'critical':
      return 'critical';
    case 'warn':
      return 'warn';
    case 'ok':
      return 'ok';
    default:
      return 'muted';
  }
}

function statusLabel(status: TrafficStatus, kind: 'visit' | 'anomaly') {
  if (status === 'critical') return 'Red · anomaly';
  if (status === 'warn' && kind === 'anomaly') return 'Yellow · review';
  if (status === 'warn') return 'Yellow · review';
  if (status === 'muted') return 'Reviewed';
  return 'Green · normal';
}

function locationText(loc: { city?: string; region?: string; country?: string } | null | undefined) {
  if (!loc) return '—';
  return [loc.city, loc.region, loc.country].filter(Boolean).join(', ') || '—';
}

export default function AnomaliesPage() {
  const { isLoading: authLoading } = useAdminAuth();
  const [daysBack, setDaysBack] = useState('7');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const { data, isLoading, refetch } = trpc.platformAdmin.getLocationAnomalies.useQuery(
    {
      daysBack: Number(daysBack),
      limit: 100,
      anomaliesOnly: false,
    },
    { enabled: !authLoading, refetchInterval: 60_000 },
  );

  const dismissMutation = trpc.platformAdmin.dismissAnomaly.useMutation({
    onSuccess: () => {
      void refetch();
    },
  });

  const events = useMemo(() => {
    const rows = (data as any)?.events ?? [];
    if (statusFilter === 'all') return rows;
    if (statusFilter === 'anomalies') return rows.filter((e: any) => e.kind === 'anomaly' && !e.dismissed);
    return rows.filter((e: any) => e.status === statusFilter);
  }, [data, statusFilter]);

  const summary = (data as any)?.summary ?? {
    ok: 0,
    warn: 0,
    critical: 0,
    muted: 0,
    visits: 0,
    anomalies: 0,
    activeAnomalies: 0,
    highSeverity: 0,
    mediumSeverity: 0,
  };

  const handleDismiss = (anomalyId: string) => {
    if (confirm('Dismiss this anomaly? This will mark it as reviewed.')) {
      dismissMutation.mutate({ anomalyId, reason: 'Reviewed by admin' });
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-admin-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <PageHeader
        eyebrow="Operations"
        title="Location activity"
        description="Recent journey page visits that feed location checks, plus flagged impossible-travel anomalies. Green means healthy traffic; yellow needs review; red is a critical jump."
      />

      <StatStrip
        className="mb-6"
        items={[
          {
            label: 'Green · normal',
            value: summary.ok,
            severity: 'ok',
            hint: 'Healthy page visits',
          },
          {
            label: 'Yellow · review',
            value: summary.warn,
            severity: summary.warn > 0 ? 'warn' : 'muted',
            hint: 'Medium anomalies or trust flags',
          },
          {
            label: 'Red · critical',
            value: summary.critical,
            severity: summary.critical > 0 ? 'critical' : 'ok',
            hint: 'High-severity location jumps',
          },
          {
            label: 'Visits in window',
            value: summary.visits,
            severity: summary.visits > 0 ? 'info' : 'muted',
            hint: `${summary.activeAnomalies} active anomalies`,
          },
        ]}
      />

      <FilterBar>
        <FilterSelect
          label="Show last"
          value={daysBack}
          onChange={setDaysBack}
          options={[
            { value: '1', label: '24 hours' },
            { value: '7', label: '7 days' },
            { value: '30', label: '30 days' },
            { value: '90', label: '90 days' },
          ]}
        />
        <FilterSelect
          label="Status"
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as StatusFilter)}
          options={[
            { value: 'all', label: 'Everything' },
            { value: 'ok', label: 'Green only' },
            { value: 'warn', label: 'Yellow only' },
            { value: 'critical', label: 'Red only' },
            { value: 'anomalies', label: 'Anomalies only' },
          ]}
        />
      </FilterBar>

      {isLoading ? (
        <div className="admin-panel py-16 text-center text-sm text-admin-muted">Loading activity…</div>
      ) : events.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="h-8 w-8 text-admin-ok" />}
          title={
            statusFilter === 'all'
              ? 'No journey location activity in this window'
              : 'No matching rows'
          }
          description={
            statusFilter === 'all'
              ? 'When candidates open journey pages, visits appear here in green. Impossible-travel jumps show as yellow or red.'
              : 'Try widening the time window or switching status to Everything.'
          }
        />
      ) : (
        <div className="admin-panel overflow-hidden">
          <table className="min-w-full divide-y divide-admin-border">
            <thead className="bg-slate-50/80">
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-admin-muted">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-admin-muted">
                  Time
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-admin-muted">
                  Candidate
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-admin-muted">
                  Journey
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-admin-muted">
                  Location
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-admin-muted">
                  Detail
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-admin-muted">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-border">
              {events.map((event: any) => (
                <tr
                  key={`${event.kind}-${event.id}`}
                  className={cn(
                    'hover:bg-slate-50/60',
                    event.status === 'critical' && 'bg-admin-danger-soft/40',
                    event.status === 'warn' && event.kind === 'anomaly' && 'bg-admin-warn-soft/30',
                  )}
                >
                  <td className="px-4 py-3">
                    <SeverityBadge
                      severity={statusToSeverity(event.status)}
                      pulse={event.status === 'critical'}
                    >
                      {statusLabel(event.status, event.kind)}
                    </SeverityBadge>
                  </td>
                  <td className="admin-mono px-4 py-3 text-xs text-admin-secondary">
                    {new Date(event.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    {event.candidateId ? (
                      <Link
                        href={`/candidate/${event.candidateId}`}
                        className="text-sm font-medium text-admin-accent hover:underline"
                      >
                        {event.candidateName}
                      </Link>
                    ) : (
                      <span className="text-sm font-medium text-admin-ink">{event.candidateName}</span>
                    )}
                    <div className="text-xs text-admin-muted">{event.candidateEmail}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-admin-secondary">{event.journeyName}</td>
                  <td className="px-4 py-3">
                    {event.kind === 'anomaly' ? (
                      <div className="flex items-center gap-1.5 text-sm text-admin-ink">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-admin-muted" />
                        <span>{locationText(event.previousLocation)}</span>
                        <span className="text-admin-muted">→</span>
                        <span>{locationText(event.currentLocation)}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-sm text-admin-ink">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-admin-muted" />
                        <span>{locationText(event.currentLocation)}</span>
                      </div>
                    )}
                    {event.ipAddress ? (
                      <div className="admin-mono mt-0.5 text-[11px] text-admin-muted">
                        IP {event.ipAddress}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-sm text-admin-secondary">
                    {event.kind === 'anomaly' ? (
                      <>
                        <span className="font-medium text-admin-ink">
                          {event.distanceKm != null
                            ? `${Number(event.distanceKm).toLocaleString()} km`
                            : 'Location jump'}
                        </span>
                        {event.message ? (
                          <div className="mt-0.5 max-w-xs text-xs text-admin-muted line-clamp-2">
                            {event.message}
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <span className="text-admin-ink">
                          {event.page ? `Page · ${event.page}` : 'Page visit'}
                        </span>
                        {event.vpnOrProxy || event.trustFlags?.length ? (
                          <div className="mt-0.5 text-xs text-admin-warn">
                            {event.vpnOrProxy ? 'VPN/proxy signal' : null}
                            {event.vpnOrProxy && event.trustFlags?.length ? ' · ' : null}
                            {event.trustFlags?.length
                              ? event.trustFlags.slice(0, 3).join(', ')
                              : null}
                          </div>
                        ) : (
                          <div className="mt-0.5 text-xs text-admin-muted">Location check OK</div>
                        )}
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {event.candidateId ? (
                        <Link
                          href={`/candidate/${event.candidateId}`}
                          className="text-xs font-medium text-admin-accent hover:underline"
                        >
                          View
                        </Link>
                      ) : null}
                      {event.kind === 'anomaly' && !event.dismissed ? (
                        <button
                          type="button"
                          onClick={() => handleDismiss(event.id)}
                          disabled={dismissMutation.isPending}
                          className="inline-flex items-center gap-0.5 text-xs text-admin-muted hover:text-admin-ink"
                        >
                          <X className="h-3.5 w-3.5" />
                          Dismiss
                        </button>
                      ) : null}
                      {event.kind === 'anomaly' && event.dismissed ? (
                        <span className="text-xs text-admin-muted">Dismissed</span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="admin-panel mt-6 p-4">
        <h3 className="text-sm font-semibold text-admin-ink">How the lights work</h3>
        <ul className="mt-2 space-y-1 text-sm text-admin-secondary">
          <li>
            <span className="font-medium text-admin-ok">Green</span> — normal journey page visit with
            no impossible-travel flag (proves location checks are running).
          </li>
          <li>
            <span className="font-medium text-admin-warn">Yellow</span> — medium anomaly (&gt;500km
            /&lt;2h, &gt;2,000km /&lt;8h) or visit with VPN/proxy / trust flags worth a look.
          </li>
          <li>
            <span className="font-medium text-admin-danger">Red</span> — high anomaly (&gt;5,000km
            in &lt;24h). Dismiss after review.
          </li>
        </ul>
      </div>
    </div>
  );
}

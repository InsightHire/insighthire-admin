'use client';
export const dynamic = 'force-dynamic';

/**
 * Sourcing runs across every tenant.
 *
 * A run fans out to up to six independent sources, each of which can fail or
 * come back empty on its own. This page exists to make that fan-out visible:
 * which sources a run went to, exactly where each one looked (every query,
 * board and filter), and what each place returned. A provider that quietly
 * stops returning anything shows up here as a column of zeroes days before a
 * customer reports "sourcing feels thin".
 */
import { Fragment, useState } from 'react';
import { CheckCircle2, Radar, ShieldCheck } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { AdminPageChrome } from '@/components/admin/page-chrome';
import { SectionCard } from '@/components/admin/section-card';
import { StatGrid } from '@/components/admin/stat-tile';
import { StatusPill, type StatusTone } from '@/components/admin/status-pill';
import { EmptyState } from '@/components/admin/empty-state';
import { Segmented } from '@/components/admin/segmented';
import { DataTableEl, Th, Td } from '@/components/admin/data-table';
import { buttonClass, selectClass } from '@/components/admin/controls';

const DAY_OPTIONS = [1, 7, 30] as const;

/** Order is the order a run actually fans out in. */
const SOURCE_ORDER = ['EXA', 'EXA_WEB', 'APOLLO', 'PDL', 'NPI', 'LICENSE', 'DISCOVERY'] as const;

const SOURCE_LABELS: Record<string, string> = {
  EXA: 'Exa · people',
  EXA_WEB: 'Exa · open web',
  APOLLO: 'Apollo',
  PDL: 'People Data Labs',
  NPI: 'NPI registry',
  LICENSE: 'State license boards',
  DISCOVERY: 'Contact databases',
};

interface SourceStat {
  found: number;
  ok: boolean;
  error?: string;
  /** Set when the source never ran because the role did not call for it. */
  skipped?: string;
  target?: string;
  detail?: Array<{ label: string; count?: number; ok?: boolean; note?: string }>;
  domains?: string[];
  requestIds?: string[];
}

function statusTone(status: string): StatusTone {
  if (status === 'COMPLETED') return 'success';
  if (status === 'FAILED') return 'danger';
  if (status === 'RUNNING') return 'info';
  return 'neutral';
}

function duration(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60_000)}m`;
}

/** The fan-out. One column per source: where it went, and what came back. */
function RunFanout({ runId }: { runId: string }) {
  const detail = (trpc as any).platformAdmin.getSourcingRun.useQuery(
    { runId },
    { refetchOnWindowFocus: false },
  );

  if (detail.isLoading) return <p className="px-5 py-3 text-xs text-admin-muted">Loading run…</p>;
  if (detail.error) return <p className="px-5 py-3 text-xs text-red-600">{String(detail.error.message)}</p>;

  const data = detail.data ?? {};
  const stats: Record<string, SourceStat> = data.providerStats ?? {};
  const returned: Record<string, number> = data.returnedBySource ?? {};
  const plan = data.plan ?? {};
  const profiles: any[] = data.profiles ?? [];
  const keys = SOURCE_ORDER.filter((k) => k in stats);
  const totalReturned = Object.values(returned).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4 bg-admin-bg/70 px-5 py-4">
      {/* The request */}
      <div className="admin-panel p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-admin-muted">The request</p>
        <p className="mt-1 text-sm font-medium text-admin-ink">
          {data.position?.title ?? 'Unknown'}
          {data.position?.location ? <span className="font-normal text-admin-muted"> · {data.position.location}</span> : null}
          {data.position?.isAdHocSourcingPrompt ? (
            <StatusPill tone="brand" dot={false} className="ml-2 text-[11px]">
              {data.topic ? `standing search · ${data.topic.cadence?.toLowerCase?.()}` : 'ad-hoc prompt'}
            </StatusPill>
          ) : null}
        </p>
        {Array.isArray(plan.queries) && plan.queries.length ? (
          <div className="mt-2">
            <p className="text-[11px] uppercase tracking-wide text-admin-muted">Queries the planner wrote</p>
            <ul className="mt-1 space-y-0.5">
              {plan.queries.map((q: string, i: number) => (
                <li key={i} className="admin-mono text-[11px] text-admin-secondary">
                  {q}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {/* Where it went */}
      <div>
        <div className="flex items-baseline justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-admin-muted">
            Where it went ({keys.length} {keys.length === 1 ? 'source' : 'sources'})
          </p>
          <p className="text-xs text-admin-muted">{totalReturned} people stored</p>
        </div>
        <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {keys.map((key) => {
            const stat = stats[key];
            const stored = returned[key] ?? 0;
            const failed = stat.ok === false;
            const skipped = !!stat.skipped;
            // "Never ran" and "ran and found nobody" are different answers.
            const empty = !failed && !skipped && stored === 0;
            return (
              <div
                key={key}
                className={`admin-panel p-3 ${
                  failed ? 'border-red-200' : empty ? 'border-amber-200' : skipped ? 'opacity-70' : ''
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-admin-ink">{SOURCE_LABELS[key] ?? key}</p>
                  <StatusPill dot={false} tone={failed ? 'danger' : skipped ? 'neutral' : empty ? 'warn' : 'success'}>
                    {failed ? 'failed' : skipped ? 'not applicable' : `${stored} stored`}
                  </StatusPill>
                </div>
                {stat.target ? <p className="admin-mono mt-0.5 text-[11px] text-admin-muted">{stat.target}</p> : null}
                {stat.error ? <p className="mt-1 text-[11px] text-red-600">{stat.error}</p> : null}
                {stat.skipped ? <p className="mt-1 text-[11px] text-admin-muted">Skipped — {stat.skipped}</p> : null}

                {stat.detail?.length ? (
                  <ul className="mt-2 space-y-1 border-t border-admin-border pt-2">
                    {stat.detail.map((d, i) => (
                      <li key={i} className="flex items-start justify-between gap-2 text-[11px]">
                        <span className={`min-w-0 flex-1 ${d.ok === false ? 'text-red-600' : 'text-admin-secondary'}`}>
                          {d.label}
                          {d.note ? <span className="block text-red-500">{d.note}</span> : null}
                        </span>
                        {d.count != null ? (
                          <span className="admin-mono shrink-0 text-admin-ink">{d.count}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {stat.domains?.length ? (
                  <details className="mt-2 border-t border-admin-border pt-2">
                    <summary className="cursor-pointer text-[11px] text-admin-muted">
                      {stat.domains.length} domains searched
                    </summary>
                    <p className="admin-mono mt-1 text-[10px] leading-relaxed text-admin-muted">
                      {stat.domains.join(' · ')}
                    </p>
                  </details>
                ) : null}

                {stat.requestIds?.length ? (
                  <p className="admin-mono mt-2 text-[10px] text-slate-300">
                    req {stat.requestIds.slice(0, 2).join(', ')}
                    {stat.requestIds.length > 2 ? ` +${stat.requestIds.length - 2}` : ''}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* What came back */}
      {profiles.length ? (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-admin-muted">
            What came back (top {Math.min(profiles.length, 25)} of {profiles.length})
          </p>
          <div className="admin-panel mt-2 overflow-x-auto">
            <DataTableEl className="text-xs">
              <thead>
                <tr>
                  <Th className="px-3 py-2">Source</Th>
                  <Th className="px-3 py-2">Name</Th>
                  <Th className="px-3 py-2">Title</Th>
                  <Th className="px-3 py-2">Location</Th>
                  <Th className="px-3 py-2 text-right">Score</Th>
                  <Th className="px-3 py-2">Contact</Th>
                  <Th className="px-3 py-2">Status</Th>
                </tr>
              </thead>
              <tbody>
                {profiles.slice(0, 25).map((p) => (
                  <tr key={p.id}>
                    <Td mono className="whitespace-nowrap px-3 py-1.5 text-[10px] text-admin-muted">{p.source}</Td>
                    <Td className="px-3 py-1.5">
                      <a
                        href={p.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-admin-accent hover:text-admin-accent-ink hover:underline"
                      >
                        {p.fullName ?? 'Unnamed'}
                      </a>
                    </Td>
                    <Td className="px-3 py-1.5">
                      {p.currentTitle ?? '—'}
                      {p.currentCompany ? <span className="text-admin-muted"> · {p.currentCompany}</span> : null}
                    </Td>
                    <Td className="px-3 py-1.5 text-admin-muted">{p.location ?? '—'}</Td>
                    <Td mono className="px-3 py-1.5 text-right text-admin-ink">
                      {p.coachScore != null
                        ? `${Math.round(p.coachScore * 100)}%`
                        : p.score != null
                          ? `${Math.round(p.score * 100)}%`
                          : '—'}
                    </Td>
                    <Td className="px-3 py-1.5 text-admin-muted">{p.hasContact ? 'yes' : '—'}</Td>
                    <Td className="px-3 py-1.5 text-admin-muted">{p.status}</Td>
                  </tr>
                ))}
              </tbody>
            </DataTableEl>
          </div>
          <p className="mt-1 text-[11px] text-admin-muted">
            Candidate contact details are not shown here — only whether a reachable address or number exists.
          </p>
        </div>
      ) : (
        <p className="text-xs text-admin-muted">This run stored no people.</p>
      )}
    </div>
  );
}

/**
 * Registry health from the weekly canary.
 *
 * These adapters fail to zero rather than erroring — a state renames a column
 * and the source goes quiet — so "returned no records" is the alarm, not an
 * absence of one.
 */
function RegistryHealth() {
  const health = (trpc as any).platformAdmin.getSourceHealth.useQuery(undefined, { refetchOnWindowFocus: false });
  const run = (trpc as any).platformAdmin.runSourceCanary.useMutation({
    onSuccess: () => setTimeout(() => health.refetch(), 5_000),
  });
  const sources: any[] = health.data?.sources ?? [];
  const summary = health.data?.summary ?? { total: 0, healthy: 0, unhealthy: 0, skipped: 0 };
  const broken = sources.filter((s) => !s.ok && !s.skipped);

  return (
    <SectionCard
      icon={<ShieldCheck />}
      title="Registry health"
      description={
        sources.length === 0
          ? 'The canary has not run yet — it probes every licensing registry weekly.'
          : `${summary.healthy} of ${summary.total} registries answered on the last check.`
      }
      actions={
        <button
          type="button"
          onClick={() => run.mutate()}
          disabled={run.isPending}
          className={buttonClass.small}
        >
          {run.isPending ? 'Checking…' : 'Check now'}
        </button>
      }
      footer={
        summary.skipped > 0 ? `${summary.skipped} skipped (not yet imported — neither healthy nor broken).` : undefined
      }
    >
      {broken.length > 0 ? (
        <ul className="space-y-1.5">
          {broken.map((s) => (
            <li key={s.adapterId} className="rounded-admin-sm border border-admin-danger/20 bg-admin-danger-soft px-3 py-1.5 text-xs text-red-800">
              <span className="font-medium">{s.board}</span> returned nothing for {s.trade}
              {s.consecutiveFailures > 1 ? ` (${s.consecutiveFailures} checks in a row)` : ''}
              {s.error ? <span className="block font-mono text-[11px] opacity-80">{s.error}</span> : null}
            </li>
          ))}
        </ul>
      ) : sources.length > 0 ? (
        <p className="flex items-center gap-1.5 text-sm text-admin-ok">
          <CheckCircle2 className="h-4 w-4" />
          Every registry returned a record.
        </p>
      ) : (
        <p className="text-sm text-admin-muted">No canary results yet.</p>
      )}
    </SectionCard>
  );
}

export default function SourcingRunsPage() {
  useAdminAuth();
  const [days, setDays] = useState<number>(7);
  const [status, setStatus] = useState<string>('');
  const [problemSource, setProblemSource] = useState<string>('');
  const [open, setOpen] = useState<string | null>(null);

  const list = (trpc as any).platformAdmin.listSourcingRuns.useQuery(
    {
      days,
      ...(status ? { status } : {}),
      ...(problemSource ? { problemSource } : {}),
    },
    { refetchOnWindowFocus: false },
  );

  const runs: any[] = list.data?.runs ?? [];
  const health: Record<string, { runs: number; failed: number; empty: number; returned: number }> =
    list.data?.health ?? {};

  return (
    <AuthenticatedLayout>
      <AdminPageChrome
        icon={<Radar />}
        breadcrumbs={[{ label: 'Operations' }, { label: 'Scout runs' }]}
        title="Scout runs"
        description="Every outbound sourcing request across all tenants — where it went looking and what each source returned."
        actions={
          <>
            <Segmented
              size="sm"
              ariaLabel="Time window"
              options={DAY_OPTIONS.map((d) => ({ value: d as number, label: `${d}d` }))}
              value={days}
              onChange={setDays}
            />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={selectClass}
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              {['COMPLETED', 'FAILED', 'RUNNING', 'QUEUED'].map((v) => (
                <option key={v} value={v}>
                  {v.toLowerCase()}
                </option>
              ))}
            </select>
            <select
              value={problemSource}
              onChange={(e) => setProblemSource(e.target.value)}
              className={selectClass}
              aria-label="Filter to runs where a source struggled"
            >
              <option value="">Any source</option>
              {SOURCE_ORDER.map((v) => (
                <option key={v} value={v}>
                  {SOURCE_LABELS[v]} struggled
                </option>
              ))}
            </select>
          </>
        }
      >
      <div className="space-y-6">
        <RegistryHealth />

        {/* Fleet health per source — the reason this page exists. */}
        {Object.keys(health).length ? (
          <StatGrid cols={4}>
            {SOURCE_ORDER.filter((k) => k in health).map((key) => {
              const h = health[key];
              const failRate = h.runs ? Math.round((h.failed / h.runs) * 100) : 0;
              const emptyRate = h.runs ? Math.round((h.empty / h.runs) * 100) : 0;
              return (
                <div
                  key={key}
                  className={`admin-panel p-4 ${
                    failRate > 20 ? 'border-red-200' : emptyRate > 50 ? 'border-amber-200' : ''
                  }`}
                >
                  <p className="flex items-center gap-1.5 text-xs font-medium text-admin-muted">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        failRate > 20 ? 'bg-admin-danger' : emptyRate > 50 ? 'bg-admin-warn' : 'bg-admin-ok'
                      }`}
                    />
                    {SOURCE_LABELS[key] ?? key}
                  </p>
                  <p className="mt-1.5 text-[1.65rem] font-bold leading-tight tracking-tight text-admin-ink tabular-nums">
                    {h.returned.toLocaleString()}
                  </p>
                  <p className="text-[11px] text-admin-muted">people over {h.runs} runs</p>
                  <p className="mt-1 text-[11px]">
                    <span className={failRate > 20 ? 'text-red-600' : 'text-admin-muted'}>{failRate}% failed</span>
                    <span className="text-slate-300"> · </span>
                    <span className={emptyRate > 50 ? 'text-amber-700' : 'text-admin-muted'}>{emptyRate}% empty</span>
                  </p>
                </div>
              );
            })}
          </StatGrid>
        ) : null}

        <SectionCard icon={<Radar />} title="Runs" description="Click a run to see where each source looked and what came back" padded={false}>
        {list.isLoading ? (
          <p className="px-5 py-6 text-sm text-admin-muted">Loading runs…</p>
        ) : runs.length === 0 ? (
          <EmptyState compact className="border-0 shadow-none" icon={<Radar />} title="No sourcing runs in this window." />
        ) : (
          <div className="overflow-x-auto">
            <DataTableEl>
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>Organization</Th>
                  <Th>Status</Th>
                  <Th>Sources</Th>
                  <Th className="text-right">Found</Th>
                  <Th className="text-right">New</Th>
                  <Th className="text-right">Cost</Th>
                  <Th className="text-right">Took</Th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <Fragment key={r.id}>
                    <tr
                      onClick={() => setOpen(open === r.id ? null : r.id)}
                      className="cursor-pointer"
                    >
                      <Td className="whitespace-nowrap">
                        {new Date(r.createdAt).toLocaleString()}
                      </Td>
                      <Td className="text-admin-ink">
                        {r.organizationName ?? r.organizationId}
                        {r.topicName ? (
                          <StatusPill tone="brand" dot={false} className="ml-2 text-[11px]">
                            {r.topicName}
                          </StatusPill>
                        ) : null}
                      </Td>
                      <Td>
                        <StatusPill tone={statusTone(r.status)}>{r.status.toLowerCase()}</StatusPill>
                      </Td>
                      <Td>
                        <div className="flex flex-wrap gap-1">
                          {SOURCE_ORDER.filter((k) => r.sourcesUsed.includes(k)).map((k) => {
                            const failed = r.sourcesFailed.includes(k);
                            const skipped = r.sourcesSkipped?.includes(k);
                            const empty = !skipped && r.sourcesEmpty.includes(k);
                            return (
                              <span
                                key={k}
                                title={`${SOURCE_LABELS[k] ?? k}: ${r.returnedBySource[k] ?? 0} stored`}
                                className={`rounded px-1 py-0.5 font-mono text-[10px] ${
                                  failed
                                    ? 'bg-red-100 text-red-700'
                                    : skipped
                                      ? 'bg-slate-100 text-slate-400'
                                      : empty
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-green-100 text-green-700'
                                }`}
                              >
                                {k}
                              </span>
                            );
                          })}
                        </div>
                      </Td>
                      <Td mono className="text-right text-admin-ink">{r.resultsCount ?? '—'}</Td>
                      <Td mono className="text-right text-admin-ink">{r.newCount ?? '—'}</Td>
                      <Td mono className="text-right text-admin-muted">
                        {r.costUsd != null ? `$${r.costUsd.toFixed(3)}` : '—'}
                      </Td>
                      <Td mono className="text-right text-admin-muted">{duration(r.durationMs)}</Td>
                    </tr>
                    {open === r.id ? (
                      <tr>
                        <td colSpan={8} className="p-0">
                          <RunFanout runId={r.id} />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </DataTableEl>
          </div>
        )}
        </SectionCard>
      </div>
      </AdminPageChrome>
    </AuthenticatedLayout>
  );
}

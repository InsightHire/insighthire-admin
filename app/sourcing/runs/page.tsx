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
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';

const DAY_OPTIONS = [1, 7, 30] as const;

/** Order is the order a run actually fans out in. */
const SOURCE_ORDER = ['EXA', 'EXA_WEB', 'APOLLO', 'PDL', 'NPI', 'LICENSE', 'DISCOVERY'] as const;

const SOURCE_LABELS: Record<string, string> = {
  EXA: 'Exa · people',
  EXA_WEB: 'Exa · open web',
  APOLLO: 'Apollo',
  PDL: 'People Data Labs',
  NPI: 'NPI registry',
  LICENSE: 'State licence boards',
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

function statusTone(status: string): string {
  if (status === 'COMPLETED') return 'bg-green-50 text-green-700 ring-green-200';
  if (status === 'FAILED') return 'bg-red-50 text-red-700 ring-red-200';
  if (status === 'RUNNING') return 'bg-blue-50 text-blue-700 ring-blue-200';
  return 'bg-gray-50 text-gray-600 ring-gray-200';
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

  if (detail.isLoading) return <p className="px-4 py-3 text-xs text-gray-400">Loading run…</p>;
  if (detail.error) return <p className="px-4 py-3 text-xs text-red-600">{String(detail.error.message)}</p>;

  const data = detail.data ?? {};
  const stats: Record<string, SourceStat> = data.providerStats ?? {};
  const returned: Record<string, number> = data.returnedBySource ?? {};
  const plan = data.plan ?? {};
  const profiles: any[] = data.profiles ?? [];
  const keys = SOURCE_ORDER.filter((k) => k in stats);
  const totalReturned = Object.values(returned).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4 bg-gray-50 px-4 py-4">
      {/* The request */}
      <div className="rounded-lg border border-gray-200 bg-white p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">The request</p>
        <p className="mt-1 text-sm font-medium text-gray-900">
          {data.position?.title ?? 'Unknown'}
          {data.position?.location ? <span className="font-normal text-gray-500"> · {data.position.location}</span> : null}
          {data.position?.isAdHocSourcingPrompt ? (
            <span className="ml-2 rounded bg-purple-50 px-1.5 py-0.5 text-[11px] font-medium text-purple-700">
              {data.topic ? `standing search · ${data.topic.cadence?.toLowerCase?.()}` : 'ad-hoc prompt'}
            </span>
          ) : null}
        </p>
        {Array.isArray(plan.queries) && plan.queries.length ? (
          <div className="mt-2">
            <p className="text-[11px] uppercase tracking-wide text-gray-400">Queries the planner wrote</p>
            <ul className="mt-1 space-y-0.5">
              {plan.queries.map((q: string, i: number) => (
                <li key={i} className="font-mono text-[11px] text-gray-600">
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
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Where it went ({keys.length} {keys.length === 1 ? 'source' : 'sources'})
          </p>
          <p className="text-xs text-gray-500">{totalReturned} people stored</p>
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
                className={`rounded-lg border bg-white p-3 ${
                  failed ? 'border-red-200' : empty ? 'border-amber-200' : skipped ? 'border-gray-150 opacity-70' : 'border-gray-200'
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900">{SOURCE_LABELS[key] ?? key}</p>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                      failed
                        ? 'bg-red-50 text-red-700'
                        : skipped
                          ? 'bg-gray-100 text-gray-500'
                          : empty
                            ? 'bg-amber-50 text-amber-800'
                            : 'bg-green-50 text-green-700'
                    }`}
                  >
                    {failed ? 'failed' : skipped ? 'not applicable' : `${stored} stored`}
                  </span>
                </div>
                {stat.target ? <p className="mt-0.5 font-mono text-[11px] text-gray-400">{stat.target}</p> : null}
                {stat.error ? <p className="mt-1 text-[11px] text-red-600">{stat.error}</p> : null}
                {stat.skipped ? <p className="mt-1 text-[11px] text-gray-500">Skipped — {stat.skipped}</p> : null}

                {stat.detail?.length ? (
                  <ul className="mt-2 space-y-1 border-t border-gray-100 pt-2">
                    {stat.detail.map((d, i) => (
                      <li key={i} className="flex items-start justify-between gap-2 text-[11px]">
                        <span className={`min-w-0 flex-1 ${d.ok === false ? 'text-red-600' : 'text-gray-600'}`}>
                          {d.label}
                          {d.note ? <span className="block text-red-500">{d.note}</span> : null}
                        </span>
                        {d.count != null ? (
                          <span className="shrink-0 font-mono text-gray-900">{d.count}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {stat.domains?.length ? (
                  <details className="mt-2 border-t border-gray-100 pt-2">
                    <summary className="cursor-pointer text-[11px] text-gray-500">
                      {stat.domains.length} domains searched
                    </summary>
                    <p className="mt-1 font-mono text-[10px] leading-relaxed text-gray-400">
                      {stat.domains.join(' · ')}
                    </p>
                  </details>
                ) : null}

                {stat.requestIds?.length ? (
                  <p className="mt-2 font-mono text-[10px] text-gray-300">
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
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            What came back (top {Math.min(profiles.length, 25)} of {profiles.length})
          </p>
          <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Source</th>
                  <th className="px-3 py-2 text-left font-medium">Name</th>
                  <th className="px-3 py-2 text-left font-medium">Title</th>
                  <th className="px-3 py-2 text-left font-medium">Location</th>
                  <th className="px-3 py-2 text-right font-medium">Score</th>
                  <th className="px-3 py-2 text-left font-medium">Contact</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {profiles.slice(0, 25).map((p) => (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap px-3 py-1.5 font-mono text-[10px] text-gray-500">{p.source}</td>
                    <td className="px-3 py-1.5">
                      <a
                        href={p.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {p.fullName ?? 'Unnamed'}
                      </a>
                    </td>
                    <td className="px-3 py-1.5 text-gray-600">
                      {p.currentTitle ?? '—'}
                      {p.currentCompany ? <span className="text-gray-400"> · {p.currentCompany}</span> : null}
                    </td>
                    <td className="px-3 py-1.5 text-gray-500">{p.location ?? '—'}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-gray-900">
                      {p.coachScore != null
                        ? `${Math.round(p.coachScore * 100)}%`
                        : p.score != null
                          ? `${Math.round(p.score * 100)}%`
                          : '—'}
                    </td>
                    <td className="px-3 py-1.5 text-gray-500">{p.hasContact ? 'yes' : '—'}</td>
                    <td className="px-3 py-1.5 text-gray-500">{p.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1 text-[11px] text-gray-400">
            Candidate contact details are not shown here — only whether a reachable address or number exists.
          </p>
        </div>
      ) : (
        <p className="text-xs text-gray-500">This run stored no people.</p>
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
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Registry health</h2>
          <p className="text-xs text-gray-500">
            {sources.length === 0
              ? 'The canary has not run yet — it probes every licensing registry weekly.'
              : `${summary.healthy} of ${summary.total} registries answered on the last check.`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => run.mutate()}
          disabled={run.isPending}
          className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-50"
        >
          {run.isPending ? 'Checking…' : 'Check now'}
        </button>
      </div>

      {broken.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {broken.map((s) => (
            <li key={s.adapterId} className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-800">
              <span className="font-medium">{s.board}</span> returned nothing for {s.trade}
              {s.consecutiveFailures > 1 ? ` (${s.consecutiveFailures} checks in a row)` : ''}
              {s.error ? <span className="block font-mono text-[11px] opacity-80">{s.error}</span> : null}
            </li>
          ))}
        </ul>
      ) : sources.length > 0 ? (
        <p className="mt-2 text-xs text-green-700">Every registry returned a record.</p>
      ) : null}

      {summary.skipped > 0 ? (
        <p className="mt-2 text-[11px] text-gray-500">
          {summary.skipped} skipped (not yet imported — neither healthy nor broken).
        </p>
      ) : null}
    </div>
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
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sourcing runs</h1>
            <p className="text-sm text-gray-500">
              Every outbound sourcing request across all tenants — where it went looking and what each source returned.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {DAY_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`rounded-md px-2.5 py-1.5 text-sm ${
                  days === d ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 ring-1 ring-gray-200'
                }`}
              >
                {d}d
              </button>
            ))}
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-700"
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
              className="rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-700"
              aria-label="Filter to runs where a source struggled"
            >
              <option value="">Any source</option>
              {SOURCE_ORDER.map((v) => (
                <option key={v} value={v}>
                  {SOURCE_LABELS[v]} struggled
                </option>
              ))}
            </select>
          </div>
        </div>

        <RegistryHealth />

        {/* Fleet health per source — the reason this page exists. */}
        {Object.keys(health).length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SOURCE_ORDER.filter((k) => k in health).map((key) => {
              const h = health[key];
              const failRate = h.runs ? Math.round((h.failed / h.runs) * 100) : 0;
              const emptyRate = h.runs ? Math.round((h.empty / h.runs) * 100) : 0;
              return (
                <div
                  key={key}
                  className={`rounded-lg border bg-white p-3 ${
                    failRate > 20 ? 'border-red-200' : emptyRate > 50 ? 'border-amber-200' : 'border-gray-200'
                  }`}
                >
                  <p className="text-sm font-semibold text-gray-900">{SOURCE_LABELS[key] ?? key}</p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">{h.returned.toLocaleString()}</p>
                  <p className="text-[11px] text-gray-500">people over {h.runs} runs</p>
                  <p className="mt-1 text-[11px]">
                    <span className={failRate > 20 ? 'text-red-600' : 'text-gray-500'}>{failRate}% failed</span>
                    <span className="text-gray-300"> · </span>
                    <span className={emptyRate > 50 ? 'text-amber-700' : 'text-gray-500'}>{emptyRate}% empty</span>
                  </p>
                </div>
              );
            })}
          </div>
        ) : null}

        {list.isLoading ? (
          <p className="text-sm text-gray-500">Loading runs…</p>
        ) : runs.length === 0 ? (
          <p className="text-sm text-gray-500">No sourcing runs in this window.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">When</th>
                  <th className="px-4 py-2 text-left font-medium">Organization</th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                  <th className="px-4 py-2 text-left font-medium">Sources</th>
                  <th className="px-4 py-2 text-right font-medium">Found</th>
                  <th className="px-4 py-2 text-right font-medium">New</th>
                  <th className="px-4 py-2 text-right font-medium">Cost</th>
                  <th className="px-4 py-2 text-right font-medium">Took</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {runs.map((r) => (
                  <Fragment key={r.id}>
                    <tr
                      onClick={() => setOpen(open === r.id ? null : r.id)}
                      className="cursor-pointer hover:bg-gray-50"
                    >
                      <td className="whitespace-nowrap px-4 py-2 text-gray-600">
                        {new Date(r.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-gray-900">
                        {r.organizationName ?? r.organizationId}
                        {r.topicName ? (
                          <span className="ml-2 rounded bg-purple-50 px-1.5 py-0.5 text-[11px] text-purple-700">
                            {r.topicName}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`rounded px-1.5 py-0.5 text-xs ring-1 ${statusTone(r.status)}`}>
                          {r.status.toLowerCase()}
                        </span>
                      </td>
                      <td className="px-4 py-2">
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
                                      ? 'bg-gray-100 text-gray-400'
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
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-gray-900">{r.resultsCount ?? '—'}</td>
                      <td className="px-4 py-2 text-right font-mono text-gray-900">{r.newCount ?? '—'}</td>
                      <td className="px-4 py-2 text-right font-mono text-gray-500">
                        {r.costUsd != null ? `$${r.costUsd.toFixed(3)}` : '—'}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-gray-500">{duration(r.durationMs)}</td>
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
            </table>
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
}

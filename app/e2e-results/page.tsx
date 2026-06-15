'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import {
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  FlaskConical,
  RefreshCw,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';

function StatusBadge({ status }: { status: string }) {
  if (status === 'passed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
        <CheckCircle2 className="h-3.5 w-3.5" /> Passed
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
        <XCircle className="h-3.5 w-3.5" /> Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
      <Clock className="h-3.5 w-3.5" /> {status}
    </span>
  );
}

function formatDuration(ms: number | null | undefined) {
  if (!ms) return '—';
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function E2eResultsPage() {
  useAdminAuth();
  const [suiteFilter, setSuiteFilter] = useState<'all' | 'smoke' | 'functional'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const {
    data: summary,
    refetch: refetchSummary,
    isFetching: summaryLoading,
  } = trpc.platformAdmin.getE2eSummary.useQuery(undefined, { refetchInterval: 60_000 });

  const {
    data: runsData,
    refetch: refetchRuns,
    isFetching: runsLoading,
  } = trpc.platformAdmin.listE2eRuns.useQuery(
    { suite: suiteFilter === 'all' ? undefined : suiteFilter, limit: 40 },
    { refetchInterval: 60_000 },
  );

  const { data: detail } = trpc.platformAdmin.getE2eRun.useQuery(
    { id: selectedId! },
    { enabled: !!selectedId },
  );

  const loading = summaryLoading || runsLoading;

  return (
    <AuthenticatedLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FlaskConical className="h-7 w-7 text-indigo-600" />
              E2E Test Results
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Production Playwright suite from{' '}
              <a
                href="https://github.com/tcast/insighthire-e2e/actions"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:underline inline-flex items-center gap-0.5"
              >
                insighthire-e2e
                <ExternalLink className="h-3 w-3" />
              </a>
              {' '}— runs every 6h and after deploys
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              refetchSummary();
              refetchRuns();
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Latest smoke</p>
            {summary?.latestSmoke ? (
              <div className="mt-2 space-y-2">
                <StatusBadge status={summary.latestSmoke.status} />
                <p className="text-sm text-gray-700">
                  {summary.latestSmoke.passed} passed · {summary.latestSmoke.failed} failed ·{' '}
                  {summary.latestSmoke.skipped} skipped
                </p>
                <p className="text-xs text-gray-400">{formatWhen(summary.latestSmoke.finishedAt)}</p>
                {summary.latestSmoke.githubRunUrl && (
                  <a
                    href={summary.latestSmoke.githubRunUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-indigo-600 hover:underline inline-flex items-center gap-1"
                  >
                    GitHub run <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            ) : (
              <p className="mt-2 text-sm text-gray-400">No runs recorded yet</p>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Latest functional
            </p>
            {summary?.latestFunctional ? (
              <div className="mt-2 space-y-2">
                <StatusBadge status={summary.latestFunctional.status} />
                <p className="text-sm text-gray-700">
                  {summary.latestFunctional.passed} passed · {summary.latestFunctional.failed}{' '}
                  failed · {summary.latestFunctional.skipped} skipped
                </p>
                <p className="text-xs text-gray-400">
                  {formatWhen(summary.latestFunctional.finishedAt)}
                </p>
                {summary.latestFunctional.githubRunUrl && (
                  <a
                    href={summary.latestFunctional.githubRunUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-indigo-600 hover:underline inline-flex items-center gap-1"
                  >
                    GitHub run <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            ) : (
              <p className="mt-2 text-sm text-gray-400">No runs recorded yet</p>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Last 7 days</p>
            <p className="mt-2 text-3xl font-semibold text-gray-900">
              {summary?.last7Days.passRate != null ? `${summary.last7Days.passRate}%` : '—'}
            </p>
            <p className="text-sm text-gray-500">
              {summary?.last7Days.passedRuns ?? 0} / {summary?.last7Days.totalRuns ?? 0} job runs
              passed
            </p>
          </div>
        </div>

        {/* Run history */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 className="font-semibold text-gray-900">Run history</h2>
            <select
              value={suiteFilter}
              onChange={(e) => setSuiteFilter(e.target.value as typeof suiteFilter)}
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm bg-white"
            >
              <option value="all">All suites</option>
              <option value="smoke">Smoke</option>
              <option value="functional">Functional</option>
            </select>
          </div>

          {!runsData?.runs.length ? (
            <div className="p-8 text-center text-sm text-gray-500">
              No E2E runs ingested yet. Results appear after the next CI run completes.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {runsData.runs.map((run) => (
                <button
                  key={run.id}
                  type="button"
                  onClick={() => setSelectedId(run.id === selectedId ? null : run.id)}
                  className="w-full flex items-center gap-4 px-5 py-3 text-left hover:bg-gray-50 transition-colors"
                >
                  <StatusBadge status={run.status} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 capitalize">
                      {run.suite}
                      {run.triggerSource ? (
                        <span className="text-gray-400 font-normal"> · after {run.triggerSource}</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {run.passed} passed · {run.failed} failed · {run.skipped} skipped ·{' '}
                      {formatDuration(run.durationMs)}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{formatWhen(run.finishedAt)}</span>
                  {run.githubRunUrl && (
                    <a
                      href={run.githubRunUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-gray-400 hover:text-indigo-600"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                  <ChevronRight
                    className={`h-4 w-4 text-gray-300 transition-transform ${selectedId === run.id ? 'rotate-90' : ''}`}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {detail && selectedId && (
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 capitalize">{detail.suite} run detail</h3>
              <StatusBadge status={detail.status} />
            </div>
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <dt className="text-gray-500">Trigger</dt>
                <dd className="font-medium text-gray-900">{detail.trigger ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Duration</dt>
                <dd className="font-medium text-gray-900">{formatDuration(detail.durationMs)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Finished</dt>
                <dd className="font-medium text-gray-900">{formatWhen(detail.finishedAt)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">GitHub</dt>
                <dd>
                  {detail.githubRunUrl ? (
                    <a
                      href={detail.githubRunUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:underline"
                    >
                      View workflow
                    </a>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
            </dl>

            {Array.isArray(detail.failedTests) && detail.failedTests.length > 0 && (
              <div>
                <h4 className="flex items-center gap-2 text-sm font-semibold text-red-800 mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  Failed tests ({detail.failedTests.length})
                </h4>
                <ul className="space-y-2">
                  {(detail.failedTests as Array<{ title?: string; file?: string; error?: string }>).map(
                    (t, i) => (
                      <li
                        key={i}
                        className="rounded-lg border border-red-100 bg-red-50/50 px-3 py-2 text-sm"
                      >
                        <p className="font-medium text-gray-900">{t.title}</p>
                        {t.file && <p className="text-xs text-gray-500 font-mono mt-0.5">{t.file}</p>}
                        {t.error && (
                          <pre className="mt-1 text-xs text-red-700 whitespace-pre-wrap">{t.error}</pre>
                        )}
                      </li>
                    ),
                  )}
                </ul>
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-gray-400">
          Tip: open a failed GitHub run to download the Playwright HTML report artifact (retained 7 days).
        </p>
      </div>
    </AuthenticatedLayout>
  );
}

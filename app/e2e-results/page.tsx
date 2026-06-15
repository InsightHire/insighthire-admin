'use client';
export const dynamic = 'force-dynamic';

import { Fragment, useMemo, useState } from 'react';
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
  ChevronDown,
  Search,
  MinusCircle,
  Zap,
} from 'lucide-react';

type TestStatus = 'passed' | 'failed' | 'skipped' | 'flaky' | 'timedOut';
type TestResult = {
  title: string;
  file?: string;
  project?: string;
  status: TestStatus;
  durationMs?: number;
  error?: string;
  retries?: number;
};

type E2eRunRow = {
  id: string;
  status: string;
  suite: string;
  triggerSource?: string | null;
  passed: number;
  failed: number;
  skipped: number;
  finishedAt: string;
  githubRunUrl?: string | null;
  durationMs?: number | null;
};

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

function TestStatusIcon({ status }: { status: TestStatus | string }) {
  if (status === 'passed') return <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />;
  if (status === 'skipped') return <MinusCircle className="h-4 w-4 text-gray-400 shrink-0" />;
  if (status === 'flaky') return <Zap className="h-4 w-4 text-amber-600 shrink-0" />;
  return <XCircle className="h-4 w-4 text-red-600 shrink-0" />;
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

function basename(file?: string) {
  if (!file) return '';
  const parts = file.split(/[/\\]/);
  return parts[parts.length - 1] ?? file;
}

function dedupeFailedTests(
  items: Array<{ title?: string; file?: string; project?: string; error?: string; status?: string }>,
): TestResult[] {
  const seen = new Set<string>();
  const out: TestResult[] = [];
  for (const t of items) {
    const key = `${t.title ?? ''}|${t.file ?? ''}|${t.project ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      title: t.title ?? 'Unknown test',
      file: t.file,
      project: t.project,
      status: (t.status as TestStatus) ?? 'failed',
      error: t.error,
    });
  }
  return out;
}

function isCompleteBreakdown(tests: TestResult[], runTotals: { passed: number; failed: number; skipped: number }) {
  const expectedTotal = runTotals.passed + runTotals.failed + runTotals.skipped;
  if (tests.length === 0 || expectedTotal === 0) return false;
  const passedInList = tests.filter((t) => t.status === 'passed').length;
  return passedInList > 0 || tests.length >= expectedTotal - 2;
}

function RunTestList({
  tests,
  legacyFailed,
  runTotals,
}: {
  tests: TestResult[];
  legacyFailed?: Array<{ title?: string; file?: string; error?: string; project?: string }>;
  runTotals: { passed: number; failed: number; skipped: number };
}) {
  const [statusFilter, setStatusFilter] = useState<'all' | TestStatus>('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const complete = isCompleteBreakdown(tests, runTotals);
  const expectedTotal = runTotals.passed + runTotals.failed + runTotals.skipped;

  const sourceTests: TestResult[] = useMemo(() => {
    if (complete) return tests;
    const failures = dedupeFailedTests(
      tests.length > 0
        ? tests.filter((t) => t.status !== 'passed' && t.status !== 'skipped')
        : (legacyFailed ?? []).map((t) => ({ ...t, status: 'failed' })),
    );
    return failures;
  }, [tests, legacyFailed, complete]);

  const counts = useMemo(() => {
    if (complete) {
      const c = { passed: 0, failed: 0, skipped: 0, total: sourceTests.length };
      for (const t of sourceTests) {
        if (t.status === 'passed') c.passed++;
        else if (t.status === 'skipped') c.skipped++;
        else c.failed++;
      }
      return c;
    }
    return {
      passed: runTotals.passed,
      failed: runTotals.failed,
      skipped: runTotals.skipped,
      total: expectedTotal,
    };
  }, [complete, sourceTests, runTotals, expectedTotal]);

  const filtered = useMemo(() => {
    if (!complete && (statusFilter === 'passed' || statusFilter === 'skipped')) {
      return [];
    }
    const q = search.trim().toLowerCase();
    return sourceTests.filter((t) => {
      if (statusFilter !== 'all') {
        const bucket =
          t.status === 'timedOut' || t.status === 'flaky' ? 'failed' : t.status;
        const filterBucket =
          statusFilter === 'timedOut' || statusFilter === 'flaky' ? 'failed' : statusFilter;
        if (bucket !== filterBucket && t.status !== statusFilter) return false;
      }
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        (t.file?.toLowerCase().includes(q) ?? false) ||
        (t.project?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [sourceTests, statusFilter, search, complete]);

  if (!complete && sourceTests.length === 0 && expectedTotal === 0) {
    return (
      <p className="text-sm text-gray-500 py-4">
        No per-test breakdown for this run. Re-run CI to capture test-level detail, or open the
        GitHub workflow for the Playwright HTML report.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {!complete && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Showing <strong>{sourceTests.length} failed</strong> test
          {sourceTests.length === 1 ? '' : 's'} individually ({counts.passed} passed and{' '}
          {counts.skipped} skipped are in the summary only). Re-run CI after the latest deploy for
          the full {expectedTotal}-test list.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {(['all', 'passed', 'failed', 'skipped'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setStatusFilter(key)}
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
              statusFilter === key
                ? 'bg-indigo-100 text-indigo-800'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {key === 'all'
              ? `All (${counts.total})`
              : `${key} (${counts[key as keyof typeof counts]})`}
          </button>
        ))}
        <div className="relative flex-1 min-w-[180px] max-w-xs ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input
            type="search"
            placeholder="Search tests…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-1.5 pl-8 pr-2 text-sm"
          />
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 overflow-hidden max-h-[480px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr className="text-left text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-3 py-2 w-8" />
              <th className="px-3 py-2">Test</th>
              <th className="px-3 py-2 hidden md:table-cell">File</th>
              <th className="px-3 py-2 w-20 text-right">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((test, i) => {
              const rowKey = `${test.title}-${i}`;
              const isOpen = expanded === rowKey;
              const hasError = !!test.error;
              return (
                <Fragment key={rowKey}>
                  <tr
                    className={`${hasError ? 'cursor-pointer hover:bg-gray-50' : ''} ${
                      test.status !== 'passed' && test.status !== 'skipped' ? 'bg-red-50/30' : ''
                    }`}
                    onClick={() => hasError && setExpanded(isOpen ? null : rowKey)}
                  >
                    <td className="px-3 py-2">
                      <TestStatusIcon status={test.status} />
                    </td>
                    <td className="px-3 py-2 min-w-0">
                      <p className="font-medium text-gray-900 break-words">{test.title}</p>
                      <div className="flex flex-wrap gap-2 mt-0.5">
                        {test.project && (
                          <span className="text-xs text-gray-400">{test.project}</span>
                        )}
                        {test.retries != null && test.retries > 0 && (
                          <span className="text-xs text-amber-600">{test.retries} retries</span>
                        )}
                        <span className="text-xs text-gray-400 capitalize md:hidden">
                          {basename(test.file)}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 hidden md:table-cell text-xs text-gray-500 font-mono truncate max-w-[200px]">
                      {basename(test.file) || '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-gray-500 tabular-nums">
                      {formatDuration(test.durationMs)}
                    </td>
                  </tr>
                  {isOpen && test.error && (
                    <tr>
                      <td colSpan={4} className="px-3 py-2 bg-red-50/80">
                        <pre className="text-xs text-red-800 whitespace-pre-wrap font-mono overflow-x-auto">
                          {test.error}
                        </pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-6">
            {!complete && (statusFilter === 'passed' || statusFilter === 'skipped')
              ? `${counts[statusFilter]} ${statusFilter} tests — open a newer CI run for the full list, or use GitHub for the HTML report.`
              : 'No tests match your filter.'}
          </p>
        )}
      </div>
    </div>
  );
}

function RunDetailPanel({ runId }: { runId: string }) {
  const { data: detail, isLoading } = (trpc as any).platformAdmin.getE2eRun.useQuery(
    { id: runId },
    { enabled: !!runId },
  );

  if (isLoading) {
    return (
      <div className="px-5 py-6 bg-slate-50 border-t border-gray-100 text-sm text-gray-500">
        Loading test results…
      </div>
    );
  }
  if (!detail) return null;

  const tests = (detail.testResults ?? []) as TestResult[];

  return (
    <div className="px-5 py-4 bg-slate-50 border-t border-gray-100 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-gray-900 capitalize">{detail.suite} — test breakdown</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {detail.passed} passed · {detail.failed} failed · {detail.skipped} skipped ·{' '}
            {formatDuration(detail.durationMs)} total
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={detail.status} />
          {detail.githubRunUrl && (
            <a
              href={detail.githubRunUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-600 hover:underline inline-flex items-center gap-1"
            >
              GitHub run <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>

      <RunTestList
        tests={tests}
        legacyFailed={detail.failedTests}
        runTotals={{
          passed: detail.passed ?? 0,
          failed: detail.failed ?? 0,
          skipped: detail.skipped ?? 0,
        }}
      />
    </div>
  );
}

export default function E2eResultsPage() {
  useAdminAuth();
  const [suiteFilter, setSuiteFilter] = useState<'all' | 'smoke' | 'functional'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const {
    data: summary,
    refetch: refetchSummary,
    isFetching: summaryLoading,
  } = (trpc as any).platformAdmin.getE2eSummary.useQuery(undefined, { refetchInterval: 60_000 });

  const {
    data: runsData,
    refetch: refetchRuns,
    isFetching: runsLoading,
  } = (trpc as any).platformAdmin.listE2eRuns.useQuery(
    { suite: suiteFilter === 'all' ? undefined : suiteFilter, limit: 40 },
    { refetchInterval: 60_000 },
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
              {' '}— runs every 6h and after deploys. Click a run to drill into individual tests.
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
                <button
                  type="button"
                  onClick={() => setSelectedId(summary.latestSmoke.id)}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  View tests →
                </button>
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
                <button
                  type="button"
                  onClick={() => setSelectedId(summary.latestFunctional.id)}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  View tests →
                </button>
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
              {runsData.runs.map((run: E2eRunRow) => (
                <div key={run.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(run.id === selectedId ? null : run.id)}
                    className={`w-full flex items-center gap-4 px-5 py-3 text-left transition-colors ${
                      selectedId === run.id ? 'bg-indigo-50/60' : 'hover:bg-gray-50'
                    }`}
                  >
                    <StatusBadge status={run.status} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 capitalize">
                        {run.suite}
                        {run.triggerSource ? (
                          <span className="text-gray-400 font-normal">
                            {' '}
                            · after {run.triggerSource}
                          </span>
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
                    {selectedId === run.id ? (
                      <ChevronDown className="h-4 w-4 text-indigo-500" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-300" />
                    )}
                  </button>
                  {selectedId === run.id && <RunDetailPanel runId={run.id} />}
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Older runs may only show failed tests. New runs include full pass/fail/skip breakdown. GitHub
          artifacts retain Playwright HTML reports for 7 days.
        </p>
      </div>
    </AuthenticatedLayout>
  );
}

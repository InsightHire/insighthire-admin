'use client';
export const dynamic = 'force-dynamic';

import { Fragment, useMemo, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { ReliabilitySubnav } from '@/components/admin/reliability-subnav';
import { AdminPageChrome } from '@/components/admin/page-chrome';
import { SectionCard } from '@/components/admin/section-card';
import { StatTile } from '@/components/admin/stat-tile';
import { StatusPill } from '@/components/admin/status-pill';
import { EmptyState } from '@/components/admin/empty-state';
import { Segmented } from '@/components/admin/segmented';
import { DataTableEl, Th, Td } from '@/components/admin/data-table';
import { buttonClass, inputClass, selectClass } from '@/components/admin/controls';
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
  hasFullBreakdown?: boolean;
};

function StatusBadge({ status }: { status: string }) {
  if (status === 'passed') {
    return (
      <StatusPill tone="success" dot={false}>
        <CheckCircle2 className="h-3.5 w-3.5" /> Passed
      </StatusPill>
    );
  }
  if (status === 'failed') {
    return (
      <StatusPill tone="danger" dot={false}>
        <XCircle className="h-3.5 w-3.5" /> Failed
      </StatusPill>
    );
  }
  return (
    <StatusPill tone="neutral" dot={false}>
      <Clock className="h-3.5 w-3.5" /> {status}
    </StatusPill>
  );
}

function TestStatusIcon({ status }: { status: TestStatus | string }) {
  if (status === 'passed') return <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />;
  if (status === 'skipped') return <MinusCircle className="h-4 w-4 text-admin-muted shrink-0" />;
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
      <EmptyState
        compact
        className="border-dashed shadow-none"
        icon={<FlaskConical />}
        title="No per-test breakdown for this run"
        description="Re-run CI to capture test-level detail, or open the GitHub workflow for the Playwright HTML report."
      />
    );
  }

  return (
    <div className="space-y-3">
      {!complete && (
        <div className="rounded-admin-sm border border-admin-warn/25 bg-admin-warn-soft px-3 py-2 text-sm text-amber-900">
          Showing <strong>{sourceTests.length} failed</strong> test
          {sourceTests.length === 1 ? '' : 's'} individually ({counts.passed} passed and{' '}
          {counts.skipped} skipped are in the summary only). Re-run CI after the latest deploy for
          the full {expectedTotal}-test list.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Segmented<'all' | TestStatus>
          size="sm"
          ariaLabel="Filter tests by status"
          options={(['all', 'passed', 'failed', 'skipped'] as const).map((key) => ({
            value: key,
            label: key === 'all' ? 'All' : key.charAt(0).toUpperCase() + key.slice(1),
            count: key === 'all' ? counts.total : counts[key as keyof typeof counts],
          }))}
          value={statusFilter}
          onChange={setStatusFilter}
        />
        <div className="relative flex-1 min-w-[180px] max-w-xs ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-admin-muted" />
          <input
            type="search"
            placeholder="Search tests…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputClass} py-1.5 pl-8`}
          />
        </div>
      </div>

      <div className="max-h-[480px] overflow-hidden overflow-y-auto rounded-admin-sm border border-admin-border bg-white">
        <DataTableEl className="w-full">
          <thead className="sticky top-0 z-10">
            <tr>
              <Th className="w-8 bg-admin-bg px-3" />
              <Th className="bg-admin-bg px-3">Test</Th>
              <Th className="hidden bg-admin-bg px-3 md:table-cell">File</Th>
              <Th className="w-20 bg-admin-bg px-3 text-right">Time</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((test, i) => {
              const rowKey = `${test.title}-${i}`;
              const isOpen = expanded === rowKey;
              const hasError = !!test.error;
              return (
                <Fragment key={rowKey}>
                  <tr
                    className={`${hasError ? 'cursor-pointer' : ''} ${
                      test.status !== 'passed' && test.status !== 'skipped' ? 'bg-red-50/30' : ''
                    }`}
                    onClick={() => hasError && setExpanded(isOpen ? null : rowKey)}
                  >
                    <Td className="px-3 py-2">
                      <TestStatusIcon status={test.status} />
                    </Td>
                    <Td className="min-w-0 px-3 py-2">
                      <p className="font-medium text-admin-ink break-words">{test.title}</p>
                      <div className="flex flex-wrap gap-2 mt-0.5">
                        {test.project && (
                          <span className="text-xs text-admin-muted">{test.project}</span>
                        )}
                        {test.retries != null && test.retries > 0 && (
                          <span className="text-xs text-amber-600">{test.retries} retries</span>
                        )}
                        <span className="text-xs text-admin-muted capitalize md:hidden">
                          {basename(test.file)}
                        </span>
                      </div>
                    </Td>
                    <Td mono className="hidden max-w-[200px] truncate px-3 py-2 text-admin-muted md:table-cell">
                      {basename(test.file) || '—'}
                    </Td>
                    <Td className="px-3 py-2 text-right text-xs text-admin-muted tabular-nums">
                      {formatDuration(test.durationMs)}
                    </Td>
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
        </DataTableEl>
        {filtered.length === 0 && (
          <p className="text-sm text-admin-muted text-center py-6">
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
      <div className="border-t border-admin-border bg-admin-bg/60 px-5 py-6 text-sm text-admin-muted">
        Loading test results…
      </div>
    );
  }
  if (!detail) return null;

  const tests = (detail.testResults ?? []) as TestResult[];

  return (
    <div className="space-y-4 border-t border-admin-border bg-admin-bg/60 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-admin-ink capitalize">{detail.suite} — test breakdown</h3>
          <p className="text-xs text-admin-muted mt-0.5">
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
              className="inline-flex items-center gap-1 text-xs font-medium text-admin-accent hover:text-admin-accent-ink"
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
      <AdminPageChrome
        icon={<FlaskConical />}
        breadcrumbs={[{ label: 'Operations' }, { label: 'Reliability', href: '/reliability' }, { label: 'E2E tests' }]}
        title="E2E Test Results"
        description={
          <>
            Production Playwright suite from{' '}
            <a
              href="https://github.com/InsightHire/insighthire-e2e/actions"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 font-medium text-admin-accent hover:text-admin-accent-ink"
            >
              insighthire-e2e
              <ExternalLink className="h-3 w-3" />
            </a>
            {' '}— runs every 6h and after deploys. Click a run to drill into individual tests.
          </>
        }
        actions={
          <button
            type="button"
            onClick={() => {
              refetchSummary();
              refetchRuns();
            }}
            className={buttonClass.secondary}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      >
        <ReliabilitySubnav />
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <SectionCard title="Latest smoke" icon={<Zap />}>
              {summary?.latestSmoke ? (
                <div className="space-y-2">
                  <StatusBadge status={summary.latestSmoke.status} />
                  <p className="text-sm text-admin-secondary">
                    {summary.latestSmoke.passed} passed · {summary.latestSmoke.failed} failed ·{' '}
                    {summary.latestSmoke.skipped} skipped
                  </p>
                  <p className="text-xs text-admin-muted">{formatWhen(summary.latestSmoke.finishedAt)}</p>
                  <button
                    type="button"
                    onClick={() => setSelectedId(summary.latestSmoke.id)}
                    className="text-xs font-medium text-admin-accent hover:text-admin-accent-ink"
                  >
                    View tests →
                  </button>
                </div>
              ) : (
                <p className="text-sm text-admin-muted">No runs recorded yet</p>
              )}
            </SectionCard>

            <SectionCard title="Latest functional" icon={<FlaskConical />}>
              {summary?.latestFunctional ? (
                <div className="space-y-2">
                  <StatusBadge status={summary.latestFunctional.status} />
                  <p className="text-sm text-admin-secondary">
                    {summary.latestFunctional.passed} passed · {summary.latestFunctional.failed}{' '}
                    failed · {summary.latestFunctional.skipped} skipped
                  </p>
                  <p className="text-xs text-admin-muted">
                    {formatWhen(summary.latestFunctional.finishedAt)}
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelectedId(summary.latestFunctional.id)}
                    className="text-xs font-medium text-admin-accent hover:text-admin-accent-ink"
                  >
                    View tests →
                  </button>
                </div>
              ) : (
                <p className="text-sm text-admin-muted">No runs recorded yet</p>
              )}
            </SectionCard>

            <StatTile
              label="Last 7 days"
              icon={CheckCircle2}
              tone="brand"
              value={summary?.last7Days.passRate != null ? `${summary.last7Days.passRate}%` : '—'}
              hint={`${summary?.last7Days.passedRuns ?? 0} / ${summary?.last7Days.totalRuns ?? 0} job runs passed`}
            />
          </div>

          <SectionCard
            title="Run history"
            description="Latest 40 runs"
            icon={<Clock />}
            padded={false}
            actions={
              <select
                value={suiteFilter}
                onChange={(e) => setSuiteFilter(e.target.value as typeof suiteFilter)}
                className={`${selectClass} py-1.5`}
              >
                <option value="all">All suites</option>
                <option value="smoke">Smoke</option>
                <option value="functional">Functional</option>
              </select>
            }
            footer={
              <span className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Older runs may only show failed tests. New runs include full pass/fail/skip breakdown. GitHub
                artifacts retain Playwright HTML reports for 7 days.
              </span>
            }
          >
            {!runsData?.runs.length ? (
              <EmptyState
                compact
                className="border-0 shadow-none"
                icon={<FlaskConical />}
                title="No E2E runs ingested yet."
                description="Results appear after the next CI run completes."
              />
            ) : (
              <div className="divide-y divide-admin-border">
                {runsData.runs.map((run: E2eRunRow) => (
                  <div key={run.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(run.id === selectedId ? null : run.id)}
                      className={`w-full flex items-center gap-4 px-5 py-3 text-left transition-colors ${
                        selectedId === run.id ? 'bg-admin-accent-soft/60' : 'hover:bg-admin-bg/70'
                      }`}
                    >
                      <StatusBadge status={run.status} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-admin-ink capitalize">
                          {run.suite}
                          {run.hasFullBreakdown ? (
                            <StatusPill tone="success" dot={false} className="ml-2 text-[10px] uppercase tracking-wide">
                              Full list
                            </StatusPill>
                          ) : run.passed + run.failed + run.skipped > 0 ? (
                            <StatusPill tone="warn" dot={false} className="ml-2 text-[10px] uppercase tracking-wide">
                              Failures only
                            </StatusPill>
                          ) : null}
                          {run.triggerSource ? (
                            <span className="text-admin-muted font-normal">
                              {' '}
                              · after {run.triggerSource}
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs text-admin-muted truncate">
                          {run.passed} passed · {run.failed} failed · {run.skipped} skipped ·{' '}
                          {formatDuration(run.durationMs)}
                        </p>
                      </div>
                      <span className="text-xs text-admin-muted shrink-0">{formatWhen(run.finishedAt)}</span>
                      {run.githubRunUrl && (
                        <a
                          href={run.githubRunUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-admin-muted hover:text-admin-accent"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                      {selectedId === run.id ? (
                        <ChevronDown className="h-4 w-4 text-admin-accent" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-admin-border-strong" />
                      )}
                    </button>
                    {selectedId === run.id && <RunDetailPanel runId={run.id} />}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </AdminPageChrome>
    </AuthenticatedLayout>
  );
}

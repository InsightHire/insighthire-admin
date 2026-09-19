'use client';
export const dynamic = 'force-dynamic';

/**
 * Scheduled job health.
 *
 * The reason this page exists: a scheduled job that stops firing raises no
 * error. It goes quiet, and quiet is indistinguishable from healthy. Failures
 * were always visible in logs; *absence* was not, and absence is how a monthly
 * import dies without anyone noticing until the data goes stale.
 *
 * So the primary signal here is OVERDUE — last run compared against the job's
 * expected cadence — not the error count.
 */
import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';

/** Jobs an admin can trigger by hand, matching the API's allowlist. */
const RUNNABLE = new Set(['faa_airmen_import', 'sourcing_topics', 'coach_rerank', 'semantic_index']);

interface JobHealth {
  jobType: string;
  label: string;
  everyMinutes: number | null;
  lastRunAt: string | null;
  lastStatus: 'RUNNING' | 'SUCCEEDED' | 'FAILED' | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  lastDurationMs: number | null;
  consecutiveFailures: number;
  runs24h: number;
  failures24h: number;
  overdue: boolean;
  minutesSinceLastRun: number | null;
}

function cadence(minutes: number | null): string {
  if (minutes == null) return 'event-driven';
  if (minutes >= 60 * 24 * 28) return 'monthly';
  if (minutes >= 60 * 24) return `every ${Math.round(minutes / (60 * 24))}d`;
  if (minutes >= 60) return `every ${Math.round(minutes / 60)}h`;
  return `every ${minutes}m`;
}

function ago(minutes: number | null): string {
  if (minutes == null) return 'never';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}h ago`;
  return `${Math.round(minutes / (60 * 24))}d ago`;
}

function duration(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60_000)}m`;
}

function JobRuns({ jobType }: { jobType: string }) {
  const list = (trpc as any).platformAdmin.listJobRuns.useQuery(
    { jobType, limit: 20 },
    { refetchOnWindowFocus: false },
  );
  const runs: any[] = list.data?.runs ?? [];
  if (list.isLoading) return <p className="px-4 py-3 text-xs text-gray-400">Loading runs…</p>;
  if (!runs.length) return <p className="px-4 py-3 text-xs text-gray-500">This job has never run.</p>;

  return (
    <div className="space-y-1 bg-gray-50 px-4 py-3">
      {runs.map((r) => (
        <div key={r.id} className="flex flex-wrap items-baseline gap-x-3 text-xs">
          <span
            className={`rounded px-1.5 py-0.5 font-medium ${
              r.status === 'SUCCEEDED'
                ? 'bg-green-50 text-green-700'
                : r.status === 'FAILED'
                  ? 'bg-red-50 text-red-700'
                  : 'bg-blue-50 text-blue-700'
            }`}
          >
            {r.status.toLowerCase()}
          </span>
          <span className="text-gray-600">{new Date(r.startedAt).toLocaleString()}</span>
          <span className="font-mono text-gray-400">{duration(r.durationMs)}</span>
          {r.trigger === 'manual' ? <span className="text-purple-600">manual</span> : null}
          {r.error ? <span className="w-full font-mono text-[11px] text-red-600">{r.error}</span> : null}
          {r.result ? (
            <span className="w-full truncate font-mono text-[11px] text-gray-500">{JSON.stringify(r.result)}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export default function ScheduledJobsPage() {
  useAdminAuth();
  const [open, setOpen] = useState<string | null>(null);
  const [started, setStarted] = useState<string | null>(null);

  const health = (trpc as any).platformAdmin.getJobHealth.useQuery(undefined, {
    refetchOnWindowFocus: false,
    refetchInterval: 60_000,
  });
  const runJob = (trpc as any).platformAdmin.runScheduledJob.useMutation({
    onSuccess: (_d: unknown, vars: { jobType: string }) => {
      setStarted(vars.jobType);
      setTimeout(() => health.refetch(), 2_000);
    },
  });

  const jobs: JobHealth[] = health.data?.jobs ?? [];
  const summary = health.data?.summary ?? { total: 0, overdue: 0, failing: 0, healthy: 0 };

  return (
    <AuthenticatedLayout>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Scheduled jobs</h1>
          <p className="text-sm text-gray-500">
            Every recurring job, when it last ran, and whether it is overdue. A job that stops firing raises no error —
            overdue is how you find out.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          {[
            { label: 'Overdue', value: summary.overdue, tone: summary.overdue > 0 ? 'text-red-600' : 'text-gray-900' },
            { label: 'Failing', value: summary.failing, tone: summary.failing > 0 ? 'text-amber-700' : 'text-gray-900' },
            { label: 'Healthy', value: summary.healthy, tone: 'text-green-700' },
            { label: 'Tracked', value: summary.total, tone: 'text-gray-900' },
          ].map((tile) => (
            <div key={tile.label} className="rounded-lg border border-gray-200 bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">{tile.label}</p>
              <p className={`mt-1 text-2xl font-bold ${tile.tone}`}>{tile.value}</p>
            </div>
          ))}
        </div>

        {started ? (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800">
            Started <span className="font-mono">{started}</span>. Long imports keep running after this page reloads —
            open the job to watch its run.
          </div>
        ) : null}

        {health.isLoading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Job</th>
                  <th className="px-4 py-2 text-left font-medium">Cadence</th>
                  <th className="px-4 py-2 text-left font-medium">Last run</th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                  <th className="px-4 py-2 text-right font-medium">24h</th>
                  <th className="px-4 py-2 text-right font-medium">Took</th>
                  <th className="px-4 py-2 text-right font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {jobs.map((job) => (
                  <tr
                    key={job.jobType}
                    className={`cursor-pointer hover:bg-gray-50 ${job.overdue ? 'bg-red-50/40' : ''}`}
                    onClick={() => setOpen(open === job.jobType ? null : job.jobType)}
                  >
                    <td className="px-4 py-2">
                      <span className="font-medium text-gray-900">{job.label}</span>
                      <span className="ml-2 font-mono text-[11px] text-gray-400">{job.jobType}</span>
                      {job.lastError && job.consecutiveFailures > 0 ? (
                        <span className="block max-w-lg truncate font-mono text-[11px] text-red-600">
                          {job.lastError}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2 text-gray-500">{cadence(job.everyMinutes)}</td>
                    <td className="px-4 py-2 text-gray-600">{ago(job.minutesSinceLastRun)}</td>
                    <td className="px-4 py-2">
                      {job.overdue ? (
                        <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
                          {job.lastRunAt ? 'overdue' : 'never run'}
                        </span>
                      ) : job.consecutiveFailures > 0 ? (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">
                          failing ×{job.consecutiveFailures}
                        </span>
                      ) : (
                        <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">ok</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-gray-600">
                      {job.runs24h}
                      {job.failures24h > 0 ? <span className="text-red-600"> / {job.failures24h}✗</span> : null}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-gray-500">{duration(job.lastDurationMs)}</td>
                    <td className="px-4 py-2 text-right">
                      {RUNNABLE.has(job.jobType) ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            runJob.mutate({ jobType: job.jobType });
                          }}
                          disabled={runJob.isPending}
                          className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                        >
                          Run now
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {open ? (
                  <tr>
                    <td colSpan={7} className="p-0">
                      <JobRuns jobType={open} />
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
}

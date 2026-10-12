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
import { AlarmClock, CheckCircle2, Hourglass, Timer, XCircle } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { AdminPageChrome } from '@/components/admin/page-chrome';
import { SectionCard } from '@/components/admin/section-card';
import { StatGrid, StatTile } from '@/components/admin/stat-tile';
import { StatusPill } from '@/components/admin/status-pill';
import { DataTableEl, Th, Td } from '@/components/admin/data-table';
import { buttonClass } from '@/components/admin/controls';

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
  /** Registered but not yet due for its first run — not a fault. */
  awaitingFirstRun: boolean;
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
  if (list.isLoading) return <p className="px-5 py-3 text-xs text-admin-muted">Loading runs…</p>;
  if (!runs.length) return <p className="px-5 py-3 text-xs text-admin-muted">This job has never run.</p>;

  return (
    <div className="space-y-1.5 bg-admin-bg/70 px-5 py-3">
      {runs.map((r) => (
        <div key={r.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs">
          <StatusPill tone={r.status === 'SUCCEEDED' ? 'success' : r.status === 'FAILED' ? 'danger' : 'info'}>
            {r.status.toLowerCase()}
          </StatusPill>
          <span className="text-admin-secondary">{new Date(r.startedAt).toLocaleString()}</span>
          <span className="admin-mono text-admin-muted">{duration(r.durationMs)}</span>
          {r.trigger === 'manual' ? <span className="text-admin-accent-ink">manual</span> : null}
          {r.error ? <span className="admin-mono w-full text-[11px] text-red-600">{r.error}</span> : null}
          {r.result ? (
            <span className="admin-mono w-full truncate text-[11px] text-admin-muted">{JSON.stringify(r.result)}</span>
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
  const summary = health.data?.summary ?? { total: 0, overdue: 0, failing: 0, healthy: 0, awaitingFirstRun: 0 };

  return (
    <AuthenticatedLayout>
      <AdminPageChrome
        icon={<Timer />}
        breadcrumbs={[{ label: 'Operations' }, { label: 'Scheduled jobs' }]}
        title="Scheduled jobs"
        description={
          <>
            Every recurring job, when it last ran, and whether it is overdue. A job that stops firing raises no error —
            overdue is how you find out.
          </>
        }
      >
      <div className="space-y-6">
        <StatGrid cols={4}>
          <StatTile label="Overdue" icon={AlarmClock} tone={summary.overdue > 0 ? 'critical' : 'muted'} value={summary.overdue} loading={health.isLoading} />
          <StatTile label="Failing" icon={XCircle} tone={summary.failing > 0 ? 'warn' : 'muted'} value={summary.failing} loading={health.isLoading} />
          <StatTile label="Healthy" icon={CheckCircle2} tone="ok" value={summary.healthy} loading={health.isLoading} />
          <StatTile label="Awaiting first run" icon={Hourglass} tone="muted" value={summary.awaitingFirstRun ?? 0} loading={health.isLoading} />
        </StatGrid>

        {started ? (
          <div className="rounded-admin border border-admin-info/20 bg-admin-info-soft px-4 py-2.5 text-sm text-sky-800">
            Started <span className="font-mono">{started}</span>. Long imports keep running after this page reloads —
            open the job to watch its run.
          </div>
        ) : null}

        <SectionCard icon={<Timer />} title="Jobs" description="Click a job to see its last 20 runs" padded={false}>
        {health.isLoading ? (
          <p className="px-5 py-6 text-sm text-admin-muted">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <DataTableEl>
              <thead>
                <tr>
                  <Th>Job</Th>
                  <Th>Cadence</Th>
                  <Th>Last run</Th>
                  <Th>Status</Th>
                  <Th className="text-right">24h</Th>
                  <Th className="text-right">Took</Th>
                  <Th className="text-right" />
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr
                    key={job.jobType}
                    className={`cursor-pointer ${job.overdue ? 'bg-admin-danger-soft/40' : ''}`}
                    onClick={() => setOpen(open === job.jobType ? null : job.jobType)}
                  >
                    <Td>
                      <span className="font-medium text-admin-ink">{job.label}</span>
                      <span className="admin-mono ml-2 text-[11px] text-admin-muted">{job.jobType}</span>
                      {job.lastError && job.consecutiveFailures > 0 ? (
                        <span className="admin-mono block max-w-lg truncate text-[11px] text-red-600">
                          {job.lastError}
                        </span>
                      ) : null}
                    </Td>
                    <Td className="text-admin-muted">{cadence(job.everyMinutes)}</Td>
                    <Td>{ago(job.minutesSinceLastRun)}</Td>
                    <Td>
                      {job.overdue ? (
                        <StatusPill tone="danger">{job.lastRunAt ? 'overdue' : 'never run'}</StatusPill>
                      ) : job.awaitingFirstRun ? (
                        <StatusPill tone="neutral" title="Registered, but its first window has not come round yet">
                          awaiting first run
                        </StatusPill>
                      ) : job.consecutiveFailures > 0 ? (
                        <StatusPill tone="warn">failing ×{job.consecutiveFailures}</StatusPill>
                      ) : (
                        <StatusPill tone="success">ok</StatusPill>
                      )}
                    </Td>
                    <Td mono className="text-right">
                      {job.runs24h}
                      {job.failures24h > 0 ? <span className="text-red-600"> / {job.failures24h}✗</span> : null}
                    </Td>
                    <Td mono className="text-right text-admin-muted">{duration(job.lastDurationMs)}</Td>
                    <Td className="text-right">
                      {RUNNABLE.has(job.jobType) ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            runJob.mutate({ jobType: job.jobType });
                          }}
                          disabled={runJob.isPending}
                          className={buttonClass.small}
                        >
                          Run now
                        </button>
                      ) : null}
                    </Td>
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
            </DataTableEl>
          </div>
        )}
        </SectionCard>
      </div>
      </AdminPageChrome>
    </AuthenticatedLayout>
  );
}

'use client';
export const dynamic = 'force-dynamic';

/**
 * Outreach runs across every tenant.
 *
 * A run is one person's pass through one cadence. Every step the engine
 * reached is a row: it went out, it was skipped (and exactly why), or it
 * failed (and how). The health block on top is the point of the page — when
 * "Candidate has not opted in to text messages" is the top skip reason across
 * the fleet, that is a product fact, not forty separate recruiter mysteries.
 * Expanding a run shows the full timeline: delivery, opens, clicks, replies.
 */
import { Fragment, useState } from 'react';
import { Send, SkipForward, XCircle } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { AdminPageChrome } from '@/components/admin/page-chrome';
import { SectionCard } from '@/components/admin/section-card';
import { StatusPill, type StatusTone } from '@/components/admin/status-pill';
import { EmptyState } from '@/components/admin/empty-state';
import { Segmented } from '@/components/admin/segmented';
import { DataTableEl, Th, Td } from '@/components/admin/data-table';
import { selectClass } from '@/components/admin/controls';

const DAY_OPTIONS = [1, 7, 30] as const;
const CHANNELS = ['EMAIL', 'SMS', 'PHONE_SCREEN', 'TASK'] as const;
const CHANNEL_LABEL: Record<string, string> = { EMAIL: 'Email', SMS: 'Text', PHONE_SCREEN: 'Phone screen', TASK: 'Task' };
const ENROLLMENT_STATUSES = ['ACTIVE', 'PAUSED', 'COMPLETED', 'STOPPED_REPLY', 'STOPPED_MANUAL', 'STOPPED_SUPPRESSED'] as const;

function statusTone(status: string): StatusTone {
  if (status === 'ACTIVE') return 'info';
  if (status === 'COMPLETED') return 'neutral';
  if (status === 'STOPPED_REPLY') return 'success';
  if (status === 'STOPPED_SUPPRESSED') return 'danger';
  if (status === 'PAUSED') return 'warn';
  return 'neutral';
}

function outcomeTone(outcome: string): string {
  if (outcome === 'SENT') return 'bg-green-100 text-green-700';
  if (outcome === 'SKIPPED') return 'bg-amber-100 text-amber-800';
  if (outcome === 'FAILED') return 'bg-red-100 text-red-700';
  return 'bg-slate-100 text-slate-400';
}

function deliveryLabel(step: any): { text: string; cls: string } | null {
  if (step.channel === 'PHONE_SCREEN' && step.phoneScreen) {
    const s = step.phoneScreen.status as string;
    return { text: s.toLowerCase().replace('_', ' '), cls: s === 'COMPLETED' ? 'text-green-700' : s === 'FAILED' ? 'text-red-600' : 'text-admin-muted' };
  }
  if (step.channel === 'TASK' && step.task) return { text: `task ${String(step.task.status).toLowerCase()}`, cls: 'text-admin-muted' };
  const d = step.delivery;
  if (!d) return null;
  switch (d.state) {
    case 'clicked':
      return { text: `clicked${d.clickCount > 1 ? ` ×${d.clickCount}` : ''}${d.openCount ? ` · opened ×${d.openCount}` : ''}`, cls: 'text-green-700' };
    case 'opened':
      return { text: `opened${d.openCount > 1 ? ` ×${d.openCount}` : ''}`, cls: 'text-green-700' };
    case 'delivered':
      return { text: 'delivered', cls: 'text-green-700' };
    case 'bounced':
      return { text: `bounced${d.error ? ` — ${d.error}` : ''}`, cls: 'text-red-600' };
    case 'undelivered':
      return { text: `undelivered${d.error ? ` — ${d.error}` : ''}`, cls: 'text-red-600' };
    case 'failed':
      return { text: `failed${d.error ? ` — ${d.error}` : ''}`, cls: 'text-red-600' };
    case 'sent':
      return {
        text:
          d.via === 'mailbox'
            ? d.tracked ? 'sent via recruiter mailbox · not opened' : 'sent via recruiter mailbox (pre-pixel, no open tracking)'
            : d.via === 'twilio' ? 'sent · awaiting carrier' : 'sent · not opened',
        cls: 'text-admin-muted',
      };
    default:
      return null;
  }
}

function when(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleString() : '—';
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-admin-muted">{children}</p>;
}

/** One enrollment, expanded. */
function RunTimeline({ enrollmentId }: { enrollmentId: string }) {
  const detail = (trpc as any).platformAdmin.getOutreachRun.useQuery({ enrollmentId }, { refetchOnWindowFocus: false });
  if (detail.isLoading) return <p className="px-5 py-3 text-xs text-admin-muted">Loading run…</p>;
  if (detail.error) return <p className="px-5 py-3 text-xs text-red-600">{String(detail.error.message)}</p>;
  const data = detail.data ?? {};
  const steps: any[] = data.steps ?? [];
  const replies: any[] = data.replies ?? [];

  return (
    <div className="space-y-4 bg-admin-bg/70 px-5 py-4">
      <div className="admin-panel p-3">
        <Label>The run</Label>
        <p className="mt-1 text-sm font-medium text-admin-ink">
          {data.candidate ? [data.candidate.firstName, data.candidate.lastName].filter(Boolean).join(' ') || 'Candidate' : 'Candidate'}
          <span className="font-normal text-admin-muted"> · {data.sequenceName}</span>
          {data.positionTitle ? <span className="font-normal text-admin-muted"> · about {data.positionTitle}</span> : null}
        </p>
        <p className="mt-1 text-xs text-admin-muted">
          Enrolled {when(data.enrolledAt)}
          {data.completedAt ? ` · finished ${when(data.completedAt)}` : data.nextSendAt ? ` · next step due ${when(data.nextSendAt)}` : ''}
          {data.stoppedReason ? ` · ${data.stoppedReason}` : ''}
        </p>
      </div>

      <div>
        <Label>Every step</Label>
        <div className="admin-panel mt-2 overflow-x-auto">
          <DataTableEl className="text-xs">
            <thead>
              <tr>
                <Th className="px-3 py-2">Step</Th>
                <Th className="px-3 py-2">Channel</Th>
                <Th className="px-3 py-2">Outcome</Th>
                <Th className="px-3 py-2">When</Th>
                <Th className="px-3 py-2">Then</Th>
              </tr>
            </thead>
            <tbody>
              {steps.map((s) => {
                const after = deliveryLabel(s);
                return (
                  <tr key={`${s.stepOrder}-${s.stepId ?? ''}`}>
                    <Td mono className="whitespace-nowrap px-3 py-1.5 text-admin-ink">
                      {s.stepOrder + 1}
                      {s.subject ? <span className="ml-2 font-sans text-admin-muted">{s.subject}</span> : null}
                    </Td>
                    <Td className="whitespace-nowrap px-3 py-1.5">{CHANNEL_LABEL[s.channel] ?? s.channel}</Td>
                    <Td className="px-3 py-1.5">
                      <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${outcomeTone(s.outcome)}`}>{s.outcome.toLowerCase()}</span>
                      {s.reason ? <span className={`ml-2 ${s.outcome === 'FAILED' ? 'text-red-600' : 'text-amber-800'}`}>{s.reason}</span> : null}
                    </Td>
                    <Td className="whitespace-nowrap px-3 py-1.5 text-admin-muted">{s.at ? when(s.at) : s.outcome === 'PENDING' ? 'not yet' : '—'}</Td>
                    <Td className={`px-3 py-1.5 ${after?.cls ?? 'text-admin-muted'}`}>
                      {after?.text ?? '—'}
                      {s.delivery?.clickedLinks?.length ? (
                        <span className="block truncate font-mono text-[10px] text-admin-muted">{s.delivery.clickedLinks.slice(0, 3).join(' · ')}</span>
                      ) : null}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </DataTableEl>
        </div>
      </div>

      <div>
        <Label>Replies ({replies.length})</Label>
        {replies.length === 0 ? (
          <p className="mt-1 text-xs text-admin-muted">No reply from this person yet.</p>
        ) : (
          <ul className="admin-panel mt-2 space-y-1 p-3">
            {replies.map((r) => (
              <li key={r.at} className="text-xs text-admin-secondary">
                <span className="font-medium text-admin-ink">{CHANNEL_LABEL[r.channel] ?? r.channel}</span>
                <span className="text-admin-muted"> · {when(r.at)}</span>
                {r.answeringStepOrder != null ? <span className="text-admin-muted"> · answering step {r.answeringStepOrder + 1}</span> : null}
                {r.intent ? (
                  <StatusPill
                    dot={false}
                    tone={r.intent === 'interested' ? 'success' : r.intent === 'not_interested' ? 'danger' : 'neutral'}
                    className="ml-2 text-[10px]"
                  >
                    {r.intent.replace('_', ' ')}
                  </StatusPill>
                ) : null}
                {r.preview ? <span className="block truncate text-admin-muted">“{r.preview}”</span> : null}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-[11px] text-admin-muted">Candidate contact details are not shown here.</p>
      </div>
    </div>
  );
}

export default function OutreachRunsPage() {
  useAdminAuth();
  const [days, setDays] = useState<number>(7);
  const [status, setStatus] = useState<string>('');
  const [channel, setChannel] = useState<string>('');
  const [outcome, setOutcome] = useState<string>('');
  const [open, setOpen] = useState<string | null>(null);

  const list = (trpc as any).platformAdmin.listOutreachRuns.useQuery(
    {
      days,
      ...(status ? { status } : {}),
      ...(channel ? { channel } : {}),
      ...(outcome ? { outcome } : {}),
    },
    { refetchOnWindowFocus: false },
  );

  const runs: any[] = list.data?.runs ?? [];
  const health = list.data?.health ?? null;
  const byStatus: Record<string, number> = list.data?.byStatus ?? {};

  return (
    <AuthenticatedLayout>
      <AdminPageChrome
        icon={<Send />}
        breadcrumbs={[{ label: 'Operations' }, { label: 'Outreach runs' }]}
        title="Outreach runs"
        description="Every person moving through a cadence across all tenants — each step sent, skipped (and why), or failed, then delivered, opened, clicked, replied."
        actions={
          <>
            <Segmented
              size="sm"
              ariaLabel="Time window"
              options={DAY_OPTIONS.map((d) => ({ value: d as number, label: `${d}d` }))}
              value={days}
              onChange={setDays}
            />
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass} aria-label="Filter by enrollment status">
              <option value="">All statuses</option>
              {ENROLLMENT_STATUSES.map((v) => (
                <option key={v} value={v}>
                  {v.toLowerCase().replace('_', ' ')}
                </option>
              ))}
            </select>
            <select value={channel} onChange={(e) => setChannel(e.target.value)} className={selectClass} aria-label="Filter by channel">
              <option value="">Any channel</option>
              {CHANNELS.map((v) => (
                <option key={v} value={v}>
                  {CHANNEL_LABEL[v]}
                </option>
              ))}
            </select>
            <select value={outcome} onChange={(e) => setOutcome(e.target.value)} className={selectClass} aria-label="Filter by step outcome">
              <option value="">Any outcome</option>
              <option value="SENT">had a step sent</option>
              <option value="SKIPPED">had a step skipped</option>
              <option value="FAILED">had a step fail</option>
            </select>
          </>
        }
      >
      <div className="space-y-6">
        {/* Fleet health — the reason this page exists. */}
        {health ? (
          <div className="grid gap-4 lg:grid-cols-3">
            <SectionCard
              icon={<Send />}
              title="Step attempts"
              description={
                <>
                  <span className="text-green-700">{health.sent} sent</span>
                  <span className="text-slate-300"> · </span>
                  <span className={health.skipped > health.sent ? 'font-semibold text-amber-800' : 'text-amber-800'}>{health.skipped} skipped</span>
                  <span className="text-slate-300"> · </span>
                  <span className={health.failed ? 'text-red-600' : 'text-admin-muted'}>{health.failed} failed</span>
                </>
              }
              actions={<span className="text-2xl font-bold tabular-nums text-admin-ink">{health.attempts.toLocaleString()}</span>}
            >
              <ul className="space-y-1">
                {CHANNELS.filter((c) => health.byChannel?.[c]).map((c) => {
                  const b = health.byChannel[c];
                  return (
                    <li key={c} className="flex justify-between text-xs">
                      <span className="text-admin-secondary">{CHANNEL_LABEL[c]}</span>
                      <span className="admin-mono text-admin-ink">
                        {b.sent} <span className="text-admin-muted">sent</span> {b.skipped} <span className="text-admin-muted">skip</span> {b.failed} <span className="text-admin-muted">fail</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </SectionCard>
            <SectionCard
              icon={<SkipForward />}
              title="Why steps were skipped"
              className={health.skipReasons?.length ? 'border-amber-200' : undefined}
            >
              {health.skipReasons?.length ? (
                <ul className="space-y-1.5">
                  {health.skipReasons.slice(0, 6).map((r: any) => (
                    <li key={`${r.channel}-${r.reason}`} className="flex items-start justify-between gap-2 text-xs">
                      <span className="min-w-0 flex-1 text-admin-secondary">
                        <span className="mr-1 rounded bg-slate-100 px-1 font-mono text-[10px] text-admin-muted">{r.channel}</span>
                        {r.reason}
                      </span>
                      <span className="admin-mono shrink-0 text-admin-ink">{r.count}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-admin-muted">Nothing skipped in this window.</p>
              )}
            </SectionCard>
            <SectionCard
              icon={<XCircle />}
              title="Why steps failed"
              className={health.failReasons?.length ? 'border-red-200' : undefined}
              footer={
                Object.keys(byStatus).length ? (
                  <>
                    {list.data?.totalInWindow} enrollments touched ·{' '}
                    {Object.entries(byStatus)
                      .map(([k, v]) => `${v} ${k.toLowerCase().replace('_', ' ')}`)
                      .join(' · ')}
                  </>
                ) : undefined
              }
            >
              {health.failReasons?.length ? (
                <ul className="space-y-1.5">
                  {health.failReasons.slice(0, 6).map((r: any) => (
                    <li key={`${r.channel}-${r.reason}`} className="flex items-start justify-between gap-2 text-xs">
                      <span className="min-w-0 flex-1 text-red-700">
                        <span className="mr-1 rounded bg-slate-100 px-1 font-mono text-[10px] text-admin-muted">{r.channel}</span>
                        {r.reason}
                      </span>
                      <span className="admin-mono shrink-0 text-admin-ink">{r.count}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-admin-muted">No failures in this window.</p>
              )}
            </SectionCard>
          </div>
        ) : null}

        <SectionCard icon={<Send />} title="Runs" description="Click a run to see its full timeline" padded={false}>
        {list.isLoading ? (
          <p className="px-5 py-6 text-sm text-admin-muted">Loading runs…</p>
        ) : runs.length === 0 ? (
          <EmptyState compact className="border-0 shadow-none" icon={<Send />} title="No outreach runs in this window." />
        ) : (
          <div className="overflow-x-auto">
            <DataTableEl>
              <thead>
                <tr>
                  <Th>Last activity</Th>
                  <Th>Organization</Th>
                  <Th>Cadence</Th>
                  <Th>Person</Th>
                  <Th>Status</Th>
                  <Th>Steps</Th>
                  <Th className="text-right">Sent</Th>
                  <Th className="text-right">Skipped</Th>
                  <Th className="text-right">Failed</Th>
                  <Th>Replied</Th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <Fragment key={r.id}>
                    <tr onClick={() => setOpen(open === r.id ? null : r.id)} className="cursor-pointer">
                      <Td className="whitespace-nowrap">{when(r.lastActivityAt)}</Td>
                      <Td className="text-admin-ink">{r.organizationName ?? r.organizationId}</Td>
                      <Td className="text-admin-ink">
                        {r.sequenceName}
                        {r.sequenceStatus !== 'ACTIVE' ? (
                          <StatusPill tone="neutral" dot={false} className="ml-2 text-[11px]">{String(r.sequenceStatus).toLowerCase()}</StatusPill>
                        ) : null}
                      </Td>
                      <Td className="text-admin-ink">{r.candidateName}</Td>
                      <Td>
                        <StatusPill tone={statusTone(r.status)}>{String(r.status).toLowerCase().replace('_', ' ')}</StatusPill>
                      </Td>
                      <Td>
                        <div className="flex flex-wrap gap-1">
                          {Array.from({ length: r.stepCount }, (_, i) => {
                            const step = r.steps.find((s: any) => s.stepOrder === i);
                            const isNext = !step && r.status === 'ACTIVE' && r.nextStepOrder === i;
                            return (
                              <span
                                key={i}
                                title={step ? `Step ${i + 1} · ${CHANNEL_LABEL[step.channel] ?? step.channel} · ${step.outcome.toLowerCase()}${step.reason ? ` — ${step.reason}` : ''}` : isNext ? `Step ${i + 1} · next${r.nextSendAt ? ` at ${when(r.nextSendAt)}` : ''}` : `Step ${i + 1} · not reached`}
                                className={`rounded px-1 py-0.5 font-mono text-[10px] ${step ? outcomeTone(step.outcome) : isNext ? 'bg-admin-info-soft text-sky-700 ring-1 ring-sky-200' : 'bg-slate-100 text-slate-400'}`}
                              >
                                {step ? (step.channel === 'SMS' ? 'SMS' : step.channel === 'PHONE_SCREEN' ? 'CALL' : step.channel === 'TASK' ? 'TASK' : 'MAIL') : i + 1}
                              </span>
                            );
                          })}
                        </div>
                      </Td>
                      <Td mono className="text-right text-admin-ink">{r.sent}</Td>
                      <Td mono className={`text-right ${r.skipped ? 'text-amber-800' : 'text-admin-muted'}`}>{r.skipped}</Td>
                      <Td mono className={`text-right ${r.failed ? 'text-red-600' : 'text-admin-muted'}`}>{r.failed}</Td>
                      <Td>{r.replied ? <StatusPill tone="success" dot={false}>yes</StatusPill> : <span className="text-xs text-admin-muted">—</span>}</Td>
                    </tr>
                    {open === r.id ? (
                      <tr>
                        <td colSpan={10} className="p-0">
                          <RunTimeline enrollmentId={r.id} />
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

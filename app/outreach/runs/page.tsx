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
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';

const DAY_OPTIONS = [1, 7, 30] as const;
const CHANNELS = ['EMAIL', 'SMS', 'PHONE_SCREEN', 'TASK'] as const;
const CHANNEL_LABEL: Record<string, string> = { EMAIL: 'Email', SMS: 'Text', PHONE_SCREEN: 'Phone screen', TASK: 'Task' };
const ENROLLMENT_STATUSES = ['ACTIVE', 'PAUSED', 'COMPLETED', 'STOPPED_REPLY', 'STOPPED_MANUAL', 'STOPPED_SUPPRESSED'] as const;

function statusTone(status: string): string {
  if (status === 'ACTIVE') return 'bg-blue-50 text-blue-700 ring-blue-200';
  if (status === 'COMPLETED') return 'bg-gray-50 text-gray-600 ring-gray-200';
  if (status === 'STOPPED_REPLY') return 'bg-green-50 text-green-700 ring-green-200';
  if (status === 'STOPPED_SUPPRESSED') return 'bg-red-50 text-red-700 ring-red-200';
  if (status === 'PAUSED') return 'bg-amber-50 text-amber-800 ring-amber-200';
  return 'bg-gray-50 text-gray-600 ring-gray-200';
}

function outcomeTone(outcome: string): string {
  if (outcome === 'SENT') return 'bg-green-100 text-green-700';
  if (outcome === 'SKIPPED') return 'bg-amber-100 text-amber-800';
  if (outcome === 'FAILED') return 'bg-red-100 text-red-700';
  return 'bg-gray-100 text-gray-400';
}

function deliveryLabel(step: any): { text: string; cls: string } | null {
  if (step.channel === 'PHONE_SCREEN' && step.phoneScreen) {
    const s = step.phoneScreen.status as string;
    return { text: s.toLowerCase().replace('_', ' '), cls: s === 'COMPLETED' ? 'text-green-700' : s === 'FAILED' ? 'text-red-600' : 'text-gray-500' };
  }
  if (step.channel === 'TASK' && step.task) return { text: `task ${String(step.task.status).toLowerCase()}`, cls: 'text-gray-500' };
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
        cls: 'text-gray-500',
      };
    default:
      return null;
  }
}

function when(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleString() : '—';
}

/** One enrollment, expanded. */
function RunTimeline({ enrollmentId }: { enrollmentId: string }) {
  const detail = (trpc as any).platformAdmin.getOutreachRun.useQuery({ enrollmentId }, { refetchOnWindowFocus: false });
  if (detail.isLoading) return <p className="px-4 py-3 text-xs text-gray-400">Loading run…</p>;
  if (detail.error) return <p className="px-4 py-3 text-xs text-red-600">{String(detail.error.message)}</p>;
  const data = detail.data ?? {};
  const steps: any[] = data.steps ?? [];
  const replies: any[] = data.replies ?? [];

  return (
    <div className="space-y-4 bg-gray-50 px-4 py-4">
      <div className="rounded-lg border border-gray-200 bg-white p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">The run</p>
        <p className="mt-1 text-sm font-medium text-gray-900">
          {data.candidate ? [data.candidate.firstName, data.candidate.lastName].filter(Boolean).join(' ') || 'Candidate' : 'Candidate'}
          <span className="font-normal text-gray-500"> · {data.sequenceName}</span>
          {data.positionTitle ? <span className="font-normal text-gray-500"> · about {data.positionTitle}</span> : null}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Enrolled {when(data.enrolledAt)}
          {data.completedAt ? ` · finished ${when(data.completedAt)}` : data.nextSendAt ? ` · next step due ${when(data.nextSendAt)}` : ''}
          {data.stoppedReason ? ` · ${data.stoppedReason}` : ''}
        </p>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Every step</p>
        <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Step</th>
                <th className="px-3 py-2 text-left font-medium">Channel</th>
                <th className="px-3 py-2 text-left font-medium">Outcome</th>
                <th className="px-3 py-2 text-left font-medium">When</th>
                <th className="px-3 py-2 text-left font-medium">Then</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {steps.map((s) => {
                const after = deliveryLabel(s);
                return (
                  <tr key={`${s.stepOrder}-${s.stepId ?? ''}`}>
                    <td className="whitespace-nowrap px-3 py-1.5 font-mono text-gray-900">
                      {s.stepOrder + 1}
                      {s.subject ? <span className="ml-2 font-sans text-gray-500">{s.subject}</span> : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-gray-600">{CHANNEL_LABEL[s.channel] ?? s.channel}</td>
                    <td className="px-3 py-1.5">
                      <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${outcomeTone(s.outcome)}`}>{s.outcome.toLowerCase()}</span>
                      {s.reason ? <span className={`ml-2 ${s.outcome === 'FAILED' ? 'text-red-600' : 'text-amber-800'}`}>{s.reason}</span> : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-gray-500">{s.at ? when(s.at) : s.outcome === 'PENDING' ? 'not yet' : '—'}</td>
                    <td className={`px-3 py-1.5 ${after?.cls ?? 'text-gray-400'}`}>
                      {after?.text ?? '—'}
                      {s.delivery?.clickedLinks?.length ? (
                        <span className="block truncate font-mono text-[10px] text-gray-400">{s.delivery.clickedLinks.slice(0, 3).join(' · ')}</span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Replies ({replies.length})
        </p>
        {replies.length === 0 ? (
          <p className="mt-1 text-xs text-gray-500">No reply from this person yet.</p>
        ) : (
          <ul className="mt-2 space-y-1 rounded-lg border border-gray-200 bg-white p-3">
            {replies.map((r) => (
              <li key={r.at} className="text-xs text-gray-700">
                <span className="font-medium text-gray-900">{CHANNEL_LABEL[r.channel] ?? r.channel}</span>
                <span className="text-gray-500"> · {when(r.at)}</span>
                {r.answeringStepOrder != null ? <span className="text-gray-500"> · answering step {r.answeringStepOrder + 1}</span> : null}
                {r.intent ? (
                  <span
                    className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      r.intent === 'interested' ? 'bg-green-50 text-green-700' : r.intent === 'not_interested' ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {r.intent.replace('_', ' ')}
                  </span>
                ) : null}
                {r.preview ? <span className="block truncate text-gray-500">“{r.preview}”</span> : null}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-[11px] text-gray-400">Candidate contact details are not shown here.</p>
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
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Outreach runs</h1>
            <p className="text-sm text-gray-500">
              Every person moving through a cadence across all tenants — each step sent, skipped (and why), or failed, then delivered, opened, clicked, replied.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {DAY_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`rounded-md px-2.5 py-1.5 text-sm ${days === d ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 ring-1 ring-gray-200'}`}
              >
                {d}d
              </button>
            ))}
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-700" aria-label="Filter by enrollment status">
              <option value="">All statuses</option>
              {ENROLLMENT_STATUSES.map((v) => (
                <option key={v} value={v}>
                  {v.toLowerCase().replace('_', ' ')}
                </option>
              ))}
            </select>
            <select value={channel} onChange={(e) => setChannel(e.target.value)} className="rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-700" aria-label="Filter by channel">
              <option value="">Any channel</option>
              {CHANNELS.map((v) => (
                <option key={v} value={v}>
                  {CHANNEL_LABEL[v]}
                </option>
              ))}
            </select>
            <select value={outcome} onChange={(e) => setOutcome(e.target.value)} className="rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-700" aria-label="Filter by step outcome">
              <option value="">Any outcome</option>
              <option value="SENT">had a step sent</option>
              <option value="SKIPPED">had a step skipped</option>
              <option value="FAILED">had a step fail</option>
            </select>
          </div>
        </div>

        {/* Fleet health — the reason this page exists. */}
        {health ? (
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <p className="text-sm font-semibold text-gray-900">Step attempts</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{health.attempts.toLocaleString()}</p>
              <p className="text-[11px] text-gray-500">
                <span className="text-green-700">{health.sent} sent</span>
                <span className="text-gray-300"> · </span>
                <span className={health.skipped > health.sent ? 'text-amber-800 font-semibold' : 'text-amber-800'}>{health.skipped} skipped</span>
                <span className="text-gray-300"> · </span>
                <span className={health.failed ? 'text-red-600' : 'text-gray-500'}>{health.failed} failed</span>
              </p>
              <ul className="mt-2 space-y-0.5 border-t border-gray-100 pt-2">
                {CHANNELS.filter((c) => health.byChannel?.[c]).map((c) => {
                  const b = health.byChannel[c];
                  return (
                    <li key={c} className="flex justify-between text-[11px]">
                      <span className="text-gray-600">{CHANNEL_LABEL[c]}</span>
                      <span className="font-mono text-gray-900">
                        {b.sent} <span className="text-gray-400">sent</span> {b.skipped} <span className="text-gray-400">skip</span> {b.failed} <span className="text-gray-400">fail</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className={`rounded-lg border bg-white p-3 ${health.skipReasons?.length ? 'border-amber-200' : 'border-gray-200'}`}>
              <p className="text-sm font-semibold text-gray-900">Why steps were skipped</p>
              {health.skipReasons?.length ? (
                <ul className="mt-2 space-y-1">
                  {health.skipReasons.slice(0, 6).map((r: any) => (
                    <li key={`${r.channel}-${r.reason}`} className="flex items-start justify-between gap-2 text-[11px]">
                      <span className="min-w-0 flex-1 text-gray-700">
                        <span className="mr-1 rounded bg-gray-100 px-1 font-mono text-[10px] text-gray-500">{r.channel}</span>
                        {r.reason}
                      </span>
                      <span className="shrink-0 font-mono text-gray-900">{r.count}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[11px] text-gray-500">Nothing skipped in this window.</p>
              )}
            </div>
            <div className={`rounded-lg border bg-white p-3 ${health.failReasons?.length ? 'border-red-200' : 'border-gray-200'}`}>
              <p className="text-sm font-semibold text-gray-900">Why steps failed</p>
              {health.failReasons?.length ? (
                <ul className="mt-2 space-y-1">
                  {health.failReasons.slice(0, 6).map((r: any) => (
                    <li key={`${r.channel}-${r.reason}`} className="flex items-start justify-between gap-2 text-[11px]">
                      <span className="min-w-0 flex-1 text-red-700">
                        <span className="mr-1 rounded bg-gray-100 px-1 font-mono text-[10px] text-gray-500">{r.channel}</span>
                        {r.reason}
                      </span>
                      <span className="shrink-0 font-mono text-gray-900">{r.count}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[11px] text-gray-500">No failures in this window.</p>
              )}
              {Object.keys(byStatus).length ? (
                <p className="mt-2 border-t border-gray-100 pt-2 text-[11px] text-gray-500">
                  {list.data?.totalInWindow} enrollments touched ·{' '}
                  {Object.entries(byStatus)
                    .map(([k, v]) => `${v} ${k.toLowerCase().replace('_', ' ')}`)
                    .join(' · ')}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {list.isLoading ? (
          <p className="text-sm text-gray-500">Loading runs…</p>
        ) : runs.length === 0 ? (
          <p className="text-sm text-gray-500">No outreach runs in this window.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Last activity</th>
                  <th className="px-4 py-2 text-left font-medium">Organization</th>
                  <th className="px-4 py-2 text-left font-medium">Cadence</th>
                  <th className="px-4 py-2 text-left font-medium">Person</th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                  <th className="px-4 py-2 text-left font-medium">Steps</th>
                  <th className="px-4 py-2 text-right font-medium">Sent</th>
                  <th className="px-4 py-2 text-right font-medium">Skipped</th>
                  <th className="px-4 py-2 text-right font-medium">Failed</th>
                  <th className="px-4 py-2 text-left font-medium">Replied</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {runs.map((r) => (
                  <Fragment key={r.id}>
                    <tr onClick={() => setOpen(open === r.id ? null : r.id)} className="cursor-pointer hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-2 text-gray-600">{when(r.lastActivityAt)}</td>
                      <td className="px-4 py-2 text-gray-900">{r.organizationName ?? r.organizationId}</td>
                      <td className="px-4 py-2 text-gray-900">
                        {r.sequenceName}
                        {r.sequenceStatus !== 'ACTIVE' ? (
                          <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">{String(r.sequenceStatus).toLowerCase()}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-2 text-gray-900">{r.candidateName}</td>
                      <td className="px-4 py-2">
                        <span className={`rounded px-1.5 py-0.5 text-xs ring-1 ${statusTone(r.status)}`}>{String(r.status).toLowerCase().replace('_', ' ')}</span>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex flex-wrap gap-1">
                          {Array.from({ length: r.stepCount }, (_, i) => {
                            const step = r.steps.find((s: any) => s.stepOrder === i);
                            const isNext = !step && r.status === 'ACTIVE' && r.nextStepOrder === i;
                            return (
                              <span
                                key={i}
                                title={step ? `Step ${i + 1} · ${CHANNEL_LABEL[step.channel] ?? step.channel} · ${step.outcome.toLowerCase()}${step.reason ? ` — ${step.reason}` : ''}` : isNext ? `Step ${i + 1} · next${r.nextSendAt ? ` at ${when(r.nextSendAt)}` : ''}` : `Step ${i + 1} · not reached`}
                                className={`rounded px-1 py-0.5 font-mono text-[10px] ${step ? outcomeTone(step.outcome) : isNext ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' : 'bg-gray-100 text-gray-400'}`}
                              >
                                {step ? (step.channel === 'SMS' ? 'SMS' : step.channel === 'PHONE_SCREEN' ? 'CALL' : step.channel === 'TASK' ? 'TASK' : 'MAIL') : i + 1}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-gray-900">{r.sent}</td>
                      <td className={`px-4 py-2 text-right font-mono ${r.skipped ? 'text-amber-800' : 'text-gray-400'}`}>{r.skipped}</td>
                      <td className={`px-4 py-2 text-right font-mono ${r.failed ? 'text-red-600' : 'text-gray-400'}`}>{r.failed}</td>
                      <td className="px-4 py-2">{r.replied ? <span className="rounded bg-green-50 px-1.5 py-0.5 text-xs text-green-700">yes</span> : <span className="text-xs text-gray-400">—</span>}</td>
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
            </table>
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
}

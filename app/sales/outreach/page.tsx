'use client';

import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { formatWhen } from '../format';

/**
 * Top-of-funnel across every live Apollo sequence.
 *
 * Apollo counts unique CONTACTS at each step, not messages, so these are
 * people reached rather than emails sent — which is the number that answers
 * "is outreach working". Rates are shown against the step above rather than
 * against the top, because open rate on delivered and reply rate on delivered
 * answer different questions and conflating them flatters the result.
 */
function OutreachFunnel({
  funnel,
  sequenceCount,
  rate,
}: {
  funnel: { delivered: number; opened: number; replied: number; clicked: number };
  sequenceCount: number;
  rate: (part: number, whole: number) => number;
}) {
  const steps = [
    { label: 'Reached', value: funnel.delivered, of: null as number | null, hint: 'unique people delivered to' },
    { label: 'Opened', value: funnel.opened, of: funnel.delivered, hint: 'of those reached' },
    { label: 'Replied', value: funnel.replied, of: funnel.delivered, hint: 'of those reached' },
    { label: 'Clicked', value: funnel.clicked, of: funnel.delivered, hint: 'of those reached' },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Outreach funnel</h2>
        <p className="text-xs text-gray-500">
          {sequenceCount} live {sequenceCount === 1 ? 'sequence' : 'sequences'} · unique people, not messages
        </p>
      </div>
      {funnel.delivered === 0 ? (
        <p className="text-sm text-gray-500">No live sequence has reached anyone yet.</p>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((step) => (
            <div key={step.label} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">{step.label}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{step.value.toLocaleString()}</p>
              <p className="text-xs text-gray-500">
                {step.of == null ? step.hint : `${rate(step.value, step.of)}% ${step.hint}`}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SalesOutreachPage() {
  const { isAuthenticated, isLoading: authLoading } = useAdminAuth();
  const { data, isLoading, error } = trpc.platformAdmin.getSalesApollo.useQuery(undefined, {
    enabled: !authLoading && isAuthenticated,
    refetchInterval: 60_000,
  });
  const gong = trpc.platformAdmin.getSalesGong.useQuery(undefined, {
    enabled: !authLoading && isAuthenticated,
    refetchInterval: 60_000,
  });

  if (authLoading || isLoading || gong.isLoading) {
    return (
      <div className="flex justify-center py-24">
        <div className="animate-spin h-10 w-10 border-2 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }
  if (!isAuthenticated) return null;

  if (error && gong.error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
        {error.message}
      </div>
    );
  }

  const sequences = data?.sequences ?? [];
  const emails = data?.emails ?? [];
  const g = gong.data;
  const stats = g?.stats;

  // Funnel across every live sequence. Apollo reports unique contacts at each
  // step, so these are people reached rather than messages sent — the number a
  // rep actually cares about.
  const live = sequences.filter((sq: { archived: boolean }) => !sq.archived);
  const funnel = live.reduce(
    (acc: { delivered: number; opened: number; replied: number; clicked: number }, sq: any) => ({
      delivered: acc.delivered + (sq.uniqueDelivered ?? 0),
      opened: acc.opened + (sq.uniqueOpened ?? 0),
      replied: acc.replied + (sq.uniqueReplied ?? 0),
      clicked: acc.clicked + (sq.uniqueClicked ?? 0),
    }),
    { delivered: 0, opened: 0, replied: 0, clicked: 0 },
  );
  const rate = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

  return (
    <div className="space-y-6">
      {(error || gong.error) && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error?.message || gong.error?.message}
        </div>
      )}
      {data?.error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Apollo: {data.error}
        </div>
      )}
      {g?.error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Gong: {g.error}
        </div>
      )}

      <OutreachFunnel funnel={funnel} sequenceCount={live.length} rate={rate} />

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <Kpi label="In flows" value={String(stats?.people ?? 0)} />
        <Kpi label="Sent past email" value={String(stats?.sent ?? 0)} />
        <Kpi label="Queued on email" value={String(stats?.queued ?? 0)} />
        <Kpi label="Opened" value={String(stats?.opened ?? 0)} />
        <Kpi label="Bounces" value={String(stats?.bounces ?? 0)} />
        <Kpi label="Unsubs" value={String(stats?.unsubs ?? 0)} />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Gong Engage flows</h2>
          <p className="text-sm text-gray-500 mt-1">
            {g?.connected
              ? `${g.flows.length} flows · ${stats?.people ?? 0} people · ${g.tasks.length} call tasks`
              : 'Gong is not connected'}
          </p>
        </div>
        {!g?.connected ? (
          <p className="p-6 text-sm text-gray-500">
            Set Gong credentials.{' '}
            <Link href="/sales/connections" className="text-indigo-700 hover:underline">
              Connections
            </Link>
          </p>
        ) : (g.flows ?? []).length === 0 ? (
          <p className="p-6 text-sm text-gray-500">No Engage flows returned.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Flow</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Folder</th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-600">People</th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-600">Sent</th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-600">Queued</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Created</th>
                </tr>
              </thead>
              <tbody>
                {g.flows.map((flow) => (
                  <tr key={flow.id} className="border-b border-gray-100">
                    <td className="px-4 py-3 font-medium text-gray-900">{flow.name}</td>
                    <td className="px-4 py-3 text-gray-600">{flow.folderName || '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-600">{flow.people ?? 0}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-600">{flow.sent ?? 0}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-600">{flow.queued ?? 0}</td>
                    <td className="px-4 py-3 text-gray-600">{formatWhen(flow.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">People in Gong flows</h2>
          <p className="text-sm text-gray-500 mt-1">
            Salesforce contacts and leads currently on Engage flows. Sent means they already left the email step.
          </p>
        </div>
        {(g?.people ?? []).length === 0 ? (
          <p className="p-6 text-sm text-gray-500">No contacts or leads are assigned to a Gong flow in Salesforce.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Name</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Email</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Flow</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Step</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Email</th>
                </tr>
              </thead>
              <tbody>
                {g!.people.map((person) => (
                  <tr key={`${person.source}:${person.id}`} className="border-b border-gray-100">
                    <td className="px-4 py-3 font-medium text-gray-900">{person.name || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{person.email || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{person.flowName || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {[person.stepType, person.stepNumber ? `#${person.stepNumber}` : null].filter(Boolean).join(' ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{person.flowStatus || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {person.bounced ? 'Bounced' : person.unsubscribed ? 'Unsub' : person.sent ? 'Sent' : 'Queued'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Apollo sequences</h2>
          <p className="text-sm text-gray-500 mt-1">
            {data?.connected ? `${sequences.length} loaded · first 50` : 'Apollo is not connected'}
          </p>
        </div>
        {!data?.connected ? (
          <p className="p-6 text-sm text-gray-500">
            Add Apollo credentials.{' '}
            <Link href="/sales/connections" className="text-indigo-700 hover:underline">
              Connections
            </Link>
          </p>
        ) : sequences.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">No sequences in Apollo.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Sequence</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-600">Delivered</th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-600">Opened</th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-600">Replied</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Last used</th>
                </tr>
              </thead>
              <tbody>
                {sequences.map((seq) => (
                  <tr key={seq.id} className="border-b border-gray-100">
                    <td className="px-4 py-3 font-medium text-gray-900">{seq.name}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {seq.archived ? 'Archived' : seq.active ? 'Active' : 'Inactive'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-600">{seq.uniqueDelivered ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-600">{seq.uniqueOpened ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-600">{seq.uniqueReplied ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{formatWhen(seq.lastUsedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent emails</h2>
          <p className="text-sm text-gray-500 mt-1">
            {data.from && data.to
              ? `${new Date(data.from).toLocaleDateString()} – ${new Date(data.to).toLocaleDateString()}`
              : 'Last 14 days'}
            {' · '}
            {data.emailsThisWeek} this week
          </p>
        </div>
        {!data?.connected ? (
          <p className="p-6 text-sm text-gray-500">Apollo emails unavailable.</p>
        ) : emails.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">No outreach emails in this range.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">To</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Subject</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Sent</th>
                </tr>
              </thead>
              <tbody>
                {emails.map((email) => (
                  <tr key={email.id} className="border-b border-gray-100">
                    <td className="px-4 py-3 font-medium text-gray-900">{email.toName || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{email.subject || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 capitalize">{email.status || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{formatWhen(email.completedAt ?? email.dueAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">{value}</p>
    </div>
  );
}

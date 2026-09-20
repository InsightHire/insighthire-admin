'use client';

import { Fragment, useMemo, useState } from 'react';

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

/**
 * Apollo sequences, ranked by the number that actually matters.
 *
 * Default sort is reply rate, not volume: a sequence that blasted 4,000 people
 * for six replies is a worse sequence than one that reached 80 for twelve, and
 * sorting by delivered hides that. Sequences below a floor of 20 delivered are
 * still shown but their rate is greyed — a 100% reply rate on two people is
 * noise, and letting it top the table would be actively misleading.
 */
function SequenceTable({
  sequences,
  connected,
  sort,
  setSort,
  filter,
  setFilter,
  query,
  setQuery,
  group,
  setGroup,
  onlyMeaningful,
  setOnlyMeaningful,
}: {
  sequences: any[];
  connected: boolean;
  sort: 'replyRate' | 'delivered' | 'replied' | 'recent' | 'name';
  setSort: (v: 'replyRate' | 'delivered' | 'replied' | 'recent' | 'name') => void;
  filter: 'live' | 'all';
  setFilter: (v: 'live' | 'all') => void;
  query: string;
  setQuery: (v: string) => void;
  group: 'none' | 'status' | 'performance';
  setGroup: (v: 'none' | 'status' | 'performance') => void;
  onlyMeaningful: boolean;
  setOnlyMeaningful: (v: boolean) => void;
}) {
  /** Below this, a percentage says more about luck than about the sequence. */
  const MEANINGFUL = 20;

  const rows = useMemo(() => {
    const withRates = sequences
      .filter((s) => (filter === 'live' ? !s.archived : true))
      .filter((s) => (query ? s.name.toLowerCase().includes(query.toLowerCase()) : true))
      .map((s) => {
        const delivered = s.uniqueDelivered ?? 0;
        return {
          ...s,
          delivered,
          opened: s.uniqueOpened ?? 0,
          replied: s.uniqueReplied ?? 0,
          openRate: delivered ? (s.uniqueOpened ?? 0) / delivered : 0,
          replyRate: delivered ? (s.uniqueReplied ?? 0) / delivered : 0,
          meaningful: delivered >= MEANINGFUL,
        };
      });

    const sorted = [...withRates];
    switch (sort) {
      case 'replyRate':
        // Sequences with too little volume sink rather than topping the table
        // on a meaningless percentage.
        sorted.sort((a, b) => {
          if (a.meaningful !== b.meaningful) return a.meaningful ? -1 : 1;
          return b.replyRate - a.replyRate;
        });
        break;
      case 'delivered':
        sorted.sort((a, b) => b.delivered - a.delivered);
        break;
      case 'replied':
        sorted.sort((a, b) => b.replied - a.replied);
        break;
      case 'recent':
        sorted.sort((a, b) => (b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? ''));
        break;
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }
    return onlyMeaningful ? sorted.filter((s) => s.meaningful) : sorted;
  }, [sequences, sort, filter, query, onlyMeaningful]);

  /**
   * Optional grouping. "Performance" buckets by reply rate rather than by any
   * Apollo field — the question a sales lead actually asks is "which of these
   * are working", and a band answers that faster than a sorted column.
   */
  const grouped = useMemo(() => {
    if (group === 'none') return [{ key: '', label: '', rows }];
    const bucket = (r: any) => {
      if (group === 'status') return r.archived ? 'Archived' : r.active ? 'Active' : 'Paused';
      if (!r.meaningful) return 'Too little volume to judge';
      if (r.replyRate >= 0.1) return 'Working — 10%+ reply';
      if (r.replyRate >= 0.03) return 'Average — 3-10% reply';
      return 'Underperforming — under 3%';
    };
    const map = new Map<string, any[]>();
    for (const r of rows) map.set(bucket(r), [...(map.get(bucket(r)) ?? []), r]);
    const order = [
      'Working — 10%+ reply',
      'Average — 3-10% reply',
      'Underperforming — under 3%',
      'Too little volume to judge',
      'Active',
      'Paused',
      'Archived',
    ];
    return [...map.entries()]
      .map(([key, groupRows]) => ({
        key,
        label: key,
        rows: groupRows,
        reached: groupRows.reduce((n, r) => n + r.delivered, 0),
        replied: groupRows.reduce((n, r) => n + r.replied, 0),
      }))
      .sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));
  }, [rows, group]);

  const best = Math.max(0.0001, ...rows.filter((r) => r.meaningful).map((r) => r.replyRate));

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">
          Sequences <span className="text-sm font-normal text-gray-500">({rows.length})</span>
        </h2>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a sequence…"
            aria-label="Find a sequence"
            className="w-44 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
          <div className="flex rounded-md border border-gray-300 overflow-hidden">
            {(['live', 'all'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1.5 text-sm ${
                  filter === f ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {f === 'live' ? 'Live' : 'All'}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={onlyMeaningful}
              onChange={(e) => setOnlyMeaningful(e.target.checked)}
              className="rounded border-gray-300"
            />
            Enough volume only
          </label>
          <select
            value={group}
            onChange={(e) => setGroup(e.target.value as never)}
            aria-label="Group sequences"
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-700"
          >
            <option value="none">No grouping</option>
            <option value="performance">Group by performance</option>
            <option value="status">Group by status</option>
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as never)}
            aria-label="Sort sequences"
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-700"
          >
            <option value="replyRate">Best reply rate</option>
            <option value="replied">Most replies</option>
            <option value="delivered">Most reached</option>
            <option value="recent">Recently used</option>
            <option value="name">By name</option>
          </select>
        </div>
      </div>

      {!connected ? (
        <p className="p-6 text-sm text-gray-500">
          Apollo is not connected.{' '}
          <Link href="/sales/connections" className="text-indigo-700 hover:underline">
            Connections
          </Link>
        </p>
      ) : rows.length === 0 ? (
        <p className="p-6 text-sm text-gray-500">
          {query ? 'No sequence matches that name.' : 'No sequences in Apollo.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2 text-left font-medium">Sequence</th>
                <th className="px-4 py-2 text-right font-medium">Reached</th>
                <th className="px-4 py-2 text-right font-medium">Opened</th>
                <th className="px-4 py-2 text-right font-medium">Replied</th>
                <th className="px-4 py-2 text-left font-medium">Reply rate</th>
                <th className="px-4 py-2 text-left font-medium">Last used</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((g: any) => (
                <Fragment key={g.key || 'all'}>
                  {group !== 'none' && (
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <td colSpan={6} className="px-4 py-2">
                        <span className="font-semibold text-gray-900">{g.label}</span>
                        <span className="ml-2 text-sm text-gray-500">
                          {g.rows.length} · {g.reached.toLocaleString()} reached · {g.replied.toLocaleString()} replies
                        </span>
                      </td>
                    </tr>
                  )}
                  {g.rows.map((seq: any) => (
                <tr key={seq.id} className="border-b border-gray-100">
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900">{seq.name}</span>
                    {seq.archived && (
                      <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">archived</span>
                    )}
                    {!seq.archived && seq.active && (
                      <span className="ml-2 rounded bg-green-50 px-1.5 py-0.5 text-[11px] text-green-700">active</span>
                    )}
                    <span className="block text-xs text-gray-400">{seq.numSteps ?? 0} steps</span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-900">{seq.delivered.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                    {seq.opened.toLocaleString()}
                    {seq.delivered > 0 && (
                      <span className="ml-1 text-xs text-gray-400">{Math.round(seq.openRate * 100)}%</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-gray-900">
                    {seq.replied.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    {seq.delivered === 0 ? (
                      <span className="text-xs text-gray-400">not sent</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className={seq.meaningful ? 'h-2 bg-indigo-500' : 'h-2 bg-gray-300'}
                            style={{ width: `${Math.max(4, (seq.replyRate / best) * 100)}%` }}
                          />
                        </div>
                        <span
                          className={`tabular-nums text-xs ${seq.meaningful ? 'text-gray-900' : 'text-gray-400'}`}
                          title={seq.meaningful ? undefined : `Only ${seq.delivered} reached — too few to read into`}
                        >
                          {(seq.replyRate * 100).toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{formatWhen(seq.lastUsedAt)}</td>
                </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function SalesOutreachPage() {
  const { isAuthenticated, isLoading: authLoading } = useAdminAuth();
  const [seqSort, setSeqSort] = useState<'replyRate' | 'delivered' | 'replied' | 'recent' | 'name'>('replyRate');
  const [seqFilter, setSeqFilter] = useState<'live' | 'all'>('live');
  const [seqQuery, setSeqQuery] = useState('');
  const [seqGroup, setSeqGroup] = useState<'none' | 'status' | 'performance'>('none');
  const [onlyMeaningful, setOnlyMeaningful] = useState(false);
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

      <SequenceTable
        sequences={sequences}
        connected={!!data?.connected}
        sort={seqSort}
        setSort={setSeqSort}
        filter={seqFilter}
        setFilter={setSeqFilter}
        query={seqQuery}
        setQuery={setSeqQuery}
        group={seqGroup}
        setGroup={setSeqGroup}
        onlyMeaningful={onlyMeaningful}
        setOnlyMeaningful={setOnlyMeaningful}
      />

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

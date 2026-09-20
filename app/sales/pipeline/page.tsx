'use client';

/**
 * Full pipeline: every open deal, filterable, with stage subtotals and recent
 * closes.
 *
 * This page previously printed `opp.amount` straight from Salesforce, so any
 * deal a rep had not costed showed as $0 — and the page contradicted the
 * overview, which counts an assumed value. It now uses the same effective
 * amount and marks every estimate, so the two pages can never disagree.
 */
import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { formatDate, formatMoney } from '../format';

type SortKey = 'amount' | 'close' | 'stage' | 'account';
type GroupKey = 'none' | 'owner' | 'stage' | 'month' | 'account';
type CloseWindow = 'all' | 'overdue' | 'month' | 'quarter' | 'undated';

const GROUP_LABELS: Record<GroupKey, string> = {
  none: 'No grouping',
  owner: 'Group by rep',
  stage: 'Group by stage',
  month: 'Group by close month',
  account: 'Group by account',
};

const CLOSE_LABELS: Record<CloseWindow, string> = {
  all: 'Any close date',
  overdue: 'Past due',
  month: 'Closing this month',
  quarter: 'Closing in 90 days',
  undated: 'No close date',
};

/** "2026-11" -> "November 2026"; undated deals group together at the end. */
function monthLabel(closeDate: string | null): string {
  if (!closeDate) return 'No close date';
  const d = new Date(closeDate);
  if (Number.isNaN(d.getTime())) return 'No close date';
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function inCloseWindow(closeDate: string | null, window: CloseWindow, now = new Date()): boolean {
  if (window === 'all') return true;
  if (!closeDate) return window === 'undated';
  if (window === 'undated') return false;
  const d = new Date(closeDate);
  // An unparseable date behaves like a missing one, and 'undated' already
  // returned above, so at this point it can only be a no-match.
  if (Number.isNaN(d.getTime())) return false;
  if (window === 'overdue') return d < now;
  const days = (d.getTime() - now.getTime()) / 86_400_000;
  if (window === 'quarter') return days >= 0 && days <= 90;
  // "this month" means the current calendar month, not the next 30 days —
  // that is what a rep means when they say it.
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export default function SalesPipelinePage() {
  const { isAuthenticated, isLoading: authLoading } = useAdminAuth();
  const { data, isLoading, error } = trpc.platformAdmin.getSalesPipeline.useQuery(undefined, {
    enabled: !authLoading && isAuthenticated,
    refetchInterval: 60_000,
  });

  const [owner, setOwner] = useState<string>('');
  const [stage, setStage] = useState<string>('');
  const [sort, setSort] = useState<SortKey>('amount');
  const [groupBy, setGroupBy] = useState<GroupKey>('none');
  const [closeWindow, setCloseWindow] = useState<CloseWindow>('all');
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [showTasks, setShowTasks] = useState(false);

  const opportunities: any[] = data?.opportunities ?? [];
  const closed: any[] = data?.closed ?? [];
  const tasks: any[] = data?.recentTasks ?? [];

  const owners = useMemo(
    () => Array.from(new Set(opportunities.map((o) => o.ownerName ?? 'Unassigned'))).sort(),
    [opportunities],
  );
  const stages = useMemo(
    () => Array.from(new Set(opportunities.map((o) => o.stageName))).sort(),
    [opportunities],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = opportunities.filter(
      (o) =>
        (!owner || (o.ownerName ?? 'Unassigned') === owner) &&
        (!stage || o.stageName === stage) &&
        inCloseWindow(o.closeDate, closeWindow) &&
        (!q ||
          [o.accountName, o.name, o.ownerName, o.stageName]
            .filter(Boolean)
            .some((v: string) => v.toLowerCase().includes(q))),
    );
    const sorted = [...rows];
    switch (sort) {
      case 'amount':
        sorted.sort((a, b) => b.effectiveAmount - a.effectiveAmount);
        break;
      case 'close':
        // Undated deals sort last rather than first — a missing close date is
        // not the most urgent thing on the list.
        sorted.sort((a, b) => (a.closeDate ?? '9999').localeCompare(b.closeDate ?? '9999'));
        break;
      case 'stage':
        sorted.sort((a, b) => a.stageName.localeCompare(b.stageName));
        break;
      case 'account':
        sorted.sort((a, b) => (a.accountName ?? '').localeCompare(b.accountName ?? ''));
        break;
    }
    return sorted;
  }, [opportunities, owner, stage, sort, query, closeWindow]);

  /**
   * Group the filtered rows. Subtotals are what make grouping useful — a list
   * split by rep with no per-rep total is just a sorted list.
   */
  const groups = useMemo(() => {
    if (groupBy === 'none') return [{ key: '', label: '', rows: visible }];
    const map = new Map<string, any[]>();
    for (const o of visible) {
      const key =
        groupBy === 'owner'
          ? o.ownerName ?? 'Unassigned'
          : groupBy === 'stage'
            ? o.stageName
            : groupBy === 'account'
              ? o.accountName ?? 'No account'
              : monthLabel(o.closeDate);
      map.set(key, [...(map.get(key) ?? []), o]);
    }
    const entries = [...map.entries()].map(([key, rows]) => ({
      key,
      label: key,
      rows,
      total: rows.reduce((sum, r) => sum + r.effectiveAmount, 0),
      assumed: rows.filter((r) => r.amountAssumed).length,
    }));
    // Biggest group first, except by month where chronology is the point.
    if (groupBy === 'month') {
      entries.sort((a, b) => {
        if (a.label === 'No close date') return 1;
        if (b.label === 'No close date') return -1;
        return new Date(a.rows[0].closeDate).getTime() - new Date(b.rows[0].closeDate).getTime();
      });
    } else {
      entries.sort((a, b) => b.total - a.total);
    }
    return entries;
  }, [visible, groupBy]);

  const filteredTotal = visible.reduce((sum, o) => sum + o.effectiveAmount, 0);
  const filteredAssumed = visible.filter((o) => o.amountAssumed).length;
  const filtering = !!owner || !!stage || !!query.trim() || closeWindow !== 'all';

  if (authLoading || isLoading) {
    return (
      <div className="flex justify-center py-24">
        <div className="animate-spin h-10 w-10 border-2 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }
  if (!isAuthenticated) return null;

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error.message}</div>
    );
  }

  if (!data?.connected) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
        Salesforce is not connected.{' '}
        <Link href="/sales/connections" className="text-indigo-700 hover:underline">
          Add credentials on the API service
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {data.error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {data.error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Kpi
          label="Open pipeline"
          value={formatMoney(data.openPipelineAmount)}
          sub={`${data.openCount} deals`}
        />
        <Kpi label="Weighted" value={formatMoney(data.weightedPipelineAmount)} sub="× probability" />
        <Kpi label="Won" value={String(data.wonCount)} sub={formatMoney(data.wonAmount)} />
        <Kpi label="Lost" value={String(data.lostCount)} />
        <Kpi
          label="Estimated"
          value={String(data.assumedOpenCount)}
          sub={
            data.assumedOpenCount
              ? `${formatMoney(data.assumedOpenAmount)} at ${formatMoney(data.assumedDealValue)} each`
              : 'every deal is costed'
          }
        />
      </div>

      {data.assumedOpenCount > 0 && (
        <p className="text-xs text-gray-500">
          {data.assumedOpenCount} of {data.openCount} open deals have no amount in Salesforce and are counted at{' '}
          {formatMoney(data.assumedDealValue)}, marked{' '}
          <span className="rounded bg-amber-100 px-1 py-0.5 text-[11px] font-medium text-amber-800">est.</span> Fill the
          amount in Salesforce and it will use the real figure.
        </p>
      )}

      <StageBars stages={data.stages ?? []} onPick={(s) => setStage(s === stage ? '' : s)} active={stage} />

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Open deals <span className="text-sm font-normal text-gray-500">({visible.length})</span>
          </h2>
          {filtering && (
            <span className="text-sm text-gray-500">
              {formatMoney(filteredTotal)}
              {filteredAssumed > 0 && ` · ${filteredAssumed} est.`}
            </span>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Account, deal, rep…"
              aria-label="Search deals"
              className="w-44 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
            <Select value={owner} onChange={setOwner} label="All reps" options={owners} />
            <Select value={stage} onChange={setStage} label="All stages" options={stages} />
            <select
              value={closeWindow}
              onChange={(e) => setCloseWindow(e.target.value as CloseWindow)}
              aria-label="Filter by close date"
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-700"
            >
              {(Object.keys(CLOSE_LABELS) as CloseWindow[]).map((w) => (
                <option key={w} value={w}>
                  {CLOSE_LABELS[w]}
                </option>
              ))}
            </select>
            <select
              value={groupBy}
              onChange={(e) => {
                setGroupBy(e.target.value as GroupKey);
                setCollapsed(new Set());
              }}
              aria-label="Group deals"
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-700"
            >
              {(Object.keys(GROUP_LABELS) as GroupKey[]).map((g) => (
                <option key={g} value={g}>
                  {GROUP_LABELS[g]}
                </option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              aria-label="Sort deals"
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-700"
            >
              <option value="amount">Largest first</option>
              <option value="close">Closing soonest</option>
              <option value="stage">By stage</option>
              <option value="account">By account</option>
            </select>
            {filtering && (
              <button
                onClick={() => {
                  setOwner('');
                  setStage('');
                  setQuery('');
                  setCloseWindow('all');
                }}
                className="text-sm text-indigo-700 hover:underline"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {visible.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">
            {filtering ? 'No deals match that filter.' : 'No open opportunities.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[880px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-2 text-left font-medium">Account</th>
                  <th className="px-4 py-2 text-left font-medium">Opportunity</th>
                  <th className="px-4 py-2 text-right font-medium">Amount</th>
                  <th className="px-4 py-2 text-right font-medium">Prob.</th>
                  <th className="px-4 py-2 text-left font-medium">Stage</th>
                  <th className="px-4 py-2 text-left font-medium">Close</th>
                  <th className="px-4 py-2 text-left font-medium">Owner</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group: any) => {
                  const isCollapsed = collapsed.has(group.key);
                  return (
                    <Fragment key={group.key || 'all'}>
                      {groupBy !== 'none' && (
                        <tr className="border-b border-gray-200 bg-gray-50">
                          <td colSpan={7} className="px-4 py-2">
                            <button
                              onClick={() =>
                                setCollapsed((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(group.key)) next.delete(group.key);
                                  else next.add(group.key);
                                  return next;
                                })
                              }
                              className="flex w-full items-center gap-2 text-left"
                            >
                              <span className="text-xs text-gray-400">{isCollapsed ? '▸' : '▾'}</span>
                              <span className="font-semibold text-gray-900">{group.label}</span>
                              <span className="text-sm text-gray-500">
                                {group.rows.length} {group.rows.length === 1 ? 'deal' : 'deals'}
                              </span>
                              <span className="ml-auto tabular-nums font-medium text-gray-900">
                                {formatMoney(group.total)}
                              </span>
                              {group.assumed > 0 && (
                                <span className="text-xs text-amber-700">{group.assumed} est.</span>
                              )}
                            </button>
                          </td>
                        </tr>
                      )}
                      {!isCollapsed &&
                        group.rows.map((opp: any) => (
                          <tr key={opp.id} className="border-b border-gray-100">
                            <td className="px-4 py-3 font-medium text-gray-900">{opp.accountName || '—'}</td>
                            <td className="px-4 py-3 text-gray-700">
                              {opp.name}
                              {opp.nextStep && (
                                <span className="block text-xs text-gray-400">Next: {opp.nextStep}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-gray-900">
                              {formatMoney(opp.effectiveAmount)}
                              {opp.amountAssumed && (
                                <span className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[11px] font-medium text-amber-800">
                                  est.
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-gray-500">
                              {opp.probability == null ? '—' : `${opp.probability}%`}
                            </td>
                            <td className="px-4 py-3 text-gray-600">{opp.stageName}</td>
                            <td className="px-4 py-3 text-gray-600">
                              {formatDate(opp.closeDate)}
                              {opp.closeDate && new Date(opp.closeDate) < new Date() && (
                                <span className="ml-1 text-[11px] font-medium text-red-600">past due</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-600">{opp.ownerName || 'Unassigned'}</td>
                          </tr>
                        ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {closed.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Recently closed</h2>
            <p className="mt-1 text-sm text-gray-500">Won and lost together — the shape of what is actually landing.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-2 text-left font-medium">Result</th>
                  <th className="px-4 py-2 text-left font-medium">Account</th>
                  <th className="px-4 py-2 text-right font-medium">Amount</th>
                  <th className="px-4 py-2 text-left font-medium">Closed</th>
                  <th className="px-4 py-2 text-left font-medium">Owner</th>
                </tr>
              </thead>
              <tbody>
                {closed.slice(0, 20).map((opp) => (
                  <tr key={opp.id} className="border-b border-gray-100">
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                          opp.isWon ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {opp.isWon ? 'Won' : 'Lost'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-900">{opp.accountName || opp.name}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                      {formatMoney(opp.effectiveAmount)}
                      {opp.amountAssumed && <span className="ml-1 text-[11px] text-amber-700">est.</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(opp.closeDate)}</td>
                    <td className="px-4 py-3 text-gray-600">{opp.ownerName || 'Unassigned'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <button
          onClick={() => setShowTasks((v) => !v)}
          className="flex w-full items-center justify-between px-6 py-4 text-left"
        >
          <span>
            <span className="text-lg font-semibold text-gray-900">Recent Salesforce tasks</span>
            <span className="ml-2 text-sm text-gray-500">({tasks.length}, last 30 days)</span>
          </span>
          <span className="text-sm text-indigo-700">{showTasks ? 'Hide' : 'Show'}</span>
        </button>
        {showTasks &&
          (tasks.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-gray-500">No recent tasks.</p>
          ) : (
            <div className="overflow-x-auto border-t border-gray-200">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-2 text-left font-medium">Subject</th>
                    <th className="px-4 py-2 text-left font-medium">Who / what</th>
                    <th className="px-4 py-2 text-left font-medium">Status</th>
                    <th className="px-4 py-2 text-left font-medium">Date</th>
                    <th className="px-4 py-2 text-left font-medium">Owner</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr key={task.id} className="border-b border-gray-100">
                      <td className="px-4 py-3 text-gray-900">{task.subject || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {[task.whoName, task.whatName].filter(Boolean).join(' · ') || '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{task.status || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(task.activityDate)}</td>
                      <td className="px-4 py-3 text-gray-600">{task.ownerName || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
      </div>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

function Select({
  value,
  onChange,
  label,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className="rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-700"
    >
      <option value="">{label}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

/** Stage distribution, clickable to filter the table below it. */
function StageBars({
  stages,
  onPick,
  active,
}: {
  stages: Array<{ stageName: string; count: number; amount: number }>;
  onPick: (stage: string) => void;
  active: string;
}) {
  if (!stages.length) return null;
  const max = Math.max(1, ...stages.map((s) => s.amount));
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">By stage</h2>
      <div className="space-y-3">
        {stages.map((s) => (
          <button key={s.stageName} onClick={() => onPick(s.stageName)} className="block w-full text-left">
            <div className="flex items-center justify-between text-sm">
              <span className={active === s.stageName ? 'font-semibold text-indigo-700' : 'text-gray-700'}>
                {s.stageName}
              </span>
              <span className="tabular-nums text-gray-500">
                {s.count} · {formatMoney(s.amount)}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                className={active === s.stageName ? 'h-2 bg-indigo-700' : 'h-2 bg-indigo-500'}
                style={{ width: `${Math.max(6, (s.amount / max) * 100)}%` }}
              />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

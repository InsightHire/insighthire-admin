'use client';

import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { formatDate, formatMoney, formatWhen, money } from './format';

/**
 * Per-rep scoreboard.
 *
 * Owner.Name is the one attribution Salesforce reliably gives us, so it is
 * what everything here is grouped by. Win rate deliberately counts only
 * decided deals — including open ones would make a rep with a full pipeline
 * and no closes look like they lose everything.
 */
function RepScoreboard({
  reps,
}: {
  reps: Array<{
    ownerName: string;
    openCount: number;
    openAmount: number;
    wonCount: number;
    wonAmount: number;
    lostCount: number;
    assumedCount: number;
    winRate: number;
    averageDealSize: number;
  }>;
}) {
  if (!reps.length) return null;
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">By rep</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="py-2 pr-4 text-left font-medium">Rep</th>
              <th className="py-2 pr-4 text-right font-medium">Open</th>
              <th className="py-2 pr-4 text-right font-medium">Pipeline</th>
              <th className="py-2 pr-4 text-right font-medium">Won</th>
              <th className="py-2 pr-4 text-right font-medium">Lost</th>
              <th className="py-2 pr-4 text-right font-medium">Win rate</th>
              <th className="py-2 text-right font-medium">Avg deal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {reps.map((rep) => (
              <tr key={rep.ownerName}>
                <td className="py-2 pr-4 font-medium text-gray-900">
                  {rep.ownerName}
                  {rep.assumedCount > 0 && (
                    <span className="ml-2 text-xs font-normal text-amber-700">
                      {rep.assumedCount} estimated
                    </span>
                  )}
                </td>
                <td className="py-2 pr-4 text-right tabular-nums text-gray-700">{rep.openCount}</td>
                <td className="py-2 pr-4 text-right tabular-nums text-gray-900">{formatMoney(rep.openAmount)}</td>
                <td className="py-2 pr-4 text-right tabular-nums text-green-700">
                  {rep.wonCount}
                  {rep.wonAmount > 0 && (
                    <span className="ml-1 text-xs text-gray-500">{formatMoney(rep.wonAmount)}</span>
                  )}
                </td>
                <td className="py-2 pr-4 text-right tabular-nums text-gray-500">{rep.lostCount}</td>
                <td className="py-2 pr-4 text-right tabular-nums text-gray-700">
                  {rep.wonCount + rep.lostCount === 0 ? (
                    <span className="text-gray-400" title="Nothing decided yet">—</span>
                  ) : (
                    `${rep.winRate}%`
                  )}
                </td>
                <td className="py-2 text-right tabular-nums text-gray-700">
                  {rep.averageDealSize ? formatMoney(rep.averageDealSize) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Open deals. Amounts missing in Salesforce show the assumed figure with an
 * "est." marker — a dashboard that silently invents revenue is worse than one
 * that shows zero, so the estimate is always visible as an estimate.
 */
function DealsTable({
  deals,
  assumedValue,
  loading,
}: {
  deals: Array<{
    id: string;
    name: string;
    accountName: string | null;
    stageName: string;
    effectiveAmount: number;
    amountAssumed: boolean;
    probability: number | null;
    closeDate: string | null;
    ownerName: string | null;
    nextStep: string | null;
  }>;
  assumedValue: number;
  loading: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Open deals</h2>
        {assumedValue > 0 && (
          <p className="text-xs text-gray-500">
            Deals with no amount in Salesforce are estimated at {formatMoney(assumedValue)} and marked
            <span className="mx-1 rounded bg-amber-100 px-1 py-0.5 text-[11px] font-medium text-amber-800">est.</span>
          </p>
        )}
      </div>
      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : deals.length === 0 ? (
        <p className="text-sm text-gray-500">No open opportunities.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="py-2 pr-4 text-left font-medium">Account</th>
                <th className="py-2 pr-4 text-left font-medium">Deal</th>
                <th className="py-2 pr-4 text-left font-medium">Stage</th>
                <th className="py-2 pr-4 text-right font-medium">Amount</th>
                <th className="py-2 pr-4 text-right font-medium">Prob.</th>
                <th className="py-2 pr-4 text-left font-medium">Close</th>
                <th className="py-2 text-left font-medium">Owner</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {deals.map((deal) => (
                <tr key={deal.id}>
                  <td className="py-2 pr-4 font-medium text-gray-900">{deal.accountName ?? '—'}</td>
                  <td className="py-2 pr-4 text-gray-700">
                    {deal.name}
                    {deal.nextStep && (
                      <span className="block text-xs text-gray-400">Next: {deal.nextStep}</span>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-gray-600">{deal.stageName}</td>
                  <td className="py-2 pr-4 text-right tabular-nums text-gray-900">
                    {formatMoney(deal.effectiveAmount)}
                    {deal.amountAssumed && (
                      <span className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[11px] font-medium text-amber-800">
                        est.
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums text-gray-500">
                    {deal.probability == null ? '—' : `${deal.probability}%`}
                  </td>
                  <td className="py-2 pr-4 text-gray-600">{formatDate(deal.closeDate)}</td>
                  <td className="py-2 text-gray-600">{deal.ownerName ?? 'Unassigned'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const SECTION_LABEL: Record<string, string> = {
  leads: 'Leads',
  opportunities: 'Opportunities',
  emails: 'Emails',
  calls: 'Calls',
};

/**
 * What the 15:00 ET Slack post will say, with a manual send. Shown here rather
 * than on its own page so the numbers sit next to the dashboard they come from.
 */
function DailyDigestCard({
  digest,
  loading,
  sending,
  sent,
  error,
  onSend,
}: {
  digest: any;
  loading: boolean;
  sending: boolean;
  sent: boolean | undefined;
  error: string | null;
  onSend: () => void;
}) {
  const problems: string[] = digest
    ? Object.entries(digest.sections as Record<string, { status: string; detail?: string }>)
        .filter(([, v]) => v.status !== 'ok')
        .map(([k, v]) => `${SECTION_LABEL[k] || k}: ${v.detail || v.status.replace('_', ' ')}`)
    : [];
  const activeReps = (digest?.reps ?? []).filter(
    (r: any) => r.calls > 0 || r.emails > 0 || r.newOpportunities > 0 || r.newLeads > 0,
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Daily Slack digest</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Posts automatically at 3:00 PM ET. Covers today so far, Eastern.
          </p>
        </div>
        <button
          type="button"
          onClick={onSend}
          disabled={sending || loading}
          className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {sending ? 'Sending…' : 'Send to Slack now'}
        </button>
      </div>

      {error ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
          {error}
        </p>
      ) : sent === false ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Built the digest but no Slack webhook is configured — set
          SALES_SLACK_WEBHOOK_URL to choose a channel.
        </p>
      ) : sent ? (
        <p className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-900">
          Posted to Slack.
        </p>
      ) : null}

      {loading ? (
        <p className="mt-3 text-xs text-gray-500">Building preview…</p>
      ) : digest ? (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['New leads', digest.newLeads],
              ['Emails sent', digest.emailsSent],
              ['New opportunities', digest.newOpportunities],
              ['Calls', digest.totalCalls],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-lg bg-gray-50 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
                <p className="mt-0.5 text-lg font-semibold text-gray-900">{value as number}</p>
              </div>
            ))}
          </div>

          {activeReps.length > 0 ? (
            <ul className="mt-3 space-y-1">
              {activeReps.map((r: any) => (
                <li key={r.rep} className="flex flex-wrap justify-between gap-2 text-xs">
                  <span className="font-medium text-gray-900">{r.rep}</span>
                  <span className="text-gray-600">
                    {r.calls} calls{r.callMinutes ? ` (${r.callMinutes}m)` : ''} · {r.emails} emails ·{' '}
                    {r.newOpportunities} opps · {r.newLeads} leads
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-gray-500">No rep activity recorded today.</p>
          )}

          <p className="mt-3 text-[11px] text-gray-500">
            Emails from Gong. Calls from{' '}
            {digest.callSource === 'gong'
              ? 'Gong'
              : digest.callSource === 'salesforce'
                ? 'Salesforce call logging'
                : 'no connected source'}
            .
            {digest.emailsUnattributed > 0
              ? ` ${digest.emailsUnattributed} send${digest.emailsUnattributed === 1 ? '' : 's'} had no sender on the Gong record and are not in the rows above.`
              : ''}
          </p>

          {problems.length > 0 ? (
            <p className="mt-1 text-[11px] text-amber-700">{problems.join(' · ')}</p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export default function SalesOverviewPage() {
  const { isAuthenticated, isLoading: authLoading } = useAdminAuth();
  const enabled = !authLoading && isAuthenticated;

  const pipeline = trpc.platformAdmin.getSalesPipeline.useQuery(undefined, {
    enabled,
    refetchInterval: 60_000,
  });
  const calls = trpc.platformAdmin.getSalesCalls.useQuery(undefined, {
    enabled,
    refetchInterval: 60_000,
  });
  const connections = trpc.platformAdmin.getSalesConnections.useQuery(undefined, {
    enabled,
  });
  const apollo = trpc.platformAdmin.getSalesApollo.useQuery(undefined, {
    enabled,
    refetchInterval: 60_000,
  });
  const dailyDigest = trpc.platformAdmin.getSalesDailyDigest.useQuery(undefined, {
    enabled,
    refetchInterval: 300_000,
  });
  const sendDigest = trpc.platformAdmin.sendSalesDailyDigest.useMutation({
    onSuccess: () => void dailyDigest.refetch(),
  });

  const gong = trpc.platformAdmin.getSalesGong.useQuery(undefined, {
    enabled,
    refetchInterval: 60_000,
  });

  if (authLoading) {
    return (
      <div className="flex justify-center py-24">
        <div className="animate-spin h-10 w-10 border-2 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }
  if (!isAuthenticated) return null;

  const p = pipeline.data;
  const c = calls.data;
  const a = apollo.data;
  const g = gong.data;
  const recentCalls = (c?.calls ?? []).slice(0, 10);
  const recentSequences = (a?.sequences ?? []).filter((s) => !s.archived).slice(0, 8);
  const stages = p?.stages ?? [];
  const maxStage = Math.max(1, ...stages.map((s) => s.amount));

  return (
    <div className="space-y-8">
      {(pipeline.error || calls.error) && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <p className="font-medium">Could not load sales data</p>
          <p className="mt-1 opacity-90">{pipeline.error?.message || calls.error?.message}</p>
        </div>
      )}

      {p?.error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Salesforce: {p.error}
        </div>
      )}
      {c?.error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Calls: {c.error}
        </div>
      )}
      {a?.error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Apollo: {a.error}
        </div>
      )}
      {g?.error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Gong: {g.error}
        </div>
      )}

      {!p?.connected && !pipeline.isLoading && (
        <DisconnectedBanner
          title="Salesforce is not connected"
          href="/sales/connections"
        />
      )}

      <DailyDigestCard
        digest={dailyDigest.data}
        loading={dailyDigest.isLoading}
        sending={sendDigest.isPending}
        sent={sendDigest.data?.posted}
        error={sendDigest.error?.message ?? dailyDigest.error?.message ?? null}
        onSend={() => sendDigest.mutate()}
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Kpi
          label="Open pipeline"
          value={money(p?.openPipelineAmount)}
          sub={
            p?.assumedOpenCount
              ? `${p.openCount} deals · ${p.assumedOpenCount} estimated at ${money(p.assumedDealValue)}`
              : `${p?.openCount ?? 0} open deals`
          }
        />
        <Kpi label="Weighted" value={money(p?.weightedPipelineAmount)} sub="Amount × probability" />
        <Kpi label="Won" value={String(p?.wonCount ?? 0)} />
        <Kpi label="Lost" value={String(p?.lostCount ?? 0)} />
        <Kpi
          label="Calls this week"
          value={String(c?.callsThisWeek ?? 0)}
          sub={
            c?.connected
              ? [c.gongConnected && 'Gong', c.dialpadConnected && 'Dialpad'].filter(Boolean).join(' + ') || 'Calls'
              : 'Gong and Dialpad not connected'
          }
        />
      </div>

      <RepScoreboard reps={p?.reps ?? []} />

      <DealsTable
        deals={p?.opportunities ?? []}
        assumedValue={p?.assumedDealValue ?? 0}
        loading={pipeline.isLoading}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Pipeline by stage</h2>
            <Link href="/sales/pipeline" className="text-sm text-indigo-700 hover:underline">
              View all
            </Link>
          </div>
          {stages.length === 0 ? (
            <p className="text-sm text-gray-500">No open opportunities yet.</p>
          ) : (
            <div className="space-y-3">
              {stages.map((stage) => (
                <div key={stage.stageName}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{stage.stageName}</span>
                    <span className="tabular-nums text-gray-500">
                      {stage.count} · {formatMoney(stage.amount)}
                    </span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-2 bg-indigo-500"
                      style={{ width: `${Math.max(6, (stage.amount / maxStage) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent calls</h2>
            <Link href="/sales/calls" className="text-sm text-indigo-700 hover:underline">
              View all
            </Link>
          </div>
          {!c?.connected && !calls.isLoading ? (
            <DisconnectedBanner title="Gong and Dialpad are not connected" href="/sales/connections" />
          ) : recentCalls.length === 0 ? (
            <p className="text-sm text-gray-500">No calls in the last 14 days.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {recentCalls.map((call) => (
                <li key={`${call.source ?? 'call'}:${call.id}`} className="py-3 first:pt-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {call.title || 'Untitled call'}
                        {call.source && (
                          <span className="ml-2 text-[10px] uppercase tracking-wide text-gray-400">
                            {call.source}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatWhen(call.started)}
                        {call.durationSeconds != null ? ` · ${Math.round(call.durationSeconds / 60)} min` : ''}
                      </p>
                    </div>
                    {call.url && (
                      <a
                        href={call.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-indigo-700 hover:underline shrink-0"
                      >
                        Open
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <Kpi label="Gong in flows" value={String(g?.stats.people ?? 0)} sub={g?.connected ? `${g.flows.length} flows` : 'Gong not connected'} />
        <Kpi label="Sent past email" value={String(g?.stats.sent ?? 0)} />
        <Kpi label="Queued on email" value={String(g?.stats.queued ?? 0)} />
        <Kpi label="Opened" value={String(g?.stats.opened ?? 0)} />
        <Kpi label="Bounces" value={String(g?.stats.bounces ?? 0)} />
        <Kpi label="Unsubs" value={String(g?.stats.unsubs ?? 0)} />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Apollo sequences</h2>
            {a?.connected && (
              <p className="text-xs text-gray-500 mt-0.5">{a.emailsThisWeek} emails this week</p>
            )}
          </div>
          <Link href="/sales/outreach" className="text-sm text-indigo-700 hover:underline">
            View all
          </Link>
        </div>
        {!a?.connected && !apollo.isLoading ? (
          <DisconnectedBanner title="Apollo is not connected" href="/sales/connections" />
        ) : recentSequences.length === 0 ? (
          <p className="text-sm text-gray-500">No sequences yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {recentSequences.map((seq) => (
              <li key={seq.id} className="py-3 first:pt-0">
                <p className="text-sm font-medium text-gray-900 truncate">{seq.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {seq.active ? 'Active' : 'Inactive'}
                  {seq.uniqueDelivered != null ? ` · ${seq.uniqueDelivered} delivered` : ''}
                  {seq.uniqueReplied != null ? ` · ${seq.uniqueReplied} replied` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {connections.data && (
        <div className="text-xs text-gray-500">
          Salesforce {connections.data.salesforce.status} · Gong {connections.data.gong.status} · Dialpad {connections.data.dialpad.status} · Apollo {connections.data.apollo.status} · Sales Nav {connections.data.linkedinSalesNav.status}
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900 tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

function DisconnectedBanner({ title, href }: { title: string; href: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
      {title}.{' '}
      <Link href={href} className="text-indigo-700 hover:underline">
        Connection setup
      </Link>
    </div>
  );
}

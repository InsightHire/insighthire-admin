'use client';

import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { formatMoney, formatWhen, money } from './format';

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
  const recentCalls = (c?.calls ?? []).slice(0, 10);
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
          Gong: {c.error}
        </div>
      )}

      {!p?.connected && !pipeline.isLoading && (
        <DisconnectedBanner
          title="Salesforce is not connected"
          href="/sales/connections"
        />
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Kpi label="Open pipeline" value={money(p?.openPipelineAmount)} sub={`${p?.openCount ?? 0} open deals`} />
        <Kpi label="Weighted" value={money(p?.weightedPipelineAmount)} sub="Amount × probability" />
        <Kpi label="Won" value={String(p?.wonCount ?? 0)} />
        <Kpi label="Lost" value={String(p?.lostCount ?? 0)} />
        <Kpi label="Calls this week" value={String(c?.callsThisWeek ?? 0)} sub={c?.connected ? undefined : 'Gong not connected'} />
      </div>

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
            <h2 className="text-lg font-semibold text-gray-900">Recent Gong calls</h2>
            <Link href="/sales/calls" className="text-sm text-indigo-700 hover:underline">
              View all
            </Link>
          </div>
          {!c?.connected && !calls.isLoading ? (
            <DisconnectedBanner title="Gong is not connected" href="/sales/connections" />
          ) : recentCalls.length === 0 ? (
            <p className="text-sm text-gray-500">No calls in the last 14 days.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {recentCalls.map((call) => (
                <li key={call.id} className="py-3 first:pt-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {call.title || 'Untitled call'}
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

      {connections.data && (
        <div className="text-xs text-gray-500">
          Salesforce {connections.data.salesforce.status} · Gong {connections.data.gong.status} · Apollo {connections.data.apollo.status} · Sales Nav {connections.data.linkedinSalesNav.status}
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

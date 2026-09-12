'use client';
export const dynamic = 'force-dynamic';

/**
 * AI cost observability — per-org LLM spend and tokens by model, plus
 * spend by call site, from llm_usage_events. Pricing and abuse detection.
 */
import { Fragment, useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';

function usd(v: number): string {
  return v >= 100 ? `$${v.toFixed(0)}` : v >= 1 ? `$${v.toFixed(2)}` : `$${v.toFixed(4)}`;
}

function tokens(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
}

export default function AiCostsPage() {
  useAdminAuth();
  const [days, setDays] = useState(30);
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null);

  const summary = (trpc as any).platformAdmin.getAiCostSummary.useQuery(
    { days },
    { refetchOnWindowFocus: false, keepPreviousData: true },
  );
  const d = summary.data;

  return (
    <AuthenticatedLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI costs</h1>
            <p className="text-sm text-gray-500">
              LLM spend and token volume per tenant and per call site.
            </p>
          </div>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>

        {summary.isLoading ? (
          <p className="text-sm text-gray-400">Loading AI cost data…</p>
        ) : summary.error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {summary.error.message}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg shadow p-5">
                <p className="text-sm text-gray-500">Total spend</p>
                <p className="text-3xl font-bold text-gray-900">{usd(d.totalCost)}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-5">
                <p className="text-sm text-gray-500">Tokens</p>
                <p className="text-3xl font-bold text-gray-900">{tokens(d.totalTokens)}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-5">
                <p className="text-sm text-gray-500">Calls</p>
                <p className="text-3xl font-bold text-gray-900">{d.totalCalls.toLocaleString()}</p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow overflow-x-auto">
              <div className="px-4 py-3 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900">Spend by organization</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
                    <th className="px-4 py-2.5 font-medium">Organization</th>
                    <th className="px-4 py-2.5 font-medium text-right">Spend</th>
                    <th className="px-4 py-2.5 font-medium text-right">Tokens</th>
                    <th className="px-4 py-2.5 font-medium text-right">Calls</th>
                    <th className="px-4 py-2.5 font-medium text-right">Failed</th>
                  </tr>
                </thead>
                <tbody>
                  {d.byOrg.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No LLM usage in this window.</td></tr>
                  ) : (
                    d.byOrg.map((o: any) => {
                      const key = o.organizationId ?? 'platform';
                      const expanded = expandedOrg === key;
                      return (
                        <Fragment key={key}>
                          <tr
                            onClick={() => setExpandedOrg(expanded ? null : key)}
                            className="border-b border-gray-50 cursor-pointer hover:bg-gray-50"
                          >
                            <td className="px-4 py-2.5">
                              {o.organizationId ? (
                                <Link
                                  href={`/organizations/${o.organizationId}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="font-medium text-blue-600 hover:text-blue-700"
                                >
                                  {o.organizationName}
                                </Link>
                              ) : (
                                <span className="font-medium text-gray-700">{o.organizationName}</span>
                              )}
                              <span className="ml-2 text-xs text-gray-400">{expanded ? '▾' : '▸'}</span>
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums font-medium text-gray-900">{usd(o.cost)}</td>
                            <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">{tokens(o.tokens)}</td>
                            <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">{o.calls.toLocaleString()}</td>
                            <td className={`px-4 py-2.5 text-right tabular-nums ${o.failedCalls > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                              {o.failedCalls}
                            </td>
                          </tr>
                          {expanded && o.models.map((m: any) => (
                            <tr key={`${key}-${m.model}`} className="border-b border-gray-50 bg-gray-50/50 text-xs">
                              <td className="px-4 py-1.5 pl-10 text-gray-500">{m.model}</td>
                              <td className="px-4 py-1.5 text-right tabular-nums text-gray-600">{usd(m.cost)}</td>
                              <td className="px-4 py-1.5 text-right tabular-nums text-gray-500">{tokens(m.tokens)}</td>
                              <td className="px-4 py-1.5 text-right tabular-nums text-gray-500">{m.calls.toLocaleString()}</td>
                              <td />
                            </tr>
                          ))}
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="bg-white rounded-lg shadow overflow-x-auto">
              <div className="px-4 py-3 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900">Spend by call site</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
                    <th className="px-4 py-2.5 font-medium">Call site</th>
                    <th className="px-4 py-2.5 font-medium text-right">Spend</th>
                    <th className="px-4 py-2.5 font-medium text-right">Tokens</th>
                    <th className="px-4 py-2.5 font-medium text-right">Calls</th>
                  </tr>
                </thead>
                <tbody>
                  {d.byCallSite.map((c: any) => (
                    <tr key={c.callSite} className="border-b border-gray-50">
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-700">{c.callSite}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium text-gray-900">{usd(c.cost)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">{tokens(c.tokens)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">{c.calls.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </AuthenticatedLayout>
  );
}

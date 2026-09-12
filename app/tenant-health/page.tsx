'use client';
export const dynamic = 'force-dynamic';

/**
 * Tenant health & churn signals — per-org usage trends (seats, journeys,
 * scoring volume, last login) with at-risk flags so support reaches out
 * before a tenant quietly churns.
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';

const FLAG_LABELS: Record<string, [string, string]> = {
  USAGE_DOWN_50: ['Usage down 50%+', 'bg-red-100 text-red-800'],
  NO_LOGINS_14D: ['No logins 14d', 'bg-amber-100 text-amber-800'],
  TRIAL_EXPIRING: ['Trial expiring', 'bg-orange-100 text-orange-800'],
  EXPIRED: ['Expired', 'bg-red-100 text-red-800'],
};

function Trend({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0) return <span className="text-gray-300">—</span>;
  const pct = previous === 0 ? 100 : Math.round(((current - previous) / previous) * 100);
  const color = pct > 0 ? 'text-green-600' : pct < 0 ? 'text-red-600' : 'text-gray-400';
  return (
    <span className="whitespace-nowrap">
      <span className="tabular-nums text-gray-900">{current}</span>{' '}
      <span className={`text-xs tabular-nums ${color}`}>
        {pct > 0 ? '+' : ''}{pct}%
      </span>
    </span>
  );
}

export default function TenantHealthPage() {
  useAdminAuth();
  const [onlyAtRisk, setOnlyAtRisk] = useState(false);
  const health = (trpc as any).platformAdmin.getTenantHealth.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const rows: any[] = useMemo(() => {
    const all = health.data ?? [];
    return onlyAtRisk ? all.filter((r: any) => r.flags.length > 0) : all;
  }, [health.data, onlyAtRisk]);

  const atRiskCount = (health.data ?? []).filter((r: any) => r.flags.length > 0 && !r.isDemo).length;

  return (
    <AuthenticatedLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tenant health</h1>
            <p className="text-sm text-gray-500">
              30-day usage vs the prior 30 days. Flags mark tenants worth a proactive call.
            </p>
          </div>
          <div className="flex items-center gap-4">
            {atRiskCount > 0 && (
              <span className="px-2.5 py-1 text-sm rounded-full bg-red-100 text-red-800 font-medium">
                {atRiskCount} at risk
              </span>
            )}
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyAtRisk}
                onChange={(e) => setOnlyAtRisk(e.target.checked)}
                className="rounded border-gray-300"
              />
              At-risk only
            </label>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
                <th className="px-4 py-2.5 font-medium">Organization</th>
                <th className="px-4 py-2.5 font-medium">Plan</th>
                <th className="px-4 py-2.5 font-medium text-right">Seats (active/total)</th>
                <th className="px-4 py-2.5 font-medium text-right">Journeys 30d</th>
                <th className="px-4 py-2.5 font-medium text-right">Scoring 30d</th>
                <th className="px-4 py-2.5 font-medium">Last login</th>
                <th className="px-4 py-2.5 font-medium">Signals</th>
              </tr>
            </thead>
            <tbody>
              {health.isLoading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading tenant health…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  {onlyAtRisk ? 'No at-risk tenants right now.' : 'No organizations found.'}
                </td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <Link href={`/organizations/${r.id}`} className="font-medium text-blue-600 hover:text-blue-700">
                        {r.name || r.id}
                      </Link>
                      {r.isDemo && (
                        <span className="ml-2 px-1.5 py-0.5 text-xs rounded bg-purple-100 text-purple-800">demo</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">
                      {r.plan}
                      <span className="block text-xs text-gray-400">{r.status}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-900">
                      {r.activeSeats}/{r.seats}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Trend current={r.sessions30} previous={r.sessionsPrev30} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Trend current={r.scored30} previous={r.scoredPrev30} />
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-gray-500">
                      {r.lastLoginAt ? new Date(r.lastLoginAt).toLocaleDateString() : 'never'}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {r.flags.map((f: string) => {
                          const [label, style] = FLAG_LABELS[f] ?? [f, 'bg-gray-100 text-gray-600'];
                          return (
                            <span key={f} className={`px-1.5 py-0.5 text-xs rounded ${style}`}>
                              {label}
                            </span>
                          );
                        })}
                        {r.flags.length === 0 && <span className="text-xs text-green-600">healthy</span>}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}

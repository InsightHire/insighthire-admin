'use client';
export const dynamic = 'force-dynamic';

/**
 * Revenue & trial funnel: MRR by plan, monthly signup cohorts with
 * trial-to-paid conversion.
 */
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';

function money(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export default function RevenuePage() {
  useAdminAuth();
  const overview = (trpc as any).platformAdmin.getBillingOverview.useQuery(undefined, { refetchOnWindowFocus: false });
  const funnel = (trpc as any).platformAdmin.getRevenueFunnel.useQuery(undefined, { refetchOnWindowFocus: false });

  const o: any = overview.data ?? {};
  const cohorts: any[] = funnel.data?.cohorts ?? [];
  return (
    <AuthenticatedLayout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Revenue</h1>
          <p className="text-sm text-gray-500">
            MRR and trial funnel by signup month.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            ['MRR', overview.isLoading ? '…' : money(o.mrr ?? 0)],
            ['Active subscriptions', overview.isLoading ? '…' : String(o.activeSubscriptions ?? 0)],
            ['In trial', overview.isLoading ? '…' : String(o.trialCount ?? 0)],
            ['Trials expiring ≤14d', funnel.isLoading ? '…' : String(funnel.data?.trialsExpiring14d ?? 0)],
          ].map(([label, value]) => (
            <div key={label} className="bg-white rounded-lg shadow p-4">
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{value}</p>
            </div>
          ))}
        </div>

        {o.planBreakdown && Object.keys(o.planBreakdown).length > 0 && (
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-2">Paying orgs by plan</h2>
            <div className="flex flex-wrap gap-2">
              {Object.entries(o.planBreakdown).map(([plan, count]) => (
                <span key={plan} className="px-2.5 py-1 text-xs rounded-full bg-purple-50 text-purple-800 font-medium">
                  {plan}: {String(count)}
                </span>
              ))}
              {o.compedActiveCount > 0 && (
                <span className="px-2.5 py-1 text-xs rounded-full bg-gray-100 text-gray-600 font-medium">
                  comped: {o.compedActiveCount}
                </span>
              )}
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Signup cohorts (last 6 months)</h2>
            <p className="text-xs text-gray-400">Where each month's signups are today.</p>
          </div>
          {funnel.isLoading ? (
            <p className="px-4 py-6 text-sm text-gray-400">Loading…</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-100">
                  <th className="text-left px-4 py-2 font-medium">Month</th>
                  <th className="text-right px-4 py-2 font-medium">Signups</th>
                  <th className="text-right px-4 py-2 font-medium">Paying</th>
                  <th className="text-right px-4 py-2 font-medium">Still in trial</th>
                  <th className="text-right px-4 py-2 font-medium">Churned</th>
                  <th className="text-right px-4 py-2 font-medium">Conversion</th>
                </tr>
              </thead>
              <tbody>
                {cohorts.map((c) => (
                  <tr key={c.month} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-2 font-medium text-gray-900">{c.month}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{c.signups}</td>
                    <td className="px-4 py-2 text-right text-green-700">{c.active}</td>
                    <td className="px-4 py-2 text-right text-gray-500">{c.trial}</td>
                    <td className="px-4 py-2 text-right text-red-600">{c.churned}</td>
                    <td className="px-4 py-2 text-right font-medium text-gray-900">
                      {c.conversionPct == null ? '—' : `${c.conversionPct}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AuthenticatedLayout>
  );
}

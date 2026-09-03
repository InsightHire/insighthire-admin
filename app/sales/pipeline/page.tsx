'use client';

import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { formatDate, formatMoney } from '../format';

export default function SalesPipelinePage() {
  const { isAuthenticated, isLoading: authLoading } = useAdminAuth();
  const { data, isLoading, error } = trpc.platformAdmin.getSalesPipeline.useQuery(undefined, {
    enabled: !authLoading && isAuthenticated,
    refetchInterval: 60_000,
  });

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
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
        {error.message}
      </div>
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

  const opportunities = data.opportunities ?? [];
  const tasks = data.recentTasks ?? [];

  return (
    <div className="space-y-8">
      {data.error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {data.error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Open opportunities <span className="text-sm font-normal text-gray-500">({opportunities.length})</span>
          </h2>
        </div>
        {opportunities.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">No open opportunities.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[880px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Opportunity</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Account</th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-600">Amount</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Stage</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Close</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Owner</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Next step</th>
                </tr>
              </thead>
              <tbody>
                {opportunities.map((opp) => (
                  <tr key={opp.id} className="border-b border-gray-100">
                    <td className="px-4 py-3 font-medium text-gray-900">{opp.name}</td>
                    <td className="px-4 py-3 text-gray-600">{opp.accountName || '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatMoney(opp.amount)}</td>
                    <td className="px-4 py-3 text-gray-600">{opp.stageName}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(opp.closeDate)}</td>
                    <td className="px-4 py-3 text-gray-600">{opp.ownerName || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{opp.nextStep || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent Salesforce tasks</h2>
          <p className="text-sm text-gray-500 mt-1">Last 30 days. Sales Nav CRM Sync activity shows up here when it writes to Salesforce.</p>
        </div>
        {tasks.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">No recent tasks.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Subject</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Who / what</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Date</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Owner</th>
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
        )}
      </div>
    </div>
  );
}

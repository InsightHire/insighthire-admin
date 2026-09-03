'use client';

import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { formatWhen } from '../format';

export default function SalesCallsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAdminAuth();
  const { data, isLoading, error } = trpc.platformAdmin.getSalesCalls.useQuery(undefined, {
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
        Gong is not connected.{' '}
        <Link href="/sales/connections" className="text-indigo-700 hover:underline">
          Add credentials on the API service
        </Link>
      </div>
    );
  }

  const calls = data.calls ?? [];

  return (
    <div className="space-y-6">
      {data.error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {data.error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Gong calls</h2>
          <p className="text-sm text-gray-500 mt-1">
            {data.from && data.to
              ? `${new Date(data.from).toLocaleDateString()} – ${new Date(data.to).toLocaleDateString()}`
              : 'Last 14 days'}
            {' · '}
            {data.callsThisWeek} this week
          </p>
        </div>
        {calls.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">No calls in this range.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Call</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Started</th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-600">Duration</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Direction</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Link</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((call) => (
                  <tr key={call.id} className="border-b border-gray-100">
                    <td className="px-4 py-3 font-medium text-gray-900">{call.title || 'Untitled call'}</td>
                    <td className="px-4 py-3 text-gray-600">{formatWhen(call.started)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                      {call.durationSeconds != null ? `${Math.round(call.durationSeconds / 60)} min` : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{call.direction || '—'}</td>
                    <td className="px-4 py-3">
                      {call.url ? (
                        <a href={call.url} target="_blank" rel="noreferrer" className="text-indigo-700 hover:underline">
                          Open in Gong
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
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

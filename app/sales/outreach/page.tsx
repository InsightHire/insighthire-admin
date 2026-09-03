'use client';

import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { formatWhen } from '../format';

export default function SalesOutreachPage() {
  const { isAuthenticated, isLoading: authLoading } = useAdminAuth();
  const { data, isLoading, error } = trpc.platformAdmin.getSalesApollo.useQuery(undefined, {
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
        Apollo is not connected.{' '}
        <Link href="/sales/connections" className="text-indigo-700 hover:underline">
          Add credentials on the API service
        </Link>
      </div>
    );
  }

  const sequences = data.sequences ?? [];
  const emails = data.emails ?? [];

  return (
    <div className="space-y-6">
      {data.error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {data.error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Sequences</h2>
          <p className="text-sm text-gray-500 mt-1">{sequences.length} loaded · first 50</p>
        </div>
        {sequences.length === 0 ? (
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
        {emails.length === 0 ? (
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

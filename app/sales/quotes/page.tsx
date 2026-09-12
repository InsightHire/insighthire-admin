'use client';

import { useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { formatDate } from '../format';
import { Plus } from 'lucide-react';
import { STATUS_BADGE, centsToMoney } from './quote-format';

const STATUSES = ['ALL', 'DRAFT', 'SENT', 'VIEWED', 'SIGNED', 'ACTIVE', 'DECLINED', 'EXPIRED', 'VOID'] as const;

export default function SalesQuotesPage() {
  const { isAuthenticated, isLoading: authLoading } = useAdminAuth();
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('ALL');
  // Cast: the admin app's `trpc` is typed as `any`-router (every hook call in
  // this codebase errors the same way); keep new code out of the tsc baseline.
  const { data, isLoading, error } = (trpc as any).platformAdmin.listTenantQuotes.useQuery(
    status === 'ALL' ? undefined : { status },
    { enabled: !authLoading && isAuthenticated, refetchInterval: 60_000 },
  );

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

  const quotes = data?.quotes ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                status === s
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <Link
          href="/sales/quotes/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" /> New quote
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Tenant quotes <span className="text-sm font-normal text-gray-500">({data?.total ?? 0})</span>
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Compose an order form, send it for e-signature, and the tenant activates itself after billing setup.
          </p>
        </div>
        {quotes.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">
            No quotes yet.{' '}
            <Link href="/sales/quotes/new" className="text-indigo-700 hover:underline">
              Create the first one
            </Link>
            .
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[880px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Company</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Recipient</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Plan</th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-600">Amount</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Sent</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Signed</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q: {
                  id: string; companyName: string; recipientName: string; recipientEmail: string;
                  plan: string; amountCents: number; currency: string; billingInterval: string;
                  status: string; sentAt?: string | null; signedAt?: string | null;
                }) => (
                  <tr key={q.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <Link href={`/sales/quotes/${q.id}`} className="text-indigo-700 hover:underline">
                        {q.companyName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {q.recipientName}
                      <span className="block text-xs text-gray-400">{q.recipientEmail}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{q.plan}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {centsToMoney(q.amountCents, q.currency)}
                      <span className="text-xs text-gray-400">/{q.billingInterval === 'year' ? 'yr' : 'mo'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[q.status] || 'bg-gray-100 text-gray-600'}`}>
                        {q.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{q.sentAt ? formatDate(q.sentAt) : '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{q.signedAt ? formatDate(q.signedAt) : '—'}</td>
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

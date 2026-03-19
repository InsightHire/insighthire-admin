'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import {
  DollarSign,
  CreditCard,
  AlertTriangle,
  Users,
  ArrowRight,
  CheckCircle,
  XCircle,
  ExternalLink,
  Building2,
} from 'lucide-react';

export default function BillingDashboardPage() {
  const router = useRouter();
  const [isAuthed, setIsAuthed] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [page, setPage] = useState(0);
  const limit = 25;

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    if (!token) router.push('/login');
    else setIsAuthed(true);
  }, [router]);

  const { data: overview, isLoading } = trpc.platformAdmin.getBillingOverview.useQuery(
    undefined,
    { enabled: isAuthed, refetchInterval: 60000 }
  );

  const { data: tableData, isLoading: loadingTable } = trpc.platformAdmin.getBillingOrgsTable.useQuery(
    { limit, offset: page * limit, status: statusFilter },
    { enabled: isAuthed, refetchInterval: 60000 }
  );

  if (!isAuthed) return null;

  const totalPages = tableData ? Math.ceil(tableData.total / limit) : 0;

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">MRR</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {isLoading ? '...' : `$${(overview?.mrr ?? 0).toLocaleString()}`}
              </p>
            </div>
            <div className="p-3 bg-emerald-100 rounded-full">
              <DollarSign className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Active</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {isLoading ? '...' : overview?.activeSubscriptions ?? 0}
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <CheckCircle className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Past Due</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">
                {isLoading ? '...' : overview?.pastDueCount ?? 0}
              </p>
            </div>
            <div className="p-3 bg-amber-100 rounded-full">
              <AlertTriangle className="h-6 w-6 text-amber-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Trial</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {isLoading ? '...' : overview?.trialCount ?? 0}
              </p>
            </div>
            <div className="p-3 bg-cyan-100 rounded-full">
              <Users className="h-6 w-6 text-cyan-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Canceled</p>
              <p className="text-2xl font-bold text-gray-500 mt-1">
                {isLoading ? '...' : overview?.canceledCount ?? 0}
              </p>
            </div>
            <div className="p-3 bg-gray-100 rounded-full">
              <XCircle className="h-6 w-6 text-gray-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Full Org Billing Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-gray-900">All organizations</h2>
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
            >
              <option value="ALL">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="TRIAL">Trial</option>
              <option value="PAST_DUE">Past due</option>
              <option value="CANCELED">Canceled</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </div>
        </div>

        {loadingTable ? (
          <div className="p-12 flex justify-center">
            <div className="animate-spin h-8 w-8 border-2 border-indigo-600 border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="overflow-hidden">
            <table className="w-full text-sm table-fixed">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 w-[20%] min-w-0">Organization</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-600 w-[10%]">Plan</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-600 w-[8%]">Status</th>
                  <th className="px-2 py-2 text-right font-semibold text-gray-600 w-[7%]">MRR</th>
                  <th className="px-2 py-2 text-right font-semibold text-gray-600 w-[8%]" title="Paid / Pending">Invoices</th>
                  <th className="px-2 py-2 text-right font-semibold text-gray-600 w-[6%]" title="Positions">Pos</th>
                  <th className="px-2 py-2 text-right font-semibold text-gray-600 w-[6%]" title="Months active">Mo</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-600 w-[12%]">Trial</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-600 w-[8%]">Last paid</th>
                  <th className="px-2 py-2 w-[4%]" />
                </tr>
              </thead>
              <tbody>
                {tableData?.rows?.map((row) => (
                  <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="px-3 py-2 min-w-0">
                      <Link href={`/organizations/${row.id}`} className="font-medium text-indigo-600 hover:underline block truncate" title={row.name || row.domain || row.id}>
                        {row.name || row.domain || row.id}
                      </Link>
                      {row.domain && <p className="text-xs text-gray-500 truncate">{row.domain}</p>}
                    </td>
                    <td className="px-2 py-2">
                      <span className="font-medium text-gray-700 truncate block">{row.plan || '—'}</span>
                    </td>
                    <td className="px-2 py-2">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${
                        row.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' :
                        row.status === 'TRIAL' ? 'bg-cyan-100 text-cyan-800' :
                        row.status === 'PAST_DUE' ? 'bg-amber-100 text-amber-800' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {row.status || '—'}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-xs">
                      {row.mrr > 0 ? `$${row.mrr}` : '—'}
                    </td>
                    <td className="px-2 py-2 text-right text-xs">
                      <span>{row.invoicesPaid}</span>
                      {row.invoicesOpen > 0 && (
                        <span className="text-amber-600 font-medium"> / {row.invoicesOpen}</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right">{row.positionsCount}</td>
                    <td className="px-2 py-2 text-right">{row.monthsActive}</td>
                    <td className="px-2 py-2 min-w-0">
                      {row.isTrial ? (
                        row.trialExpiresAt ? (
                          <span className="text-xs text-cyan-700 truncate block" title={new Date(row.trialExpiresAt).toLocaleDateString()}>
                            {new Date(row.trialExpiresAt).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-xs text-cyan-600">Yes</span>
                        )
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-2 py-2 text-xs text-gray-500">
                      {row.lastPaidAt ? new Date(row.lastPaidAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-2 py-2">
                      {row.stripeCustomerId && (
                        <a
                          href={`https://dashboard.stripe.com/customers/${row.stripeCustomerId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-400 hover:text-indigo-600 inline-block"
                          title="Stripe"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tableData?.rows?.length === 0 && !loadingTable && (
          <div className="p-12 text-center text-gray-500">No organizations match the filter</div>
        )}

        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Showing {page * limit + 1}–{Math.min((page + 1) * limit, tableData?.total ?? 0)} of {tableData?.total ?? 0}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1 border rounded-lg text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-3 py-1 border rounded-lg text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          href="/billing/pricing"
          className="p-6 flex items-center justify-between rounded-xl border border-gray-200 bg-white hover:border-indigo-300 hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-100 rounded-full">
              <CreditCard className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Pricing plans</h3>
              <p className="text-sm text-gray-500">$499, $1,499, $3,999</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-gray-400" />
        </Link>

        <Link
          href="/billing/collections"
          className="p-6 flex items-center justify-between rounded-xl border border-gray-200 bg-white hover:border-amber-300 hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-100 rounded-full">
              <AlertTriangle className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Collections</h3>
              <p className="text-sm text-gray-500">
                {overview?.pastDueCount ?? 0} past due
              </p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-gray-400" />
        </Link>

        <Link
          href="/billing/settings"
          className="p-6 flex items-center justify-between rounded-xl border border-gray-200 bg-white hover:border-gray-300 hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gray-100 rounded-full">
              <Building2 className="h-6 w-6 text-gray-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Settings</h3>
              <p className="text-sm text-gray-500">Stripe, dunning, suspension</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-gray-400" />
        </Link>
      </div>
    </div>
  );
}

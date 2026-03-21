'use client';

import { useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
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
  Gift,
} from 'lucide-react';

export default function BillingDashboardPage() {
  const { isAuthenticated, isLoading: authLoading } = useAdminAuth();
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [billingFilter, setBillingFilter] = useState<'ALL' | 'COMPED' | 'NON_COMPED'>('ALL');
  const [page, setPage] = useState(0);
  const limit = 25;

  const queryEnabled = !authLoading && isAuthenticated;

  const {
    data: overview,
    isLoading: overviewLoading,
    isFetching: overviewFetching,
    error: overviewError,
  } = trpc.platformAdmin.getBillingOverview.useQuery(undefined, {
    enabled: queryEnabled,
    refetchInterval: 60000,
  });

  const {
    data: tableData,
    isLoading: tableLoading,
    isFetching: tableFetching,
    error: tableError,
  } = trpc.platformAdmin.getBillingOrgsTable.useQuery(
    { limit, offset: page * limit, status: statusFilter, billingFilter },
    { enabled: queryEnabled, refetchInterval: 60000 }
  );

  if (authLoading) {
    return (
      <div className="flex justify-center py-24">
        <div className="animate-spin h-10 w-10 border-2 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const loadingStats = overviewLoading || (overviewFetching && !overview);
  const loadingTable = tableLoading || (tableFetching && !tableData);
  const totalPages = tableData ? Math.ceil(tableData.total / limit) : 0;

  return (
    <div className="space-y-8">
      {(overviewError || tableError) && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <p className="font-medium">Could not load billing data</p>
          <p className="mt-1 opacity-90">{overviewError?.message || tableError?.message}</p>
          <p className="mt-2 text-xs text-red-800">
            If this persists after deploy, confirm the API is on the latest version and the database migration for billing fields has been applied.
          </p>
        </div>
      )}

      {/* Revenue */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <DollarSign className="h-5 w-5 text-emerald-600" />
          </div>
          <p className="text-sm font-medium text-gray-500">Paid Monthly Recurring Revenue</p>
        </div>
        <p className="text-4xl font-bold text-gray-900 mt-2">
          {loadingStats ? '…' : `$${(overview?.mrr ?? 0).toLocaleString()}`}
        </p>
        <p className="text-sm text-gray-400 mt-1">From non-comped active subscriptions</p>
      </div>

      {/* Subscription status cards — 5 across, plenty of room */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
          <div className="p-2.5 bg-emerald-100 rounded-lg">
            <CheckCircle className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{loadingStats ? '…' : overview?.activeSubscriptions ?? 0}</p>
            <p className="text-sm text-gray-500">Active</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
          <div className="p-2.5 bg-violet-100 rounded-lg">
            <Gift className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-violet-900">{loadingStats ? '…' : overview?.compedActiveCount ?? 0}</p>
            <p className="text-sm text-gray-500">Comped</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
          <div className="p-2.5 bg-cyan-100 rounded-lg">
            <Users className="h-5 w-5 text-cyan-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{loadingStats ? '…' : overview?.trialCount ?? 0}</p>
            <p className="text-sm text-gray-500">Trial</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
          <div className="p-2.5 bg-amber-100 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-amber-600">{loadingStats ? '…' : overview?.pastDueCount ?? 0}</p>
            <p className="text-sm text-gray-500">Past Due</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
          <div className="p-2.5 bg-gray-100 rounded-lg">
            <XCircle className="h-5 w-5 text-gray-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-400">{loadingStats ? '…' : overview?.canceledCount ?? 0}</p>
            <p className="text-sm text-gray-500">Canceled</p>
          </div>
        </div>
      </div>

      {/* Full Org Billing Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-gray-900">All organizations</h2>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={billingFilter}
              onChange={(e) => {
                setBillingFilter(e.target.value as 'ALL' | 'COMPED' | 'NON_COMPED');
                setPage(0);
              }}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
            >
              <option value="ALL">All billing types</option>
              <option value="COMPED">Comped only</option>
              <option value="NON_COMPED">Paid / not comped</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(0);
              }}
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[960px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Organization</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-600">Plan</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-600">Status</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-600">Billing</th>
                  <th className="px-2 py-2 text-right font-semibold text-gray-600">MRR</th>
                  <th className="px-2 py-2 text-right font-semibold text-gray-600" title="Paid / Pending">
                    Invoices
                  </th>
                  <th className="px-2 py-2 text-right font-semibold text-gray-600" title="Positions">
                    Pos
                  </th>
                  <th className="px-2 py-2 text-right font-semibold text-gray-600" title="Months active">
                    Mo
                  </th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-600">Trial</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-600">Last paid</th>
                  <th className="px-2 py-2 w-10" />
                </tr>
              </thead>
              <tbody>
                {tableData?.rows?.map((row) => (
                  <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="px-3 py-2 min-w-0 max-w-[200px]">
                      <Link
                        href={`/organizations/${row.id}`}
                        className="font-medium text-indigo-600 hover:underline block truncate"
                        title={row.name || row.domain || row.id}
                      >
                        {row.name || row.domain || row.id}
                      </Link>
                      {row.domain && <p className="text-xs text-gray-500 truncate">{row.domain}</p>}
                    </td>
                    <td className="px-2 py-2">
                      <span className="font-medium text-gray-700 truncate block">{row.plan || '—'}</span>
                    </td>
                    <td className="px-2 py-2">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${
                          row.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : row.status === 'TRIAL'
                              ? 'bg-cyan-100 text-cyan-800'
                              : row.status === 'PAST_DUE'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {row.status || '—'}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      {row.billingComped ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-violet-100 text-violet-900">
                          <Gift className="h-3 w-3" />
                          Comped
                        </span>
                      ) : row.billingSource === 'STRIPE' ? (
                        <span className="text-xs font-medium text-indigo-800">Stripe</span>
                      ) : (
                        <span className="text-xs text-gray-600" title="No Stripe customer on file">
                          No Stripe
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-xs">
                      {row.billingComped ? (
                        <span className="text-violet-700">$0</span>
                      ) : row.mrr > 0 ? (
                        `$${row.mrr}`
                      ) : (
                        '—'
                      )}
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
                          <span
                            className="text-xs text-cyan-700 truncate block"
                            title={new Date(row.trialExpiresAt).toLocaleDateString()}
                          >
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

        {!loadingTable && !tableError && (tableData?.rows?.length ?? 0) === 0 && (
          <div className="p-12 text-center text-gray-500">
            No organizations match the filters. If you expect rows here, check API connectivity and that the billing migration has been applied.
          </div>
        )}

        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Showing {page * limit + 1}–{Math.min((page + 1) * limit, tableData?.total ?? 0)} of {tableData?.total ?? 0}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1 border rounded-lg text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
              <p className="text-sm text-gray-500">Catalog & Stripe price IDs</p>
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
              <p className="text-sm text-gray-500">{overview?.pastDueCount ?? 0} past due</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-gray-400" />
        </Link>

        <Link
          href="/billing/trial-config"
          className="p-6 flex items-center justify-between rounded-xl border border-gray-200 bg-white hover:border-cyan-300 hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-cyan-100 rounded-full">
              <Users className="h-6 w-6 text-cyan-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Trial Config</h3>
              <p className="text-sm text-gray-500">Duration & reminder emails</p>
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
              <p className="text-sm text-gray-500">Stripe keys & environment</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-gray-400" />
        </Link>
      </div>
    </div>
  );
}

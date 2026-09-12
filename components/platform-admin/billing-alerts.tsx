'use client';

/**
 * Billing lifecycle alerts — past-due subscriptions, overdue invoices,
 * expiring cards, and upcoming renewals. Mounted at the top of /billing.
 */
import Link from 'next/link';
import { trpc } from '@/lib/trpc';

const KIND_STYLES: Record<string, [string, string]> = {
  PAST_DUE: ['Past due', 'bg-red-100 text-red-800'],
  OVERDUE_INVOICE: ['Overdue invoice', 'bg-red-100 text-red-800'],
  CARD_EXPIRING: ['Card expiring', 'bg-amber-100 text-amber-800'],
  RENEWAL_UPCOMING: ['Renewal', 'bg-blue-100 text-blue-800'],
};

export function BillingAlertsSection() {
  const alertsQuery = (trpc as any).platformAdmin.getBillingAlerts.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: 60000,
  });

  if (alertsQuery.isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-400">
        Checking billing alerts…
      </div>
    );
  }
  if (alertsQuery.error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
        Could not load billing alerts: {alertsQuery.error.message}
      </div>
    );
  }

  const { alerts, stripeErrors } = alertsQuery.data as {
    alerts: {
      kind: string; organizationId: string; organizationName: string;
      detail: string; at: string | null; amount: number | null;
    }[];
    stripeErrors: string[];
  };

  if (alerts.length === 0 && stripeErrors.length === 0) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
        No billing alerts — no past-due accounts, overdue invoices, or expiring cards.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Billing alerts</h2>
        <span className="text-xs text-gray-400">{alerts.length} item{alerts.length === 1 ? '' : 's'}</span>
      </div>
      <div className="divide-y divide-gray-50">
        {alerts.map((a, i) => {
          const [label, style] = KIND_STYLES[a.kind] ?? [a.kind, 'bg-gray-100 text-gray-600'];
          return (
            <div key={`${a.kind}-${a.organizationId}-${i}`} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
              <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${style}`}>{label}</span>
              <Link
                href={`/organizations/${a.organizationId}`}
                className="font-medium text-blue-600 hover:text-blue-700"
              >
                {a.organizationName}
              </Link>
              <span className="text-gray-600">{a.detail}</span>
              {a.amount != null && (
                <span className="ml-auto tabular-nums font-medium text-gray-900">
                  ${a.amount.toLocaleString()}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {stripeErrors.length > 0 && (
        <div className="px-4 py-2 border-t border-gray-100 text-xs text-amber-700">
          Partial data: {stripeErrors.join('; ')}
        </div>
      )}
    </div>
  );
}

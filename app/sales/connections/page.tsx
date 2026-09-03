'use client';

import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';

const STATUS_TONE: Record<string, string> = {
  connected: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  missing: 'bg-amber-50 text-amber-800 border-amber-200',
  later: 'bg-gray-50 text-gray-600 border-gray-200',
};

export default function SalesConnectionsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAdminAuth();
  const { data, isLoading, error } = trpc.platformAdmin.getSalesConnections.useQuery(undefined, {
    enabled: !authLoading && isAuthenticated,
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

  const cards = data
    ? [data.salesforce, data.gong, data.apollo, data.linkedinSalesNav]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Connections</h2>
        <p className="text-gray-500 mt-1">
          Credentials live on the Railway API service. This page never shows secret values.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map((card) => (
          <div key={card.id} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold text-gray-900">{card.label}</h3>
              <span className={`text-xs font-medium px-2 py-0.5 rounded border ${STATUS_TONE[card.status] || STATUS_TONE.later}`}>
                {card.status}
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-3">{card.reason}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 text-sm text-gray-600 space-y-2">
        <p className="font-medium text-gray-900">What to add on insighthire-api</p>
        <p>
          Salesforce: <code className="bg-gray-100 px-1 rounded text-xs">SALESFORCE_CLIENT_ID</code>,{' '}
          <code className="bg-gray-100 px-1 rounded text-xs">SALESFORCE_CLIENT_SECRET</code>,{' '}
          <code className="bg-gray-100 px-1 rounded text-xs">SALESFORCE_USERNAME</code>,{' '}
          <code className="bg-gray-100 px-1 rounded text-xs">SALESFORCE_PASSWORD</code> (password + security token).
        </p>
        <p>
          Gong: <code className="bg-gray-100 px-1 rounded text-xs">GONG_ACCESS_KEY</code>,{' '}
          <code className="bg-gray-100 px-1 rounded text-xs">GONG_ACCESS_KEY_SECRET</code>.
        </p>
      </div>
    </div>
  );
}

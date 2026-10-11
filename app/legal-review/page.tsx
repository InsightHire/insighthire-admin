'use client';
export const dynamic = 'force-dynamic';

/**
 * Legal review (owner, 2026-10-11). Features that move money in legally
 * sensitive ways stay demo-only until counsel signs off here: a feature must
 * be Approved and each customer org enabled by staff. Demo tenants always
 * have them.
 */
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { STATUS_LABEL, STATUS_TONE } from './status';

type Row = {
  key: string;
  title: string;
  summary: string;
  status: string;
  reviewerName: string | null;
  decidedAt: string | null;
  updatedAt: string;
  enabledOrgs: number;
  documents: number;
};

export default function LegalReviewPage() {
  useAdminAuth();
  const list = (trpc as any).platformAdmin.legalReviewList.useQuery(undefined, { refetchOnWindowFocus: false });
  const sync = (trpc as any).platformAdmin.legalReviewSyncVms.useMutation({
    onSuccess: (r: { ok: boolean; results: Record<string, string | null> }) =>
      alert(r.ok ? 'The VMS has the current cleared lists.' : `Some features did not sync: ${Object.entries(r.results).filter(([, e]) => e).map(([k, e]) => `${k}: ${e}`).join('; ')}`),
    onError: (e: { message: string }) => alert('Sync failed: ' + e.message),
  });
  const rows: Row[] = list.data ?? [];

  return (
    <AuthenticatedLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Legal review</h1>
            <p className="text-sm text-gray-500 max-w-3xl">
              These features are live in the demo only. A real customer can use one when its review is <strong>Approved</strong>{' '}
              and staff have enabled that customer. Each review lists the legal questions, the risks, the structure we recommend and
              questions to ask counsel.
            </p>
          </div>
          <button
            onClick={() => sync.mutate()}
            disabled={sync.isLoading}
            className="shrink-0 rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {sync.isLoading ? 'Syncing…' : 'Re-sync VMS'}
          </button>
        </div>

        {list.isLoading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : list.error ? (
          <p className="text-sm text-red-600">{list.error.message}</p>
        ) : (
          <div className="grid gap-4">
            {rows.map((r) => (
              <Link key={r.key} href={`/legal-review/${encodeURIComponent(r.key)}`} className="block bg-white rounded-lg shadow p-5 hover:ring-2 hover:ring-blue-200">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h2 className="font-semibold text-gray-900">{r.title}</h2>
                    <p className="text-xs font-mono text-gray-400">{r.key}</p>
                    <p className="text-sm text-gray-600 line-clamp-2">{r.summary}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_TONE[r.status] ?? 'bg-gray-100 text-gray-700'}`}>
                    {STATUS_LABEL[r.status] ?? r.status}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
                  <span>Reviewer: {r.reviewerName || 'not assigned'}</span>
                  <span>Customers enabled: {r.enabledOrgs}</span>
                  <span>Documents: {r.documents}</span>
                  {r.decidedAt && <span>Decided {new Date(r.decidedAt).toLocaleDateString()}</span>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
}

'use client';
export const dynamic = 'force-dynamic';

/**
 * Activation funnel for orgs created in the last 90 days. Tenant health only
 * catches usage *drops*; this catches orgs that never got going at all.
 */
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import Link from 'next/link';

const STALL_LABELS: Record<string, string> = {
  STALLED_NO_POSITION: 'No position',
  STALLED_NO_CANDIDATE: 'No candidates',
};

function Milestone({ at }: { at: string | null }) {
  if (!at) return <span className="text-gray-300">—</span>;
  const days = Math.max(0, Math.floor((Date.now() - new Date(at).getTime()) / 86400000));
  return (
    <span className="text-green-700">
      ✓ <span className="text-xs text-gray-500">{days === 0 ? 'today' : `${days}d`}</span>
    </span>
  );
}

export default function ActivationPage() {
  useAdminAuth();
  const funnel = (trpc as any).platformAdmin.getActivationFunnel.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const rows: any[] = funnel.data ?? [];
  const stalled = rows.filter((r) => r.stalls.length > 0);

  return (
    <AuthenticatedLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Activation</h1>
          <p className="text-sm text-gray-500">
            Orgs created in the last 90 days: first position, first candidate, first scoring run,
            first teammate invited. Stalled orgs also show in the alert inbox.
          </p>
        </div>

        {!funnel.isLoading && (
          <div className="flex gap-4">
            <div className="bg-white rounded-lg shadow px-4 py-3">
              <p className="text-2xl font-bold text-gray-900">{rows.length}</p>
              <p className="text-xs text-gray-500">Orgs (last 90d)</p>
            </div>
            <div className="bg-white rounded-lg shadow px-4 py-3">
              <p className="text-2xl font-bold text-amber-700">{stalled.length}</p>
              <p className="text-xs text-gray-500">Stalled</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Org</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Age</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Position</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Candidate</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Scoring run</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Teammate</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Stalls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {funnel.isLoading ? (
                <tr><td colSpan={7} className="px-4 py-6 text-sm text-gray-400">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-6 text-sm text-gray-400">No orgs created in the last 90 days.</td></tr>
              ) : (
                rows.map((org) => (
                  <tr key={org.organizationId} className={org.stalls.length > 0 ? 'bg-amber-50/40' : ''}>
                    <td className="px-4 py-2 text-sm font-medium text-gray-900">
                      <Link href={`/organizations/${org.organizationId}`} className="hover:text-purple-700">
                        {org.organizationName}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600">{org.ageDays}d</td>
                    <td className="px-4 py-2 text-sm"><Milestone at={org.firstPositionAt} /></td>
                    <td className="px-4 py-2 text-sm"><Milestone at={org.firstCandidateAt} /></td>
                    <td className="px-4 py-2 text-sm"><Milestone at={org.firstScoringRunAt} /></td>
                    <td className="px-4 py-2 text-sm"><Milestone at={org.firstTeammateAt} /></td>
                    <td className="px-4 py-2 text-sm space-x-1">
                      {org.stalls.map((s: string) => (
                        <span key={s} className="px-1.5 py-0.5 text-xs rounded bg-amber-100 text-amber-800">
                          {STALL_LABELS[s] ?? s}
                        </span>
                      ))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}

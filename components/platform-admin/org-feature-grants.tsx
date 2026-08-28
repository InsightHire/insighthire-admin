'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';

const CATEGORY_LABELS: Record<string, string> = {
  hiring_intelligence: 'Hiring',
  meetings: 'Meetings & scheduling',
  communication: 'Communication',
  ats: 'ATS',
};

type FeatureRow = {
  slug: string;
  name: string;
  description: string;
  category: string;
  caution: string | null;
  platformEnabled: boolean;
  granted: boolean;
  grantedAt: string | null;
  reason: 'GRANTED' | 'PLATFORM_OFF' | 'NOT_GRANTED';
  effective: boolean;
};

/**
 * Per-tenant feature grants on the org detail page.
 * Uses the same toggleOrgFeatureGrant mutation as Integrations → Tenant Access.
 */
export function OrgFeatureGrantsSection({ organizationId }: { organizationId: string }) {
  const [search, setSearch] = useState('');
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);
  const adminTrpc = trpc as any;

  const query = adminTrpc.platformAdmin.listOrganizationFeatureGrants.useQuery(
    { organizationId },
    { retry: false, staleTime: 15_000 }
  );

  const toggleMutation = adminTrpc.platformAdmin.toggleOrgFeatureGrant.useMutation({
    onSuccess: () => query.refetch(),
    onSettled: () => setPendingSlug(null),
  });

  const features: FeatureRow[] = (query.data?.features ?? []) as FeatureRow[];
  const grantedCount: number = (query.data?.grantedCount ?? 0) as number;
  const effectiveCount: number = (query.data?.effectiveCount ?? 0) as number;
  const totalCount: number = (query.data?.totalCount ?? 0) as number;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return features;
    return features.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.slug.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q)
    );
  }, [features, search]);

  const grouped = useMemo(() => {
    const byCategory = new Map<string, FeatureRow[]>();
    for (const row of filtered) {
      const list = byCategory.get(row.category) ?? [];
      list.push(row);
      byCategory.set(row.category, list);
    }
    return [...byCategory.entries()];
  }, [filtered]);

  function onToggle(row: FeatureRow) {
    setPendingSlug(row.slug);
    toggleMutation.mutate({
      organizationId,
      slug: row.slug,
      granted: !row.granted,
    });
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Enabled features</h2>
          <p className="text-sm text-gray-500 mt-1">
            Grant CRM, Approvals, pipelines, and the rest for this tenant. The org still
            needs the platform switch on in{' '}
            <Link href="/integrations" className="text-blue-600 hover:text-blue-700 font-medium">
              Integrations
            </Link>{' '}
            before a grant is live.
          </p>
        </div>
        {totalCount > 0 && (
          <p className="text-xs text-gray-500 whitespace-nowrap">
            <span className="font-semibold text-gray-700">{effectiveCount}</span> live ·{' '}
            <span className="font-semibold text-gray-700">{grantedCount}</span> granted ·{' '}
            {totalCount} total
          </p>
        )}
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search features (CRM, approvals, offers…)"
        className="mt-3 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
      />

      {query.isLoading ? (
        <p className="py-8 text-center text-sm text-gray-500">Loading features…</p>
      ) : query.error ? (
        <p className="py-8 text-center text-sm text-red-600">
          Failed to load features.{' '}
          {String((query.error as { message?: string })?.message ?? '')}
        </p>
      ) : grouped.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">
          {search ? 'No features match your search.' : 'No grantable features found.'}
        </p>
      ) : (
        <div className="mt-4 space-y-5">
          {grouped.map(([category, rows]) => (
            <div key={category}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                {CATEGORY_LABELS[category] || category}
              </h3>
              <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
                {rows.map((row) => {
                  const pending = pendingSlug === row.slug && toggleMutation.isPending;
                  return (
                    <div
                      key={row.slug}
                      className="flex items-start justify-between gap-3 px-4 py-3 bg-white hover:bg-gray-50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">{row.name}</span>
                          {row.effective ? (
                            <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                              Live
                            </span>
                          ) : row.granted ? (
                            <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                              Granted · platform off
                            </span>
                          ) : (
                            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                              Off
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{row.description}</p>
                        {row.caution && (
                          <p className="text-xs text-amber-800 mt-1">{row.caution}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => onToggle(row)}
                        disabled={pending}
                        className={`mt-0.5 relative inline-flex h-6 w-10 flex-shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                          row.granted ? 'bg-blue-600' : 'bg-gray-300'
                        }`}
                        title={row.granted ? 'Revoke for this tenant' : 'Grant for this tenant'}
                        aria-pressed={row.granted}
                        aria-label={`${row.granted ? 'Disable' : 'Enable'} ${row.name}`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                            row.granted ? 'translate-x-4' : ''
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

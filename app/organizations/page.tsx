'use client';
export const dynamic = 'force-dynamic';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Building2, Plus } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { PageHeader } from '@/components/admin/page-header';
import { FilterBar, FilterInput, FilterSelect } from '@/components/admin/filter-bar';
import { DataTable, DataTableEl, Td, Th } from '@/components/admin/data-table';
import { SeverityBadge } from '@/components/admin/severity-badge';
import { EmptyState } from '@/components/admin/empty-state';

function statusSeverity(status: string): 'ok' | 'warn' | 'critical' | 'muted' | 'info' {
  switch (status) {
    case 'ACTIVE':
      return 'ok';
    case 'TRIAL':
      return 'info';
    case 'PAST_DUE':
      return 'warn';
    case 'CANCELED':
    case 'EXPIRED':
      return 'critical';
    default:
      return 'muted';
  }
}

function OrganizationsPageInner() {
  const { isLoading: authLoading } = useAdminAuth();
  const searchParams = useSearchParams();
  const initialQ = searchParams.get('q') || '';
  const [search, setSearch] = useState(initialQ);
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);

  const { data, isLoading, error } = trpc.platformAdmin.listOrganizations.useQuery(
    {
      page: 1,
      limit: 100,
      search: search || undefined,
      status: (statusFilter as any) || undefined,
      plan: (planFilter as any) || undefined,
      includeArchived,
    },
    { enabled: !authLoading, context: { skipBatch: true } },
  );

  const orgs = useMemo(() => data?.organizations ?? [], [data]);

  if (authLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-admin-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
      <PageHeader
        eyebrow="Tenants"
        title="Organizations"
        description="Customer tenants — plan, status, and hiring volume at a glance."
        actions={
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-1.5 rounded-admin-sm bg-admin-ink px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            Add organization
          </Link>
        }
      />

      <FilterBar>
        <FilterInput
          label="Search"
          value={search}
          onChange={setSearch}
          placeholder="Name or domain…"
        />
        <FilterSelect
          label="Status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: '', label: 'All' },
            { value: 'TRIAL', label: 'Trial' },
            { value: 'ACTIVE', label: 'Active' },
            { value: 'PAST_DUE', label: 'Past due' },
            { value: 'CANCELED', label: 'Canceled' },
          ]}
        />
        <FilterSelect
          label="Plan"
          value={planFilter}
          onChange={setPlanFilter}
          options={[
            { value: '', label: 'All' },
            { value: 'TRIAL', label: 'Trial' },
            { value: 'STARTER', label: 'Starter' },
            { value: 'PROFESSIONAL', label: 'Professional' },
            { value: 'ENTERPRISE', label: 'Enterprise' },
          ]}
        />
        <label className="flex items-center gap-2 text-xs text-admin-muted">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
            className="rounded border-admin-border text-admin-accent focus:ring-admin-accent"
          />
          Show archived
        </label>
      </FilterBar>

      {isLoading ? (
        <div className="admin-panel py-16 text-center text-sm text-admin-muted">Loading…</div>
      ) : error ? (
        <div className="rounded-admin border border-admin-danger/30 bg-admin-danger-soft px-4 py-3 text-sm text-admin-danger">
          {error.message}
        </div>
      ) : orgs.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-8 w-8" />}
          title="No organizations"
          description="Try clearing filters or add a new organization."
        />
      ) : (
        <DataTable>
          <DataTableEl>
            <thead>
              <tr>
                <Th>Organization</Th>
                <Th>Plan</Th>
                <Th>Status</Th>
                <Th className="text-right">Users</Th>
                <Th className="text-right">Candidates</Th>
                <Th className="text-right">Completed</Th>
                <Th className="text-right">In progress</Th>
                <Th>Latest activity</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-border">
              {orgs.map((org: any) => (
                <tr key={org.id} className="hover:bg-slate-50/80">
                  <Td>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-admin-ink">{org.name || '(Incomplete)'}</span>
                      {org.deletedAt ? <SeverityBadge severity="muted">Archived</SeverityBadge> : null}
                    </div>
                    <div className="admin-mono text-[11px] text-admin-muted">{org.domain || org.id}</div>
                  </Td>
                  <Td>
                    <SeverityBadge severity="info">{org.subscriptionPlan}</SeverityBadge>
                  </Td>
                  <Td>
                    <SeverityBadge severity={statusSeverity(org.subscriptionStatus)}>
                      {org.subscriptionStatus}
                    </SeverityBadge>
                  </Td>
                  <Td className="text-right" mono>
                    {org._count?.users ?? '—'}
                  </Td>
                  <Td className="text-right" mono>
                    {org._count?.candidate_profiles ?? '—'}
                  </Td>
                  <Td className="text-right" mono>
                    {org.completedCandidates ?? '—'}
                  </Td>
                  <Td className="text-right" mono>
                    {org.inProgressCandidates ?? '—'}
                  </Td>
                  <Td className="text-xs text-admin-muted">
                    {org.latestActivity
                      ? new Date(org.latestActivity).toLocaleDateString()
                      : '—'}
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/attention?org=${org.id}`}
                        className="text-xs font-medium text-admin-muted hover:text-admin-ink"
                      >
                        Attention
                      </Link>
                      <Link
                        href={`/organizations/${org.id}`}
                        className="text-xs font-semibold text-admin-accent-ink hover:underline"
                      >
                        Open
                      </Link>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </DataTableEl>
        </DataTable>
      )}
    </div>
  );
}

export default function PlatformAdminOrganizationsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-admin-accent border-t-transparent" />
        </div>
      }
    >
      <OrganizationsPageInner />
    </Suspense>
  );
}

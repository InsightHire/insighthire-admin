'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Users } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AdminPageChrome } from '@/components/admin/page-chrome';
import { SectionCard } from '@/components/admin/section-card';
import { StatusPill, type StatusTone } from '@/components/admin/status-pill';
import { EmptyState } from '@/components/admin/empty-state';
import { DataTableEl, Th, Td } from '@/components/admin/data-table';

export default function OrganizationCandidatesPage() {
  const params = useParams();
  const { isLoading: authLoading } = useAdminAuth();
  const orgId = params.id as string;

  const { data, isLoading } = trpc.platformAdmin.getOrganizationCandidates.useQuery(
    { organizationId: orgId, limit: 100 },
    { enabled: !authLoading }
  );

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-admin-accent border-t-transparent"></div>
      </div>
    );
  }

  const candidates = data?.candidates || [];

  return (
    <AdminPageChrome
      icon={<Users />}
      breadcrumbs={[
        { label: 'Tenants', href: '/organizations' },
        { label: 'Organization', href: `/organizations/${orgId}` },
        { label: 'Candidates' },
      ]}
      title="Candidates"
      description={`${candidates.length} candidates`}
    >
      <SectionCard
        icon={<Users />}
        title="All candidates"
        description="Open a candidate to see their AI forensics"
        padded={false}
      >
        {candidates.length === 0 ? (
          <EmptyState
            compact
            className="border-0 shadow-none"
            icon={<Users />}
            title="No candidates found for this organization."
          />
        ) : (
          <div className="overflow-x-auto">
            <DataTableEl>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Email</Th>
                  <Th>Position</Th>
                  <Th>Status</Th>
                  <Th>Journey Progress</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((candidate: any) => {
                  const forensicsHref = candidate.positions?.id
                    ? `/organizations/${orgId}/positions/${candidate.positions.id}/candidates/${candidate.id}`
                    : `/candidate/${candidate.id}`;
                  return (
                    <tr key={candidate.id}>
                      <Td className="whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-admin-accent-border bg-admin-accent-soft text-xs font-semibold text-admin-accent-ink">
                            {(candidate.firstName?.[0] || '?').toUpperCase()}
                            {(candidate.lastName?.[0] || '').toUpperCase()}
                          </div>
                          <Link
                            href={forensicsHref}
                            className="font-medium text-admin-ink hover:text-admin-accent-ink"
                          >
                            {candidate.firstName} {candidate.lastName}
                          </Link>
                        </div>
                      </Td>
                      <Td className="whitespace-nowrap">{candidate.email}</Td>
                      <Td className="whitespace-nowrap">
                        {candidate.positions?.id ? (
                          <Link
                            href={`/organizations/${orgId}/positions/${candidate.positions.id}`}
                            className="text-admin-accent-ink hover:underline"
                          >
                            {candidate.positions.title}
                          </Link>
                        ) : (
                          '-'
                        )}
                      </Td>
                      <Td className="whitespace-nowrap">
                        <StatusPill tone={getStatusTone(candidate.status)}>{candidate.status || 'NEW'}</StatusPill>
                      </Td>
                      <Td className="whitespace-nowrap">
                        {candidate.journeyProgress !== undefined ? (
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-24 rounded-full bg-slate-100">
                              <div
                                className="h-1.5 rounded-full bg-admin-accent"
                                style={{ width: `${Math.min(100, candidate.journeyProgress || 0)}%` }}
                              />
                            </div>
                            <span className="text-xs tabular-nums text-admin-secondary">{candidate.journeyProgress || 0}%</span>
                          </div>
                        ) : (
                          <span className="text-admin-muted">-</span>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap">
                        <Link
                          href={forensicsHref}
                          className="font-medium text-admin-accent-ink hover:underline"
                        >
                          View AI forensics →
                        </Link>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTableEl>
          </div>
        )}
      </SectionCard>
    </AdminPageChrome>
  );
}

function getStatusTone(status: string | null): StatusTone {
  switch (status) {
    case 'NEW': return 'info';
    case 'SCREENING': return 'warn';
    case 'INTERVIEWING': return 'brand';
    case 'OFFER_PENDING': return 'warn';
    case 'HIRED': return 'success';
    case 'REJECTED': return 'danger';
    default: return 'neutral';
  }
}

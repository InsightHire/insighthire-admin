'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Briefcase } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AdminPageChrome } from '@/components/admin/page-chrome';
import { SectionCard } from '@/components/admin/section-card';
import { StatusPill, type StatusTone } from '@/components/admin/status-pill';
import { EmptyState } from '@/components/admin/empty-state';
import { DataTableEl, Th, Td } from '@/components/admin/data-table';
import { selectClass } from '@/components/admin/controls';

export default function OrganizationPositionsPage() {
  const params = useParams();
  const { isLoading: authLoading } = useAdminAuth();
  const orgId = params.id as string;
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  const { data, isLoading, error } = trpc.platformAdmin.getOrganizationPositions.useQuery({
    organizationId: orgId,
    limit: 100
  }, {
    enabled: !authLoading,
    retry: 1,
    onError: (err) => console.error('Positions query error:', err),

  });


  const { data: orgData } = trpc.platformAdmin.getOrganization.useQuery({ id: orgId }, {
    enabled: !authLoading,
  });

  // Filter positions by status if filter is set
  const filteredPositions = data?.positions?.filter((pos: any) => 
    !statusFilter || pos.status === statusFilter
  ) || [];

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-admin-accent border-t-transparent"></div>
      </div>
    );
  }

  return (
    <AdminPageChrome
      icon={<Briefcase />}
      breadcrumbs={[
        { label: 'Tenants', href: '/organizations' },
        { label: orgData?.organization?.name || 'Organization', href: `/organizations/${orgId}` },
        { label: 'Positions' },
      ]}
      title="Positions"
      description={orgData?.organization?.name || 'Organization'}
      actions={
        <select
          value={statusFilter || ''}
          onChange={(e) => setStatusFilter(e.target.value || undefined)}
          className={selectClass}
        >
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="OPEN">Open</option>
          <option value="ON_HOLD">On Hold</option>
          <option value="CLOSED">Closed</option>
          <option value="FILLED">Filled</option>
        </select>
      }
    >
      {error && (
        <div className="mb-6 rounded-admin border border-admin-danger/30 bg-admin-danger-soft p-4">
          <p className="font-medium text-red-800">Error loading positions</p>
          <p className="text-sm text-admin-danger">{error.message}</p>
        </div>
      )}
      <SectionCard
        icon={<Briefcase />}
        title={`Positions (${filteredPositions.length})`}
        description="Click a row to open the position"
        padded={false}
      >
        {filteredPositions.length > 0 ? (
          <div className="overflow-x-auto">
            <DataTableEl>
              <thead>
                <tr>
                  <Th>Position</Th>
                  <Th>Department</Th>
                  <Th>Location</Th>
                  <Th>Status</Th>
                  <Th>Hiring Progress</Th>
                  <Th>Applications</Th>
                  <Th>Created</Th>
                </tr>
              </thead>
              <tbody>
                {filteredPositions.map((position: any) => (
                  <tr
                    key={position.id}
                    className="cursor-pointer"
                    onClick={() => {
                      window.location.href = `/organizations/${orgId}/positions/${position.id}`;
                    }}
                  >
                    <Td>
                      <div className="flex items-center gap-3">
                        <Briefcase className="h-4 w-4 text-admin-muted" />
                        <div>
                          <Link
                            href={`/organizations/${orgId}/positions/${position.id}`}
                            className="font-medium text-admin-ink hover:text-admin-accent-ink hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {position.title}
                          </Link>
                          <div className="admin-mono text-[11px] text-admin-muted">{position.id.slice(0, 8)}...</div>
                        </div>
                      </div>
                    </Td>
                    <Td>{position.department || '—'}</Td>
                    <Td>{position.location || '—'}</Td>
                    <Td>
                      <StatusPill tone={getStatusTone(position.status)}>{position.status}</StatusPill>
                    </Td>
                    <Td>
                      {position.targetHires ? (
                        <div>
                          <div className="text-sm font-medium tabular-nums text-admin-ink">
                            {position.currentHires || 0} / {position.targetHires}
                          </div>
                          <div className="mt-1 h-1.5 w-24 rounded-full bg-slate-100">
                            <div 
                              className="h-1.5 rounded-full bg-admin-accent" 
                              style={{ 
                                width: `${Math.min(100, ((position.currentHires || 0) / position.targetHires) * 100)}%` 
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-admin-muted">—</span>
                      )}
                    </Td>
                    <Td>
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <div className="text-base font-semibold tabular-nums text-admin-ink">{position._count?.applications || 0}</div>
                          <div className="text-[11px] text-admin-muted">Apps</div>
                        </div>
                        <div className="text-center">
                          <div className="text-base font-semibold tabular-nums text-admin-accent-ink">{position._count?.candidate_profiles || 0}</div>
                          <div className="text-[11px] text-admin-muted">Candidates</div>
                        </div>
                      </div>
                    </Td>
                    <Td className="text-admin-muted">
                      {new Date(position.createdAt).toLocaleDateString()}
                      {position.closedAt && (
                        <div className="text-xs text-admin-danger">
                          Closed: {new Date(position.closedAt).toLocaleDateString()}
                        </div>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </DataTableEl>
          </div>
        ) : (
          <EmptyState
            compact
            className="border-0 shadow-none"
            icon={<Briefcase />}
            title="No Positions Found"
            description={statusFilter 
              ? `No positions with status "${statusFilter}" found for this organization.`
              : 'This organization has not created any positions yet.'}
          />
        )}
      </SectionCard>
    </AdminPageChrome>
  );
}

function getStatusTone(status: string): StatusTone {
  switch (status) {
    case 'OPEN': return 'success';
    case 'DRAFT': return 'neutral';
    case 'ON_HOLD': return 'warn';
    case 'CLOSED': return 'danger';
    case 'FILLED': return 'info';
    default: return 'neutral';
  }
}

'use client';
export const dynamic = 'force-dynamic';

/**
 * Activation funnel for orgs created in the last 90 days. Tenant health only
 * catches usage *drops*; this catches orgs that never got going at all.
 */
import { AlertTriangle, Building2, Rocket, Sprout } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import Link from 'next/link';
import { AdminPageChrome } from '@/components/admin/page-chrome';
import { SectionCard } from '@/components/admin/section-card';
import { StatGrid, StatTile } from '@/components/admin/stat-tile';
import { StatusPill } from '@/components/admin/status-pill';
import { EmptyState } from '@/components/admin/empty-state';
import { DataTableEl, Th, Td } from '@/components/admin/data-table';

const STALL_LABELS: Record<string, string> = {
  STALLED_NO_POSITION: 'No position',
  STALLED_NO_CANDIDATE: 'No candidates',
};

function Milestone({ at }: { at: string | null }) {
  if (!at) return <span className="text-slate-300">—</span>;
  const days = Math.max(0, Math.floor((Date.now() - new Date(at).getTime()) / 86400000));
  return (
    <span className="text-admin-ok">
      ✓ <span className="text-xs text-admin-muted">{days === 0 ? 'today' : `${days}d`}</span>
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
      <AdminPageChrome
        icon={<Rocket />}
        breadcrumbs={[{ label: 'Tenants', href: '/organizations' }, { label: 'Activation' }]}
        title="Activation"
        description={
          <>
            Orgs created in the last 90 days: first position, first candidate, first scoring run,
            first teammate invited. Stalled orgs also show in the alert inbox.
          </>
        }
      >
        <div className="space-y-6">
          <StatGrid cols={2} className="max-w-xl">
            <StatTile label="Orgs (last 90d)" icon={Building2} tone="brand" loading={funnel.isLoading} value={rows.length} />
            <StatTile
              label="Stalled"
              icon={AlertTriangle}
              tone={stalled.length > 0 ? 'warn' : 'muted'}
              loading={funnel.isLoading}
              value={stalled.length}
            />
          </StatGrid>

          <SectionCard
            icon={<Sprout />}
            title="New orgs"
            description="Days since each milestone was first reached"
            padded={false}
          >
            {funnel.isLoading ? (
              <p className="px-5 py-6 text-sm text-admin-muted">Loading…</p>
            ) : rows.length === 0 ? (
              <EmptyState compact className="border-0 shadow-none" icon={<Building2 />} title="No orgs created in the last 90 days." />
            ) : (
              <div className="overflow-x-auto">
                <DataTableEl>
                  <thead>
                    <tr>
                      <Th>Org</Th>
                      <Th>Age</Th>
                      <Th>Position</Th>
                      <Th>Candidate</Th>
                      <Th>Scoring run</Th>
                      <Th>Teammate</Th>
                      <Th>Stalls</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((org) => (
                      <tr key={org.organizationId} className={org.stalls.length > 0 ? 'bg-admin-warn-soft/40' : ''}>
                        <Td className="font-medium text-admin-ink">
                          <Link href={`/organizations/${org.organizationId}`} className="hover:text-admin-accent-ink">
                            {org.organizationName}
                          </Link>
                        </Td>
                        <Td className="tabular-nums">{org.ageDays}d</Td>
                        <Td><Milestone at={org.firstPositionAt} /></Td>
                        <Td><Milestone at={org.firstCandidateAt} /></Td>
                        <Td><Milestone at={org.firstScoringRunAt} /></Td>
                        <Td><Milestone at={org.firstTeammateAt} /></Td>
                        <Td>
                          <span className="flex flex-wrap gap-1">
                            {org.stalls.map((s: string) => (
                              <StatusPill key={s} tone="warn">
                                {STALL_LABELS[s] ?? s}
                              </StatusPill>
                            ))}
                          </span>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </DataTableEl>
              </div>
            )}
          </SectionCard>
        </div>
      </AdminPageChrome>
    </AuthenticatedLayout>
  );
}

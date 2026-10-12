'use client';
export const dynamic = 'force-dynamic';

/**
 * Impersonation audit trail — who impersonated whom, when, and from where.
 * Sourced from admin_audit_logs (impersonate_user / impersonate_organization).
 * Actions taken during an impersonated session appear in the org timeline.
 */
import { useState } from 'react';
import Link from 'next/link';
import { History, UserCog } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { AdminPageChrome } from '@/components/admin/page-chrome';
import { SectionCard } from '@/components/admin/section-card';
import { StatusPill } from '@/components/admin/status-pill';
import { EmptyState } from '@/components/admin/empty-state';
import { Segmented } from '@/components/admin/segmented';

const DAY_OPTIONS = [7, 30, 90] as const;

export default function ImpersonationPage() {
  useAdminAuth();
  const [days, setDays] = useState<number>(30);

  const list = (trpc as any).platformAdmin.listImpersonationEvents.useQuery(
    { days },
    { refetchOnWindowFocus: false },
  );
  const events: any[] = list.data ?? [];

  return (
    <AuthenticatedLayout>
      <AdminPageChrome
        width="narrow"
        icon={<UserCog />}
        breadcrumbs={[{ label: 'System' }, { label: 'Impersonation' }]}
        title="Impersonation"
        description={
          <>
            Every impersonation session started by a platform admin. Actions during the
            session are recorded in the organization&apos;s timeline.
          </>
        }
        actions={
          <Segmented
            size="sm"
            ariaLabel="Period"
            options={DAY_OPTIONS.map((d) => ({ value: d as number, label: `${d}d` }))}
            value={days}
            onChange={setDays}
          />
        }
      >
        <SectionCard
          icon={<History />}
          title="Sessions"
          description={`Last ${days} days`}
          padded={false}
        >
          {list.isLoading ? (
            <p className="px-5 py-6 text-sm text-admin-muted">Loading…</p>
          ) : events.length === 0 ? (
            <EmptyState
              compact
              className="border-0 shadow-none"
              icon={<UserCog />}
              title={`No impersonation sessions in the last ${days} days.`}
            />
          ) : (
            <ul className="divide-y divide-admin-border">
              {events.map((e) => {
                const meta = (e.metadata ?? {}) as Record<string, unknown>;
                const targetEmail = typeof meta.userEmail === 'string' ? meta.userEmail : null;
                return (
                  <li key={e.id} className="flex flex-wrap items-start gap-3 px-5 py-3 transition-colors hover:bg-admin-bg/70">
                    <StatusPill tone={e.action === 'impersonate_user' ? 'brand' : 'info'} dot={false} className="shrink-0">
                      {e.action === 'impersonate_user' ? 'user' : 'organization'}
                    </StatusPill>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-admin-ink">
                        {e.adminName || e.adminEmail || e.adminId}
                        <span className="font-normal text-admin-muted"> impersonated </span>
                        {targetEmail ?? e.targetUserId ?? 'organization'}
                        {e.orgName && (
                          <>
                            <span className="font-normal text-admin-muted"> at </span>
                            {e.orgId ? (
                              <Link href={`/organizations/${e.orgId}`} className="text-admin-accent-ink hover:underline">
                                {e.orgName}
                              </Link>
                            ) : (
                              e.orgName
                            )}
                          </>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-admin-muted">
                        {new Date(e.at).toLocaleString()}
                        {e.ipAddress ? <span className="ml-2 font-mono">{e.ipAddress}</span> : null}
                        {typeof meta.userRole === 'string' ? <span className="ml-2">role: {meta.userRole}</span> : null}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      </AdminPageChrome>
    </AuthenticatedLayout>
  );
}

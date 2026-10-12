'use client';
export const dynamic = 'force-dynamic';

/**
 * Legal review (owner, 2026-10-11). Features that move money in legally
 * sensitive ways stay demo-only until counsel signs off here: a feature must
 * be Approved and each customer org enabled by staff. Demo tenants always
 * have them.
 */
import Link from 'next/link';
import { Building2, ChevronRight, FileText, RefreshCw, ShieldCheck, UserCheck } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { AdminPageChrome } from '@/components/admin/page-chrome';
import { StatusPill, type StatusTone } from '@/components/admin/status-pill';
import { EmptyState } from '@/components/admin/empty-state';
import { buttonClass } from '@/components/admin/controls';
import { STATUS_LABEL } from './status';

const STATUS_PILL: Record<string, StatusTone> = {
  NEEDS_REVIEW: 'warn',
  IN_REVIEW: 'info',
  APPROVED: 'success',
  REJECTED: 'danger',
};

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
      <AdminPageChrome
        icon={<ShieldCheck />}
        breadcrumbs={[{ label: 'Tenants', href: '/organizations' }, { label: 'Legal review' }]}
        title="Legal review"
        description={
          <>
            These features are live in the demo only. A real customer can use one when its review is <strong>Approved</strong>{' '}
            and staff have enabled that customer. Each review lists the legal questions, the risks, the structure we recommend and
            questions to ask counsel.
          </>
        }
        actions={
          <button onClick={() => sync.mutate()} disabled={sync.isLoading} className={buttonClass.secondary}>
            <RefreshCw className={`h-4 w-4 ${sync.isLoading ? 'animate-spin' : ''}`} />
            {sync.isLoading ? 'Syncing…' : 'Re-sync VMS'}
          </button>
        }
      >
        {list.isLoading ? (
          <p className="text-sm text-admin-muted">Loading…</p>
        ) : list.error ? (
          <p className="text-sm text-admin-danger">{list.error.message}</p>
        ) : rows.length === 0 ? (
          <EmptyState icon={<ShieldCheck />} title="No features under legal review." />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {rows.map((r) => (
              <Link
                key={r.key}
                href={`/legal-review/${encodeURIComponent(r.key)}`}
                className="admin-panel admin-panel-hover group flex flex-col p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <h2 className="font-semibold text-admin-ink group-hover:text-admin-accent-ink">{r.title}</h2>
                    <p className="font-mono text-xs text-admin-muted">{r.key}</p>
                  </div>
                  <StatusPill tone={STATUS_PILL[r.status] ?? 'neutral'} className="shrink-0">
                    {STATUS_LABEL[r.status] ?? r.status}
                  </StatusPill>
                </div>
                <p className="mt-2 line-clamp-2 flex-1 text-sm text-admin-secondary">{r.summary}</p>
                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-admin-border pt-3 text-xs text-admin-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <UserCheck className="h-3.5 w-3.5" />
                    Reviewer: {r.reviewerName || 'not assigned'}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" />
                    Customers enabled: {r.enabledOrgs}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" />
                    Documents: {r.documents}
                  </span>
                  {r.decidedAt && <span>Decided {new Date(r.decidedAt).toLocaleDateString()}</span>}
                  <ChevronRight className="ml-auto h-4 w-4 text-admin-muted transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </AdminPageChrome>
    </AuthenticatedLayout>
  );
}

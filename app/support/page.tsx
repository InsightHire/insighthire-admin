'use client';
export const dynamic = 'force-dynamic';

/**
 * Support queue: requests filed from the agency portal (each one is also
 * emailed to support@insighthire.com). Changing status stamps the first
 * response and resolution times measured against the support targets.
 */
import { useState } from 'react';
import { CheckCircle2, LifeBuoy } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { AdminPageChrome } from '@/components/admin/page-chrome';
import { SectionCard } from '@/components/admin/section-card';
import { StatusPill, type StatusTone } from '@/components/admin/status-pill';
import { EmptyState } from '@/components/admin/empty-state';
import { StatGrid, StatTile } from '@/components/admin/stat-tile';
import { buttonClass, checkboxClass, inputClass, selectClass } from '@/components/admin/controls';

const STATUSES = ['open', 'in_progress', 'waiting_on_customer', 'resolved'] as const;
const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  in_progress: 'In progress',
  waiting_on_customer: 'Waiting on customer',
  resolved: 'Resolved',
};
const STATUS_TONE: Record<string, StatusTone> = { open: 'warn', in_progress: 'info', waiting_on_customer: 'neutral', resolved: 'success' };
const SEVERITY_TONE: Record<string, StatusTone> = { sev1: 'danger', sev2: 'warn', sev3: 'info', sev4: 'neutral' };

type Request = {
  id: string;
  subject: string;
  message: string;
  category: string;
  severity: string;
  tier: string;
  status: string;
  requesterName: string | null;
  requesterEmail: string;
  agencyName: string | null;
  clientName: string | null;
  pageUrl: string | null;
  staffNote: string | null;
  firstResponseDueAt: string;
  firstRespondedAt: string | null;
  resolutionDueAt: string;
  resolvedAt: string | null;
  createdAt: string;
};

function RequestRow({ r, onDone }: { r: Request; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(r.staffNote ?? '');
  const update = (trpc as any).platformTrust.updateSupportRequest.useMutation({ onSuccess: onDone, onError: (e: { message: string }) => alert(e.message) });
  const overdue = !r.firstRespondedAt && new Date(r.firstResponseDueAt) < new Date() && r.status !== 'resolved';
  return (
    <div className="px-5 py-3.5">
      <button type="button" className="flex w-full items-start gap-3 text-left" onClick={() => setOpen((o) => !o)}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={SEVERITY_TONE[r.severity] ?? 'neutral'}>{r.severity}</StatusPill>
            <StatusPill tone={STATUS_TONE[r.status] ?? 'neutral'} dot={false}>
              {STATUS_LABEL[r.status] ?? r.status}
            </StatusPill>
            {overdue && <StatusPill tone="danger">Response overdue</StatusPill>}
            <p className="text-sm font-medium text-admin-ink">{r.subject}</p>
          </div>
          <p className="mt-1 text-xs text-admin-muted">
            {r.requesterName || r.requesterEmail}
            {r.agencyName && ` · ${r.agencyName}`}
            {r.clientName && ` → ${r.clientName}`} · {r.category} · {r.tier} · filed {new Date(r.createdAt).toLocaleString()} · respond by{' '}
            {new Date(r.firstResponseDueAt).toLocaleString()}
          </p>
        </div>
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <p className="whitespace-pre-wrap rounded-admin-sm bg-admin-bg p-3 text-sm text-admin-secondary">{r.message}</p>
          <p className="text-xs text-admin-muted">
            Reply to <a className="text-admin-accent hover:underline" href={`mailto:${r.requesterEmail}?subject=${encodeURIComponent(`Re: ${r.subject}`)}`}>{r.requesterEmail}</a>
            {r.pageUrl && <> · filed from {r.pageUrl}</>}
            {r.firstRespondedAt && <> · first response {new Date(r.firstRespondedAt).toLocaleString()}</>}
            {r.resolvedAt && <> · resolved {new Date(r.resolvedAt).toLocaleString()}</>}
          </p>
          <textarea className={`${inputClass} h-20`} placeholder="Staff note (internal)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                className={s === r.status ? buttonClass.primary : buttonClass.small}
                disabled={update.isLoading}
                onClick={() => update.mutate({ id: r.id, status: s, staffNote: note || null })}
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SupportQueuePage() {
  useAdminAuth();
  const [status, setStatus] = useState<string>('');
  const [includeDemo, setIncludeDemo] = useState(false);
  const q = (trpc as any).platformTrust.supportRequests.useQuery(
    { ...(status ? { status } : {}), includeDemo },
    { refetchOnWindowFocus: false },
  );
  const rows: Request[] = q.data?.requests ?? [];
  const stats = q.data?.stats90d;

  return (
    <AuthenticatedLayout>
      <AdminPageChrome
        icon={<LifeBuoy />}
        breadcrumbs={[{ label: 'Operations' }, { label: 'Support requests' }]}
        title="Support requests"
        description="Filed from the agency portal's Report an issue page. Each one is also emailed to support@insighthire.com."
      >
        <div className="space-y-6">
          {stats && (
            <StatGrid>
              <StatTile label="Requests (90 days)" value={stats.total} />
              <StatTile label="First response on time" value={stats.respondedOnTimePct == null ? '—' : `${stats.respondedOnTimePct}%`} />
              <StatTile label="Resolved on time" value={stats.resolvedOnTimePct == null ? '—' : `${stats.resolvedOnTimePct}%`} />
              <StatTile label="Response overdue" value={stats.overdueResponse} />
            </StatGrid>
          )}
          <SectionCard
            icon={<LifeBuoy />}
            title="Queue"
            padded={false}
            actions={
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-1.5 text-xs text-admin-muted">
                  <input type="checkbox" className={checkboxClass} checked={includeDemo} onChange={(e) => setIncludeDemo(e.target.checked)} />
                  Include demo
                </label>
                <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="">All statuses</option>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </div>
            }
          >
            {q.isLoading ? (
              <p className="px-5 py-6 text-sm text-admin-muted">Loading…</p>
            ) : q.error ? (
              <p className="px-5 py-6 text-sm text-admin-danger">{q.error.message}</p>
            ) : rows.length === 0 ? (
              <EmptyState compact className="border-0 shadow-none" icon={<CheckCircle2 />} title="No support requests." />
            ) : (
              <div className="divide-y divide-admin-border">
                {rows.map((r) => (
                  <RequestRow key={r.id} r={r} onDone={() => q.refetch()} />
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </AdminPageChrome>
    </AuthenticatedLayout>
  );
}

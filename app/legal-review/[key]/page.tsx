'use client';
export const dynamic = 'force-dynamic';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BookOpen, ClipboardCheck, History, ShieldCheck } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { AdminPage, AdminPageChrome } from '@/components/admin/page-chrome';
import { SectionCard } from '@/components/admin/section-card';
import { StatusPill, type StatusTone } from '@/components/admin/status-pill';
import { EmptyState } from '@/components/admin/empty-state';
import { buttonClass, inputClass, selectClass } from '@/components/admin/controls';
import { EVENT_LABEL, STATUSES, STATUS_LABEL } from '../status';
import { Documents } from '../_components/documents';
import { Customers } from '../_components/customers';
import { FeatureSettings } from '../_components/feature-settings';

const STATUS_PILL: Record<string, StatusTone> = {
  NEEDS_REVIEW: 'warn',
  IN_REVIEW: 'info',
  APPROVED: 'success',
  REJECTED: 'danger',
};

const lines = (v: string) => v.split('\n').map((s) => s.trim()).filter(Boolean);

function List({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 text-sm text-admin-secondary marker:text-admin-muted">
      {items.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ul>
  );
}

export default function LegalReviewDetailPage() {
  useAdminAuth();
  const { key: rawKey } = useParams<{ key: string }>();
  const key = decodeURIComponent(rawKey);
  const q = (trpc as any).platformAdmin.legalReviewGet.useQuery({ key }, { refetchOnWindowFocus: false });
  const f = q.data?.feature;

  const [status, setStatus] = useState('NEEDS_REVIEW');
  const [reviewerName, setReviewerName] = useState('');
  const [reviewerEmail, setReviewerEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [decisionNote, setDecisionNote] = useState('');
  const [editBrief, setEditBrief] = useState(false);
  const [brief, setBrief] = useState({ summary: '', recommendedStructure: '', legalQuestions: '', risks: '', counselQuestions: '' });

  useEffect(() => {
    if (!f) return;
    setStatus(f.status);
    setReviewerName(f.reviewerName ?? '');
    setReviewerEmail(f.reviewerEmail ?? '');
    setNotes(f.notes ?? '');
    setBrief({
      summary: f.summary,
      recommendedStructure: f.recommendedStructure,
      legalQuestions: (f.legalQuestions as string[]).join('\n'),
      risks: (f.risks as string[]).join('\n'),
      counselQuestions: (f.counselQuestions as string[]).join('\n'),
    });
  }, [f]);

  const update = (trpc as any).platformAdmin.legalReviewUpdate.useMutation({
    onSuccess: (r: { syncError: string | null }) => {
      setDecisionNote('');
      setEditBrief(false);
      q.refetch();
      if (r.syncError) alert(`Saved, but the VMS did not get the change: ${r.syncError}. Use "Re-sync VMS" on the Legal review page.`);
    },
    onError: (e: { message: string }) => alert('Save failed: ' + e.message),
  });

  if (q.isLoading || !f) {
    return (
      <AuthenticatedLayout>
        <AdminPage>
          <p className={`text-sm ${q.error ? 'text-admin-danger' : 'text-admin-muted'}`}>{q.error ? q.error.message : 'Loading…'}</p>
        </AdminPage>
      </AuthenticatedLayout>
    );
  }

  const saveDecision = () =>
    update.mutate({ key, status, reviewerName: reviewerName || null, reviewerEmail: reviewerEmail || null, notes: notes || null, decisionNote: decisionNote || undefined });
  const saveBrief = () =>
    update.mutate({
      key,
      summary: brief.summary,
      recommendedStructure: brief.recommendedStructure,
      legalQuestions: lines(brief.legalQuestions),
      risks: lines(brief.risks),
      counselQuestions: lines(brief.counselQuestions),
    });

  return (
    <AuthenticatedLayout>
      <AdminPageChrome
        icon={<ShieldCheck />}
        breadcrumbs={[{ label: 'Tenants', href: '/organizations' }, { label: 'Legal review', href: '/legal-review' }, { label: f.key }]}
        title={f.title}
        meta={
          <>
            <StatusPill tone={STATUS_PILL[f.status] ?? 'neutral'}>{STATUS_LABEL[f.status] ?? f.status}</StatusPill>
            <span className="font-mono text-xs text-admin-muted">{f.key}</span>
          </>
        }
        description={
          q.data.effectiveForCustomers
            ? 'Approved: customers enabled below can use it.'
            : 'Not approved: only demo tenants can use it. Enabling a customer below takes effect once this is approved.'
        }
      >
        <div className="grid items-start gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <SectionCard
              icon={<BookOpen />}
              title="Brief for counsel"
              actions={
                <button onClick={() => setEditBrief(!editBrief)} className={buttonClass.small}>
                  {editBrief ? 'Cancel' : 'Edit'}
                </button>
              }
            >
              {editBrief ? (
                <div className="space-y-4 text-sm">
                  {(
                    [
                      ['summary', 'Summary', 4],
                      ['legalQuestions', 'Legal questions (one per line)', 8],
                      ['risks', 'Risks (one per line)', 6],
                      ['recommendedStructure', 'Recommended structure', 6],
                      ['counselQuestions', 'Questions for counsel (one per line)', 8],
                    ] as const
                  ).map(([field, label, rows]) => (
                    <label key={field} className="block">
                      <span className="mb-1 block text-admin-secondary">{label}</span>
                      <textarea value={brief[field]} onChange={(e) => setBrief({ ...brief, [field]: e.target.value })} rows={rows} className={inputClass} />
                    </label>
                  ))}
                  <button onClick={saveBrief} disabled={update.isLoading} className={buttonClass.primary}>
                    Save brief
                  </button>
                </div>
              ) : (
                <div className="space-y-5">
                  <p className="text-sm text-admin-secondary">{f.summary}</p>
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-admin-ink">Legal questions</h3>
                    <List items={f.legalQuestions as string[]} />
                  </div>
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-admin-ink">Risks</h3>
                    <List items={f.risks as string[]} />
                  </div>
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-admin-ink">Recommended structure</h3>
                    <p className="whitespace-pre-line text-sm text-admin-secondary">{f.recommendedStructure}</p>
                  </div>
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-admin-ink">Questions to ask counsel</h3>
                    <List items={f.counselQuestions as string[]} />
                  </div>
                </div>
              )}
            </SectionCard>

            <Documents featureKey={key} documents={q.data.documents} onChange={() => q.refetch()} />
            <Customers featureKey={key} approved={q.data.effectiveForCustomers} enablements={q.data.enablements} demoOrgs={q.data.demoOrgs} onChange={() => q.refetch()} />
            <FeatureSettings featureKey={key} demoOrgs={q.data.demoOrgs} />
          </div>

          <div className="space-y-6">
            <SectionCard
              icon={<ClipboardCheck />}
              title="Review status"
              footer="Approving, rejecting or withdrawing an approval needs a super admin."
            >
              <div className="space-y-4">
                <label className="block text-sm">
                  <span className="mb-1 block text-admin-secondary">Status</span>
                  <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${selectClass} w-full`}>
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-admin-secondary">Reviewer (counsel)</span>
                  <input value={reviewerName} onChange={(e) => setReviewerName(e.target.value)} className={inputClass} placeholder="Name, firm" />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-admin-secondary">Reviewer email</span>
                  <input value={reviewerEmail} onChange={(e) => setReviewerEmail(e.target.value)} className={inputClass} type="email" />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-admin-secondary">Notes</span>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={5} className={inputClass} />
                </label>
                {status !== f.status && (
                  <label className="block text-sm">
                    <span className="mb-1 block text-admin-secondary">Why (saved in the decision history)</span>
                    <input value={decisionNote} onChange={(e) => setDecisionNote(e.target.value)} className={inputClass} placeholder="e.g. Counsel memo of 2026-11-02 attached" />
                  </label>
                )}
                <button onClick={saveDecision} disabled={update.isLoading} className={buttonClass.primary}>
                  {update.isLoading ? 'Saving…' : 'Save'}
                </button>
              </div>
            </SectionCard>

            <SectionCard icon={<History />} title="Decision history" padded={false}>
              {q.data.events.length === 0 ? (
                <EmptyState compact className="border-0 shadow-none" icon={<History />} title="No changes yet." />
              ) : (
                <ul className="divide-y divide-admin-border text-sm">
                  {q.data.events.map((e: any) => (
                    <li key={e.id} className="px-5 py-3">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-medium text-admin-ink">{EVENT_LABEL[e.action] ?? e.action}</span>
                        {e.fromStatus && e.toStatus && (
                          <span className="text-admin-secondary">
                            {STATUS_LABEL[e.fromStatus] ?? e.fromStatus} → {STATUS_LABEL[e.toStatus] ?? e.toStatus}
                          </span>
                        )}
                        {e.organizationName && <span className="text-admin-secondary">{e.organizationName}</span>}
                        {e.metadata?.filename && <span className="text-admin-secondary">{e.metadata.filename}</span>}
                        {e.metadata?.fields && <span className="text-admin-muted">({(e.metadata.fields as string[]).join(', ')})</span>}
                      </div>
                      <p className="mt-0.5 text-xs text-admin-muted">
                        {e.actorEmail ?? e.actorId} · {new Date(e.createdAt).toLocaleString()}
                      </p>
                      {e.note && e.action !== 'details_updated' && <p className="mt-0.5 text-admin-secondary">{e.note}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>
        </div>
      </AdminPageChrome>
    </AuthenticatedLayout>
  );
}

'use client';
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { EVENT_LABEL, STATUSES, STATUS_LABEL, STATUS_TONE } from '../status';
import { Documents } from '../_components/documents';
import { Customers } from '../_components/customers';
import { FeatureSettings } from '../_components/feature-settings';

const lines = (v: string) => v.split('\n').map((s) => s.trim()).filter(Boolean);

function List({ items }: { items: string[] }) {
  return (
    <ul className="list-disc pl-5 space-y-1.5 text-sm text-gray-700">
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
        <div className="max-w-6xl mx-auto px-4 py-8 text-sm text-gray-500">{q.error ? q.error.message : 'Loading…'}</div>
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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <Link href="/legal-review" className="text-sm text-blue-600 hover:text-blue-700">
            ← Legal review
          </Link>
          <div className="mt-2 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{f.title}</h1>
              <p className="text-xs font-mono text-gray-400">{f.key}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-sm font-medium ${STATUS_TONE[f.status] ?? ''}`}>{STATUS_LABEL[f.status] ?? f.status}</span>
          </div>
          <p className="mt-2 text-sm text-gray-600">
            {q.data.effectiveForCustomers
              ? 'Approved: customers enabled below can use it.'
              : 'Not approved: only demo tenants can use it. Enabling a customer below takes effect once this is approved.'}
          </p>
        </div>

        <section className="bg-white rounded-lg shadow p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Review status</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Status</span>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2">
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Reviewer (counsel)</span>
              <input value={reviewerName} onChange={(e) => setReviewerName(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="Name, firm" />
            </label>
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Reviewer email</span>
              <input value={reviewerEmail} onChange={(e) => setReviewerEmail(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2" type="email" />
            </label>
          </div>
          <label className="block text-sm">
            <span className="block text-gray-600 mb-1">Notes</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={5} className="w-full rounded-lg border border-gray-300 px-3 py-2" />
          </label>
          {status !== f.status && (
            <label className="block text-sm">
              <span className="block text-gray-600 mb-1">Why (saved in the decision history)</span>
              <input value={decisionNote} onChange={(e) => setDecisionNote(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="e.g. Counsel memo of 2026-11-02 attached" />
            </label>
          )}
          <div className="flex items-center gap-3">
            <button onClick={saveDecision} disabled={update.isLoading} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {update.isLoading ? 'Saving…' : 'Save'}
            </button>
            <span className="text-xs text-gray-500">Approving, rejecting or withdrawing an approval needs a super admin.</span>
          </div>
        </section>

        <section className="bg-white rounded-lg shadow p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Brief for counsel</h2>
            <button onClick={() => setEditBrief(!editBrief)} className="text-sm text-blue-600 hover:text-blue-700">
              {editBrief ? 'Cancel' : 'Edit'}
            </button>
          </div>
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
                  <span className="block text-gray-600 mb-1">{label}</span>
                  <textarea value={brief[field]} onChange={(e) => setBrief({ ...brief, [field]: e.target.value })} rows={rows} className="w-full rounded-lg border border-gray-300 px-3 py-2" />
                </label>
              ))}
              <button onClick={saveBrief} disabled={update.isLoading} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                Save brief
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-700">{f.summary}</p>
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Legal questions</h3>
                <List items={f.legalQuestions as string[]} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Risks</h3>
                <List items={f.risks as string[]} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Recommended structure</h3>
                <p className="text-sm text-gray-700 whitespace-pre-line">{f.recommendedStructure}</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Questions to ask counsel</h3>
                <List items={f.counselQuestions as string[]} />
              </div>
            </>
          )}
        </section>

        <Documents featureKey={key} documents={q.data.documents} onChange={() => q.refetch()} />
        <Customers featureKey={key} approved={q.data.effectiveForCustomers} enablements={q.data.enablements} demoOrgs={q.data.demoOrgs} onChange={() => q.refetch()} />
        <FeatureSettings featureKey={key} demoOrgs={q.data.demoOrgs} />

        <section className="bg-white rounded-lg shadow p-5 space-y-3">
          <h2 className="font-semibold text-gray-900">Decision history</h2>
          {q.data.events.length === 0 ? (
            <p className="text-sm text-gray-500">No changes yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100 text-sm">
              {q.data.events.map((e: any) => (
                <li key={e.id} className="py-2">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-medium text-gray-900">{EVENT_LABEL[e.action] ?? e.action}</span>
                    {e.fromStatus && e.toStatus && (
                      <span className="text-gray-600">
                        {STATUS_LABEL[e.fromStatus] ?? e.fromStatus} → {STATUS_LABEL[e.toStatus] ?? e.toStatus}
                      </span>
                    )}
                    {e.organizationName && <span className="text-gray-600">{e.organizationName}</span>}
                    {e.metadata?.filename && <span className="text-gray-600">{e.metadata.filename}</span>}
                    {e.metadata?.fields && <span className="text-gray-500">({(e.metadata.fields as string[]).join(', ')})</span>}
                    <span className="ml-auto text-xs text-gray-400">
                      {e.actorEmail ?? e.actorId} · {new Date(e.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {e.note && e.action !== 'details_updated' && <p className="text-gray-600 mt-0.5">{e.note}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AuthenticatedLayout>
  );
}

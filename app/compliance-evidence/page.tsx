'use client';
export const dynamic = 'force-dynamic';

/**
 * SOC 2 evidence: the weekly evidence pack (captured every Monday, or on
 * demand), restore drill records, and reviewer sign-off for access reviews.
 * Each snapshot stores its JSON and a SHA-256 so it can be handed to an
 * auditor unchanged. Readiness evidence only; not a certification.
 */
import { useState } from 'react';
import { Camera, Download, FileCheck2, HardDriveDownload, ShieldCheck } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { AdminPageChrome } from '@/components/admin/page-chrome';
import { SectionCard } from '@/components/admin/section-card';
import { StatusPill } from '@/components/admin/status-pill';
import { EmptyState } from '@/components/admin/empty-state';
import { buttonClass, checkboxClass, inputClass, selectClass } from '@/components/admin/controls';

type Snapshot = {
  id: string;
  kind: string;
  periodStart: string;
  periodEnd: string;
  sha256: string;
  trigger: string;
  createdBy: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
};

const KIND_LABEL: Record<string, string> = { weekly_pack: 'Weekly evidence pack', restore_test: 'Restore drill' };

function SnapshotRow({ s, onDone }: { s: Snapshot; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const detail = (trpc as any).platformTrust.evidenceSnapshot.useQuery({ id: s.id }, { enabled: open });
  const signOff = (trpc as any).platformTrust.signOffEvidence.useMutation({ onSuccess: onDone, onError: (e: { message: string }) => alert(e.message) });
  const download = () => {
    if (!detail.data) return;
    const blob = new Blob([JSON.stringify(detail.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${s.kind}-${s.periodEnd.slice(0, 10)}-${s.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="px-5 py-3.5">
      <button type="button" className="flex w-full items-start gap-3 text-left" onClick={() => setOpen((o) => !o)}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-admin-ink">{KIND_LABEL[s.kind] ?? s.kind}</p>
            <StatusPill tone={s.reviewedAt ? 'success' : 'warn'}>{s.reviewedAt ? `Signed off by ${s.reviewedBy}` : 'Not signed off'}</StatusPill>
            <StatusPill tone="neutral" dot={false}>
              {s.trigger}
            </StatusPill>
          </div>
          <p className="mt-1 text-xs text-admin-muted">
            {new Date(s.periodStart).toLocaleDateString()} – {new Date(s.periodEnd).toLocaleDateString()} · captured {new Date(s.createdAt).toLocaleString()}
            {s.createdBy && ` by ${s.createdBy}`} · <span className="font-mono">sha256 {s.sha256.slice(0, 16)}…</span>
          </p>
        </div>
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          {detail.isLoading ? (
            <p className="text-sm text-admin-muted">Loading…</p>
          ) : detail.error ? (
            <p className="text-sm text-admin-danger">{detail.error.message}</p>
          ) : (
            <pre className="max-h-96 overflow-auto rounded-admin-sm bg-admin-bg p-3 text-xs text-admin-secondary">{JSON.stringify(detail.data?.payload, null, 2)}</pre>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={buttonClass.small} onClick={download} disabled={!detail.data}>
              <Download className="h-3.5 w-3.5" />
              Download JSON
            </button>
            {s.reviewNote && <span className="text-xs text-admin-muted">Note: {s.reviewNote}</span>}
          </div>
          {!s.reviewedAt && (
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                signOff.mutate({ id: s.id, note });
              }}
            >
              <input
                className={`${inputClass} min-w-[18rem] flex-1`}
                placeholder="Review note, e.g. Access list reviewed; removed 2 stale accounts"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                required
                minLength={3}
              />
              <button type="submit" className={buttonClass.secondary} disabled={signOff.isLoading}>
                <ShieldCheck className="h-4 w-4" />
                Sign off
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

function RestoreDrillForm({ onDone }: { onDone: () => void }) {
  const [backupTakenAt, setBackupTakenAt] = useState('');
  const [restoredInto, setRestoredInto] = useState('');
  const [durationMinutes, setDuration] = useState('');
  const [tablesChecked, setTables] = useState('');
  const [rowCountsMatch, setMatch] = useState(true);
  const [result, setResult] = useState<'pass' | 'fail'>('pass');
  const [notes, setNotes] = useState('');
  const save = (trpc as any).platformTrust.recordRestoreTest.useMutation({ onSuccess: onDone });
  return (
    <form
      className="space-y-3 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate({
          backupTakenAt,
          restoredInto,
          durationMinutes: Number(durationMinutes),
          tablesChecked: Number(tablesChecked),
          rowCountsMatch,
          result,
          notes: notes || undefined,
        });
      }}
    >
      <p className="text-sm text-admin-secondary">
        Run <code className="font-mono text-xs">npx tsx scripts/restore-drill.ts</code> in insighthire-api against the restored copy; it records the drill itself.
        Use this form for a drill done by hand.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <input className={inputClass} placeholder="Backup taken at (e.g. 2026-10-12 04:00 UTC)" value={backupTakenAt} onChange={(e) => setBackupTakenAt(e.target.value)} required minLength={8} />
        <input className={inputClass} placeholder="Restored into (e.g. Railway restore-test database)" value={restoredInto} onChange={(e) => setRestoredInto(e.target.value)} required minLength={2} />
        <input className={inputClass} type="number" min={0} placeholder="Minutes to restore" value={durationMinutes} onChange={(e) => setDuration(e.target.value)} required />
        <input className={inputClass} type="number" min={0} placeholder="Tables checked" value={tablesChecked} onChange={(e) => setTables(e.target.value)} required />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="inline-flex items-center gap-2 text-sm text-admin-ink">
          <input type="checkbox" className={checkboxClass} checked={rowCountsMatch} onChange={(e) => setMatch(e.target.checked)} />
          Row counts match
        </label>
        <select className={selectClass} value={result} onChange={(e) => setResult(e.target.value as 'pass' | 'fail')}>
          <option value="pass">Pass</option>
          <option value="fail">Fail</option>
        </select>
      </div>
      <textarea className={`${inputClass} h-20`} placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <div className="flex items-center justify-end gap-3">
        {save.error && <span className="text-sm text-admin-danger">{save.error.message}</span>}
        <button type="submit" className={buttonClass.primary} disabled={save.isLoading}>
          Record drill
        </button>
      </div>
    </form>
  );
}

export default function ComplianceEvidencePage() {
  useAdminAuth();
  const [kind, setKind] = useState<string>('');
  const list = (trpc as any).platformTrust.evidenceSnapshots.useQuery(kind ? { kind } : undefined, { refetchOnWindowFocus: false });
  const capture = (trpc as any).platformTrust.captureEvidence.useMutation({
    onSuccess: () => list.refetch(),
    onError: (e: { message: string }) => alert(e.message),
  });
  const rows: Snapshot[] = list.data ?? [];

  return (
    <AuthenticatedLayout>
      <AdminPageChrome
        icon={<FileCheck2 />}
        breadcrumbs={[{ label: 'Operations' }, { label: 'SOC 2 evidence' }]}
        title="SOC 2 evidence"
        description="Weekly evidence packs (Mondays 07:10 UTC), restore drills and access-review sign-off, kept for the auditor. This is readiness evidence, not a SOC 2 report."
        actions={
          <button type="button" className={buttonClass.primary} onClick={() => capture.mutate()} disabled={capture.isLoading}>
            <Camera className="h-4 w-4" />
            {capture.isLoading ? 'Capturing…' : 'Capture pack now'}
          </button>
        }
      >
        <div className="space-y-6">
          <SectionCard
            icon={<FileCheck2 />}
            title="Snapshots"
            padded={false}
            actions={
              <select className={selectClass} value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="">All</option>
                <option value="weekly_pack">Weekly packs</option>
                <option value="restore_test">Restore drills</option>
              </select>
            }
          >
            {list.isLoading ? (
              <p className="px-5 py-6 text-sm text-admin-muted">Loading…</p>
            ) : list.error ? (
              <p className="px-5 py-6 text-sm text-admin-danger">{list.error.message}</p>
            ) : rows.length === 0 ? (
              <EmptyState compact className="border-0 shadow-none" icon={<FileCheck2 />} title="No evidence captured yet." />
            ) : (
              <div className="divide-y divide-admin-border">
                {rows.map((s) => (
                  <SnapshotRow key={s.id} s={s} onDone={() => list.refetch()} />
                ))}
              </div>
            )}
          </SectionCard>
          <SectionCard icon={<HardDriveDownload />} title="Record a restore drill" padded={false}>
            <RestoreDrillForm onDone={() => list.refetch()} />
          </SectionCard>
        </div>
      </AdminPageChrome>
    </AuthenticatedLayout>
  );
}

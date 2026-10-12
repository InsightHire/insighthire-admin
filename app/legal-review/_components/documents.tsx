'use client';

import { useRef, useState } from 'react';
import { FileText, Upload } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { SectionCard } from '@/components/admin/section-card';
import { EmptyState } from '@/components/admin/empty-state';
import { buttonClass, inputClass } from '@/components/admin/controls';

type Doc = { id: string; filename: string; contentType: string; sizeBytes: number; note: string | null; uploadedByEmail: string | null; createdAt: string };

const ACCEPT = '.pdf,.doc,.docx,.txt,.png,.jpg,.jpeg';
const TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
};

export function Documents({ featureKey, documents, onChange }: { featureKey: string; documents: Doc[]; onChange: () => void }) {
  const file = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const uploadUrl = (trpc as any).platformAdmin.legalReviewDocUploadUrl.useMutation();
  const add = (trpc as any).platformAdmin.legalReviewDocAdd.useMutation();
  const url = (trpc as any).platformAdmin.legalReviewDocUrl.useMutation();
  const remove = (trpc as any).platformAdmin.legalReviewDocRemove.useMutation({ onSuccess: onChange });

  const upload = async () => {
    const f = file.current?.files?.[0];
    if (!f) return;
    const contentType = f.type || TYPES[f.name.split('.').pop()?.toLowerCase() ?? ''];
    if (!contentType || !Object.values(TYPES).includes(contentType)) return alert('Upload a PDF, Word, text or image file.');
    setBusy(true);
    try {
      const { uploadUrl: put, storageKey } = await uploadUrl.mutateAsync({ key: featureKey, filename: f.name, contentType, sizeBytes: f.size });
      const res = await fetch(put, { method: 'PUT', headers: { 'Content-Type': contentType }, body: f });
      if (!res.ok) throw new Error(`Storage upload failed (${res.status})`);
      await add.mutateAsync({ key: featureKey, storageKey, filename: f.name, contentType, sizeBytes: f.size, note: note.trim() || null });
      setNote('');
      if (file.current) file.current.value = '';
      onChange();
    } catch (e: any) {
      alert('Upload failed: ' + (e?.message ?? 'unknown error'));
    } finally {
      setBusy(false);
    }
  };

  const open = async (id: string) => {
    try {
      const { url: href } = await url.mutateAsync({ id });
      window.open(href, '_blank', 'noopener');
    } catch (e: any) {
      alert(e?.message ?? 'Could not open the file');
    }
  };

  return (
    <SectionCard icon={<FileText />} title="Documents" description="Counsel memos, agreements and opinions. Up to 25 MB each." padded={false}>
      <div className="flex flex-wrap items-center gap-3 border-b border-admin-border px-5 py-4">
        <input
          ref={file}
          type="file"
          accept={ACCEPT}
          className="text-sm text-admin-secondary file:mr-3 file:rounded-admin-sm file:border file:border-admin-border file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-admin-ink hover:file:bg-admin-bg"
        />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className={`${inputClass} min-w-[200px] flex-1`} />
        <button onClick={upload} disabled={busy} className={buttonClass.primary}>
          <Upload className="h-4 w-4" />
          {busy ? 'Uploading…' : 'Upload'}
        </button>
      </div>
      {documents.length === 0 ? (
        <EmptyState compact className="border-0 shadow-none" icon={<FileText />} title="No documents yet." />
      ) : (
        <ul className="divide-y divide-admin-border text-sm">
          {documents.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <FileText className="h-4 w-4 shrink-0 text-admin-muted" />
              <button onClick={() => open(d.id)} className="font-medium text-admin-accent-ink hover:underline">
                {d.filename}
              </button>
              <span className="text-xs text-admin-muted">{(d.sizeBytes / 1024).toFixed(0)} KB</span>
              {d.note && <span className="text-admin-secondary">{d.note}</span>}
              <span className="ml-auto text-xs text-admin-muted">
                {d.uploadedByEmail ?? ''} · {new Date(d.createdAt).toLocaleDateString()}
              </span>
              <button
                onClick={() => confirm(`Remove ${d.filename}?`) && remove.mutate({ id: d.id })}
                className="text-xs font-medium text-admin-danger hover:text-red-700"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

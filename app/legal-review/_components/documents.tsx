'use client';

import { useRef, useState } from 'react';
import { trpc } from '@/lib/trpc';

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
    <section className="bg-white rounded-lg shadow p-5 space-y-4">
      <h2 className="font-semibold text-gray-900">Documents</h2>
      <p className="text-sm text-gray-500">Counsel memos, agreements and opinions. Up to 25 MB each.</p>
      <div className="flex flex-wrap items-center gap-3">
        <input ref={file} type="file" accept={ACCEPT} className="text-sm" />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="flex-1 min-w-[200px] rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        <button onClick={upload} disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {busy ? 'Uploading…' : 'Upload'}
        </button>
      </div>
      {documents.length === 0 ? (
        <p className="text-sm text-gray-500">No documents yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100 text-sm">
          {documents.map((d) => (
            <li key={d.id} className="py-2 flex items-center gap-3">
              <button onClick={() => open(d.id)} className="text-blue-600 hover:text-blue-700 font-medium">
                {d.filename}
              </button>
              <span className="text-gray-400 text-xs">{(d.sizeBytes / 1024).toFixed(0)} KB</span>
              {d.note && <span className="text-gray-600">{d.note}</span>}
              <span className="ml-auto text-xs text-gray-400">
                {d.uploadedByEmail ?? ''} · {new Date(d.createdAt).toLocaleDateString()}
              </span>
              <button
                onClick={() => confirm(`Remove ${d.filename}?`) && remove.mutate({ id: d.id })}
                className="text-xs text-red-600 hover:text-red-700"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

'use client';

import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { PageHeader } from '@/components/admin/page-header';
import { diffLines, diffStats } from '@/lib/legal-diff';

type Status = 'DRAFT' | 'LIVE' | 'SUPERSEDED';
type VersionMeta = {
  id: string;
  version: number;
  status: Status;
  changeSummary: string;
  effectiveAt: string | null;
  publishedAt: string | null;
  publishedByEmail: string | null;
  createdAt: string;
};
type DocDetail = {
  slug: string;
  title: string;
  description: string | null;
  usedAt: string | null;
  format?: string;
  allowEmpty?: boolean;
  editorHint?: string;
  versions: VersionMeta[];
  live: (VersionMeta & { bodyMarkdown: string }) | null;
};
type VersionDetail = VersionMeta & {
  bodyMarkdown: string;
  html: string;
  versionLabel: string;
  previous: { id: string; version: number; bodyMarkdown: string } | null;
};

type Editor = { mode: 'new' | 'draft'; draftId?: string; body: string; summary: string; effectiveAt: string };

type TrackedChanges = 'accept' | 'reject';
type DocxResult = {
  bodyMarkdown: string;
  html: string;
  warnings: Array<{ code: string; message: string }>;
  stats: { insertions: number; deletions: number; formattingChanges: number };
};
/** The last Word upload, kept so staff can switch between accepted and rejected tracked changes. */
type WordImport = { fileName: string; base64: string; trackedChanges: TrackedChanges; result: DocxResult };

const DOCX_MAX_BYTES = 10 * 1024 * 1024;

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file'));
    reader.readAsDataURL(file);
  });
}

const STATUS_STYLE: Record<Status, string> = {
  LIVE: 'bg-emerald-100 text-emerald-800',
  DRAFT: 'bg-amber-100 text-amber-800',
  SUPERSEDED: 'bg-slate-100 text-slate-600',
};
const STATUS_LABEL: Record<Status, string> = { LIVE: 'Live', DRAFT: 'Draft', SUPERSEDED: 'Superseded' };

const inputClass =
  'mt-1 block w-full rounded-admin-sm border border-admin-border bg-white px-3 py-2 text-sm text-admin-ink shadow-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent';
const primaryButton =
  'inline-flex items-center rounded-admin-sm bg-admin-ink px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50';
const secondaryButton =
  'inline-flex items-center rounded-admin-sm border border-admin-border bg-white px-4 py-2 text-sm font-medium text-admin-ink hover:bg-slate-50 disabled:opacity-50';

const api = trpc as any;

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function StatusBadge({ status }: { status: Status }) {
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span>;
}

function DiffView({ before, after, beforeLabel }: { before: string; after: string; beforeLabel: string }) {
  const lines = useMemo(() => diffLines(before, after), [before, after]);
  const stats = diffStats(lines);
  return (
    <div>
      <p className="mb-2 text-xs text-admin-muted">
        Compared with {beforeLabel}: <span className="text-emerald-700">+{stats.added}</span>{' '}
        <span className="text-red-700">−{stats.removed}</span> lines
      </p>
      <pre className="max-h-[70vh] overflow-auto rounded-admin-sm border border-admin-border bg-white p-3 text-xs leading-relaxed">
        {lines.map((l, i) => (
          <div
            key={i}
            className={
              l.kind === 'added'
                ? 'whitespace-pre-wrap bg-emerald-50 text-emerald-900'
                : l.kind === 'removed'
                  ? 'whitespace-pre-wrap bg-red-50 text-red-900 line-through'
                  : 'whitespace-pre-wrap text-admin-muted'
            }
          >
            {l.kind === 'added' ? '+ ' : l.kind === 'removed' ? '− ' : '  '}
            {l.text || ' '}
          </div>
        ))}
      </pre>
    </div>
  );
}

export default function LegalDocumentPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? '';
  const utils = api.useUtils();
  const docQuery = api.legalDocuments.get.useQuery({ slug }, { enabled: !!slug, refetchOnWindowFocus: false });
  const doc = docQuery.data as DocDetail | undefined;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<'text' | 'diff' | 'markdown'>('text');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [preview, setPreview] = useState<{ html: string; body: string } | null>(null);
  const [pane, setPane] = useState<'preview' | 'diff'>('diff');
  const [wordImport, setWordImport] = useState<WordImport | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const draft = doc?.versions.find((v) => v.status === 'DRAFT') ?? null;
  const currentId = selectedId ?? doc?.live?.id ?? draft?.id ?? doc?.versions[0]?.id ?? null;
  const versionQuery = api.legalDocuments.getVersion.useQuery(
    { id: currentId ?? '' },
    { enabled: !!currentId, refetchOnWindowFocus: false },
  );
  const version = versionQuery.data as VersionDetail | undefined;

  const refresh = async () => {
    await Promise.all([
      utils.legalDocuments.get.invalidate({ slug }),
      utils.legalDocuments.list.invalidate(),
      utils.legalDocuments.getVersion.invalidate(),
    ]);
  };
  const onError = (e: { message: string }) => setMessage(e.message);

  const previewMutation = api.legalDocuments.previewMarkdown.useMutation({ onError });
  const convertDocx = api.legalDocuments.convertDocx.useMutation({ onError });
  const createDraft = api.legalDocuments.createDraft.useMutation({ onError });
  const updateDraft = api.legalDocuments.updateDraft.useMutation({ onError });
  const publishDraft = api.legalDocuments.publishDraft.useMutation({ onError });
  const publishNew = api.legalDocuments.publishNewVersion.useMutation({ onError });
  const discardDraft = api.legalDocuments.discardDraft.useMutation({ onError });
  const busy =
    createDraft.isPending || updateDraft.isPending || publishDraft.isPending || publishNew.isPending || discardDraft.isPending;

  const openEditor = (next: Editor) => {
    setMessage(null);
    setPreview(null);
    setWordImport(null);
    setPane(doc?.live ? 'diff' : 'preview');
    setEditor(next);
  };

  const closeEditor = () => {
    setEditor(null);
    setWordImport(null);
  };

  const refreshPreview = (body: string) =>
    previewMutation.mutate({ bodyMarkdown: body }, { onSuccess: (r: { html: string }) => setPreview({ html: r.html, body }) });

  const canUploadWord = doc?.format === 'markdown';

  /** Converts on the server and loads the result into the editor. Nothing is saved until Publish or Save as draft. */
  const convertWord = async (fileName: string, base64: string, trackedChanges: TrackedChanges) => {
    setMessage(null);
    const result = (await convertDocx.mutateAsync({ slug, fileName, contentBase64: base64, trackedChanges })) as DocxResult;
    setEditor((e) => (e ? { ...e, body: result.bodyMarkdown } : { mode: 'new', body: result.bodyMarkdown, summary: '', effectiveAt: '' }));
    setWordImport({ fileName, base64, trackedChanges, result });
    setPreview({ html: result.html, body: result.bodyMarkdown });
    setPane('preview');
  };

  const onWordFile = async (file: File | undefined) => {
    if (fileInput.current) fileInput.current.value = '';
    if (!file) return;
    if (!/\.docx$/i.test(file.name)) {
      setMessage(
        /\.doc$/i.test(file.name)
          ? 'This is an older Word .doc file. In Word choose File → Save As → Word Document (.docx), then upload that.'
          : 'Only Word .docx files can be uploaded.',
      );
      return;
    }
    if (file.size > DOCX_MAX_BYTES) {
      setMessage('The file is larger than 10 MB. Images make files big and are dropped anyway, so try removing them.');
      return;
    }
    const edited = editor && editor.body.trim() && editor.body !== (wordImport?.result.bodyMarkdown ?? doc?.live?.bodyMarkdown ?? '');
    if (edited && !window.confirm('Replace the text in the editor with this Word document?')) return;
    await convertWord(file.name, await readAsBase64(file), 'accept');
  };

  const switchTrackedChanges = async () => {
    if (!wordImport || !editor) return;
    if (editor.body !== wordImport.result.bodyMarkdown && !window.confirm('This replaces your edits to the converted text. Continue?')) return;
    await convertWord(wordImport.fileName, wordImport.base64, wordImport.trackedChanges === 'accept' ? 'reject' : 'accept');
  };

  const startNewVersion = () => openEditor({ mode: 'new', body: doc?.live?.bodyMarkdown ?? '', summary: '', effectiveAt: '' });

  const editDraft = async () => {
    if (!draft) return;
    const full = (await utils.legalDocuments.getVersion.fetch({ id: draft.id })) as VersionDetail;
    openEditor({
      mode: 'draft',
      draftId: draft.id,
      body: full.bodyMarkdown,
      summary: full.changeSummary,
      effectiveAt: full.effectiveAt ? new Date(full.effectiveAt).toISOString().slice(0, 10) : '',
    });
  };

  const editorPayload = (e: Editor) => ({ bodyMarkdown: e.body, changeSummary: e.summary, effectiveAt: e.effectiveAt || null });

  const saveDraft = async () => {
    if (!editor) return;
    setMessage(null);
    if (editor.mode === 'draft' && editor.draftId) {
      await updateDraft.mutateAsync({ versionId: editor.draftId, ...editorPayload(editor) });
      setSelectedId(editor.draftId);
    } else {
      const created = (await createDraft.mutateAsync({ slug, ...editorPayload(editor) })) as VersionMeta;
      setSelectedId(created.id);
    }
    closeEditor();
    setMessage('Draft saved. It is not live yet.');
    await refresh();
  };

  /** Publishes the open editor's text, or the saved draft when no editor is open. */
  const publish = async () => {
    setMessage(null);
    let published: VersionMeta;
    if (editor?.mode === 'new') {
      published = (await publishNew.mutateAsync({ slug, ...editorPayload(editor) })) as VersionMeta;
    } else {
      const draftId = editor?.draftId ?? draft?.id;
      if (!draftId) return;
      if (editor) await updateDraft.mutateAsync({ versionId: draftId, ...editorPayload(editor) });
      published = (await publishDraft.mutateAsync({ versionId: draftId })) as VersionMeta;
    }
    closeEditor();
    setSelectedId(published.id);
    setView('text');
    setMessage(`Version ${published.version} is now live.`);
    await refresh();
  };

  const discard = async () => {
    if (!draft || !window.confirm(`Discard draft v${draft.version}? This cannot be undone.`)) return;
    await discardDraft.mutateAsync({ versionId: draft.id });
    setSelectedId(null);
    closeEditor();
    setMessage('Draft discarded.');
    await refresh();
  };

  // Mutation errors are shown through onError; this only stops unhandled rejections.
  const run = (fn: () => Promise<void>) => () => void fn().catch(() => undefined);

  const canSubmit = !!editor && (doc?.allowEmpty || editor.body.trim().length > 0) && editor.summary.trim().length >= 3;

  return (
    <AuthenticatedLayout>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <Link href="/legal" className="mb-3 inline-block text-sm text-admin-muted hover:text-admin-ink">
          ← Licenses & disclosures
        </Link>

        {docQuery.error ? <p className="text-sm text-red-600">{docQuery.error.message}</p> : null}

        {!doc ? (
          <div className="admin-panel py-16 text-center text-sm text-admin-muted">{docQuery.isLoading ? 'Loading…' : 'Not found.'}</div>
        ) : (
          <>
            <PageHeader
              eyebrow="Licenses & disclosures"
              title={doc.title}
              description={doc.description ?? undefined}
              actions={
                editor ? null : draft ? (
                  <>
                    <button type="button" className={secondaryButton} onClick={run(editDraft)} disabled={busy}>
                      Edit draft v{draft.version}
                    </button>
                    <button type="button" className={primaryButton} onClick={() => setConfirming(true)} disabled={busy}>
                      Publish draft
                    </button>
                  </>
                ) : (
                  <>
                    {canUploadWord ? (
                      <button
                        type="button"
                        className={secondaryButton}
                        onClick={() => fileInput.current?.click()}
                        disabled={convertDocx.isPending}
                      >
                        {convertDocx.isPending ? 'Converting…' : 'Upload Word doc (.docx)'}
                      </button>
                    ) : null}
                    <button type="button" className={primaryButton} onClick={startNewVersion}>
                      New version
                    </button>
                  </>
                )
              }
            />
            {canUploadWord ? (
              <input
                ref={fileInput}
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={(e) => run(() => onWordFile(e.target.files?.[0]))()}
              />
            ) : null}

            <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-admin-muted">
              {doc.usedAt ? (
                <span>
                  Shown at <span className="font-mono text-admin-ink">{doc.usedAt}</span>
                </span>
              ) : null}
              <span>
                Live:{' '}
                {doc.live ? <span className="font-medium text-admin-ink">v{doc.live.version}</span> : 'none yet (the text shipped in code is shown)'}
              </span>
            </div>

            {message ? (
              <div className="mb-4 rounded-admin-sm border border-admin-border bg-slate-50 px-4 py-2 text-sm text-admin-ink">{message}</div>
            ) : null}

            {draft && !editor ? (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-admin-sm border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <span>
                  Draft v{draft.version} is waiting to be published: “{draft.changeSummary}”. Nobody sees it yet.
                </span>
                <button type="button" className="underline" onClick={run(discard)} disabled={busy}>
                  Discard draft
                </button>
              </div>
            ) : null}

            {editor ? (
              <section className="admin-panel mb-6 space-y-4 p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-admin-ink">
                    {editor.mode === 'new' ? 'New version' : `Edit draft v${draft?.version ?? ''}`}
                  </h2>
                  <div className="flex items-center gap-4">
                    {canUploadWord ? (
                      <button
                        type="button"
                        className="text-sm text-admin-muted underline hover:text-admin-ink"
                        onClick={() => fileInput.current?.click()}
                        disabled={convertDocx.isPending}
                      >
                        {convertDocx.isPending ? 'Converting…' : 'Upload Word doc (.docx)'}
                      </button>
                    ) : null}
                    <button type="button" className="text-sm text-admin-muted hover:text-admin-ink" onClick={closeEditor}>
                      Cancel
                    </button>
                  </div>
                </div>
                <p className="text-xs text-admin-muted">
                  {doc.editorHint ?? 'Markdown. End a heading with {#anchor} to keep a link like /privacy#sms working.'}
                  {canUploadWord ? ' Or upload a Word .docx (up to 10 MB; save older .doc files as .docx first).' : ''}
                </p>
                {wordImport ? (
                  <div className="rounded-admin-sm border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">
                        Converted from {wordImport.fileName}. Check the text, preview and changes below. Nothing is live until you publish.
                      </span>
                      {wordImport.result.stats.insertions + wordImport.result.stats.deletions + wordImport.result.stats.formattingChanges > 0 ? (
                        <button type="button" className="underline" onClick={run(switchTrackedChanges)} disabled={convertDocx.isPending}>
                          {wordImport.trackedChanges === 'accept' ? 'Show original (reject all changes)' : 'Show all changes accepted'}
                        </button>
                      ) : null}
                    </div>
                    {wordImport.result.warnings.length ? (
                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        {wordImport.result.warnings.map((w) => (
                          <li key={w.code}>{w.message}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1">No conversion warnings.</p>
                    )}
                  </div>
                ) : null}
                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <label className="block text-sm font-semibold text-admin-ink">{wordImport ? 'Converted text' : 'Text'}</label>
                    <textarea
                      value={editor.body}
                      onChange={(e) => setEditor({ ...editor, body: e.target.value })}
                      rows={28}
                      className={`${inputClass} font-mono text-xs leading-relaxed`}
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex gap-1 rounded-admin-sm border border-admin-border p-0.5 text-xs">
                        {(doc.live ? (['preview', 'diff'] as const) : (['preview'] as const)).map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => {
                              setPane(p);
                              if (p === 'preview' && !preview) refreshPreview(editor.body);
                            }}
                            className={`rounded px-2 py-1 ${pane === p ? 'bg-admin-ink text-white' : 'text-admin-muted hover:text-admin-ink'}`}
                          >
                            {p === 'preview' ? 'Preview' : 'Changes vs live'}
                          </button>
                        ))}
                      </div>
                      {pane === 'preview' ? (
                        <button
                          type="button"
                          className="text-xs text-admin-muted underline hover:text-admin-ink"
                          onClick={() => refreshPreview(editor.body)}
                          disabled={previewMutation.isPending}
                        >
                          {previewMutation.isPending ? 'Rendering…' : preview ? 'Refresh preview' : 'Show preview'}
                        </button>
                      ) : null}
                    </div>
                    {pane === 'preview' && preview && preview.body !== editor.body ? (
                      <p className="mt-1 text-xs text-amber-700">The text changed since this preview. Refresh to see it.</p>
                    ) : null}
                    <div className="mt-1 max-h-[34rem] overflow-auto rounded-admin-sm border border-admin-border bg-white p-4">
                      {pane === 'diff' && doc.live ? (
                        <DiffView before={doc.live.bodyMarkdown} after={editor.body} beforeLabel={`live v${doc.live.version}`} />
                      ) : preview ? (
                        <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: preview.html }} />
                      ) : (
                        <p className="text-xs text-admin-muted">Click “Show preview” to see how it will look.</p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
                  <div>
                    <label className="block text-sm font-semibold text-admin-ink">What changed (required)</label>
                    <input
                      type="text"
                      value={editor.summary}
                      maxLength={500}
                      onChange={(e) => setEditor({ ...editor, summary: e.target.value })}
                      placeholder="e.g. Added a sub-processor; updated the retention period"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-admin-ink">Effective date</label>
                    <input
                      type="date"
                      value={editor.effectiveAt}
                      onChange={(e) => setEditor({ ...editor, effectiveAt: e.target.value })}
                      className={inputClass}
                    />
                    <p className="mt-1 text-xs text-admin-muted">Blank means the day you publish.</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 border-t border-admin-border pt-4">
                  <button type="button" className={primaryButton} disabled={!canSubmit || busy} onClick={() => setConfirming(true)}>
                    Publish
                  </button>
                  <button type="button" className={secondaryButton} disabled={!canSubmit || busy} onClick={run(saveDraft)}>
                    Save as draft
                  </button>
                </div>
              </section>
            ) : null}

            <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
              <section className="admin-panel min-w-0 p-6">
                {version ? (
                  <>
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-semibold text-admin-ink">Version {version.version}</h2>
                        <StatusBadge status={version.status} />
                        <span className="font-mono text-xs text-admin-muted">{version.versionLabel}</span>
                      </div>
                      <div className="flex gap-1 rounded-admin-sm border border-admin-border p-0.5 text-xs">
                        {(['text', 'diff', 'markdown'] as const).map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setView(v)}
                            className={`rounded px-2 py-1 ${view === v ? 'bg-admin-ink text-white' : 'text-admin-muted hover:text-admin-ink'}`}
                          >
                            {v === 'text' ? 'Text' : v === 'diff' ? 'Changes' : 'Markdown'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="mb-4 text-xs text-admin-muted">
                      {version.changeSummary} · effective {formatDate(version.effectiveAt)}
                      {version.publishedAt
                        ? ` · published ${formatDate(version.publishedAt)} by ${version.publishedByEmail ?? 'unknown'}`
                        : ''}
                    </p>
                    {view === 'text' ? (
                      <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: version.html }} />
                    ) : view === 'markdown' ? (
                      <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap rounded-admin-sm border border-admin-border bg-slate-50 p-3 text-xs">
                        {version.bodyMarkdown}
                      </pre>
                    ) : version.previous ? (
                      <DiffView
                        before={version.previous.bodyMarkdown}
                        after={version.bodyMarkdown}
                        beforeLabel={`v${version.previous.version}`}
                      />
                    ) : (
                      <p className="text-sm text-admin-muted">This is the first published version, so there is nothing to compare with.</p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-admin-muted">{versionQuery.isLoading ? 'Loading…' : 'No versions yet.'}</p>
                )}
              </section>

              <aside className="admin-panel h-fit p-4">
                <h2 className="mb-3 text-sm font-semibold text-admin-ink">Version history</h2>
                <ol className="space-y-1">
                  {doc.versions.map((v) => (
                    <li key={v.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedId(v.id);
                          setView('text');
                        }}
                        className={`w-full rounded-admin-sm px-3 py-2 text-left text-sm hover:bg-slate-50 ${v.id === currentId ? 'bg-slate-100' : ''}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-admin-ink">v{v.version}</span>
                          <StatusBadge status={v.status} />
                        </div>
                        <div className="mt-0.5 line-clamp-2 text-xs text-admin-muted">{v.changeSummary}</div>
                        <div className="mt-0.5 text-xs text-admin-muted">
                          {v.publishedAt ? `${formatDate(v.publishedAt)} · ${v.publishedByEmail ?? 'unknown'}` : `Saved ${formatDate(v.createdAt)}`}
                        </div>
                      </button>
                    </li>
                  ))}
                </ol>
              </aside>
            </div>
          </>
        )}

        {confirming ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
            <div className="w-full max-w-md rounded-admin bg-white p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-admin-ink">Publish this version?</h2>
              <p className="mt-2 text-sm text-admin-muted">
                It goes live right away{doc?.usedAt ? ` at ${doc.usedAt}` : ''}.
                {doc?.live ? ` Version ${doc.live.version} will be marked superseded and kept in the history.` : ''} Published versions
                cannot be edited.
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" className={secondaryButton} onClick={() => setConfirming(false)} disabled={busy}>
                  Cancel
                </button>
                <button
                  type="button"
                  className={primaryButton}
                  onClick={run(() => publish().finally(() => setConfirming(false)))}
                  disabled={busy}
                >
                  {busy ? 'Publishing…' : 'Publish'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AuthenticatedLayout>
  );
}

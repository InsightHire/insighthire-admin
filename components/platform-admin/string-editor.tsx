'use client';

import { useEffect, useRef, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/cn';
import { Segmented } from '@/components/admin/segmented';
import { StatusPill } from '@/components/admin/status-pill';
import { buttonClass, checkboxClass, inputClass } from '@/components/admin/controls';

type Surface = 'hire' | 'partner' | 'worker' | 'vmsServer';
type Filter = 'all' | 'missing' | 'needsReview' | 'overridden' | 'machine';

type StringRow = {
  key: string;
  english: string;
  value: string | null;
  shipped: string | null;
  override: { id: string; by: string; at: string } | null;
  englishOverridden: boolean;
  missing: boolean;
  tag: string | null;
  review: { by: string; at: string } | null;
  needsReview: boolean;
  machine: boolean;
};

type ListData = { bundle: 'hire' | 'partner'; catalog: string; isSource: boolean; maxLength: number; total: number; rows: StringRow[] };
type ImportChange = { key: string; english: string; current: string | null; next: string; errors: string[] };
type ImportDiff = { changes: ImportChange[]; unknownKeys: string[]; unchanged: number; blank: number };
type Version = { id: string; value: string | null; previousValue: string | null; action: string; by: string; at: string };

const PAGE = 50;
const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'missing', label: 'Missing' },
  { value: 'needsReview', label: 'Needs review' },
  { value: 'overridden', label: 'Edited' },
  { value: 'machine', label: 'Machine translated' },
];

const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
const dirFor = (locale: string) => (locale.split('-')[0] === 'ar' ? 'rtl' : 'ltr');

function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function download(filename: string, content: string) {
  const type = filename.endsWith('.csv') ? 'text/csv;charset=utf-8' : 'application/xliff+xml;charset=utf-8';
  const url = URL.createObjectURL(new Blob([filename.endsWith('.csv') ? `\uFEFF${content}` : content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Strings for one product and language (API i18n.listStrings and friends):
 * English beside the live text, inline edits with validation and preview,
 * history and revert, review marks, and CSV/XLIFF round trips for translators.
 * Edits apply to the live apps within about 30 seconds.
 */
export function StringEditor({
  surface,
  locale,
  label,
  canReview,
  initialFilter,
  onChanged,
}: {
  surface: Surface;
  locale: string;
  label: string;
  canReview: boolean;
  initialFilter: Filter;
  onChanged: () => void;
}) {
  const t = trpc as any;
  const utils = t.useUtils();
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim());
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [diff, setDiff] = useState<ImportDiff | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPage(0);
    setPicked(new Set());
  }, [filter, q, surface, locale]);

  const list = t.i18n.listStrings.useQuery({ surface, locale, filter, search: q || undefined, offset: page * PAGE, limit: PAGE }, { refetchOnWindowFocus: false });
  const data = list.data as ListData | undefined;
  const rows = data?.rows ?? [];
  const refresh = () => {
    void list.refetch();
    onChanged();
  };
  const review = t.i18n.setPartnerReviews.useMutation({
    onSuccess: () => {
      setPicked(new Set());
      refresh();
    },
    onError: (e: Error) => setError(e.message),
  });
  const preview = t.i18n.previewImport.useMutation({ onSuccess: (d: ImportDiff) => setDiff(d), onError: (e: Error) => setError(e.message) });

  const markAllNeedingReview = async () => {
    setBusy('review');
    try {
      const keys: string[] = [];
      for (let offset = 0; ; offset += 200) {
        const r = (await utils.i18n.listStrings.fetch({ surface, locale, filter: 'needsReview', offset, limit: 200 })) as ListData;
        keys.push(...r.rows.map((x) => x.key));
        if (keys.length >= r.total || !r.rows.length) break;
      }
      if (keys.length && window.confirm(`Record a professional review for all ${keys.length} strings in ${label}?`)) review.mutate({ locale, keys, reviewed: true });
    } finally {
      setBusy(null);
    }
  };

  const exportAs = async (format: 'csv' | 'xliff') => {
    setBusy(format);
    setError(null);
    try {
      const r = (await utils.i18n.exportStrings.fetch({ surface, locale, format, filter })) as { filename: string; content: string };
      download(r.filename, r.content);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    const format = /\.csv$/i.test(file.name) ? 'csv' : 'xliff';
    preview.mutate({ surface, locale, format, content: await file.text() });
    if (fileRef.current) fileRef.current.value = '';
  };

  const showReviewBar = canReview && filter === 'needsReview' && rows.length > 0;
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE)) : 1;

  return (
    <div className="admin-panel overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-admin-border px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-admin-ink">
            {label} <span className="admin-mono text-xs font-normal text-admin-muted">{locale}</span>
            {data?.isSource && <span className="ml-2 text-xs font-normal text-admin-muted">English source: edits change what every language falls back to</span>}
          </h3>
          <p className="mt-0.5 max-w-2xl text-xs text-admin-muted">
            Edits go live in about 30 seconds without a deploy. Placeholders like {'{name}'} and tags must match the English; HTML is not allowed.
            {canReview && ' Consent, legal and tax strings need a professional translator; an edit lapses an earlier review.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={buttonClass.small} disabled={!!busy} onClick={() => void exportAs('csv')}>
            {busy === 'csv' ? 'Exporting…' : 'Export CSV'}
          </button>
          <button type="button" className={buttonClass.small} disabled={!!busy} onClick={() => void exportAs('xliff')}>
            {busy === 'xliff' ? 'Exporting…' : 'Export XLIFF'}
          </button>
          <button type="button" className={buttonClass.small} disabled={preview.isPending} onClick={() => fileRef.current?.click()}>
            {preview.isPending ? 'Reading…' : 'Import…'}
          </button>
          <input ref={fileRef} type="file" accept=".csv,.xlf,.xliff,.xml" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-b border-admin-border px-5 py-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search key, English or translation"
          aria-label="Search strings"
          className={cn(inputClass, 'max-w-xs py-1.5')}
        />
        <Segmented size="sm" ariaLabel="String filter" value={filter} onChange={setFilter} options={FILTERS.filter((f) => canReview || (f.value !== 'needsReview' && f.value !== 'machine'))} />
        <span className="text-xs text-admin-muted">{data ? `${data.total} strings` : ''}</span>
      </div>

      {error && <p className="border-b border-admin-border bg-red-50 px-5 py-2 text-xs text-admin-danger">{error}</p>}

      {diff && (
        <ImportReview
          diff={diff}
          canReview={canReview}
          surface={surface}
          locale={locale}
          onClose={(applied) => {
            setDiff(null);
            if (applied) refresh();
          }}
        />
      )}

      {showReviewBar && (
        <div className="flex flex-wrap items-center gap-2 border-b border-admin-border bg-slate-50 px-5 py-2">
          <button type="button" className={buttonClass.small} disabled={picked.size === 0 || review.isPending} onClick={() => review.mutate({ locale, keys: [...picked], reviewed: true })}>
            Mark {picked.size || ''} selected reviewed
          </button>
          <button type="button" className={buttonClass.small} disabled={review.isPending || busy === 'review'} onClick={() => void markAllNeedingReview()}>
            Mark all {data?.total ?? ''} reviewed
          </button>
        </div>
      )}

      {list.isLoading ? (
        <div className="py-10 text-center text-sm text-admin-muted">Loading…</div>
      ) : list.error ? (
        <div className="py-10 text-center text-sm text-admin-danger">{list.error.message}</div>
      ) : rows.length === 0 ? (
        <div className="py-10 text-center text-sm text-admin-muted">Nothing here.</div>
      ) : (
        <ul className="divide-y divide-admin-border">
          {rows.map((r) => (
            <li key={r.key} className="px-5 py-3">
              <div className="flex items-start gap-3">
                {showReviewBar && (
                  <input
                    type="checkbox"
                    aria-label={`Select ${r.key}`}
                    checked={picked.has(r.key)}
                    onChange={() =>
                      setPicked((prev) => {
                        const next = new Set(prev);
                        if (next.has(r.key)) next.delete(r.key);
                        else next.add(r.key);
                        return next;
                      })
                    }
                    className={cn(checkboxClass, 'mt-1')}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="admin-mono break-all text-xs text-admin-ink">{r.key}</span>
                    {r.tag && <StatusPill tone={r.tag === 'tax' ? 'info' : r.tag === 'consent' ? 'warn' : 'neutral'} dot={false}>{r.tag}</StatusPill>}
                    {r.missing && <StatusPill tone="warn" dot={false}>Missing</StatusPill>}
                    {r.needsReview && <StatusPill tone="warn" dot={false}>Needs review</StatusPill>}
                    {r.review && <StatusPill tone="success" dot={false}>Reviewed</StatusPill>}
                    {r.machine && <StatusPill tone="neutral" dot={false}>Machine</StatusPill>}
                    {r.override && <StatusPill tone="brand" dot={false}>Edited</StatusPill>}
                    {r.englishOverridden && <StatusPill tone="info" dot={false}>English edited</StatusPill>}
                  </div>
                  <div className={cn('mt-1.5 grid gap-3', !data?.isSource && 'md:grid-cols-2')}>
                    {!data?.isSource && (
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-admin-muted">English</div>
                        <p className="whitespace-pre-wrap text-sm text-admin-secondary">{r.english || <em>(empty)</em>}</p>
                      </div>
                    )}
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-admin-muted">{data?.isSource ? 'English (live)' : label}</div>
                      <p dir={dirFor(locale)} className={cn('whitespace-pre-wrap text-sm', r.value == null ? 'italic text-admin-muted' : 'text-admin-ink')}>
                        {r.value ?? 'Not translated: shows the English'}
                      </p>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-admin-muted">
                    {r.override && `Edited by ${r.override.by}, ${fmtDate(r.override.at)}. `}
                    {r.review && `Reviewed by ${r.review.by}, ${fmtDate(r.review.at)}.`}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <button type="button" className={buttonClass.small} onClick={() => setEditing(editing === r.key ? null : r.key)}>
                    {editing === r.key ? 'Close' : 'Edit'}
                  </button>
                  <button type="button" className={buttonClass.ghost} onClick={() => setHistoryFor(historyFor === r.key ? null : r.key)}>
                    History
                  </button>
                  {canReview && r.review && (
                    <button type="button" className={buttonClass.ghost} disabled={review.isPending} onClick={() => review.mutate({ locale, keys: [r.key], reviewed: false })}>
                      Undo review
                    </button>
                  )}
                </div>
              </div>
              {editing === r.key && (
                <InlineEditor
                  surface={surface}
                  locale={locale}
                  row={r}
                  isSource={!!data?.isSource}
                  canReview={canReview && !!r.tag}
                  maxLength={data?.maxLength ?? 4000}
                  onDone={(saved) => {
                    setEditing(null);
                    if (saved) refresh();
                  }}
                />
              )}
              {historyFor === r.key && <History surface={surface} locale={locale} row={r} onChanged={refresh} />}
            </li>
          ))}
        </ul>
      )}

      {data && data.total > PAGE && (
        <div className="flex items-center justify-between border-t border-admin-border px-5 py-2 text-xs text-admin-muted">
          <span>
            Page {page + 1} of {pages}
          </span>
          <div className="flex gap-2">
            <button type="button" className={buttonClass.small} disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <button type="button" className={buttonClass.small} disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function InlineEditor({
  surface,
  locale,
  row,
  isSource,
  canReview,
  maxLength,
  onDone,
}: {
  surface: Surface;
  locale: string;
  row: StringRow;
  isSource: boolean;
  canReview: boolean;
  maxLength: number;
  onDone: (saved: boolean) => void;
}) {
  const t = trpc as any;
  const [value, setValue] = useState(row.value ?? row.english);
  const [markReviewed, setMarkReviewed] = useState(false);
  const checked = useDebounced(value);
  const check = t.i18n.validateString.useQuery(
    { surface, locale, key: row.key, value: checked },
    { enabled: checked.trim().length > 0 && checked.length <= maxLength * 2, refetchOnWindowFocus: false },
  );
  const result = check.data as { errors: string[]; preview: string | null } | undefined;
  const save = t.i18n.saveString.useMutation({ onSuccess: () => onDone(true) });
  const unchanged = value === (row.value ?? '');
  const stale = checked !== value || check.isFetching;
  const errors = !value.trim() ? ['Text can’t be empty. Use History to go back to the shipped text.'] : (result?.errors ?? []);

  return (
    <div className="mt-3 rounded-admin-sm border border-admin-border bg-slate-50 p-3">
      <label className="text-xs font-medium text-admin-ink" htmlFor={`edit-${row.key}`}>
        {isSource ? 'English text' : 'Translation'}
      </label>
      <textarea
        id={`edit-${row.key}`}
        dir={dirFor(locale)}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={Math.min(8, Math.max(2, Math.ceil(value.length / 90)))}
        className={cn(inputClass, 'mt-1 font-mono text-[13px]')}
      />
      <div className="mt-1 flex justify-between text-xs text-admin-muted">
        <span>{stale ? 'Checking…' : errors.length ? '' : 'Looks good.'}</span>
        <span className={cn(value.length > maxLength && 'text-admin-danger')}>
          {value.length} / {maxLength}
        </span>
      </div>
      {errors.length > 0 && (
        <ul className="mt-1 list-disc pl-5 text-xs text-admin-danger">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {result?.preview != null && (
        <div className="mt-2">
          <div className="text-[11px] uppercase tracking-wide text-admin-muted">Preview</div>
          <p dir={dirFor(locale)} className="whitespace-pre-wrap rounded-admin-sm border border-admin-border bg-white px-3 py-2 text-sm text-admin-ink">
            {result.preview}
          </p>
        </div>
      )}
      {canReview && (
        <label className="mt-2 flex items-center gap-2 text-xs text-admin-ink">
          <input type="checkbox" className={checkboxClass} checked={markReviewed} onChange={(e) => setMarkReviewed(e.target.checked)} />
          A professional translator reviewed this text (record the review with the save)
        </label>
      )}
      {canReview && row.review && !markReviewed && <p className="mt-1 text-xs text-amber-700">Saving lapses the current review.</p>}
      {save.error && <p className="mt-1 text-xs text-admin-danger">{save.error.message}</p>}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className={buttonClass.primary}
          disabled={unchanged || stale || errors.length > 0 || save.isPending}
          onClick={() => save.mutate({ surface, locale, key: row.key, value, markReviewed: canReview && markReviewed })}
        >
          {save.isPending ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className={buttonClass.secondary} onClick={() => onDone(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function History({ surface, locale, row, onChanged }: { surface: Surface; locale: string; row: StringRow; onChanged: () => void }) {
  const t = trpc as any;
  const history = t.i18n.stringHistory.useQuery({ surface, locale, key: row.key }, { refetchOnWindowFocus: false });
  const data = history.data as { shipped: string | null; versions: Version[] } | undefined;
  const revert = t.i18n.revertString.useMutation({
    onSuccess: () => {
      void history.refetch();
      onChanged();
    },
  });

  return (
    <div className="mt-3 rounded-admin-sm border border-admin-border bg-white p-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-admin-ink">History</span>
        {row.override && (
          <button
            type="button"
            className={buttonClass.small}
            disabled={revert.isPending}
            onClick={() => window.confirm('Go back to the shipped text?') && revert.mutate({ surface, locale, key: row.key })}
          >
            Revert to shipped text
          </button>
        )}
      </div>
      {revert.error && <p className="mt-1 text-xs text-admin-danger">{revert.error.message}</p>}
      <p className="mt-2 text-xs text-admin-muted">Shipped: {data?.shipped ?? <em>(not translated)</em>}</p>
      {history.isLoading ? (
        <p className="mt-2 text-xs text-admin-muted">Loading…</p>
      ) : !data?.versions.length ? (
        <p className="mt-2 text-xs text-admin-muted">No edits yet.</p>
      ) : (
        <ol className="mt-2 space-y-2">
          {data.versions.map((v, i) => (
            <li key={v.id} className="flex items-start justify-between gap-3 border-t border-admin-border pt-2">
              <div className="min-w-0">
                <div className="text-xs text-admin-muted">
                  {v.action === 'SAVE' ? 'Edited' : v.action === 'IMPORT' ? 'Imported' : v.value == null ? 'Reverted to shipped text' : 'Restored'} by {v.by}, {fmtDate(v.at)}
                  {i === 0 && ' (live)'}
                </div>
                {v.value != null && (
                  <p dir={dirFor(locale)} className="whitespace-pre-wrap text-sm text-admin-ink">
                    {v.value}
                  </p>
                )}
                {v.previousValue != null && <p className="text-xs text-admin-muted line-through">{v.previousValue}</p>}
              </div>
              {i > 0 && v.value != null && (
                <button type="button" className={buttonClass.small} disabled={revert.isPending} onClick={() => revert.mutate({ surface, locale, key: row.key, toVersionId: v.id })}>
                  Restore
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function ImportReview({
  diff,
  canReview,
  surface,
  locale,
  onClose,
}: {
  diff: ImportDiff;
  canReview: boolean;
  surface: Surface;
  locale: string;
  onClose: (applied: boolean) => void;
}) {
  const t = trpc as any;
  const valid = diff.changes.filter((c) => !c.errors.length);
  const [accepted, setAccepted] = useState<Set<string>>(() => new Set(valid.map((c) => c.key)));
  const [markReviewed, setMarkReviewed] = useState(false);
  const apply = t.i18n.applyImport.useMutation({ onSuccess: () => onClose(true) });
  const invalid = diff.changes.length - valid.length;

  return (
    <div className="border-b border-admin-border bg-admin-accent-soft/40 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-admin-ink">Import preview</h4>
          <p className="text-xs text-admin-muted">
            {diff.changes.length} changed ({invalid} with problems, not applied), {diff.unchanged} unchanged, {diff.blank} blank (skipped)
            {diff.unknownKeys.length > 0 && `, ${diff.unknownKeys.length} unknown keys ignored`}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canReview && (
            <label className="flex items-center gap-2 text-xs text-admin-ink">
              <input type="checkbox" className={checkboxClass} checked={markReviewed} onChange={(e) => setMarkReviewed(e.target.checked)} />
              Professionally reviewed
            </label>
          )}
          <button
            type="button"
            className={buttonClass.primary}
            disabled={accepted.size === 0 || apply.isPending}
            onClick={() =>
              apply.mutate({ surface, locale, markReviewed: canReview && markReviewed, changes: valid.filter((c) => accepted.has(c.key)).map((c) => ({ key: c.key, value: c.next })) })
            }
          >
            {apply.isPending ? 'Applying…' : `Apply ${accepted.size}`}
          </button>
          <button type="button" className={buttonClass.secondary} onClick={() => onClose(false)}>
            Cancel
          </button>
        </div>
      </div>
      {apply.error && <p className="mt-2 text-xs text-admin-danger">{apply.error.message}</p>}
      {diff.unknownKeys.length > 0 && <p className="mt-2 break-all text-xs text-admin-muted">Unknown: {diff.unknownKeys.slice(0, 10).join(', ')}{diff.unknownKeys.length > 10 ? '…' : ''}</p>}
      {diff.changes.length > 0 && (
        <div className="mt-3 max-h-[28rem] overflow-y-auto rounded-admin-sm border border-admin-border bg-white">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-[11px] uppercase tracking-wide text-admin-muted">
              <tr>
                <th className="w-8 px-3 py-2" />
                <th className="px-3 py-2 font-medium">Key</th>
                <th className="px-3 py-2 font-medium">Now</th>
                <th className="px-3 py-2 font-medium">From the file</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-border">
              {diff.changes.map((c) => (
                <tr key={c.key} className={cn(c.errors.length > 0 && 'bg-red-50')}>
                  <td className="px-3 py-2 align-top">
                    <input
                      type="checkbox"
                      aria-label={`Apply ${c.key}`}
                      className={checkboxClass}
                      disabled={c.errors.length > 0}
                      checked={accepted.has(c.key)}
                      onChange={() =>
                        setAccepted((prev) => {
                          const next = new Set(prev);
                          if (next.has(c.key)) next.delete(c.key);
                          else next.add(c.key);
                          return next;
                        })
                      }
                    />
                  </td>
                  <td className="admin-mono break-all px-3 py-2 align-top text-xs">{c.key}</td>
                  <td dir={dirFor(locale)} className="whitespace-pre-wrap px-3 py-2 align-top text-admin-muted">
                    {c.current ?? <em>(not translated)</em>}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <p dir={dirFor(locale)} className="whitespace-pre-wrap text-admin-ink">
                      {c.next}
                    </p>
                    {c.errors.map((e) => (
                      <p key={e} className="text-xs text-admin-danger">
                        {e}
                      </p>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

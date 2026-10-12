'use client';

import { useMemo, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/cn';
import { Segmented } from '@/components/admin/segmented';
import { StatusPill } from '@/components/admin/status-pill';

type Surface = 'hire' | 'partner' | 'worker' | 'vmsServer' | 'helpCenter';

type Row = {
  surface: Surface;
  locale: string;
  label: string;
  nativeLabel: string;
  isSource: boolean;
  enabled: boolean;
  rtl: boolean;
  total: number;
  present: number;
  completeness: number;
  missing: number;
  sameAsEnglish: number;
  needsReview: number;
  reviewed: number;
  machineTranslated: number;
  updatedAt: string | null;
};

type StatusData = {
  surfaces: Array<{ id: Surface; label: string; description: string }>;
  rows: Row[];
  helpCenter: { languages: string[]; sections: number; articles: number };
};

type DetailKey = {
  key: string;
  english: string;
  kind: 'missing' | 'needsReview' | 'reviewed' | 'sameAsEnglish';
  tag?: string;
  reviewedBy?: string;
  reviewedAt?: string;
};

const KIND_LABELS: Record<DetailKey['kind'], string> = {
  needsReview: 'Needs review',
  reviewed: 'Reviewed',
  missing: 'Missing',
  sameAsEnglish: 'Same as English',
};

const PARTNER_SURFACES: Surface[] = ['partner', 'worker', 'vmsServer', 'helpCenter'];
const MAX_KEYS_SHOWN = 300;

const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

function Bar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn('h-full rounded-full', value >= 100 ? 'bg-admin-ok' : value >= 95 ? 'bg-admin-accent' : 'bg-admin-warn')}
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
      <span className="tabular-nums text-xs text-admin-ink">{value}%</span>
    </div>
  );
}

/**
 * Translation status by surface and locale, with partner locale on/off and
 * professional-review tracking (API i18n.getTranslationStatus and friends).
 */
export function TranslationStatus() {
  const [surface, setSurface] = useState<Surface>('partner');
  const [selected, setSelected] = useState<string | null>(null);
  const status = (trpc as any).i18n.getTranslationStatus.useQuery(undefined, { refetchOnWindowFocus: false });
  const data = status.data as StatusData | undefined;
  const toggle = (trpc as any).i18n.setPartnerLocaleEnabled.useMutation({ onSuccess: () => void status.refetch() });

  const rows = useMemo(() => (data?.rows ?? []).filter((r) => r.surface === surface), [data, surface]);
  const meta = data?.surfaces.find((s) => s.id === surface);
  const isPartner = PARTNER_SURFACES.includes(surface);
  const selectedRow = rows.find((r) => r.locale === selected) ?? null;

  if (status.isLoading) return <div className="admin-panel py-16 text-center text-sm text-admin-muted">Loading…</div>;
  if (status.error || !data) {
    return <div className="admin-panel p-6 text-sm text-admin-danger">{status.error?.message ?? 'Could not load translation status.'}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="admin-panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-admin-border px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-admin-ink">Translation status</h2>
            <p className="mt-0.5 text-xs text-admin-muted">{meta?.description}</p>
          </div>
          <Segmented
            size="sm"
            ariaLabel="Product surface"
            value={surface}
            onChange={(v) => {
              setSurface(v);
              setSelected(null);
            }}
            options={data.surfaces.map((s) => ({ value: s.id, label: s.label }))}
          />
        </div>

        {isPartner && (
          <p className="border-b border-admin-border bg-slate-50 px-5 py-2 text-xs text-admin-muted">
            {surface === 'helpCenter'
              ? `${data.helpCenter.articles} articles in ${data.helpCenter.sections} sections, written in ${data.helpCenter.languages.join(', ')} only. Other languages show the English articles. `
              : ''}
            Hiding a language removes it from the language menu on partners.insighthire.com and the worker app, and the client VMS screens stop using it. It applies to every partner surface.
          </p>
        )}
        {surface === 'hire' && (
          <p className="border-b border-admin-border bg-slate-50 px-5 py-2 text-xs text-admin-muted">
            Turn Hire app languages on or off with the platform controls below.
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-admin-muted">
              <tr>
                <th className="px-5 py-2 font-medium">Language</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Complete</th>
                <th className="px-3 py-2 text-right font-medium">Missing</th>
                {surface !== 'hire' && surface !== 'helpCenter' && (
                  <>
                    <th className="px-3 py-2 text-right font-medium" title="Consent, legal and tax strings without a recorded professional review">
                      Needs review
                    </th>
                    <th className="px-3 py-2 text-right font-medium">Reviewed</th>
                    <th className="px-3 py-2 text-right font-medium" title="Translated strings with no recorded professional review">
                      Machine translated
                    </th>
                  </>
                )}
                {surface !== 'helpCenter' && (
                  <th className="px-3 py-2 text-right font-medium" title="Identical to the English text (often fine: names, codes, short labels)">
                    Same as English
                  </th>
                )}
                <th className="px-3 py-2 font-medium">Last updated</th>
                {isPartner && <th className="px-5 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-border">
              {rows.map((r) => (
                <tr
                  key={r.locale}
                  onClick={() => surface !== 'helpCenter' && setSelected(r.locale === selected ? null : r.locale)}
                  className={cn(
                    surface !== 'helpCenter' && 'cursor-pointer hover:bg-slate-50',
                    r.locale === selected && 'bg-admin-accent-soft',
                    !r.enabled && 'text-admin-muted',
                  )}
                >
                  <td className="px-5 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-admin-ink">{r.label}</span>
                      <span className="admin-mono text-xs text-admin-muted">{r.locale}</span>
                      {r.rtl && <StatusPill tone="info" dot={false}>RTL</StatusPill>}
                      {r.isSource && <StatusPill tone="brand" dot={false}>Source</StatusPill>}
                    </div>
                    <div className="text-xs text-admin-muted">{r.nativeLabel}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    {r.enabled ? <StatusPill tone="success">On</StatusPill> : <StatusPill tone="neutral">Hidden</StatusPill>}
                  </td>
                  <td className="px-3 py-2.5">
                    <Bar value={r.completeness} />
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{r.missing}</td>
                  {surface !== 'hire' && surface !== 'helpCenter' && (
                    <>
                      <td className={cn('px-3 py-2.5 text-right tabular-nums', r.needsReview > 0 && 'font-medium text-amber-700')}>{r.needsReview}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{r.reviewed}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{r.machineTranslated}</td>
                    </>
                  )}
                  {surface !== 'helpCenter' && <td className="px-3 py-2.5 text-right tabular-nums">{r.sameAsEnglish}</td>}
                  <td className="px-3 py-2.5 text-xs">{fmtDate(r.updatedAt)}</td>
                  {isPartner && (
                    <td className="px-5 py-2.5 text-right">
                      {r.locale !== 'en-US' && (
                        <button
                          type="button"
                          disabled={toggle.isPending}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggle.mutate({ locale: r.locale, enabled: !r.enabled });
                          }}
                          className="rounded-admin-sm border border-admin-border px-2.5 py-1 text-xs font-medium text-admin-ink hover:bg-slate-50 disabled:opacity-50"
                        >
                          {r.enabled ? 'Hide' : 'Show'}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {toggle.error && <p className="border-t border-admin-border px-5 py-2 text-xs text-admin-danger">{toggle.error.message}</p>}
      </div>

      {selectedRow && surface !== 'helpCenter' && (
        <LocaleDetail surface={surface} row={selectedRow} onChanged={() => void status.refetch()} />
      )}
    </div>
  );
}

function LocaleDetail({ surface, row, onChanged }: { surface: Surface; row: Row; onChanged: () => void }) {
  const detail = (trpc as any).i18n.getTranslationDetail.useQuery({ surface, locale: row.locale }, { refetchOnWindowFocus: false });
  const keys = ((detail.data as { keys?: DetailKey[] } | undefined)?.keys ?? []) as DetailKey[];
  const [kind, setKind] = useState<DetailKey['kind']>(row.needsReview > 0 ? 'needsReview' : row.missing > 0 ? 'missing' : 'sameAsEnglish');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const review = (trpc as any).i18n.setPartnerReviews.useMutation({
    onSuccess: () => {
      setPicked(new Set());
      void detail.refetch();
      onChanged();
    },
  });

  const counts = useMemo(() => {
    const c: Record<DetailKey['kind'], number> = { needsReview: 0, reviewed: 0, missing: 0, sameAsEnglish: 0 };
    for (const k of keys) c[k.kind] += 1;
    return c;
  }, [keys]);
  const shown = keys.filter((k) => k.kind === kind);
  const canReview = surface !== 'hire' && !row.isSource;
  const kinds: DetailKey['kind'][] = canReview ? ['needsReview', 'reviewed', 'missing', 'sameAsEnglish'] : ['missing', 'sameAsEnglish'];

  const mark = (list: string[], reviewed: boolean) => review.mutate({ locale: row.locale, keys: list, reviewed });

  return (
    <div className="admin-panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-admin-border px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-admin-ink">
            {row.label} <span className="admin-mono text-xs font-normal text-admin-muted">{row.locale}</span>
          </h3>
          <p className="mt-0.5 text-xs text-admin-muted">
            {canReview
              ? 'Consent, legal and tax strings need a professional translator. Until one is recorded, screens show the "English is binding" note. A review lapses when the translation changes.'
              : 'Keys with the English source text.'}
          </p>
        </div>
        <Segmented
          size="sm"
          ariaLabel="Key filter"
          value={kind}
          onChange={(v) => {
            setKind(v);
            setPicked(new Set());
          }}
          options={kinds.map((k) => ({ value: k, label: KIND_LABELS[k], count: counts[k] }))}
        />
      </div>

      {canReview && kind === 'needsReview' && shown.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-admin-border bg-slate-50 px-5 py-2">
          <button
            type="button"
            disabled={picked.size === 0 || review.isPending}
            onClick={() => mark([...picked], true)}
            className="rounded-admin-sm bg-admin-ink px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            Mark {picked.size || ''} selected reviewed
          </button>
          <button
            type="button"
            disabled={review.isPending}
            onClick={() => {
              if (window.confirm(`Record a professional review for all ${shown.length} strings in ${row.label}?`)) mark(shown.map((k) => k.key), true);
            }}
            className="rounded-admin-sm border border-admin-border bg-white px-3 py-1.5 text-xs font-medium text-admin-ink hover:bg-slate-100 disabled:opacity-50"
          >
            Mark all {shown.length} reviewed
          </button>
          {review.error && <span className="text-xs text-admin-danger">{review.error.message}</span>}
        </div>
      )}

      {detail.isLoading ? (
        <div className="py-10 text-center text-sm text-admin-muted">Loading…</div>
      ) : shown.length === 0 ? (
        <div className="py-10 text-center text-sm text-admin-muted">Nothing here.</div>
      ) : (
        <ul className="max-h-[32rem] divide-y divide-admin-border overflow-y-auto">
          {shown.slice(0, MAX_KEYS_SHOWN).map((k) => (
            <li key={k.key} className="flex items-start gap-3 px-5 py-2.5">
              {canReview && kind === 'needsReview' && (
                <input
                  type="checkbox"
                  aria-label={`Select ${k.key}`}
                  checked={picked.has(k.key)}
                  onChange={() =>
                    setPicked((prev) => {
                      const next = new Set(prev);
                      if (next.has(k.key)) next.delete(k.key);
                      else next.add(k.key);
                      return next;
                    })
                  }
                  className="mt-1 h-4 w-4 rounded border-admin-border text-admin-accent focus:ring-admin-accent"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="admin-mono break-all text-xs text-admin-ink">{k.key}</span>
                  {k.tag && <StatusPill tone={k.tag === 'tax' ? 'info' : k.tag === 'consent' ? 'warn' : 'neutral'} dot={false}>{k.tag}</StatusPill>}
                </div>
                <p className="mt-0.5 text-sm text-admin-muted">{k.english || <em>(no English text)</em>}</p>
                {k.kind === 'reviewed' && (
                  <p className="mt-0.5 text-xs text-admin-muted">
                    Reviewed by {k.reviewedBy} on {fmtDate(k.reviewedAt)}
                  </p>
                )}
              </div>
              {k.kind === 'reviewed' && (
                <button
                  type="button"
                  disabled={review.isPending}
                  onClick={() => mark([k.key], false)}
                  className="shrink-0 rounded-admin-sm border border-admin-border px-2.5 py-1 text-xs text-admin-ink hover:bg-slate-50 disabled:opacity-50"
                >
                  Undo
                </button>
              )}
            </li>
          ))}
          {shown.length > MAX_KEYS_SHOWN && (
            <li className="px-5 py-2.5 text-xs text-admin-muted">
              Showing the first {MAX_KEYS_SHOWN} of {shown.length}.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

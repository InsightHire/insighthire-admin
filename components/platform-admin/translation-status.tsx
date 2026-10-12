'use client';

import { useMemo, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/cn';
import { Segmented } from '@/components/admin/segmented';
import { StatusPill } from '@/components/admin/status-pill';
import { checkboxClass } from '@/components/admin/controls';
import { StringEditor } from './string-editor';

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
  overridden: number;
  updatedAt: string | null;
};

type HideSurface = 'partner' | 'worker' | 'clientVms';

type StatusData = {
  surfaces: Array<{ id: Surface; label: string; description: string }>;
  rows: Row[];
  helpCenter: { languages: string[]; sections: number; articles: number };
  hideSurfaces: Array<{ id: HideSurface; label: string }>;
  disabledBySurface: Record<HideSurface, string[]>;
  partnerLocales: Array<{ code: string; label: string; nativeLabel: string }>;
};

const PARTNER_SURFACES: Surface[] = ['partner', 'worker', 'vmsServer', 'helpCenter'];

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
 * Translation status by surface and locale, partner languages shown or hidden
 * per product, and a string editor per language (API i18n.getTranslationStatus
 * and friends).
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
            Show or hide languages per product under Language menus below. Click a language to edit its strings.
          </p>
        )}
        {surface === 'hire' && (
          <p className="border-b border-admin-border bg-slate-50 px-5 py-2 text-xs text-admin-muted">
            Turn Hire app languages on or off with the platform controls below. Click a language to edit its strings.
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
                  <>
                    <th className="px-3 py-2 text-right font-medium" title="Identical to the English text (often fine: names, codes, short labels)">
                      Same as English
                    </th>
                    <th className="px-3 py-2 text-right font-medium" title="Strings staff edited here (live without a deploy)">
                      Edited
                    </th>
                  </>
                )}
                <th className="px-5 py-2 font-medium">Last updated</th>
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
                  {surface !== 'helpCenter' && (
                    <>
                      <td className="px-3 py-2.5 text-right tabular-nums">{r.sameAsEnglish}</td>
                      <td className={cn('px-3 py-2.5 text-right tabular-nums', r.overridden > 0 && 'font-medium text-admin-accent-ink')}>{r.overridden}</td>
                    </>
                  )}
                  <td className="px-5 py-2.5 text-xs">{fmtDate(r.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedRow && surface !== 'helpCenter' && (
        <StringEditor
          key={`${surface}:${selectedRow.locale}`}
          surface={surface}
          locale={selectedRow.locale}
          label={selectedRow.label}
          canReview={surface !== 'hire' && !selectedRow.isSource}
          initialFilter={surface !== 'hire' && selectedRow.needsReview > 0 ? 'needsReview' : selectedRow.missing > 0 ? 'missing' : 'all'}
          onChanged={() => void status.refetch()}
        />
      )}

      {isPartner && <LanguageMenus data={data} pending={toggle.isPending} error={toggle.error?.message} onToggle={(v) => toggle.mutate(v)} />}
    </div>
  );
}

/** Which partner languages each product's language menu offers (en-US always). */
function LanguageMenus({
  data,
  pending,
  error,
  onToggle,
}: {
  data: StatusData;
  pending: boolean;
  error?: string;
  onToggle: (v: { locale: string; enabled: boolean; surface: HideSurface }) => void;
}) {
  return (
    <div className="admin-panel overflow-hidden">
      <div className="border-b border-admin-border px-5 py-4">
        <h2 className="text-sm font-semibold text-admin-ink">Language menus</h2>
        <p className="mt-0.5 text-xs text-admin-muted">
          A hidden language leaves that product's language menu, and anyone who picked it sees their agency's default (else English). Emails, digests and
          push notifications follow the same rule. English (US) can't be hidden.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-admin-muted">
            <tr>
              <th className="px-5 py-2 font-medium">Language</th>
              {data.hideSurfaces.map((s) => (
                <th key={s.id} className="px-3 py-2 text-center font-medium">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-admin-border">
            {data.partnerLocales.map((l) => (
              <tr key={l.code}>
                <td className="px-5 py-2">
                  <span className="font-medium text-admin-ink">{l.label}</span> <span className="admin-mono text-xs text-admin-muted">{l.code}</span>
                </td>
                {data.hideSurfaces.map((s) => {
                  const shown = !data.disabledBySurface[s.id]?.includes(l.code);
                  return (
                    <td key={s.id} className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        aria-label={`${l.label} on ${s.label}`}
                        className={checkboxClass}
                        checked={shown}
                        disabled={l.code === 'en-US' || pending}
                        onChange={() => onToggle({ locale: l.code, enabled: !shown, surface: s.id })}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && <p className="border-t border-admin-border px-5 py-2 text-xs text-admin-danger">{error}</p>}
    </div>
  );
}

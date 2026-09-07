'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';

const CATEGORY_LABELS: Record<string, string> = {
  hiring_intelligence: 'Hiring',
  meetings: 'Meetings & scheduling',
  communication: 'Communication',
  ats: 'ATS',
};

type Reason = 'GRANTED' | 'PLATFORM_OFF' | 'PLAN_REQUIRED' | 'NOT_GRANTED' | 'GRANT_EXPIRED' | 'CAP_REACHED';
type PlanTier = 'NONE' | 'HIRE' | 'ENTERPRISE';

type FeatureRow = {
  slug: string;
  name: string;
  description: string;
  category: string;
  caution: string | null;
  platformEnabled: boolean;
  granted: boolean;
  grantedAt: string | null;
  expiresAt: string | null;
  expired: boolean;
  reason: Reason;
  effective: boolean;
  minPlan: 'HIRE' | 'ENTERPRISE' | null;
  allowance: { unit: string; cap: number | null; overCap: 'BLOCK' | 'ALLOW'; source: 'plan' | 'override' } | null;
  usedThisPeriod: number | null;
};

const TIER_LABEL: Record<PlanTier, string> = { NONE: 'Screen', HIRE: 'Hire', ENTERPRISE: 'Enterprise' };

function statusPill(row: FeatureRow) {
  switch (row.reason) {
    case 'GRANTED':
      return ['Live', 'bg-green-100 text-green-800'];
    case 'PLATFORM_OFF':
      return [row.granted ? 'Granted · platform off' : 'Off', row.granted ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-500'];
    case 'PLAN_REQUIRED':
      return [`Needs ${row.minPlan === 'ENTERPRISE' ? 'Enterprise' : 'Hire'} plan`, 'bg-slate-100 text-slate-700'];
    case 'GRANT_EXPIRED':
      return ['Trial ended', 'bg-red-100 text-red-800'];
    case 'CAP_REACHED':
      return ['Cap reached', 'bg-red-100 text-red-800'];
    default:
      return ['Off', 'bg-gray-100 text-gray-500'];
  }
}

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function toDateInput(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toISOString().slice(0, 10);
}

/**
 * Per-tenant feature grants on the org detail page, plus trial end dates and
 * metered allowances. Uses the same toggleOrgFeatureGrant mutation as
 * Integrations → Tenant Access.
 */
export function OrgFeatureGrantsSection({ organizationId }: { organizationId: string }) {
  const [search, setSearch] = useState('');
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const adminTrpc = trpc as any;

  const query = adminTrpc.platformAdmin.listOrganizationFeatureGrants.useQuery(
    { organizationId },
    { retry: false, staleTime: 15_000 }
  );

  const toggleMutation = adminTrpc.platformAdmin.toggleOrgFeatureGrant.useMutation({
    onSuccess: () => query.refetch(),
    onSettled: () => setPendingSlug(null),
  });
  const limitMutation = adminTrpc.platformAdmin.setOrgFeatureLimit.useMutation({
    onSuccess: () => query.refetch(),
    onSettled: () => setPendingSlug(null),
  });

  const features: FeatureRow[] = (query.data?.features ?? []) as FeatureRow[];
  const planTier: PlanTier = (query.data?.planTier ?? 'NONE') as PlanTier;
  const period: string = (query.data?.period ?? '') as string;
  const grantedCount: number = (query.data?.grantedCount ?? 0) as number;
  const effectiveCount: number = (query.data?.effectiveCount ?? 0) as number;
  const totalCount: number = (query.data?.totalCount ?? 0) as number;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return features;
    return features.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.slug.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q)
    );
  }, [features, search]);

  const grouped = useMemo(() => {
    const byCategory = new Map<string, FeatureRow[]>();
    for (const row of filtered) {
      const list = byCategory.get(row.category) ?? [];
      list.push(row);
      byCategory.set(row.category, list);
    }
    return [...byCategory.entries()];
  }, [filtered]);

  function onToggle(row: FeatureRow) {
    setPendingSlug(row.slug);
    toggleMutation.mutate({ organizationId, slug: row.slug, granted: !row.granted });
  }

  function setExpiry(row: FeatureRow, value: string) {
    setPendingSlug(row.slug);
    toggleMutation.mutate({
      organizationId,
      slug: row.slug,
      granted: true,
      expiresAt: value ? new Date(`${value}T23:59:59.000Z`).toISOString() : null,
    });
  }

  function saveLimit(row: FeatureRow, cap: string, overCap: 'BLOCK' | 'ALLOW') {
    setPendingSlug(row.slug);
    const trimmed = cap.trim();
    limitMutation.mutate({
      organizationId,
      slug: row.slug,
      monthlyCap: trimmed === '' ? null : Number(trimmed),
      overCapBehavior: overCap,
    });
  }

  function clearLimit(row: FeatureRow) {
    setPendingSlug(row.slug);
    limitMutation.mutate({ organizationId, slug: row.slug, monthlyCap: null, overCapBehavior: 'BLOCK', remove: true });
  }

  const mutationError = (toggleMutation.error ?? limitMutation.error) as { message?: string } | null;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Enabled features</h2>
          <p className="text-sm text-gray-500 mt-1">
            Grant features for this tenant, set trial end dates, and override monthly allowances. The org still
            needs the platform switch on in{' '}
            <Link href="/integrations" className="text-blue-600 hover:text-blue-700 font-medium">
              Integrations
            </Link>{' '}
            before a grant is live.
          </p>
        </div>
        <div className="text-right">
          <span className="inline-block text-xs font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
            {TIER_LABEL[planTier]} plan
          </span>
          {totalCount > 0 && (
            <p className="text-xs text-gray-500 whitespace-nowrap mt-1">
              <span className="font-semibold text-gray-700">{effectiveCount}</span> live ·{' '}
              <span className="font-semibold text-gray-700">{grantedCount}</span> granted · {totalCount} total
            </p>
          )}
        </div>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search features (CRM, approvals, phone screens…)"
        className="mt-3 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
      />

      {mutationError?.message ? <p className="mt-2 text-sm text-red-600">{mutationError.message}</p> : null}

      {query.isLoading ? (
        <p className="py-8 text-center text-sm text-gray-500">Loading features…</p>
      ) : query.error ? (
        <p className="py-8 text-center text-sm text-red-600">
          Failed to load features. {String((query.error as { message?: string })?.message ?? '')}
        </p>
      ) : grouped.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">
          {search ? 'No features match your search.' : 'No grantable features found.'}
        </p>
      ) : (
        <div className="mt-4 space-y-5">
          {grouped.map(([category, rows]) => (
            <div key={category}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                {CATEGORY_LABELS[category] || category}
              </h3>
              <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
                {rows.map((row) => {
                  const pending = pendingSlug === row.slug && (toggleMutation.isPending || limitMutation.isPending);
                  const [pillText, pillClass] = statusPill(row);
                  const open = openSlug === row.slug;
                  const capText = row.allowance
                    ? row.allowance.cap === null
                      ? `${row.usedThisPeriod ?? 0} ${row.allowance.unit} this month · no cap`
                      : `${row.usedThisPeriod ?? 0} / ${row.allowance.cap} ${row.allowance.unit} this month${row.allowance.source === 'override' ? ' · override' : ''}${row.allowance.overCap === 'ALLOW' ? ' · overage allowed' : ''}`
                    : null;
                  return (
                    <div key={row.slug} className="bg-white hover:bg-gray-50">
                      <div className="flex items-start justify-between gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">{row.name}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${pillClass}`}>{pillText}</span>
                            {row.minPlan ? (
                              <span className="text-[11px] uppercase tracking-wide text-gray-400">
                                {row.minPlan === 'ENTERPRISE' ? 'Enterprise+' : 'Hire+'}
                              </span>
                            ) : null}
                            {row.expiresAt && !row.expired ? (
                              <span className="text-xs text-amber-700">Trial ends {fmtDate(row.expiresAt)}</span>
                            ) : null}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{row.description}</p>
                          {capText ? <p className="text-xs text-gray-600 mt-1 tabular-nums">{capText}</p> : null}
                          {row.caution && <p className="text-xs text-amber-800 mt-1">{row.caution}</p>}
                          {(row.granted || row.allowance) && (
                            <button
                              type="button"
                              onClick={() => setOpenSlug(open ? null : row.slug)}
                              className="mt-1 text-xs text-blue-600 hover:text-blue-700"
                            >
                              {open ? 'Hide options' : 'Trial & allowance…'}
                            </button>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => onToggle(row)}
                          disabled={pending}
                          className={`mt-0.5 relative inline-flex h-6 w-10 flex-shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                            row.granted ? 'bg-blue-600' : 'bg-gray-300'
                          }`}
                          title={row.granted ? 'Revoke for this tenant' : 'Grant for this tenant'}
                          aria-pressed={row.granted}
                          aria-label={`${row.granted ? 'Disable' : 'Enable'} ${row.name}`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                              row.granted ? 'translate-x-4' : ''
                            }`}
                          />
                        </button>
                      </div>
                      {open && (
                        <RowOptions
                          row={row}
                          period={period}
                          pending={pending}
                          onExpiry={(v) => setExpiry(row, v)}
                          onSaveLimit={(cap, over) => saveLimit(row, cap, over)}
                          onClearLimit={() => clearLimit(row)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RowOptions({
  row,
  period,
  pending,
  onExpiry,
  onSaveLimit,
  onClearLimit,
}: {
  row: FeatureRow;
  period: string;
  pending: boolean;
  onExpiry: (value: string) => void;
  onSaveLimit: (cap: string, overCap: 'BLOCK' | 'ALLOW') => void;
  onClearLimit: () => void;
}) {
  const [expiry, setExpiryValue] = useState(toDateInput(row.expiresAt));
  const [cap, setCap] = useState(row.allowance?.source === 'override' && row.allowance.cap !== null ? String(row.allowance.cap) : '');
  const [overCap, setOverCap] = useState<'BLOCK' | 'ALLOW'>(row.allowance?.source === 'override' ? row.allowance.overCap : 'BLOCK');

  return (
    <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 grid gap-4 sm:grid-cols-2 text-sm">
      {row.granted && (
        <div>
          <label className="block text-xs font-semibold text-gray-700">Trial / beta ends</label>
          <p className="text-xs text-gray-500 mb-1">Grant switches off at the end of this day. Leave blank for open-ended.</p>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={expiry}
              onChange={(e) => setExpiryValue(e.target.value)}
              className="px-2 py-1 border border-gray-300 rounded text-sm"
            />
            <button
              type="button"
              disabled={pending}
              onClick={() => onExpiry(expiry)}
              className="px-2 py-1 text-xs font-medium rounded bg-gray-900 text-white disabled:opacity-50"
            >
              Save
            </button>
            {row.expiresAt && (
              <button type="button" disabled={pending} onClick={() => { setExpiryValue(''); onExpiry(''); }} className="text-xs text-gray-600 underline">
                Clear
              </button>
            )}
          </div>
        </div>
      )}
      {row.allowance && (
        <div>
          <label className="block text-xs font-semibold text-gray-700">Monthly allowance ({row.allowance.unit})</label>
          <p className="text-xs text-gray-500 mb-1">
            Plan default applies when blank. Usage period {period}. Over the cap: block, or allow and record the overage.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={0}
              value={cap}
              placeholder="plan default"
              onChange={(e) => setCap(e.target.value)}
              className="w-28 px-2 py-1 border border-gray-300 rounded text-sm tabular-nums"
            />
            <select value={overCap} onChange={(e) => setOverCap(e.target.value as 'BLOCK' | 'ALLOW')} className="px-2 py-1 border border-gray-300 rounded text-sm">
              <option value="BLOCK">Block at cap</option>
              <option value="ALLOW">Allow, record overage</option>
            </select>
            <button
              type="button"
              disabled={pending}
              onClick={() => onSaveLimit(cap, overCap)}
              className="px-2 py-1 text-xs font-medium rounded bg-gray-900 text-white disabled:opacity-50"
            >
              Save override
            </button>
            {row.allowance.source === 'override' && (
              <button type="button" disabled={pending} onClick={onClearLimit} className="text-xs text-gray-600 underline">
                Use plan default
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

'use client';
export const dynamic = 'force-dynamic';

/**
 * Every tenant × every tenant-level configuration on one screen: add-on
 * modules (grants), legal-gated features, platform flag overrides and the
 * support toggles. Clicking a cell uses the same mutation as the org page,
 * Legal review or Feature flags screen it mirrors.
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/cn';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { useIsSuperAdmin } from '@/lib/use-super-admin';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { PageHeader } from '@/components/admin/page-header';
import { FilterBar, FilterInput, FilterSelect } from '@/components/admin/filter-bar';
import { SeverityBadge } from '@/components/admin/severity-badge';
import {
  CATEGORY_LABELS,
  TIER_LABEL,
  featureCellState,
  filterMatrixOrgs,
  flagCellState,
  legalCellState,
  type CellState,
  type CellTone,
  type MatrixFeature,
  type MatrixOrg,
  type OrgKindFilter,
  type PlanTier,
} from '@/lib/tenant-matrix';

type View = 'modules' | 'legal' | 'flags' | 'settings';

const VIEWS: Array<{ id: View; label: string }> = [
  { id: 'modules', label: 'Modules' },
  { id: 'legal', label: 'Legal gates' },
  { id: 'flags', label: 'Flag overrides' },
  { id: 'settings', label: 'Support settings' },
];

const TONE_CLASS: Record<CellTone, string> = {
  live: 'bg-emerald-500 text-white border-emerald-600',
  blocked: 'bg-amber-100 text-amber-800 border-amber-300',
  problem: 'bg-red-100 text-red-700 border-red-300',
  off: 'bg-white text-transparent border-slate-200 hover:border-slate-400',
  'inherit-on': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  demo: 'bg-violet-100 text-violet-800 border-violet-200',
};

const LEGAL_STATUS: Record<string, [string, 'ok' | 'warn' | 'critical' | 'muted']> = {
  APPROVED: ['Approved', 'ok'],
  IN_REVIEW: ['In review', 'warn'],
  NEEDS_REVIEW: ['Needs review', 'muted'],
  REJECTED: ['Rejected', 'critical'],
};

type Column = {
  key: string;
  name: string;
  group: string;
  note?: string;
  muted?: boolean;
  title: string;
  count: (o: MatrixOrg) => boolean;
  cell: (o: MatrixOrg) => CellState;
  disabled?: (o: MatrixOrg) => boolean;
  onClick: (o: MatrixOrg) => void;
};

function Cell({ state, pending, disabled, onClick }: { state: CellState; pending: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending || disabled}
      title={state.title}
      aria-label={state.title}
      className={cn(
        'flex h-6 w-6 items-center justify-center rounded border text-[10px] font-bold leading-none transition-colors disabled:cursor-not-allowed',
        TONE_CLASS[state.tone],
        pending && 'animate-pulse opacity-60',
        disabled && state.tone === 'off' && 'hover:border-slate-200',
      )}
    >
      {state.label}
    </button>
  );
}

function LegendSwatch({ tone, label, text }: { tone: CellTone; label: string; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('flex h-4 w-4 items-center justify-center rounded border text-[9px] font-bold', TONE_CLASS[tone], tone === 'off' && 'text-transparent')}>
        {label}
      </span>
      {text}
    </span>
  );
}

function OrgCell({ org }: { org: MatrixOrg }) {
  return (
    <div className="min-w-0">
      <Link href={`/organizations/${org.id}`} className="block truncate font-medium text-admin-ink hover:text-admin-accent-ink hover:underline" title={org.name ?? org.id}>
        {org.name || '(Incomplete)'}
      </Link>
      <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] font-semibold uppercase tracking-wide">
        <span className="rounded bg-slate-100 px-1 text-slate-700">{TIER_LABEL[org.planTier]}</span>
        {org.subscriptionStatus && org.subscriptionStatus !== 'ACTIVE' ? (
          <span className={cn('rounded px-1', org.subscriptionStatus === 'TRIAL' ? 'bg-sky-100 text-sky-800' : 'bg-red-100 text-red-800')}>
            {org.subscriptionStatus.replace('_', ' ')}
          </span>
        ) : null}
        {org.billingComped ? <span className="rounded bg-violet-50 px-1 text-violet-800">Comped</span> : null}
        {org.demoTenant ? <span className="rounded bg-violet-600 px-1 text-white">Demo</span> : null}
        {org.sandbox ? <span className="rounded bg-amber-100 px-1 text-amber-900">Sandbox</span> : null}
        {org.orgKind !== 'STANDARD' ? <span className="rounded bg-teal-50 px-1 text-teal-800">{org.orgKind.replace('_', ' ')}</span> : null}
      </div>
    </div>
  );
}

function TenantFeatureMatrixInner() {
  const { isLoading: authLoading } = useAdminAuth();
  const isSuperAdmin = useIsSuperAdmin();
  const adminTrpc = trpc as any;

  const [view, setView] = useState<View>('modules');
  const [search, setSearch] = useState('');
  const [tier, setTier] = useState<'' | PlanTier>('');
  const [status, setStatus] = useState('');
  const [kind, setKind] = useState<OrgKindFilter>('');
  const [category, setCategory] = useState('');
  const [hideUnused, setHideUnused] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = adminTrpc.platformAdmin.tenantFeatureMatrix.useQuery(undefined, {
    enabled: !authLoading,
    refetchOnWindowFocus: false,
    staleTime: 15_000,
  });
  const data = query.data as
    | { features: MatrixFeature[]; flags: Array<{ id: string; key: string; description: string | null; enabled: boolean }>; legal: Array<{ key: string; title: string; status: string }>; orgs: MatrixOrg[] }
    | undefined;

  const done = {
    onSuccess: () => { setError(null); return query.refetch(); },
    onError: (e: { message: string }) => setError(e.message),
    onSettled: () => setPending(null),
  };
  const toggleGrant = adminTrpc.platformAdmin.toggleOrgFeatureGrant.useMutation(done);
  const setLegal = adminTrpc.platformAdmin.legalReviewSetOrg.useMutation({
    ...done,
    onSuccess: (r: { syncError?: string | null }) => {
      setError(r?.syncError ? `Saved, but the VMS sync failed: ${r.syncError}` : null);
      return query.refetch();
    },
  });
  const updateFlag = adminTrpc.platformAdmin.updateFlag.useMutation(done);
  const setDashboard = adminTrpc.platformAdmin.setOrgDashboardSettings.useMutation(done);
  const setAuthoring = adminTrpc.platformAdmin.setOrgAuthoringSettings.useMutation(done);

  const orgs = useMemo(
    () => filterMatrixOrgs(data?.orgs ?? [], { search, tier, kind, status }),
    [data, search, tier, kind, status],
  );

  const categories = useMemo(() => {
    const seen = new Set<string>();
    for (const f of data?.features ?? []) seen.add(f.category);
    return [...seen];
  }, [data]);

  const columns: Column[] = (() => {
    if (!data) return [];
    const run = (key: string, fn: () => void) => { setPending(key); setError(null); fn(); };
    const orgName = (o: MatrixOrg) => o.name || o.id;

    if (view === 'modules') {
      const allOrgs = data.orgs;
      return data.features
        .filter((f) => !category || f.category === category)
        .filter((f) => !hideUnused || f.platformEnabled || allOrgs.some((o) => o.features[f.slug]?.granted))
        .map((f): Column => ({
          key: f.slug,
          name: f.name,
          group: CATEGORY_LABELS[f.category] || f.category,
          note: f.platformEnabled ? undefined : 'platform off',
          muted: !f.platformEnabled,
          title: `${f.name}\n${f.description}${f.minPlan ? `\nNeeds ${f.minPlan === 'ENTERPRISE' ? 'Enterprise' : 'Hire'} plan.` : ''}${f.platformEnabled ? '' : '\nPlatform switch off: live only for demo tenants. Granting turns the platform switch on.'}${f.caution ? `\n${f.caution}` : ''}`,
          count: (o) => o.features[f.slug]?.reason === 'GRANTED',
          cell: (o) => featureCellState(o.features[f.slug], f.minPlan),
          onClick: (o) => {
            const granted = o.features[f.slug]?.granted === true;
            if (granted && !window.confirm(`Revoke ${f.name} for ${orgName(o)}?`)) return;
            if (!granted && f.caution && !window.confirm(`${f.caution}\n\nGrant ${f.name} to ${orgName(o)}?`)) return;
            if (!granted && !f.platformEnabled && !window.confirm(`${f.name} is switched off platform-wide. Granting turns the platform switch on (other tenants still need their own grant). Continue?`)) return;
            run(`${o.id}:${f.slug}`, () => toggleGrant.mutate({ organizationId: o.id, slug: f.slug, granted: !granted }));
          },
        }));
    }

    if (view === 'legal') {
      return data.legal.map((l): Column => {
        const [statusLabel] = LEGAL_STATUS[l.status] ?? [l.status];
        return {
          key: l.key,
          name: l.title,
          group: 'Legal review',
          note: statusLabel.toLowerCase(),
          muted: l.status !== 'APPROVED',
          title: `${l.title}\nStatus: ${statusLabel}. Customers are live only when approved and enabled. Super admin only.`,
          count: (o) => o.legal[l.key]?.cleared === true,
          cell: (o) => legalCellState(o.legal[l.key], o.demoTenant, l.status),
          disabled: (o) => o.demoTenant || !isSuperAdmin,
          onClick: (o) => {
            const enabled = o.legal[l.key]?.enabled === true;
            if (!window.confirm(`${enabled ? 'Disable' : 'Enable'} ${l.title} for ${orgName(o)}?`)) return;
            run(`${o.id}:${l.key}`, () => setLegal.mutate({ key: l.key, organizationId: o.id, enabled: !enabled, note: null }));
          },
        };
      });
    }

    if (view === 'flags') {
      return data.flags.map((fl): Column => ({
        key: fl.key,
        name: fl.key,
        group: 'Platform flags',
        note: fl.enabled ? 'global on' : 'global off',
        muted: !fl.enabled,
        title: `${fl.key}${fl.description ? `\n${fl.description}` : ''}\nGlobal: ${fl.enabled ? 'on' : 'off'}. An org override always wins. Super admin only.`,
        count: (o) => (o.flagOverrides[fl.key] ?? fl.enabled) === true,
        cell: (o) => flagCellState(o.flagOverrides[fl.key], fl.enabled),
        disabled: () => !isSuperAdmin,
        onClick: (o) => {
          const override = o.flagOverrides[fl.key];
          const setOrgOverride = override === undefined
            ? { organizationId: o.id, enabled: !fl.enabled }
            : { organizationId: o.id, clear: true as const };
          run(`${o.id}:${fl.key}`, () => updateFlag.mutate({ id: fl.id, setOrgOverride }));
        },
      }));
    }

    return [
      {
        key: 'supportChatEnabled',
        name: 'Support chatbot',
        group: 'Support settings',
        title: 'Support chatbot in the recruiter dashboard (off by default).',
        count: (o) => o.supportChatEnabled,
        cell: (o) => (o.supportChatEnabled
          ? { tone: 'live', label: '✓', title: 'On. Click to turn off.' }
          : { tone: 'off', label: '', title: 'Off. Click to turn on.' }),
        onClick: (o) => run(`${o.id}:supportChatEnabled`, () => setDashboard.mutate({ organizationId: o.id, supportChatEnabled: !o.supportChatEnabled })),
      },
      {
        key: 'autoGenerateQuestionVideos',
        name: 'Auto avatar videos',
        group: 'Support settings',
        title: 'Render AI avatar videos automatically when a video question is saved (on by default). Turn off for quota or persona issues.',
        count: (o) => o.autoGenerateQuestionVideos,
        cell: (o) => (o.autoGenerateQuestionVideos
          ? { tone: 'live', label: '✓', title: 'On. Click to turn off.' }
          : { tone: 'off', label: '', title: 'Off. Click to turn on.' }),
        onClick: (o) => run(`${o.id}:autoGenerateQuestionVideos`, () => setAuthoring.mutate({ organizationId: o.id, autoGenerateQuestionVideos: !o.autoGenerateQuestionVideos })),
      },
    ];
  })();

  const groups: Array<{ name: string; span: number }> = [];
  for (const c of columns) {
    const last = groups[groups.length - 1];
    if (last && last.name === c.group) last.span += 1;
    else groups.push({ name: c.group, span: 1 });
  }

  const totals = data
    ? {
        orgs: data.orgs.length,
        demo: data.orgs.filter((o) => o.demoTenant).length,
        modulesOff: data.features.filter((f) => !f.platformEnabled).length,
        modules: data.features.length,
        expired: data.orgs.reduce((n, o) => n + Object.values(o.features).filter((c) => c.reason === 'GRANT_EXPIRED').length, 0),
        blocked: data.orgs.reduce((n, o) => n + Object.values(o.features).filter((c) => c.granted && (c.reason === 'PLATFORM_OFF' || c.reason === 'PLAN_REQUIRED')).length, 0),
      }
    : null;

  return (
    <div className="mx-auto max-w-[1800px] px-4 py-6 sm:px-6">
      <PageHeader
        eyebrow="Tenants"
        title="Feature matrix"
        description="Every tenant against every module, legal gate, flag override and support setting. Click a cell to change it; hover for why it is or isn't live."
      />

      {totals ? (
        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          <SeverityBadge severity="info">{totals.orgs} tenants</SeverityBadge>
          <SeverityBadge severity="muted">{totals.demo} demo</SeverityBadge>
          <SeverityBadge severity="muted">{totals.modulesOff} of {totals.modules} modules off platform-wide</SeverityBadge>
          {totals.blocked > 0 ? <SeverityBadge severity="warn">{totals.blocked} grants not live (platform or plan)</SeverityBadge> : null}
          {totals.expired > 0 ? <SeverityBadge severity="critical">{totals.expired} expired trials</SeverityBadge> : null}
        </div>
      ) : null}

      <div className="mb-3 flex flex-wrap gap-1 border-b border-admin-border">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setView(v.id)}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm font-medium',
              view === v.id ? 'border-admin-accent text-admin-ink' : 'border-transparent text-admin-muted hover:text-admin-ink',
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      <FilterBar>
        <FilterInput label="Search" value={search} onChange={setSearch} placeholder="Tenant name, domain or id…" />
        <FilterSelect
          label="Tenants"
          value={kind}
          onChange={(v) => setKind(v as OrgKindFilter)}
          options={[
            { value: '', label: 'All' },
            { value: 'customers', label: 'Customers (no demo/sandbox)' },
            { value: 'demo', label: 'Demo' },
            { value: 'sandbox', label: 'Sandboxes' },
            { value: 'agencies', label: 'Agencies & MSPs' },
          ]}
        />
        <FilterSelect
          label="Plan"
          value={tier}
          onChange={(v) => setTier(v as '' | PlanTier)}
          options={[
            { value: '', label: 'All' },
            { value: 'NONE', label: 'Screen' },
            { value: 'HIRE', label: 'Hire' },
            { value: 'ENTERPRISE', label: 'Enterprise' },
          ]}
        />
        <FilterSelect
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: '', label: 'All' },
            { value: 'ACTIVE', label: 'Active' },
            { value: 'TRIAL', label: 'Trial' },
            { value: 'PAST_DUE', label: 'Past due' },
            { value: 'CANCELED', label: 'Canceled' },
            { value: 'EXPIRED', label: 'Expired' },
          ]}
        />
        {view === 'modules' ? (
          <>
            <FilterSelect
              label="Category"
              value={category}
              onChange={setCategory}
              options={[{ value: '', label: 'All' }, ...categories.map((c) => ({ value: c, label: CATEGORY_LABELS[c] || c }))]}
            />
            <label className="flex items-center gap-2 text-xs text-admin-muted">
              <input
                type="checkbox"
                checked={hideUnused}
                onChange={(e) => setHideUnused(e.target.checked)}
                className="rounded border-admin-border text-admin-accent focus:ring-admin-accent"
              />
              Hide modules that are off and granted to nobody
            </label>
          </>
        ) : null}
      </FilterBar>

      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-admin-muted">
        {view === 'modules' ? (
          <>
            <LegendSwatch tone="live" label="✓" text="Live" />
            <LegendSwatch tone="live" label="T" text="Live, trial ends" />
            <LegendSwatch tone="blocked" label="!" text="Granted, not live (platform off or plan)" />
            <LegendSwatch tone="problem" label="×" text="Trial ended or cap reached" />
            <LegendSwatch tone="off" label="" text="Not granted" />
            <span>Demo tenants ignore the platform switch.</span>
          </>
        ) : view === 'legal' ? (
          <>
            <LegendSwatch tone="live" label="✓" text="Cleared (approved + enabled)" />
            <LegendSwatch tone="blocked" label="!" text="Enabled, awaiting approval" />
            <LegendSwatch tone="demo" label="D" text="Demo: always cleared" />
            <LegendSwatch tone="off" label="" text="Not enabled" />
            <Link href="/legal-review" className="font-medium text-admin-accent-ink hover:underline">Approve in Legal review →</Link>
          </>
        ) : view === 'flags' ? (
          <>
            <LegendSwatch tone="live" label="on" text="Override on" />
            <LegendSwatch tone="problem" label="off" text="Override off" />
            <LegendSwatch tone="inherit-on" label="" text="Follows global (on)" />
            <LegendSwatch tone="off" label="" text="Follows global (off)" />
            <Link href="/flags" className="font-medium text-admin-accent-ink hover:underline">Global switches in Feature flags →</Link>
          </>
        ) : (
          <>
            <LegendSwatch tone="live" label="✓" text="On" />
            <LegendSwatch tone="off" label="" text="Off" />
          </>
        )}
        {(view === 'legal' || view === 'flags') && !isSuperAdmin ? <span className="text-admin-warn">Read only: super admin to change.</span> : null}
      </div>

      {error ? (
        <div role="alert" className="mb-3 rounded-admin border border-admin-danger/30 bg-admin-danger-soft px-4 py-2 text-sm text-admin-danger">
          {error}
        </div>
      ) : null}

      {query.isLoading ? (
        <div className="admin-panel py-16 text-center text-sm text-admin-muted">Loading matrix…</div>
      ) : query.error ? (
        <div className="rounded-admin border border-admin-danger/30 bg-admin-danger-soft px-4 py-3 text-sm text-admin-danger">
          {(query.error as { message?: string }).message}
        </div>
      ) : columns.length === 0 ? (
        <div className="admin-panel py-16 text-center text-sm text-admin-muted">Nothing to show for this view.</div>
      ) : (
        <div className="admin-panel max-h-[calc(100vh-18rem)] overflow-auto">
          <table className="border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th rowSpan={2} className="sticky left-0 top-0 z-30 min-w-[16rem] max-w-[18rem] border-b border-r border-admin-border bg-white px-3 py-2 text-left align-bottom text-xs font-semibold text-admin-muted">
                  Tenant <span className="font-normal">({orgs.length})</span>
                </th>
                {view === 'modules' ? (
                  <th rowSpan={2} className="sticky top-0 z-20 border-b border-r border-admin-border bg-white px-2 py-2 align-bottom text-xs font-semibold text-admin-muted" title="Live modules / granted modules">
                    Live
                  </th>
                ) : null}
                {groups.map((g, i) => (
                  <th key={`${g.name}-${i}`} colSpan={g.span} className="sticky top-0 z-20 h-7 border-b border-r border-admin-border bg-slate-50 px-2 text-left text-[11px] font-semibold uppercase tracking-wide text-admin-muted">
                    {g.name}
                  </th>
                ))}
              </tr>
              <tr>
                {columns.map((c) => (
                  <th key={c.key} title={c.title} className="sticky top-7 z-20 h-40 w-8 border-b border-admin-border bg-white px-1 pb-2 align-bottom">
                    <div className={cn('mx-auto max-h-36 overflow-hidden text-left text-xs font-medium [writing-mode:vertical-rl] rotate-180', c.muted ? 'text-admin-muted' : 'text-admin-ink')}>
                      {c.name}
                      {c.note ? <span className="ml-1 text-[10px] font-normal italic text-admin-muted">· {c.note}</span> : null}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orgs.map((o) => (
                <tr key={o.id} className="group">
                  <td className="sticky left-0 z-10 min-w-[16rem] max-w-[18rem] border-b border-r border-admin-border bg-white px-3 py-1.5 group-hover:bg-slate-50">
                    <OrgCell org={o} />
                  </td>
                  {view === 'modules' ? (
                    <td className="border-b border-r border-admin-border px-2 text-center text-xs tabular-nums text-admin-muted group-hover:bg-slate-50" title={`${o.liveCount} live of ${o.grantedCount} granted`}>
                      <span className="font-semibold text-admin-ink">{o.liveCount}</span>/{o.grantedCount}
                    </td>
                  ) : null}
                  {columns.map((c) => (
                    <td key={c.key} className="border-b border-admin-border px-1 py-1 group-hover:bg-slate-50">
                      <div className="flex justify-center">
                        <Cell
                          state={c.cell(o)}
                          pending={pending === `${o.id}:${c.key}`}
                          disabled={c.disabled?.(o) ?? false}
                          onClick={() => c.onClick(o)}
                        />
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="sticky bottom-0 left-0 z-20 border-r border-t border-admin-border bg-slate-50 px-3 py-2 text-xs font-semibold text-admin-muted">
                  Live in shown tenants
                </td>
                {view === 'modules' ? <td className="sticky bottom-0 z-10 border-r border-t border-admin-border bg-slate-50" /> : null}
                {columns.map((c) => (
                  <td key={c.key} className="sticky bottom-0 z-10 border-t border-admin-border bg-slate-50 py-2 text-center text-xs tabular-nums text-admin-ink">
                    {orgs.filter(c.count).length}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
          {orgs.length === 0 ? <p className="py-10 text-center text-sm text-admin-muted">No tenants match these filters.</p> : null}
        </div>
      )}
    </div>
  );
}

export default function TenantFeatureMatrixPage() {
  return (
    <AuthenticatedLayout>
      <TenantFeatureMatrixInner />
    </AuthenticatedLayout>
  );
}

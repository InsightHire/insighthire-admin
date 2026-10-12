'use client';
export const dynamic = 'force-dynamic';

/**
 * Staff view of every tenant-level configuration: add-on modules, legal
 * gates, platform flag overrides, and support settings. Rows are
 * configurations (so the names stay readable). Columns are tenants.
 * Selecting a cell explains the state and applies the same mutation as the
 * org page, Legal review, or Feature flags.
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, Blocks, Building2, FlaskConical, LayoutGrid, MousePointerClick, PowerOff, TimerOff } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/cn';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { useIsSuperAdmin } from '@/lib/use-super-admin';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { PageHeader } from '@/components/admin/page-header';
import { FilterBar, FilterInput, FilterSelect } from '@/components/admin/filter-bar';
import { StatGrid, StatTile } from '@/components/admin/stat-tile';
import { EmptyState } from '@/components/admin/empty-state';
import { buttonClass, checkboxClass } from '@/components/admin/controls';
import {
  CATEGORY_LABELS,
  TIER_LABEL,
  buildConfigRows,
  filterMatrixOrgs,
  matrixCategories,
  sortMatrixOrgs,
  type CellState,
  type CellTone,
  type ConfigRow,
  type ConfigSection,
  type MatrixOrg,
  type MatrixPayload,
  type OrgKindFilter,
  type PlanTier,
} from '@/lib/tenant-matrix';

const SECTIONS: Array<{ id: ConfigSection; label: string }> = [
  { id: '', label: 'All' },
  { id: 'module', label: 'Modules' },
  { id: 'legal', label: 'Legal gates' },
  { id: 'flag', label: 'Flag overrides' },
  { id: 'setting', label: 'Support settings' },
];

const TONE_CLASS: Record<CellTone, string> = {
  live: 'bg-emerald-500 text-white border-emerald-600',
  blocked: 'bg-amber-100 text-amber-800 border-amber-300',
  problem: 'bg-red-100 text-red-700 border-red-300',
  off: 'bg-white text-transparent border-slate-200 hover:border-slate-400',
  'inherit-on': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  demo: 'bg-violet-100 text-violet-800 border-violet-200',
};

type Line =
  | { type: 'group'; name: string; count: number }
  | { type: 'row'; row: ConfigRow };

function toLines(rows: ConfigRow[]): Line[] {
  const lines: Line[] = [];
  let i = 0;
  while (i < rows.length) {
    const group = rows[i].group;
    let j = i;
    while (j < rows.length && rows[j].group === group) j += 1;
    lines.push({ type: 'group', name: group, count: j - i });
    for (let k = i; k < j; k += 1) lines.push({ type: 'row', row: rows[k] });
    i = j;
  }
  return lines;
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

function actionLabel(row: ConfigRow, org: MatrixOrg): string | null {
  if (row.kind === 'module' && row.module) {
    return org.features[row.module.slug]?.granted === true ? 'Revoke' : 'Grant';
  }
  if (row.kind === 'legal' && row.legal) {
    if (org.demoTenant) return null;
    return org.legal[row.legal.key]?.enabled === true ? 'Disable' : 'Enable';
  }
  if (row.kind === 'flag' && row.flag) {
    return org.flagOverrides[row.flag.key] === undefined
      ? (row.flag.enabled ? 'Override off' : 'Override on')
      : 'Remove override';
  }
  if (row.setting === 'supportChatEnabled') return org.supportChatEnabled ? 'Turn off' : 'Turn on';
  if (row.setting === 'autoGenerateQuestionVideos') return org.autoGenerateQuestionVideos ? 'Turn off' : 'Turn on';
  return null;
}

function readOnlyReason(row: ConfigRow, org: MatrixOrg, isSuperAdmin: boolean): string | null {
  if (row.kind === 'legal' && org.demoTenant) return 'Demo tenants are always cleared. This cannot be turned off here.';
  if ((row.kind === 'legal' || row.kind === 'flag') && !isSuperAdmin) return 'Super admin required to change this.';
  return null;
}

function TenantFeatureMatrixInner() {
  const { isLoading: authLoading } = useAdminAuth();
  const isSuperAdmin = useIsSuperAdmin();
  const adminTrpc = trpc as any;
  const searchParams = useSearchParams();

  const [section, setSection] = useState<ConfigSection>('');
  const [featureSearch, setFeatureSearch] = useState(searchParams.get('feature') ?? '');
  const [tenantSearch, setTenantSearch] = useState('');
  const [tier, setTier] = useState<'' | PlanTier>('');
  const [status, setStatus] = useState('');
  const [kind, setKind] = useState<OrgKindFilter>('');
  const [category, setCategory] = useState('');
  const [hideUnused, setHideUnused] = useState(true);
  const [problemsOnly, setProblemsOnly] = useState(false);
  const [selected, setSelected] = useState<{ rowKey: string; orgId: string } | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = adminTrpc.platformAdmin.tenantFeatureMatrix.useQuery(undefined, {
    enabled: !authLoading,
    refetchOnWindowFocus: false,
    staleTime: 15_000,
  });
  const data = query.data as MatrixPayload | undefined;

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
    () => sortMatrixOrgs(filterMatrixOrgs(data?.orgs ?? [], { search: tenantSearch, tier, kind, status })),
    [data, tenantSearch, tier, kind, status],
  );
  const categories = useMemo(() => matrixCategories(data?.features ?? []), [data]);
  const rows = useMemo(
    () => (data ? buildConfigRows(data, { section, category, search: featureSearch, hideUnused, problemsOnly }, orgs) : []),
    [data, section, category, featureSearch, hideUnused, problemsOnly, orgs],
  );
  const lines = useMemo(() => toLines(rows), [rows]);

  const selectedRow = rows.find((r) => r.key === selected?.rowKey) ?? null;
  const selectedOrg = orgs.find((o) => o.id === selected?.orgId) ?? null;
  const selection = selectedRow && selectedOrg ? { row: selectedRow, org: selectedOrg } : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function apply(row: ConfigRow, org: MatrixOrg) {
    const key = `${org.id}:${row.key}`;
    setPending(key);
    setError(null);
    if (row.kind === 'module' && row.module) {
      const granted = org.features[row.module.slug]?.granted === true;
      toggleGrant.mutate({ organizationId: org.id, slug: row.module.slug, granted: !granted });
      return;
    }
    if (row.kind === 'legal' && row.legal) {
      const enabled = org.legal[row.legal.key]?.enabled === true;
      setLegal.mutate({ key: row.legal.key, organizationId: org.id, enabled: !enabled, note: null });
      return;
    }
    if (row.kind === 'flag' && row.flag) {
      const override = org.flagOverrides[row.flag.key];
      const setOrgOverride = override === undefined
        ? { organizationId: org.id, enabled: !row.flag.enabled }
        : { organizationId: org.id, clear: true as const };
      updateFlag.mutate({ id: row.flag.id, setOrgOverride });
      return;
    }
    if (row.setting === 'supportChatEnabled') {
      setDashboard.mutate({ organizationId: org.id, supportChatEnabled: !org.supportChatEnabled });
      return;
    }
    if (row.setting === 'autoGenerateQuestionVideos') {
      setAuthoring.mutate({ organizationId: org.id, autoGenerateQuestionVideos: !org.autoGenerateQuestionVideos });
    }
  }

  const totals = data
    ? {
        orgs: data.orgs.length,
        demo: data.orgs.filter((o) => o.demoTenant).length,
        modules: data.features.length,
        modulesOff: data.features.filter((f) => !f.platformEnabled).length,
        legal: data.legal.length,
        flags: data.flags.length,
        blocked: data.orgs.reduce((n, o) => n + Object.values(o.features).filter((c) => c.granted && (c.reason === 'PLATFORM_OFF' || c.reason === 'PLAN_REQUIRED')).length, 0),
        expired: data.orgs.reduce((n, o) => n + Object.values(o.features).filter((c) => c.reason === 'GRANT_EXPIRED').length, 0),
      }
    : null;

  const showCategory = section === '' || section === 'module';

  return (
    <div className="mx-auto flex h-[calc(100vh-3.5rem)] max-w-[1800px] flex-col overflow-auto px-4 py-4 sm:px-6">
      <PageHeader
        className="mb-4"
        icon={<LayoutGrid />}
        breadcrumbs={[{ label: 'Tenants', href: '/organizations' }, { label: 'Tenant features' }]}
        title="Tenant features"
        description="Every module, legal gate, flag override, and support setting down the side. Each column is a tenant. Select a cell to see why it is or isn't live, then change it."
      />

      {totals ? (
        <StatGrid cols={6} className="mb-4">
          <StatTile label="Tenants" icon={Building2} tone="brand" value={totals.orgs} />
          <StatTile label="Modules" icon={Blocks} tone="info" value={totals.modules} hint={`${totals.legal} legal · ${totals.flags} flags`} />
          <StatTile label="Demo tenants" icon={FlaskConical} tone="muted" value={totals.demo} />
          <StatTile label="Off platform-wide" icon={PowerOff} tone="muted" value={totals.modulesOff} hint="Modules" />
          <StatTile label="Grants not live" icon={AlertTriangle} tone={totals.blocked > 0 ? 'warn' : 'muted'} value={totals.blocked} />
          <StatTile label="Expired trials" icon={TimerOff} tone={totals.expired > 0 ? 'critical' : 'muted'} value={totals.expired} />
        </StatGrid>
      ) : null}

      <div className="mb-3 flex flex-wrap gap-1 border-b border-admin-border">
        {SECTIONS.map((s) => (
          <button
            key={s.id || 'all'}
            type="button"
            onClick={() => setSection(s.id)}
            aria-current={section === s.id ? 'page' : undefined}
            className={cn(
              'relative whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-colors',
              section === s.id ? 'text-admin-accent-ink' : 'text-admin-muted hover:text-admin-ink',
            )}
          >
            {s.label}
            {section === s.id ? (
              <span className="nav-indicator absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-admin-accent" />
            ) : null}
          </button>
        ))}
      </div>

      <FilterBar>
        <FilterInput label="Feature" value={featureSearch} onChange={setFeatureSearch} placeholder="CRM, SMS, early pay…" />
        <FilterInput label="Tenant" value={tenantSearch} onChange={setTenantSearch} placeholder="Name, domain, or id…" />
        <FilterSelect
          label="Tenants"
          value={kind}
          onChange={(v) => setKind(v as OrgKindFilter)}
          options={[
            { value: '', label: 'All' },
            { value: 'customers', label: 'Customers' },
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
        {showCategory ? (
          <FilterSelect
            label="Category"
            value={category}
            onChange={setCategory}
            options={[{ value: '', label: 'All' }, ...categories.map((c) => ({ value: c, label: CATEGORY_LABELS[c] || c }))]}
          />
        ) : null}
        <label className="flex items-center gap-2 text-xs text-admin-muted">
          <input
            type="checkbox"
            checked={hideUnused}
            onChange={(e) => setHideUnused(e.target.checked)}
            className={checkboxClass}
          />
          Hide modules off and granted to nobody
        </label>
        <label className="flex items-center gap-2 text-xs text-admin-muted">
          <input
            type="checkbox"
            checked={problemsOnly}
            onChange={(e) => setProblemsOnly(e.target.checked)}
            className={checkboxClass}
          />
          Problems only
        </label>
      </FilterBar>

      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-admin-muted">
        <LegendSwatch tone="live" label="✓" text="Live" />
        <LegendSwatch tone="live" label="T" text="Live, trial ends" />
        <LegendSwatch tone="blocked" label="!" text="Granted, not live" />
        <LegendSwatch tone="problem" label="×" text="Ended, capped, or forced off" />
        <LegendSwatch tone="demo" label="D" text="Demo, always cleared" />
        <LegendSwatch tone="inherit-on" label="" text="Follows a global switch that is on" />
        <LegendSwatch tone="off" label="" text="Off" />
        <span>Violet column names are demo tenants. Amber names are sandboxes.</span>
        {(section === '' || section === 'legal' || section === 'flag') && !isSuperAdmin ? (
          <span className="text-admin-warn">Legal gates and flags are read only until you are a super admin.</span>
        ) : null}
      </div>

      {error ? (
        <div role="alert" className="mb-3 rounded-admin border border-admin-danger/30 bg-admin-danger-soft px-4 py-2 text-sm text-admin-danger">
          {error}
        </div>
      ) : null}

      <Inspector
        selection={selection}
        pending={pending}
        isSuperAdmin={isSuperAdmin}
        onApply={apply}
      />

      {query.isLoading ? (
        <div className="admin-panel py-16 text-center text-sm text-admin-muted">Loading tenant features…</div>
      ) : query.error ? (
        <div className="rounded-admin border border-admin-danger/30 bg-admin-danger-soft px-4 py-3 text-sm text-admin-danger">
          {(query.error as { message?: string }).message}
        </div>
      ) : orgs.length === 0 ? (
        <EmptyState icon={<Building2 />} title="No tenants match these filters." />
      ) : rows.length === 0 ? (
        <EmptyState icon={<Blocks />} title="No configurations match these filters." />
      ) : (
        <div className="admin-panel min-h-[20rem] flex-1 overflow-auto">
          <table className="border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-30 min-w-[18rem] border-b border-r border-admin-border bg-white px-3 py-2 text-left align-bottom text-xs font-semibold text-admin-muted">
                  Configuration <span className="font-normal">({rows.length})</span>
                </th>
                {orgs.map((o) => (
                  <th key={o.id} className="sticky top-0 z-20 h-44 w-9 border-b border-admin-border bg-white px-0.5 pb-2 align-bottom">
                    <Link
                      href={`/organizations/${o.id}`}
                      title={`${o.name || o.id} · ${TIER_LABEL[o.planTier]}${o.subscriptionStatus ? ` · ${o.subscriptionStatus}` : ''}${o.demoTenant ? ' · Demo' : ''}${o.sandbox ? ' · Sandbox' : ''}${o.billingComped ? ' · Comped' : ''}`}
                      className={cn(
                        'mx-auto block max-h-40 overflow-hidden text-left text-[11px] font-medium leading-tight [writing-mode:vertical-rl] rotate-180 hover:underline',
                        o.demoTenant ? 'text-violet-800' : o.sandbox ? 'text-amber-800' : 'text-admin-ink',
                      )}
                    >
                      {o.name || '(Incomplete)'}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                if (line.type === 'group') {
                  return (
                    <tr key={`group:${line.name}`}>
                      <th className="sticky left-0 z-10 border-b border-r border-admin-border bg-slate-100 px-3 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-admin-muted">
                        {line.name} <span className="font-normal">({line.count})</span>
                      </th>
                      {orgs.map((o) => (
                        <th key={o.id} className="border-b border-admin-border bg-slate-100" />
                      ))}
                    </tr>
                  );
                }
                const row = line.row;
                return (
                  <tr key={row.key} className="group">
                    <th className="sticky left-0 z-10 min-w-[18rem] max-w-[22rem] border-b border-r border-admin-border bg-white px-3 py-1.5 text-left font-normal group-hover:bg-slate-50">
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 w-6 shrink-0 text-right text-xs tabular-nums text-admin-muted" title="On for this many tenants in view">
                          {orgs.filter(row.on).length}
                        </span>
                        <div className="min-w-0">
                          <div className={cn('truncate text-sm font-medium', row.muted ? 'text-admin-muted' : 'text-admin-ink')} title={row.detail}>
                            {row.name}
                          </div>
                          <div className="truncate text-[11px] text-admin-muted">{row.meta}</div>
                        </div>
                      </div>
                    </th>
                    {orgs.map((o) => {
                      const state = row.cell(o);
                      const isSelected = selected?.rowKey === row.key && selected.orgId === o.id;
                      const isPending = pending === `${o.id}:${row.key}`;
                      const locked = readOnlyReason(row, o, isSuperAdmin) !== null;
                      return (
                        <td
                          key={o.id}
                          className={cn(
                            'border-b border-admin-border px-1 py-1 group-hover:bg-slate-50',
                            selected?.orgId === o.id && 'bg-slate-50',
                          )}
                        >
                          <div className="flex justify-center">
                            <button
                              type="button"
                              onClick={() => setSelected({ rowKey: row.key, orgId: o.id })}
                              disabled={isPending}
                              title={state.title}
                              aria-label={`${row.name}, ${o.name || o.id}. ${state.title}`}
                              aria-pressed={isSelected}
                              className={cn(
                                'flex h-7 w-7 items-center justify-center rounded border text-[11px] font-bold leading-none transition-colors disabled:cursor-wait',
                                TONE_CLASS[state.tone],
                                isPending && 'animate-pulse opacity-60',
                                locked && state.tone === 'off' && 'hover:border-slate-200',
                                isSelected && 'ring-2 ring-slate-900 ring-offset-1',
                              )}
                            >
                              {state.label}
                            </button>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td className="sticky bottom-0 left-0 z-20 border-r border-t border-admin-border bg-slate-50 px-3 py-2 text-xs font-semibold text-admin-muted">
                  On in view
                </td>
                {orgs.map((o) => (
                  <td key={o.id} className="sticky bottom-0 z-10 border-t border-admin-border bg-slate-50 py-2 text-center text-[11px] tabular-nums text-admin-ink">
                    {rows.filter((r) => r.on(o)).length}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

function Inspector({
  selection,
  pending,
  isSuperAdmin,
  onApply,
}: {
  selection: { row: ConfigRow; org: MatrixOrg } | null;
  pending: string | null;
  isSuperAdmin: boolean;
  onApply: (row: ConfigRow, org: MatrixOrg) => void;
}) {
  if (!selection) {
    return (
      <div className="admin-panel mb-3 flex items-center gap-3 border-dashed px-4 py-3 text-sm text-admin-muted shadow-none">
        <MousePointerClick className="h-4 w-4 shrink-0" />
        Select a cell to change it. The number beside each name is how many tenants in view have it on.
      </div>
    );
  }

  const { row, org } = selection;
  const state = row.cell(org);
  const locked = readOnlyReason(row, org, isSuperAdmin);
  const label = actionLabel(row, org);
  const granting = row.kind === 'module' && row.module && org.features[row.module.slug]?.granted !== true;
  const busy = pending === `${org.id}:${row.key}`;

  return (
    <div className="admin-panel mb-3 flex flex-wrap items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-admin-ink">
          {row.name}
          <span className="font-normal text-admin-muted"> · {org.name || org.id}</span>
        </p>
        <p className="mt-0.5 text-sm text-admin-muted">{state.title}</p>
        <p className="mt-0.5 text-sm text-admin-muted">{row.kind === 'module' && row.module ? row.module.description : row.detail}</p>
        {granting && row.module?.caution ? (
          <p className="mt-1 text-sm text-amber-800">{row.module.caution}</p>
        ) : null}
        {granting && row.module && !row.module.platformEnabled ? (
          <p className="mt-1 text-sm text-amber-800">
            This module is off platform-wide. Granting turns the platform switch on. Other tenants still need their own grant.
          </p>
        ) : null}
        {locked ? <p className="mt-1 text-sm text-admin-warn">{locked}</p> : null}
        <div className="mt-2 flex flex-wrap gap-3 text-xs">
          <Link href={`/organizations/${org.id}`} className="font-medium text-admin-accent-ink hover:underline">Open organization</Link>
          {row.kind === 'module' ? <Link href="/integrations" className="font-medium text-admin-accent-ink hover:underline">Platform switches</Link> : null}
          {row.kind === 'legal' ? <Link href="/legal-review" className="font-medium text-admin-accent-ink hover:underline">Legal review</Link> : null}
          {row.kind === 'flag' ? <Link href="/flags" className="font-medium text-admin-accent-ink hover:underline">Feature flags</Link> : null}
        </div>
      </div>
      {label && !locked ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => onApply(row, org)}
          className={cn(
            'shrink-0',
            label === 'Revoke' || label === 'Disable' || label === 'Turn off' || label === 'Override off' ? buttonClass.danger : buttonClass.primary,
          )}
        >
          {busy ? 'Saving…' : `${label} for ${org.name || 'this tenant'}`}
        </button>
      ) : null}
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

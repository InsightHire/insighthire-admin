/**
 * Display rules for admin → Tenants → Tenant features
 * (platformAdmin.tenantFeatureMatrix).
 *
 * The page lists every staff-controlled configuration as a row (add-on
 * modules, legal gates, platform flag overrides, support settings) and every
 * tenant as a column.
 */

export type GateReason = 'GRANTED' | 'PLATFORM_OFF' | 'PLAN_REQUIRED' | 'NOT_GRANTED' | 'GRANT_EXPIRED' | 'CAP_REACHED';
export type PlanTier = 'NONE' | 'HIRE' | 'ENTERPRISE';
export type CellTone = 'live' | 'blocked' | 'problem' | 'off' | 'inherit-on' | 'demo';

export type MatrixOrg = {
  id: string;
  name: string | null;
  domain: string | null;
  subscriptionPlan: string | null;
  subscriptionStatus: string | null;
  planTier: PlanTier;
  billingComped: boolean;
  orgKind: string;
  demoTenant: boolean;
  sandbox: boolean;
  sandboxParentId: string | null;
  createdAt: string;
  supportChatEnabled: boolean;
  autoGenerateQuestionVideos: boolean;
  features: Record<string, { granted: boolean; reason: GateReason; expiresAt: string | null }>;
  liveCount: number;
  grantedCount: number;
  flagOverrides: Record<string, boolean>;
  legal: Record<string, { enabled: boolean; cleared: boolean }>;
};

export type MatrixFeature = {
  slug: string;
  name: string;
  description: string;
  category: string;
  sortOrder: number;
  platformEnabled: boolean;
  minPlan: 'HIRE' | 'ENTERPRISE' | null;
  metered: boolean;
  caution: string | null;
};

export type CellState = { tone: CellTone; label: string; title: string };

export const TIER_LABEL: Record<PlanTier, string> = { NONE: 'Screen', HIRE: 'Hire', ENTERPRISE: 'Enterprise' };

export const CATEGORY_LABELS: Record<string, string> = {
  hiring_intelligence: 'Hiring',
  meetings: 'Meetings',
  communication: 'Communication',
  integrations: 'Integrations',
  talent: 'Talent',
  vouch: 'Vouch',
  ats: 'ATS',
};

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export function featureCellState(cell: MatrixOrg['features'][string] | undefined, minPlan: MatrixFeature['minPlan']): CellState {
  if (!cell || !cell.granted) {
    return { tone: 'off', label: '', title: 'Not granted.' };
  }
  const trial = cell.expiresAt ? ` Trial ends ${fmtDay(cell.expiresAt)}.` : '';
  switch (cell.reason) {
    case 'GRANTED':
      return { tone: 'live', label: cell.expiresAt ? 'T' : '✓', title: `Live.${trial}` };
    case 'PLATFORM_OFF':
      return { tone: 'blocked', label: '!', title: 'Granted, but the platform switch is off, so it is not live.' };
    case 'PLAN_REQUIRED':
      return { tone: 'blocked', label: '!', title: `Granted, but needs the ${minPlan === 'ENTERPRISE' ? 'Enterprise' : 'Hire'} plan, so it is not live.` };
    case 'GRANT_EXPIRED':
      return { tone: 'problem', label: '×', title: `Trial ended ${cell.expiresAt ? fmtDay(cell.expiresAt) : ''}. Not live.` };
    case 'CAP_REACHED':
      return { tone: 'problem', label: '×', title: 'Monthly cap reached, blocked until next month.' };
    default:
      return { tone: 'off', label: '', title: 'Not granted.' };
  }
}

/** Flag cell: an override always wins; no override follows the global value. */
export function flagCellState(override: boolean | undefined, globalEnabled: boolean): CellState {
  if (override === true) return { tone: 'live', label: '✓', title: 'Override: on for this org. Select the cell to remove the override.' };
  if (override === false) return { tone: 'problem', label: '×', title: 'Override: off for this org. Select the cell to remove the override.' };
  return globalEnabled
    ? { tone: 'inherit-on', label: '', title: 'Follows global (on). Select the cell to override off for this org.' }
    : { tone: 'off', label: '', title: 'Follows global (off). Select the cell to override on for this org.' };
}

export function legalCellState(cell: { enabled: boolean; cleared: boolean } | undefined, demoTenant: boolean, status: string): CellState {
  if (demoTenant) return { tone: 'demo', label: 'D', title: 'Demo tenant: always cleared.' };
  if (cell?.cleared) return { tone: 'live', label: '✓', title: 'Enabled and approved: live.' };
  if (cell?.enabled) {
    return { tone: 'blocked', label: '!', title: `Enabled for this org, but the feature is ${status.replace('_', ' ').toLowerCase()}, so it is not live.` };
  }
  return { tone: 'off', label: '', title: 'Not enabled.' };
}

export type OrgKindFilter = '' | 'customers' | 'demo' | 'sandbox' | 'agencies';

export function filterMatrixOrgs(
  orgs: MatrixOrg[],
  f: { search: string; tier: '' | PlanTier; kind: OrgKindFilter; status: string },
): MatrixOrg[] {
  const q = f.search.trim().toLowerCase();
  return orgs.filter((o) => {
    if (q && !`${o.name ?? ''} ${o.domain ?? ''} ${o.id}`.toLowerCase().includes(q)) return false;
    if (f.tier && o.planTier !== f.tier) return false;
    if (f.status && o.subscriptionStatus !== f.status) return false;
    if (f.kind === 'demo' && !o.demoTenant) return false;
    if (f.kind === 'sandbox' && !o.sandbox) return false;
    if (f.kind === 'agencies' && o.orgKind === 'STANDARD') return false;
    if (f.kind === 'customers' && (o.demoTenant || o.sandbox)) return false;
    return true;
  });
}

/** Customers first, then demo tenants, then sandboxes. Name within each group. */
export function sortMatrixOrgs(orgs: MatrixOrg[]): MatrixOrg[] {
  const rank = (o: MatrixOrg) => (o.sandbox ? 2 : o.demoTenant ? 1 : 0);
  return [...orgs].sort((a, b) => {
    const byKind = rank(a) - rank(b);
    if (byKind) return byKind;
    return (a.name ?? a.id).localeCompare(b.name ?? b.id, 'en');
  });
}

export type MatrixFlag = { id: string; key: string; description: string | null; enabled: boolean };
export type MatrixLegal = { key: string; title: string; status: string };
export type MatrixPayload = {
  features: MatrixFeature[];
  flags: MatrixFlag[];
  legal: MatrixLegal[];
  orgs: MatrixOrg[];
};

export type ConfigKind = 'module' | 'legal' | 'flag' | 'setting';
export type ConfigSection = '' | ConfigKind;
export type SupportSettingKey = 'supportChatEnabled' | 'autoGenerateQuestionVideos';

export type ConfigRow = {
  key: string;
  kind: ConfigKind;
  name: string;
  group: string;
  /** Short line under the name (platform switch, plan, global flag). */
  meta: string;
  detail: string;
  muted: boolean;
  module?: MatrixFeature;
  legal?: MatrixLegal;
  flag?: MatrixFlag;
  setting?: SupportSettingKey;
  cell: (org: MatrixOrg) => CellState;
  /** Counted as on in the column footer: live grant, cleared legal gate, effective flag, or setting on. */
  on: (org: MatrixOrg) => boolean;
};

export type ConfigRowFilters = {
  section: ConfigSection;
  category: string;
  search: string;
  /** Drop modules that are off platform-wide and granted to nobody. */
  hideUnused: boolean;
  /** Keep rows where a visible tenant is granted or enabled but not actually live. */
  problemsOnly: boolean;
};

export const LEGAL_STATUS_LABEL: Record<string, string> = {
  APPROVED: 'Approved',
  IN_REVIEW: 'In review',
  NEEDS_REVIEW: 'Needs review',
  REJECTED: 'Rejected',
};

const CATEGORY_ORDER = [
  'hiring_intelligence',
  'meetings',
  'communication',
  'talent',
  'vouch',
  'integrations',
  'ats',
];

export function matrixCategories(features: MatrixFeature[]): string[] {
  const seen = new Set(features.map((f) => f.category));
  const known = CATEGORY_ORDER.filter((c) => seen.has(c));
  const rest = [...seen].filter((c) => !CATEGORY_ORDER.includes(c)).sort((a, b) => a.localeCompare(b, 'en'));
  return [...known, ...rest];
}

function attention(state: CellState): boolean {
  return state.tone === 'blocked' || state.tone === 'problem';
}

function moduleMeta(f: MatrixFeature): string {
  const bits = [
    f.platformEnabled ? 'Platform on' : 'Platform off',
    f.minPlan === 'ENTERPRISE' ? 'Enterprise+' : f.minPlan === 'HIRE' ? 'Hire+' : null,
    f.metered ? 'Monthly cap' : null,
  ];
  return bits.filter(Boolean).join(' · ');
}

function settingCell(on: boolean, onTitle: string, offTitle: string): CellState {
  return on
    ? { tone: 'live', label: '✓', title: onTitle }
    : { tone: 'off', label: '', title: offTitle };
}

/**
 * Every staff-controlled configuration, in display order.
 * `hideUnused` looks at every org in the payload, so a tenant filter cannot
 * hide a module that is granted somewhere else. `problemsOnly` looks at
 * `visibleOrgs` (the tenants currently on screen).
 */
export function buildConfigRows(data: MatrixPayload, filters: ConfigRowFilters, visibleOrgs: MatrixOrg[]): ConfigRow[] {
  const q = filters.search.trim().toLowerCase();
  const rows: ConfigRow[] = [];

  const modules = [...data.features].sort((a, b) => {
    const ca = CATEGORY_ORDER.indexOf(a.category);
    const cb = CATEGORY_ORDER.indexOf(b.category);
    const ao = ca === -1 ? 99 : ca;
    const bo = cb === -1 ? 99 : cb;
    if (ao !== bo) return ao - bo;
    return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'en');
  });

  for (const f of modules) {
    const unused = !f.platformEnabled && !data.orgs.some((o) => o.features[f.slug]?.granted);
    if (filters.hideUnused && unused) continue;
    const caution = f.caution ? ` ${f.caution}` : '';
    rows.push({
      key: `module:${f.slug}`,
      kind: 'module',
      name: f.name,
      group: CATEGORY_LABELS[f.category] || f.category,
      meta: moduleMeta(f),
      detail: `${f.description}${caution}`,
      muted: !f.platformEnabled,
      module: f,
      cell: (o) => featureCellState(o.features[f.slug], f.minPlan),
      on: (o) => o.features[f.slug]?.reason === 'GRANTED',
    });
  }

  for (const l of data.legal) {
    const statusLabel = LEGAL_STATUS_LABEL[l.status] ?? l.status;
    rows.push({
      key: `legal:${l.key}`,
      kind: 'legal',
      name: l.title,
      group: 'Legal gates',
      meta: statusLabel,
      detail: `${l.title}. Customers are live only when this is approved and enabled for them. Demo tenants are always cleared.`,
      muted: l.status !== 'APPROVED',
      legal: l,
      cell: (o) => legalCellState(o.legal[l.key], o.demoTenant, l.status),
      on: (o) => o.legal[l.key]?.cleared === true,
    });
  }

  for (const fl of data.flags) {
    rows.push({
      key: `flag:${fl.key}`,
      kind: 'flag',
      name: fl.key,
      group: 'Flag overrides',
      meta: fl.enabled ? 'Global on' : 'Global off',
      detail: fl.description?.trim() || 'Platform flag. An org override always wins over the global switch.',
      muted: !fl.enabled,
      flag: fl,
      cell: (o) => flagCellState(o.flagOverrides[fl.key], fl.enabled),
      on: (o) => (o.flagOverrides[fl.key] ?? fl.enabled) === true,
    });
  }

  rows.push(
    {
      key: 'setting:supportChatEnabled',
      kind: 'setting',
      name: 'Support chatbot',
      group: 'Support settings',
      meta: 'Off by default',
      detail: 'Support chatbot in the recruiter dashboard.',
      muted: false,
      setting: 'supportChatEnabled',
      cell: (o) => settingCell(o.supportChatEnabled, 'On for this tenant.', 'Off for this tenant.'),
      on: (o) => o.supportChatEnabled,
    },
    {
      key: 'setting:autoGenerateQuestionVideos',
      kind: 'setting',
      name: 'Auto avatar videos',
      group: 'Support settings',
      meta: 'On by default',
      detail: 'Render AI avatar videos when a video question is saved. Turn off for quota or persona issues.',
      muted: false,
      setting: 'autoGenerateQuestionVideos',
      cell: (o) => settingCell(o.autoGenerateQuestionVideos, 'On for this tenant.', 'Off for this tenant.'),
      on: (o) => o.autoGenerateQuestionVideos,
    },
  );

  return rows.filter((row) => {
    if (filters.section && row.kind !== filters.section) return false;
    if (filters.category && (row.kind !== 'module' || row.module?.category !== filters.category)) return false;
    if (q && !`${row.name} ${row.key} ${row.detail} ${row.group}`.toLowerCase().includes(q)) return false;
    if (filters.problemsOnly && !visibleOrgs.some((o) => attention(row.cell(o)))) return false;
    return true;
  });
}

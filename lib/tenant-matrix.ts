/** Display rules for admin → Tenants → Feature matrix (platformAdmin.tenantFeatureMatrix). */

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
    return { tone: 'off', label: '', title: 'Not granted. Click to grant.' };
  }
  const trial = cell.expiresAt ? ` Trial ends ${fmtDay(cell.expiresAt)}.` : '';
  switch (cell.reason) {
    case 'GRANTED':
      return { tone: 'live', label: cell.expiresAt ? 'T' : '✓', title: `Live.${trial} Click to revoke.` };
    case 'PLATFORM_OFF':
      return { tone: 'blocked', label: '!', title: 'Granted, but the platform switch is off, so it is not live. Click to revoke.' };
    case 'PLAN_REQUIRED':
      return { tone: 'blocked', label: '!', title: `Granted, but needs the ${minPlan === 'ENTERPRISE' ? 'Enterprise' : 'Hire'} plan, so it is not live. Click to revoke.` };
    case 'GRANT_EXPIRED':
      return { tone: 'problem', label: '×', title: `Trial ended ${cell.expiresAt ? fmtDay(cell.expiresAt) : ''}. Not live. Click to revoke.` };
    case 'CAP_REACHED':
      return { tone: 'problem', label: '×', title: 'Monthly cap reached, blocked until next month. Click to revoke.' };
    default:
      return { tone: 'off', label: '', title: 'Not granted. Click to grant.' };
  }
}

/** Flag cell: an override always wins; no override follows the global value. */
export function flagCellState(override: boolean | undefined, globalEnabled: boolean): CellState {
  if (override === true) return { tone: 'live', label: 'on', title: 'Override: on for this org. Click to remove the override.' };
  if (override === false) return { tone: 'problem', label: 'off', title: 'Override: off for this org. Click to remove the override.' };
  return globalEnabled
    ? { tone: 'inherit-on', label: '', title: 'Follows global (on). Click to override off for this org.' }
    : { tone: 'off', label: '', title: 'Follows global (off). Click to override on for this org.' };
}

export function legalCellState(cell: { enabled: boolean; cleared: boolean } | undefined, demoTenant: boolean, status: string): CellState {
  if (demoTenant) return { tone: 'demo', label: 'D', title: 'Demo tenant: always cleared.' };
  if (cell?.cleared) return { tone: 'live', label: '✓', title: 'Enabled and approved: live. Click to disable.' };
  if (cell?.enabled) {
    return { tone: 'blocked', label: '!', title: `Enabled for this org, but the feature is ${status.replace('_', ' ').toLowerCase()}, so it is not live. Click to disable.` };
  }
  return { tone: 'off', label: '', title: 'Not enabled. Click to enable.' };
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

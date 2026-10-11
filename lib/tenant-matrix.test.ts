import { describe, expect, it } from 'vitest';
import { featureCellState, filterMatrixOrgs, flagCellState, legalCellState, type MatrixOrg } from './tenant-matrix';

const org = (id: string, extra: Partial<MatrixOrg> = {}): MatrixOrg => ({
  id,
  name: id,
  domain: null,
  subscriptionPlan: 'PROFESSIONAL',
  subscriptionStatus: 'ACTIVE',
  planTier: 'HIRE',
  billingComped: false,
  orgKind: 'STANDARD',
  demoTenant: false,
  sandbox: false,
  sandboxParentId: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  supportChatEnabled: false,
  autoGenerateQuestionVideos: true,
  features: {},
  liveCount: 0,
  grantedCount: 0,
  flagOverrides: {},
  legal: {},
  ...extra,
});

describe('featureCellState', () => {
  it('maps gate reasons to cell tones', () => {
    expect(featureCellState(undefined, null).tone).toBe('off');
    expect(featureCellState({ granted: false, reason: 'NOT_GRANTED', expiresAt: null }, null).tone).toBe('off');
    expect(featureCellState({ granted: true, reason: 'GRANTED', expiresAt: null }, null)).toMatchObject({ tone: 'live', label: '✓' });
    expect(featureCellState({ granted: true, reason: 'GRANTED', expiresAt: '2026-12-01T00:00:00.000Z' }, null)).toMatchObject({ tone: 'live', label: 'T' });
    expect(featureCellState({ granted: true, reason: 'PLATFORM_OFF', expiresAt: null }, null).tone).toBe('blocked');
    expect(featureCellState({ granted: true, reason: 'PLAN_REQUIRED', expiresAt: null }, 'ENTERPRISE').title).toContain('Enterprise');
    expect(featureCellState({ granted: true, reason: 'GRANT_EXPIRED', expiresAt: '2026-10-01T00:00:00.000Z' }, null).tone).toBe('problem');
    expect(featureCellState({ granted: true, reason: 'CAP_REACHED', expiresAt: null }, null).tone).toBe('problem');
  });
});

describe('flagCellState', () => {
  it('shows overrides, otherwise the inherited global value', () => {
    expect(flagCellState(true, false).tone).toBe('live');
    expect(flagCellState(false, true).tone).toBe('problem');
    expect(flagCellState(undefined, true).tone).toBe('inherit-on');
    expect(flagCellState(undefined, false).tone).toBe('off');
  });
});

describe('legalCellState', () => {
  it('treats demo as cleared and separates enabled from cleared', () => {
    expect(legalCellState(undefined, true, 'NEEDS_REVIEW').tone).toBe('demo');
    expect(legalCellState({ enabled: true, cleared: true }, false, 'APPROVED').tone).toBe('live');
    expect(legalCellState({ enabled: true, cleared: false }, false, 'NEEDS_REVIEW')).toMatchObject({ tone: 'blocked' });
    expect(legalCellState({ enabled: false, cleared: false }, false, 'APPROVED').tone).toBe('off');
  });
});

describe('filterMatrixOrgs', () => {
  const orgs = [
    org('Acme', { domain: 'acme.com' }),
    org('Demo', { demoTenant: true }),
    org('Acme (Sandbox)', { sandbox: true, planTier: 'HIRE' }),
    org('Staffing Co', { orgKind: 'AGENCY', planTier: 'NONE', subscriptionStatus: 'TRIAL' }),
  ];
  const ids = (f: Partial<Parameters<typeof filterMatrixOrgs>[1]>) =>
    filterMatrixOrgs(orgs, { search: '', tier: '', kind: '', status: '', ...f }).map((o) => o.id);

  it('filters by search, kind, tier and status', () => {
    expect(ids({ search: 'acme' })).toEqual(['Acme', 'Acme (Sandbox)']);
    expect(ids({ search: 'acme.com' })).toEqual(['Acme']);
    expect(ids({ kind: 'customers' })).toEqual(['Acme', 'Staffing Co']);
    expect(ids({ kind: 'demo' })).toEqual(['Demo']);
    expect(ids({ kind: 'sandbox' })).toEqual(['Acme (Sandbox)']);
    expect(ids({ kind: 'agencies' })).toEqual(['Staffing Co']);
    expect(ids({ tier: 'NONE' })).toEqual(['Staffing Co']);
    expect(ids({ status: 'TRIAL' })).toEqual(['Staffing Co']);
  });
});

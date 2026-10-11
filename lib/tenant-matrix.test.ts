import { describe, expect, it } from 'vitest';
import { buildConfigRows, featureCellState, filterMatrixOrgs, flagCellState, legalCellState, sortMatrixOrgs, type MatrixFeature, type MatrixOrg, type MatrixPayload } from './tenant-matrix';

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
    expect(flagCellState(true, false)).toMatchObject({ tone: 'live', label: '✓' });
    expect(flagCellState(false, true)).toMatchObject({ tone: 'problem', label: '×' });
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

describe('sortMatrixOrgs', () => {
  it('puts customers ahead of demo tenants and sandboxes', () => {
    const names = sortMatrixOrgs([
      org('Sandbox', { sandbox: true }),
      org('Zeta'),
      org('Demo', { demoTenant: true }),
      org('Acme'),
    ]).map((o) => o.id);
    expect(names).toEqual(['Acme', 'Zeta', 'Demo', 'Sandbox']);
  });
});

describe('buildConfigRows', () => {
  const feature = (slug: string, extra: Partial<MatrixFeature> = {}): MatrixFeature => ({
    slug,
    name: slug,
    description: `${slug} description`,
    category: 'hiring_intelligence',
    sortOrder: 1,
    platformEnabled: true,
    minPlan: null,
    metered: false,
    caution: null,
    ...extra,
  });

  const payload = (extra: Partial<MatrixPayload> = {}): MatrixPayload => ({
    features: [
      feature('pipeline_crm', { name: 'CRM', platformEnabled: false, sortOrder: 2 }),
      feature('video_facial_emotion_analysis', { name: 'Facial analysis', platformEnabled: false, sortOrder: 3 }),
      feature('job_governance', { name: 'Approvals', category: 'hiring_intelligence', sortOrder: 1, minPlan: 'HIRE' }),
      feature('insightcrm', { name: 'InsightCRM', category: 'integrations', sortOrder: 1 }),
    ],
    flags: [{ id: 'f1', key: 'tenant_announcements', description: 'Banner', enabled: true }],
    legal: [{ key: 'vms.early_pay', title: 'Early pay', status: 'NEEDS_REVIEW' }],
    orgs: [
      org('Acme', { features: { pipeline_crm: { granted: true, reason: 'PLATFORM_OFF', expiresAt: null } } }),
      org('Quiet'),
    ],
    ...extra,
  });

  const filters = {
    section: '' as const,
    category: '',
    search: '',
    hideUnused: false,
    problemsOnly: false,
  };

  it('lists modules, legal gates, flags, and support settings in that order', () => {
    const data = payload();
    const keys = buildConfigRows(data, filters, data.orgs).map((r) => r.key);
    expect(keys.slice(0, 4)).toEqual([
      'module:job_governance',
      'module:pipeline_crm',
      'module:video_facial_emotion_analysis',
      'module:insightcrm',
    ]);
    expect(keys).toContain('legal:vms.early_pay');
    expect(keys).toContain('flag:tenant_announcements');
    expect(keys).toContain('setting:supportChatEnabled');
    expect(keys).toContain('setting:autoGenerateQuestionVideos');
    expect(keys.indexOf('module:insightcrm')).toBeLessThan(keys.indexOf('legal:vms.early_pay'));
  });

  it('hides platform-off modules granted to nobody, and keeps a problem grant', () => {
    const data = payload();
    const hidden = buildConfigRows(data, { ...filters, hideUnused: true }, data.orgs).map((r) => r.key);
    expect(hidden).not.toContain('module:video_facial_emotion_analysis');
    expect(hidden).toContain('module:pipeline_crm');

    const problems = buildConfigRows(data, { ...filters, problemsOnly: true }, [data.orgs[0]]).map((r) => r.key);
    expect(problems).toEqual(['module:pipeline_crm']);
  });

  it('filters by feature search and category', () => {
    const data = payload();
    expect(buildConfigRows(data, { ...filters, search: 'early pay' }, data.orgs).map((r) => r.key)).toEqual(['legal:vms.early_pay']);
    expect(buildConfigRows(data, { ...filters, search: 'pipeline_crm' }, data.orgs).map((r) => r.key)).toEqual(['module:pipeline_crm']);
    expect(buildConfigRows(data, { ...filters, category: 'integrations' }, data.orgs).map((r) => r.key)).toEqual(['module:insightcrm']);
  });
});

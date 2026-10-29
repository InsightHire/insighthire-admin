import { describe, expect, it } from 'vitest';
import { productOffBlocker, splitFeaturesByProduct } from './org-products';

const f = (slug: string, category: string, name = slug) => ({ slug, category, name, description: '' });

const features = [
  f('insightcrm', 'crm', 'InsightCRM'),
  f('insightcrm_marketing', 'crm', 'Marketing'),
  f('insightcrm_social_inbox', 'communication', 'Social inbox'),
  f('job_governance', 'ats', 'Job approvals'),
  f('phone_screens', 'hiring_intelligence', 'Phone screens'),
];

describe('splitFeaturesByProduct', () => {
  it('pulls out the CRM app grant and splits the rest by product and category', () => {
    const split = splitFeaturesByProduct(features);
    expect(split.crmApp?.slug).toBe('insightcrm');
    expect(split.hire.map(([c, rows]) => [c, rows.map((r) => r.slug)])).toEqual([
      ['ats', ['job_governance']],
      ['hiring_intelligence', ['phone_screens']],
    ]);
    expect(split.crm.map(([c, rows]) => [c, rows.map((r) => r.slug)])).toEqual([
      ['crm', ['insightcrm_marketing']],
      ['communication', ['insightcrm_social_inbox']],
    ]);
  });

  it('filters sub-features by search but always returns the CRM app row', () => {
    const split = splitFeaturesByProduct(features, 'approvals');
    expect(split.crmApp?.slug).toBe('insightcrm');
    expect(split.hire).toEqual([['ats', [features[3]]]]);
    expect(split.crm).toEqual([]);
  });
});

describe('productOffBlocker', () => {
  it('allows switching a product off while the other is on', () => {
    expect(productOffBlocker('hire', { hire: true, crm: true })).toBeNull();
    expect(productOffBlocker('crm', { hire: true, crm: true })).toBeNull();
  });

  it('blocks switching off the only product', () => {
    expect(productOffBlocker('hire', { hire: true, crm: false })).toMatch(/InsightCRM first/);
    expect(productOffBlocker('crm', { hire: false, crm: true })).toMatch(/InsightHire first/);
  });
});

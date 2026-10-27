import { describe, expect, it } from 'vitest';
import {
  emptyAdmin,
  groupFeatures,
  isAlreadyMemberError,
  onboardingProblems,
  selectedFeatureSlugs,
  type CatalogFeature,
} from './tenant-onboarding';

const feature = (slug: string, category: string): CatalogFeature => ({
  slug,
  name: slug,
  description: '',
  category,
  caution: null,
  platformEnabled: true,
  minPlan: null,
  planOk: true,
  includedInPlan: false,
});

const catalog = [feature('insightcrm', 'crm'), feature('insightcrm_marketing', 'crm'), feature('job_governance', 'ats')];

describe('onboardingProblems', () => {
  it('passes a complete form and ignores blank admin rows', () => {
    expect(
      onboardingProblems({
        name: 'Acme',
        products: { hire: true, crm: false },
        admins: [{ email: 'pat@acme.com', firstName: 'Pat', lastName: 'Lee', role: 'ORGANIZATION_ADMIN' }, emptyAdmin()],
      }),
    ).toEqual([]);
  });

  it('lists every problem', () => {
    expect(
      onboardingProblems({
        name: ' ',
        products: { hire: false, crm: false },
        admins: [
          { email: 'pat@acme.com', firstName: 'Pat', lastName: '', role: 'ORGANIZATION_ADMIN' },
          { email: 'PAT@acme.com', firstName: 'P', lastName: 'L', role: 'ORGANIZATION_ADMIN' },
          { email: 'nope', firstName: 'N', lastName: 'O', role: 'RECRUITER' },
        ],
      }),
    ).toEqual([
      'Enter the customer name.',
      'Pick at least one product.',
      'pat@acme.com: enter a first and last name.',
      'pat@acme.com is listed twice.',
      'nope: enter a valid email.',
    ]);
  });

  it('needs an admin', () => {
    expect(onboardingProblems({ name: 'Acme', products: { hire: true, crm: false }, admins: [emptyAdmin()] })).toContain('Add at least one admin.');
  });
});

describe('selectedFeatureSlugs', () => {
  it('drops CRM modules when CRM is off and never sends the CRM app slug', () => {
    const selected = ['insightcrm', 'insightcrm_marketing', 'job_governance', 'gone'];
    expect(selectedFeatureSlugs(selected, catalog, { hire: true, crm: false })).toEqual(['job_governance']);
    expect(selectedFeatureSlugs(selected, catalog, { hire: true, crm: true })).toEqual(['insightcrm_marketing', 'job_governance']);
  });
});

describe('groupFeatures', () => {
  it('groups by category, hides the CRM app row, and filters by search', () => {
    expect(groupFeatures(catalog, '').map(([c, rows]) => [c, rows.map((r) => r.slug)])).toEqual([
      ['crm', ['insightcrm_marketing']],
      ['ats', ['job_governance']],
    ]);
    expect(groupFeatures(catalog, 'governance').map(([c]) => c)).toEqual(['ats']);
  });
});

it('treats a retry that finds the admin already added as done', () => {
  expect(isAlreadyMemberError('User is already a member of this organization')).toBe(true);
  expect(isAlreadyMemberError('Failed to send invitation. Please try again.')).toBe(false);
});

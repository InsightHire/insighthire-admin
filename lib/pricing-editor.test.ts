import { describe, expect, it } from 'vitest';
import { blankPlan, movePlan, parseFeatures, pricingProblems, type PricingPlan } from './pricing-editor';

const plan = (overrides: Partial<PricingPlan> = {}): PricingPlan => ({
  ...blankPlan([]),
  sku: 'SCREEN',
  name: 'Screen',
  annualPrice: 9990,
  twoYearPrice: 8990,
  visible: true,
  ...overrides,
});

describe('pricing editor helpers', () => {
  it('reorders plans and ignores moves past either end', () => {
    expect(movePlan(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c']);
    expect(movePlan(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b']);
    const list = ['a', 'b'];
    expect(movePlan(list, 0, -1)).toBe(list);
    expect(movePlan(list, 1, 1)).toBe(list);
  });

  it('parses one feature per line', () => {
    expect(parseFeatures(' One \n\nTwo\n  \n')).toEqual(['One', 'Two']);
  });

  it('gives new plans a unique SKU and keeps them hidden', () => {
    const first = blankPlan([]);
    const second = blankPlan([first]);
    expect(first.visible).toBe(false);
    expect(second.sku).not.toBe(first.sku);
  });

  it('flags duplicate or malformed SKUs, bad links and fractional prices', () => {
    expect(pricingProblems([plan()], true)).toEqual([]);
    expect(pricingProblems([plan(), plan()], false).join(' ')).toMatch(/used twice/);
    expect(pricingProblems([plan({ sku: 'bad sku' })], false).join(' ')).toMatch(/uppercase/);
    expect(pricingProblems([plan({ ctaHref: 'javascript:alert(1)' })], false).join(' ')).toMatch(/link/);
    expect(pricingProblems([plan({ annualPrice: 99.5 })], false).join(' ')).toMatch(/whole number/);
  });

  it('only blocks publishing on missing prices or no visible plan', () => {
    const unpriced = plan({ twoYearPrice: 0 });
    expect(pricingProblems([unpriced], false)).toEqual([]);
    expect(pricingProblems([unpriced], true).join(' ')).toMatch(/set both prices/);
    expect(pricingProblems([plan({ customPricing: true, annualPrice: 0, twoYearPrice: 0 })], true)).toEqual([]);
    expect(pricingProblems([plan({ visible: false })], true)).toContain('At least one plan must be visible.');
  });
});

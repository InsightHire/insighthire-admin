/**
 * Pricing page editor helpers. Mirrors the plan shape served by the API
 * (`insighthire-api/src/lib/pricing-page.ts`). Prices are whole US dollars per year.
 */
export type PricingIcon = 'rocket' | 'building' | 'crown';
export type PricingTerm = 'annual' | 'twoYear';

export interface PricingPlan {
  sku: string;
  name: string;
  tagline: string;
  icon: PricingIcon;
  customPricing: boolean;
  annualPrice: number;
  twoYearPrice: number;
  unitLabel: string;
  screeningsLine: string;
  valueLine: string;
  features: string[];
  highlight: boolean;
  ctaLabel: string;
  ctaHref: string;
  visible: boolean;
}

export const PRICING_ICON_LABEL: Record<PricingIcon, string> = { rocket: 'Rocket', building: 'Building', crown: 'Crown' };

export function blankPlan(existing: PricingPlan[]): PricingPlan {
  let n = existing.length + 1;
  while (existing.some((p) => p.sku === `NEW_PLAN_${n}`)) n++;
  return {
    sku: `NEW_PLAN_${n}`,
    name: 'New plan',
    tagline: '',
    icon: 'rocket',
    customPricing: false,
    annualPrice: 0,
    twoYearPrice: 0,
    unitLabel: '',
    screeningsLine: '',
    valueLine: '',
    features: [],
    highlight: false,
    ctaLabel: 'Talk to us',
    ctaHref: '/contact',
    visible: false,
  };
}

export function movePlan<T>(list: T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** One feature per line; blank lines dropped. */
export function parseFeatures(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Problems that would make the API reject the draft or publish. Empty = OK. */
export function pricingProblems(plans: PricingPlan[], forPublish: boolean): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  plans.forEach((p, i) => {
    const label = p.name || `Plan ${i + 1}`;
    if (!/^[A-Z0-9][A-Z0-9_-]*$/.test(p.sku)) problems.push(`${label}: SKU must be uppercase letters, numbers, - or _`);
    if (seen.has(p.sku)) problems.push(`${label}: SKU ${p.sku} is used twice`);
    seen.add(p.sku);
    if (!p.name.trim()) problems.push(`Plan ${i + 1}: name is required`);
    if (!p.ctaLabel.trim()) problems.push(`${label}: button label is required`);
    if (!(p.ctaHref.startsWith('/') || p.ctaHref.startsWith('https://'))) problems.push(`${label}: button link must start with / or https://`);
    for (const [field, value] of [['Annual price', p.annualPrice], ['2-year price', p.twoYearPrice]] as const) {
      if (!Number.isInteger(value) || value < 0) problems.push(`${label}: ${field} must be a whole number of dollars`);
    }
    if (forPublish && p.visible && !p.customPricing && (p.annualPrice <= 0 || p.twoYearPrice <= 0)) {
      problems.push(`${label}: set both prices, or tick "Custom pricing" to show "Contact us"`);
    }
  });
  if (forPublish && !plans.some((p) => p.visible)) problems.push('At least one plan must be visible.');
  return problems;
}

export function formatUsd(n: number): string {
  return `$${n.toLocaleString('en-US')}`;
}

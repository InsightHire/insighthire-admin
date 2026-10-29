/** Pure helpers for the Products & features card on admin → Organization. */

import { CRM_APP_SLUG, isCrmFeature } from './tenant-onboarding';

export type Product = 'hire' | 'crm';

type FeatureLike = { slug: string; category: string; name: string; description: string };

export type ProductSplit<T extends FeatureLike> = {
  /** The `insightcrm` grant row; the InsightCRM product switch stands for it. */
  crmApp: T | null;
  hire: Array<[string, T[]]>;
  crm: Array<[string, T[]]>;
};

function group<T extends FeatureLike>(rows: T[]): Array<[string, T[]]> {
  const byCategory = new Map<string, T[]>();
  for (const row of rows) {
    const list = byCategory.get(row.category) ?? [];
    list.push(row);
    byCategory.set(row.category, list);
  }
  return [...byCategory.entries()];
}

/** Splits grantable features into InsightHire and InsightCRM sub-features, grouped by category. */
export function splitFeaturesByProduct<T extends FeatureLike>(features: T[], search = ''): ProductSplit<T> {
  const q = search.trim().toLowerCase();
  const matches = (f: T) => !q || `${f.name} ${f.slug} ${f.description}`.toLowerCase().includes(q);
  const crmApp = features.find((f) => f.slug === CRM_APP_SLUG) ?? null;
  const rest = features.filter((f) => f.slug !== CRM_APP_SLUG && matches(f));
  return {
    crmApp,
    hire: group(rest.filter((f) => !isCrmFeature(f))),
    crm: group(rest.filter((f) => isCrmFeature(f))),
  };
}

/** Why a product can't be switched off right now, or null when it can. A tenant keeps at least one product. */
export function productOffBlocker(product: Product, state: { hire: boolean; crm: boolean }): string | null {
  const other = product === 'hire' ? state.crm : state.hire;
  if (other) return null;
  return product === 'hire'
    ? 'Turn on InsightCRM first. A tenant needs at least one product.'
    : 'Turn on InsightHire first. A tenant needs at least one product.';
}

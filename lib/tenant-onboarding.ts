/** Pure helpers for admin → Onboard customer (app/onboarding/page.tsx). */

export type AdminRole = 'ORGANIZATION_ADMIN' | 'RECRUITER' | 'HIRING_MANAGER';
export type AdminRow = { email: string; firstName: string; lastName: string; role: AdminRole };
export type Products = { hire: boolean; crm: boolean };

export type CatalogFeature = {
  slug: string;
  name: string;
  description: string;
  category: string;
  caution: string | null;
  platformEnabled: boolean;
  minPlan: 'HIRE' | 'ENTERPRISE' | null;
  planOk: boolean;
  includedInPlan: boolean;
};

export type InviteState =
  | { status: 'pending' }
  | { status: 'sending' }
  | { status: 'done'; acceptUrl: string | null; note?: string }
  | { status: 'failed'; error: string };

/** The CRM product checkbox stands for this grant, so it isn't listed as a feature. */
export const CRM_APP_SLUG = 'insightcrm';

export const emptyAdmin = (): AdminRow => ({ email: '', firstName: '', lastName: '', role: 'ORGANIZATION_ADMIN' });

export function newRequestId(): string {
  const rand = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return `onb_${rand}`;
}

export const isCrmFeature = (f: Pick<CatalogFeature, 'slug' | 'category'>) => f.category === 'crm' || f.slug.startsWith('insightcrm_');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Admin rows that are entirely blank are ignored; half-filled rows are problems. */
export function filledAdmins(admins: AdminRow[]): AdminRow[] {
  return admins.filter((a) => a.email.trim() || a.firstName.trim() || a.lastName.trim());
}

export function onboardingProblems(form: { name: string; products: Products; admins: AdminRow[] }): string[] {
  const problems: string[] = [];
  if (form.name.trim().length < 2) problems.push('Enter the customer name.');
  if (!form.products.hire && !form.products.crm) problems.push('Pick at least one product.');
  const admins = filledAdmins(form.admins);
  if (!admins.length) problems.push('Add at least one admin.');
  const seen = new Set<string>();
  admins.forEach((a, i) => {
    const email = a.email.trim().toLowerCase();
    const label = email || `Admin ${i + 1}`;
    if (!EMAIL_RE.test(email)) problems.push(`${label}: enter a valid email.`);
    if (!a.firstName.trim() || !a.lastName.trim()) problems.push(`${label}: enter a first and last name.`);
    if (email && seen.has(email)) problems.push(`${email} is listed twice.`);
    seen.add(email);
  });
  return problems;
}

/** Selected slugs sent to the server: CRM modules drop out when CRM is off. */
export function selectedFeatureSlugs(selected: Iterable<string>, catalog: CatalogFeature[], products: Products): string[] {
  const bySlug = new Map(catalog.map((f) => [f.slug, f]));
  return [...new Set(selected)].filter((slug) => {
    const f = bySlug.get(slug);
    if (!f || slug === CRM_APP_SLUG) return false;
    return products.crm || !isCrmFeature(f);
  });
}

export function groupFeatures(catalog: CatalogFeature[], search: string): Array<[string, CatalogFeature[]]> {
  const q = search.trim().toLowerCase();
  const groups = new Map<string, CatalogFeature[]>();
  for (const f of catalog) {
    if (f.slug === CRM_APP_SLUG) continue;
    if (q && !`${f.name} ${f.slug} ${f.description}`.toLowerCase().includes(q)) continue;
    const list = groups.get(f.category) ?? [];
    list.push(f);
    groups.set(f.category, list);
  }
  return [...groups.entries()];
}

/** inviteOrgAdmin says this when a retry finds the person already added; that counts as done. */
export function isAlreadyMemberError(message: string): boolean {
  return /already a member/i.test(message);
}

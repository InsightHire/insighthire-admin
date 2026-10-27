'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowPathIcon,
  BuildingOfficeIcon,
  CheckCircleIcon,
  ClipboardDocumentIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  PuzzlePieceIcon,
  RocketLaunchIcon,
  TrashIcon,
  UserPlusIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { trpc } from '@/lib/trpc';
import { AdminPageChrome } from '@/components/admin/page-chrome';
import { SectionCard } from '@/components/admin/section-card';
import { buttonClass, checkboxClass, inputClass, selectClass } from '@/components/admin/controls';
import {
  emptyAdmin,
  filledAdmins,
  groupFeatures,
  isAlreadyMemberError,
  isCrmFeature,
  newRequestId,
  onboardingProblems,
  selectedFeatureSlugs,
  type AdminRole,
  type AdminRow,
  type CatalogFeature,
  type InviteState,
  type Products,
} from '@/lib/tenant-onboarding';

const STORAGE_KEY = 'ih-admin-onboarding-v1';
const labelClass = 'block text-sm font-medium text-admin-secondary mb-1';

const INDUSTRIES = [
  ['TECHNOLOGY', 'Technology'], ['HEALTHCARE', 'Healthcare'], ['FINANCE', 'Finance'], ['EDUCATION', 'Education'],
  ['RETAIL', 'Retail'], ['MANUFACTURING', 'Manufacturing'], ['CONSULTING', 'Consulting'], ['MARKETING', 'Marketing'],
  ['SALES', 'Sales'], ['HUMAN_RESOURCES', 'Human Resources'], ['LEGAL', 'Legal'], ['REAL_ESTATE', 'Real Estate'],
  ['HOSPITALITY', 'Hospitality'], ['TRANSPORTATION', 'Transportation'], ['ENERGY', 'Energy'], ['MEDIA', 'Media'],
  ['NONPROFIT', 'Nonprofit'], ['GOVERNMENT', 'Government'], ['OTHER', 'Other'],
] as const;

const PLANS = [
  ['TRIAL', 'Trial'], ['PILOT', '1-Role Pilot'], ['STARTER', 'Starter'], ['PROFESSIONAL', 'Professional'],
  ['ENTERPRISE', 'Enterprise'], ['ENTERPRISE_PLUS', 'Enterprise Plus'],
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  hiring_intelligence: 'Hiring',
  meetings: 'Meetings & scheduling',
  communication: 'Communication',
  integrations: 'Integrations',
  talent: 'Talent',
  ats: 'ATS',
  vouch: 'Vouch',
  crm: 'CRM modules',
};

type Form = {
  name: string;
  domain: string;
  industry: string;
  size: string;
  subscriptionPlan: string;
  trialDays: number;
  products: Products;
  admins: AdminRow[];
  allowDuplicateName: boolean;
};

type ProvisionResult = {
  created: boolean;
  organization: { id: string; name: string; subscriptionPlan: string };
  grantedSlugs: string[];
  steps: Array<{ key: string; label: string; status: 'ok' | 'warn'; detail?: string }>;
};

type Saved = {
  requestId: string;
  form: Form;
  selected: string[];
  planDefaultsFor: string | null;
  result: ProvisionResult | null;
  invites: Record<string, InviteState>;
};

const freshForm = (): Form => ({
  name: '',
  domain: '',
  industry: 'TECHNOLOGY',
  size: 'SMALL',
  subscriptionPlan: 'TRIAL',
  trialDays: 14,
  products: { hire: true, crm: false },
  admins: [emptyAdmin()],
  allowDuplicateName: false,
});

const fresh = (): Saved => ({ requestId: newRequestId(), form: freshForm(), selected: [], planDefaultsFor: null, result: null, invites: {} });

function loadSaved(): Saved {
  if (typeof window === 'undefined') return fresh();
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return fresh();
    const saved = JSON.parse(raw) as Saved;
    // A reload mid-send leaves "sending" behind; let it be retried.
    for (const [email, s] of Object.entries(saved.invites ?? {})) {
      if (s.status === 'sending') saved.invites[email] = { status: 'failed', error: 'Interrupted. Retry to finish.' };
    }
    return saved;
  } catch {
    return fresh();
  }
}

const errorMessage = (err: unknown) => (err as { message?: string })?.message || 'Something went wrong.';

export default function OnboardingPage() {
  const [state, setState] = useState<Saved>(fresh);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState('');
  const [problems, setProblems] = useState<string[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [nameConflict, setNameConflict] = useState(false);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    setState(loadSaved());
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, loaded]);

  const { form, selected, result, invites } = state;
  const locked = !!result || running;
  const setForm = (patch: Partial<Form>) => setState((s) => ({ ...s, form: { ...s.form, ...patch } }));

  const catalogQuery = (trpc as any).platformAdmin.provisioningCatalog.useQuery(
    { plan: form.subscriptionPlan },
    { retry: 1, staleTime: 60_000, enabled: loaded },
  );
  const catalog: CatalogFeature[] = useMemo(() => catalogQuery.data?.features ?? [], [catalogQuery.data]);
  const provision = (trpc as any).platformAdmin.provisionTenant.useMutation();
  const invite = (trpc as any).platformAdmin.inviteOrgAdmin.useMutation();

  // Pre-tick the plan's included features once per plan choice; later unticks stick.
  useEffect(() => {
    if (!catalogQuery.data || locked || state.planDefaultsFor === catalogQuery.data.plan) return;
    const included = catalog.filter((f) => f.includedInPlan).map((f) => f.slug);
    setState((s) => ({ ...s, planDefaultsFor: catalogQuery.data.plan, selected: [...new Set([...s.selected, ...included])] }));
  }, [catalogQuery.data, catalog, locked, state.planDefaultsFor]);

  const groups = useMemo(() => groupFeatures(catalog, search), [catalog, search]);
  const featureSlugs = useMemo(() => selectedFeatureSlugs(selected, catalog, form.products), [selected, catalog, form.products]);
  const selectedSet = useMemo(() => new Set(featureSlugs), [featureSlugs]);

  const toggleFeature = (slug: string) =>
    setState((s) => ({ ...s, selected: s.selected.includes(slug) ? s.selected.filter((x) => x !== slug) : [...s.selected, slug] }));
  const setCategory = (rows: CatalogFeature[], on: boolean) =>
    setState((s) => {
      const slugs = rows.map((r) => r.slug);
      return { ...s, selected: on ? [...new Set([...s.selected, ...slugs])] : s.selected.filter((x) => !slugs.includes(x)) };
    });

  const setAdmin = (i: number, patch: Partial<AdminRow>) =>
    setForm({ admins: form.admins.map((a, j) => (j === i ? { ...a, ...patch } : a)) });

  async function sendInvites(organizationId: string, admins: AdminRow[]) {
    const done: Record<string, InviteState> = { ...state.invites };
    for (const admin of admins) {
      const email = admin.email.trim().toLowerCase();
      if (done[email]?.status === 'done') continue;
      setState((s) => ({ ...s, invites: { ...s.invites, [email]: { status: 'sending' } } }));
      let next: InviteState;
      try {
        const res = await invite.mutateAsync({
          organizationId,
          email,
          firstName: admin.firstName.trim(),
          lastName: admin.lastName.trim(),
          role: admin.role,
        });
        next = { status: 'done', acceptUrl: res?.invitation?.acceptUrl ?? null };
      } catch (err) {
        const msg = errorMessage(err);
        next = isAlreadyMemberError(msg) ? { status: 'done', acceptUrl: null, note: 'Already added' } : { status: 'failed', error: msg };
      }
      done[email] = next;
      setState((s) => ({ ...s, invites: { ...s.invites, [email]: next } }));
    }
  }

  async function onProvision(e: React.FormEvent) {
    e.preventDefault();
    if (running) return;
    const found = onboardingProblems(form);
    setProblems(found);
    setServerError(null);
    if (found.length) return;

    const admins = filledAdmins(form.admins);
    setRunning(true);
    try {
      let res: ProvisionResult | null = result;
      if (!res) {
        res = (await provision.mutateAsync({
          requestId: state.requestId,
          name: form.name.trim(),
          domain: form.domain.trim() || undefined,
          industry: form.industry,
          size: form.size,
          subscriptionPlan: form.subscriptionPlan,
          trialDays: form.trialDays,
          products: form.products,
          features: featureSlugs,
          admins: admins.map((a) => ({ ...a, email: a.email.trim().toLowerCase() })),
          allowDuplicateName: form.allowDuplicateName || undefined,
        })) as ProvisionResult;
        const saved = res;
        setState((s) => ({ ...s, result: saved }));
      }
      await sendInvites(res.organization.id, admins);
    } catch (err) {
      const msg = errorMessage(err);
      setServerError(msg);
      if (/already exists/i.test(msg)) setNameConflict(true);
    } finally {
      setRunning(false);
    }
  }

  async function retryInvites() {
    if (!result || running) return;
    const found = onboardingProblems(form);
    setProblems(found);
    if (found.length) return;
    setRunning(true);
    try {
      await sendInvites(result.organization.id, filledAdmins(form.admins));
    } finally {
      setRunning(false);
    }
  }

  function startOver() {
    window.sessionStorage.removeItem(STORAGE_KEY);
    setState(fresh());
    setProblems([]);
    setServerError(null);
    setNameConflict(false);
  }

  function copy(text: string) {
    void navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  }

  const admins = filledAdmins(form.admins);
  const unsentInvites = admins.filter((a) => invites[a.email.trim().toLowerCase()]?.status !== 'done');
  const allInvited = !!result && admins.every((a) => invites[a.email.trim().toLowerCase()]?.status === 'done');
  const crmOnly = form.products.crm && !form.products.hire;
  const roleOptions: Array<[AdminRole, string]> = crmOnly
    ? [['ORGANIZATION_ADMIN', 'CRM admin'], ['RECRUITER', 'CRM member']]
    : [['ORGANIZATION_ADMIN', 'Admin (full access)'], ['RECRUITER', 'Recruiter'], ['HIRING_MANAGER', 'Hiring manager']];

  return (
    <AdminPageChrome
      width="narrow"
      icon={<BuildingOfficeIcon />}
      breadcrumbs={[{ label: 'Tenants', href: '/organizations' }, { label: 'Onboard customer' }]}
      title="Onboard New Customer"
      description="Create the tenant, turn on its products and features, and invite its admins in one go. Safe to retry."
    >
      <form onSubmit={onProvision} className="space-y-6">
        <SectionCard icon={<BuildingOfficeIcon />} title="Customer">
          <fieldset disabled={locked} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Organization name *</label>
                <input
                  value={form.name}
                  onChange={(e) => { setForm({ name: e.target.value, allowDuplicateName: false }); setNameConflict(false); }}
                  className={inputClass}
                  placeholder="Acme Corp"
                  autoFocus
                />
              </div>
              <div>
                <label className={labelClass}>Domain</label>
                <input value={form.domain} onChange={(e) => setForm({ domain: e.target.value })} className={inputClass} placeholder="acme.com" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="sm:col-span-2">
                <label className={labelClass}>Industry</label>
                <select value={form.industry} onChange={(e) => setForm({ industry: e.target.value })} className={`${selectClass} w-full`}>
                  {INDUSTRIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Company size</label>
                <select value={form.size} onChange={(e) => setForm({ size: e.target.value })} className={`${selectClass} w-full`}>
                  <option value="STARTUP">Startup (1-10)</option>
                  <option value="SMALL">Small (11-50)</option>
                  <option value="MEDIUM">Medium (51-200)</option>
                  <option value="LARGE">Large (201-1000)</option>
                  <option value="ENTERPRISE">Enterprise (1000+)</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Plan</label>
                <select value={form.subscriptionPlan} onChange={(e) => setForm({ subscriptionPlan: e.target.value })} className={`${selectClass} w-full`}>
                  {PLANS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              {form.subscriptionPlan === 'TRIAL' && (
                <div className="sm:col-span-2">
                  <label className={labelClass}>Trial days</label>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={form.trialDays}
                    onChange={(e) => setForm({ trialDays: Math.min(90, Math.max(1, parseInt(e.target.value) || 14)) })}
                    className={inputClass}
                  />
                </div>
              )}
            </div>
          </fieldset>
        </SectionCard>

        <SectionCard icon={<PuzzlePieceIcon />} title="Products & features" description={`${featureSlugs.length + (form.products.crm ? 1 : 0)} will be turned on`}>
          <fieldset disabled={locked} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {([
                ['hire', 'InsightHire', 'Hiring: jobs, candidates, journeys, interviews.'],
                ['crm', 'InsightCRM', 'The CRM at crm.insighthire.com. Admins below become CRM admins.'],
              ] as const).map(([key, title, blurb]) => (
                <label
                  key={key}
                  className={`flex cursor-pointer items-start gap-3 rounded-admin-sm border p-3 ${form.products[key] ? 'border-admin-accent-border bg-admin-accent-soft' : 'border-admin-border'}`}
                >
                  <input
                    type="checkbox"
                    className={`${checkboxClass} mt-0.5`}
                    checked={form.products[key]}
                    onChange={(e) => setForm({ products: { ...form.products, [key]: e.target.checked } })}
                  />
                  <span>
                    <span className="block text-sm font-semibold text-admin-ink">{title}</span>
                    <span className="block text-xs text-admin-muted">{blurb}</span>
                  </span>
                </label>
              ))}
            </div>
            {crmOnly && <p className="text-xs text-admin-muted">CRM only: this tenant won't see hiring, and its CRM admins manage their own team.</p>}

            <div className="flex flex-wrap items-center gap-2">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search features" className={`${inputClass} flex-1 min-w-[12rem]`} />
              <button
                type="button"
                className={buttonClass.small}
                onClick={() => setState((s) => ({ ...s, selected: catalog.filter((f) => f.includedInPlan).map((f) => f.slug) }))}
              >
                Plan defaults only
              </button>
              <button type="button" className={buttonClass.small} onClick={() => setState((s) => ({ ...s, selected: [] }))}>
                Clear
              </button>
            </div>

            {catalogQuery.isLoading ? (
              <p className="py-6 text-center text-sm text-admin-muted">Loading features…</p>
            ) : catalogQuery.error ? (
              <p className="py-6 text-center text-sm text-admin-danger">Couldn't load features: {errorMessage(catalogQuery.error)}</p>
            ) : (
              <div className="max-h-[28rem] space-y-4 overflow-y-auto pr-1">
                {groups.map(([category, rows]) => {
                  const off = category === 'crm' && !form.products.crm;
                  const allOn = rows.every((r) => selectedSet.has(r.slug));
                  return (
                    <div key={category} className={off ? 'opacity-50' : undefined}>
                      <div className="mb-1.5 flex items-center justify-between">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-admin-muted">
                          {CATEGORY_LABELS[category] || category}
                          {off && <span className="ml-2 normal-case tracking-normal">· needs InsightCRM</span>}
                        </h3>
                        {!off && (
                          <button type="button" className="text-xs text-admin-accent-ink hover:underline" onClick={() => setCategory(rows, !allOn)}>
                            {allOn ? 'None' : 'All'}
                          </button>
                        )}
                      </div>
                      <div className="divide-y divide-admin-border rounded-admin-sm border border-admin-border">
                        {rows.map((f) => (
                          <label key={f.slug} className="flex cursor-pointer items-start gap-3 px-3 py-2 hover:bg-admin-bg">
                            <input
                              type="checkbox"
                              className={`${checkboxClass} mt-0.5`}
                              disabled={off || (isCrmFeature(f) && !form.products.crm)}
                              checked={selectedSet.has(f.slug)}
                              onChange={() => toggleFeature(f.slug)}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-admin-ink">
                                {f.name}
                                {f.includedInPlan && <span className="rounded-full bg-admin-ok-soft px-1.5 py-0.5 text-[11px] text-admin-ok">In plan</span>}
                                {!f.planOk && (
                                  <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-700">
                                    Needs {f.minPlan === 'ENTERPRISE' ? 'Enterprise' : 'Hire'} plan to go live
                                  </span>
                                )}
                                {!f.platformEnabled && (
                                  <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-800">Platform switch off · turns on</span>
                                )}
                              </span>
                              <span className="block text-xs text-admin-muted">{f.description}</span>
                              {f.caution && <span className="block text-xs text-amber-800">{f.caution}</span>}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </fieldset>
        </SectionCard>

        <SectionCard icon={<UserPlusIcon />} title="Admins" description="Each gets an invite email. Add as many as you need.">
          <div className="space-y-3">
            {form.admins.map((a, i) => {
              const email = a.email.trim().toLowerCase();
              const s = invites[email];
              const rowLocked = running || s?.status === 'done';
              return (
                <div key={i} className="rounded-admin-sm border border-admin-border p-3">
                  <fieldset disabled={rowLocked} className="grid gap-2 sm:grid-cols-12">
                    <input className={`${inputClass} sm:col-span-4`} type="email" placeholder="email@company.com" value={a.email} onChange={(e) => setAdmin(i, { email: e.target.value })} />
                    <input className={`${inputClass} sm:col-span-2`} placeholder="First" value={a.firstName} onChange={(e) => setAdmin(i, { firstName: e.target.value })} />
                    <input className={`${inputClass} sm:col-span-2`} placeholder="Last" value={a.lastName} onChange={(e) => setAdmin(i, { lastName: e.target.value })} />
                    <select className={`${selectClass} sm:col-span-3`} value={a.role} onChange={(e) => setAdmin(i, { role: e.target.value as AdminRole })}>
                      {roleOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <button
                      type="button"
                      className={`${buttonClass.ghost} sm:col-span-1`}
                      aria-label="Remove admin"
                      disabled={form.admins.length === 1}
                      onClick={() => setForm({ admins: form.admins.filter((_, j) => j !== i) })}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </fieldset>
                  {s && <InviteStatus state={s} copied={copied} onCopy={copy} />}
                </div>
              );
            })}
            {!running && (
              <button type="button" className={buttonClass.secondary} onClick={() => setForm({ admins: [...form.admins, emptyAdmin()] })}>
                <PlusIcon className="h-4 w-4" /> Add admin
              </button>
            )}
          </div>
        </SectionCard>

        {(problems.length > 0 || serverError) && (
          <div className="rounded-admin-sm border border-admin-danger/30 bg-admin-danger-soft p-3 text-sm text-admin-danger">
            {problems.length > 0 ? (
              <ul className="list-disc pl-5">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
            ) : (
              <p>{serverError}</p>
            )}
            {nameConflict && !result && (
              <label className="mt-2 flex items-center gap-2 text-admin-ink">
                <input type="checkbox" className={checkboxClass} checked={form.allowDuplicateName} onChange={(e) => setForm({ allowDuplicateName: e.target.checked })} />
                Create anyway (it's a different customer)
              </label>
            )}
          </div>
        )}

        {result && (
          <SectionCard icon={<RocketLaunchIcon />} title={allInvited ? 'Tenant is ready' : 'Provisioning'}>
            <ul className="space-y-1.5 text-sm">
              {result.steps.length === 0 && (
                <StepLine status="ok" label="Tenant was already created by an earlier attempt" />
              )}
              {result.steps.map((s) => (
                <StepLine key={s.key} status={s.status} label={s.label} detail={s.detail} />
              ))}
              {admins.map((a) => {
                const email = a.email.trim().toLowerCase();
                const s = invites[email];
                return (
                  <StepLine
                    key={email}
                    status={s?.status === 'done' ? 'ok' : s?.status === 'failed' ? 'failed' : s?.status === 'sending' ? 'busy' : 'todo'}
                    label={`Invite ${email}`}
                    detail={s?.status === 'failed' ? s.error : undefined}
                  />
                );
              })}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              {unsentInvites.length > 0 && (
                <button type="button" className={buttonClass.primary} disabled={running} onClick={retryInvites}>
                  <ArrowPathIcon className={`h-4 w-4 ${running ? 'animate-spin' : ''}`} /> Send {unsentInvites.length} invite{unsentInvites.length > 1 ? 's' : ''}
                </button>
              )}
              <a href={`/organizations/${result.organization.id}`} className={buttonClass.secondary}>Open tenant</a>
              <button type="button" className={buttonClass.secondary} onClick={startOver} disabled={running}>Onboard another customer</button>
            </div>
          </SectionCard>
        )}

        {!result && (
          <button type="submit" disabled={running} className={`${buttonClass.primary} w-full py-2.5`}>
            {running ? (
              <><ArrowPathIcon className="h-4 w-4 animate-spin" /> Provisioning…</>
            ) : (
              <><RocketLaunchIcon className="h-4 w-4" /> Provision tenant and invite {admins.length || ''} admin{admins.length === 1 ? '' : 's'}</>
            )}
          </button>
        )}
      </form>
    </AdminPageChrome>
  );
}

function StepLine({ status, label, detail }: { status: 'ok' | 'warn' | 'failed' | 'busy' | 'todo'; label: string; detail?: string }) {
  const icon = 'mt-0.5 h-4 w-4 flex-shrink-0';
  return (
    <li className="flex items-start gap-2">
      {status === 'ok' ? (
        <CheckCircleIcon className={`${icon} text-admin-ok`} />
      ) : status === 'busy' ? (
        <ArrowPathIcon className={`${icon} animate-spin text-admin-muted`} />
      ) : status === 'warn' ? (
        <ExclamationTriangleIcon className={`${icon} text-amber-600`} />
      ) : status === 'failed' ? (
        <XCircleIcon className={`${icon} text-admin-danger`} />
      ) : (
        <span className={`${icon} rounded-full border border-admin-border`} />
      )}
      <span>
        <span className="text-admin-ink">{label}</span>
        {detail && <span className="block text-xs text-admin-muted">{detail}</span>}
      </span>
    </li>
  );
}

function InviteStatus({ state, copied, onCopy }: { state: InviteState; copied: string | null; onCopy: (t: string) => void }) {
  if (state.status === 'done') {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-admin-ok">
        <CheckCircleIcon className="h-4 w-4" /> {state.note ?? 'Invite sent'}
        {state.acceptUrl && (
          <button type="button" className={buttonClass.small} onClick={() => onCopy(state.acceptUrl!)}>
            <ClipboardDocumentIcon className="h-3.5 w-3.5" /> {copied === state.acceptUrl ? 'Copied' : 'Copy invite link'}
          </button>
        )}
      </div>
    );
  }
  if (state.status === 'failed') return <p className="mt-2 text-xs text-admin-danger">Invite failed: {state.error}</p>;
  if (state.status === 'sending') return <p className="mt-2 text-xs text-admin-muted">Sending invite…</p>;
  return null;
}

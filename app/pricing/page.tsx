'use client';

import { useEffect, useMemo, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { PageHeader } from '@/components/admin/page-header';
import {
  PRICING_ICON_LABEL,
  blankPlan,
  formatUsd,
  movePlan,
  parseFeatures,
  pricingProblems,
  type PricingIcon,
  type PricingPlan,
  type PricingTerm,
} from '@/lib/pricing-editor';

type VersionMeta = {
  id: string;
  version: number;
  status: 'DRAFT' | 'LIVE' | 'SUPERSEDED';
  changeSummary: string;
  publishedAt: string | null;
  publishedByEmail: string | null;
  updatedAt: string;
};
type AdminState = {
  live: (VersionMeta & { content: { plans: PricingPlan[] } }) | null;
  draft: (VersionMeta & { content: { plans: PricingPlan[] } }) | null;
  history: VersionMeta[];
};

const inputClass =
  'mt-1 block w-full rounded-admin-sm border border-admin-border bg-white px-3 py-2 text-sm text-admin-ink shadow-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent';
const primaryButton =
  'inline-flex items-center rounded-admin-sm bg-admin-ink px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50';
const secondaryButton =
  'inline-flex items-center rounded-admin-sm border border-admin-border bg-white px-4 py-2 text-sm font-medium text-admin-ink hover:bg-slate-50 disabled:opacity-50';
const smallButton =
  'rounded-admin-sm border border-admin-border bg-white px-2 py-1 text-xs text-admin-ink hover:bg-slate-50 disabled:opacity-40';

const api = trpc as any;

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-admin-ink">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-admin-muted">{hint}</span> : null}
    </label>
  );
}

function PriceInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 mt-0.5 -translate-y-1/2 text-sm text-admin-muted">$</span>
      <input
        type="number"
        min={0}
        step={1}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(e.target.value === '' ? 0 : Math.round(Number(e.target.value)))}
        className={`${inputClass} pl-7`}
      />
    </div>
  );
}

function PlanEditor({
  plan,
  index,
  count,
  onChange,
  onMove,
  onRemove,
}: {
  plan: PricingPlan;
  index: number;
  count: number;
  onChange: (p: PricingPlan) => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [featuresText, setFeaturesText] = useState(plan.features.join('\n'));
  useEffect(() => setFeaturesText(plan.features.join('\n')), [plan.features]);
  const set = <K extends keyof PricingPlan>(key: K, value: PricingPlan[K]) => onChange({ ...plan, [key]: value });

  return (
    <div className={`rounded-admin-sm border ${plan.visible ? 'border-admin-border' : 'border-dashed border-slate-300 bg-slate-50'}`}>
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <button type="button" onClick={() => setOpen(!open)} className="min-w-0 flex-1 text-left">
          <span className="font-semibold text-admin-ink">{plan.name || 'Untitled'}</span>
          <span className="ml-2 font-mono text-xs text-admin-muted">{plan.sku}</span>
          <span className="ml-3 text-xs text-admin-muted">
            {plan.customPricing
              ? 'Contact us'
              : `${formatUsd(plan.annualPrice)}/yr annual · ${formatUsd(plan.twoYearPrice)}/yr on 2-year`}
          </span>
          {plan.highlight ? <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] text-emerald-800">Most popular</span> : null}
          {!plan.visible ? <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[11px] text-slate-700">Hidden</span> : null}
        </button>
        <div className="flex items-center gap-1">
          <button type="button" className={smallButton} disabled={index === 0} onClick={() => onMove(-1)} aria-label="Move up">
            ↑
          </button>
          <button type="button" className={smallButton} disabled={index === count - 1} onClick={() => onMove(1)} aria-label="Move down">
            ↓
          </button>
          <button type="button" className={smallButton} onClick={() => set('visible', !plan.visible)}>
            {plan.visible ? 'Hide' : 'Show'}
          </button>
          <button type="button" className={smallButton} onClick={() => setOpen(!open)}>
            {open ? 'Close' : 'Edit'}
          </button>
        </div>
      </div>

      {open ? (
        <div className="space-y-4 border-t border-admin-border px-4 py-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="SKU" hint="Uppercase, e.g. SCREEN. For your records; not shown on the page.">
              <input
                value={plan.sku}
                onChange={(e) => set('sku', e.target.value.toUpperCase().replace(/\s+/g, '_'))}
                className={`${inputClass} font-mono`}
              />
            </Field>
            <Field label="Name">
              <input value={plan.name} onChange={(e) => set('name', e.target.value)} className={inputClass} />
            </Field>
            <Field label="Icon">
              <select value={plan.icon} onChange={(e) => set('icon', e.target.value as PricingIcon)} className={inputClass}>
                {(Object.keys(PRICING_ICON_LABEL) as PricingIcon[]).map((k) => (
                  <option key={k} value={k}>
                    {PRICING_ICON_LABEL[k]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Tagline">
            <input value={plan.tagline} onChange={(e) => set('tagline', e.target.value)} className={inputClass} />
          </Field>

          <div className="rounded-admin-sm bg-slate-50 p-3">
            <label className="flex items-center gap-2 text-sm text-admin-ink">
              <input type="checkbox" checked={plan.customPricing} onChange={(e) => set('customPricing', e.target.checked)} />
              Custom pricing (hide prices, show “Contact us”)
            </label>
            {!plan.customPricing ? (
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                <Field label="Annual price" hint="US dollars per year, 1-year contract, billed annually.">
                  <PriceInput value={plan.annualPrice} onChange={(n) => set('annualPrice', n)} />
                </Field>
                <Field label="2-year contract price" hint="US dollars per year, on a 2-year contract.">
                  <PriceInput value={plan.twoYearPrice} onChange={(n) => set('twoYearPrice', n)} />
                </Field>
                <Field label="Unit label" hint='Optional, shown after the price, e.g. "per organization".'>
                  <input value={plan.unitLabel} onChange={(e) => set('unitLabel', e.target.value)} className={inputClass} />
                </Field>
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Highlighted line" hint="Bold line under the price.">
              <input value={plan.screeningsLine} onChange={(e) => set('screeningsLine', e.target.value)} className={inputClass} />
            </Field>
            <Field label="Small line" hint="Small grey line under that.">
              <input value={plan.valueLine} onChange={(e) => set('valueLine', e.target.value)} className={inputClass} />
            </Field>
          </div>

          <Field label="Features" hint="One per line.">
            <textarea
              rows={Math.max(4, featuresText.split('\n').length + 1)}
              value={featuresText}
              onChange={(e) => setFeaturesText(e.target.value)}
              onBlur={() => set('features', parseFeatures(featuresText))}
              className={inputClass}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Button label">
              <input value={plan.ctaLabel} onChange={(e) => set('ctaLabel', e.target.value)} className={inputClass} />
            </Field>
            <Field label="Button link" hint="e.g. /contact or https://…">
              <input value={plan.ctaHref} onChange={(e) => set('ctaHref', e.target.value)} className={inputClass} />
            </Field>
            <div className="space-y-2 pt-6">
              <label className="flex items-center gap-2 text-sm text-admin-ink">
                <input type="checkbox" checked={plan.highlight} onChange={(e) => set('highlight', e.target.checked)} />
                “Most popular” badge
              </label>
              <label className="flex items-center gap-2 text-sm text-admin-ink">
                <input type="checkbox" checked={plan.visible} onChange={(e) => set('visible', e.target.checked)} />
                Visible on the page
              </label>
            </div>
          </div>

          <div className="flex justify-end border-t border-admin-border pt-3">
            <button
              type="button"
              className="text-xs text-red-700 underline hover:text-red-900"
              onClick={() => {
                if (window.confirm(`Remove ${plan.name || 'this plan'} from the draft? Use Hide to keep it for later.`)) onRemove();
              }}
            >
              Remove plan
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Preview({ plans }: { plans: PricingPlan[] }) {
  const [term, setTerm] = useState<PricingTerm>('annual');
  const visible = plans.filter((p) => p.visible);
  return (
    <div>
      <div className="mb-3 inline-flex gap-1 rounded-admin-sm border border-admin-border p-0.5 text-xs">
        {(['annual', 'twoYear'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTerm(t)}
            className={`rounded px-2 py-1 ${term === t ? 'bg-admin-ink text-white' : 'text-admin-muted hover:text-admin-ink'}`}
          >
            {t === 'annual' ? 'Annual' : 'Annual – 2-year contract'}
          </button>
        ))}
      </div>
      {visible.length === 0 ? <p className="text-sm text-admin-muted">No visible plans.</p> : null}
      <div className="space-y-3">
        {visible.map((p) => {
          const price = term === 'twoYear' ? p.twoYearPrice : p.annualPrice;
          const saved = p.annualPrice - p.twoYearPrice;
          return (
            <div key={p.sku} className={`rounded-admin-sm border bg-white p-4 ${p.highlight ? 'border-emerald-500' : 'border-admin-border'}`}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold text-admin-ink">{p.name}</span>
                {p.highlight ? <span className="text-[11px] font-semibold uppercase text-emerald-700">Most popular</span> : null}
              </div>
              {p.tagline ? <p className="mt-1 text-xs text-admin-muted">{p.tagline}</p> : null}
              <p className="mt-2 text-2xl font-semibold text-admin-ink">
                {p.customPricing || price <= 0 ? (
                  'Contact us'
                ) : (
                  <>
                    {formatUsd(price)}
                    <span className="text-sm font-normal text-admin-muted">/year</span>
                  </>
                )}
              </p>
              {!p.customPricing && price > 0 ? (
                <p className="text-xs text-admin-muted">
                  {term === 'twoYear' ? 'Per year on a 2-year contract' : 'Billed annually'}
                  {p.unitLabel ? ` · ${p.unitLabel}` : ''}
                </p>
              ) : null}
              {term === 'twoYear' && !p.customPricing && saved > 0 ? (
                <p className="mt-1 text-xs font-medium text-emerald-700">Save {formatUsd(saved)}/year vs annual</p>
              ) : null}
              <p className="mt-2 text-xs text-admin-muted">
                {p.features.length} features · button “{p.ctaLabel}” → {p.ctaHref}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PricingPageAdmin() {
  const utils = api.useUtils();
  const query = api.pricingPage.get.useQuery(undefined, { refetchOnWindowFocus: false });
  const state = query.data as AdminState | undefined;

  const [plans, setPlans] = useState<PricingPlan[] | null>(null);
  const [summary, setSummary] = useState('');
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!state || dirty) return;
    const source = state.draft ?? state.live;
    setPlans(source ? source.content.plans : []);
    setSummary(state.draft?.changeSummary ?? '');
  }, [state, dirty]);

  const onError = (e: { message: string }) => setMessage(e.message);
  const saveDraft = api.pricingPage.saveDraft.useMutation({ onError });
  const publishDraft = api.pricingPage.publishDraft.useMutation({ onError });
  const discardDraft = api.pricingPage.discardDraft.useMutation({ onError });
  const busy = saveDraft.isPending || publishDraft.isPending || discardDraft.isPending;

  const draftProblems = useMemo(() => (plans ? pricingProblems(plans, false) : []), [plans]);
  const publishProblems = useMemo(() => (plans ? pricingProblems(plans, true) : []), [plans]);

  const refresh = () => utils.pricingPage.get.invalidate();

  const update = (next: PricingPlan[]) => {
    setPlans(next);
    setDirty(true);
    setMessage(null);
  };

  const save = async () => {
    if (!plans) return;
    await saveDraft.mutateAsync({ content: { plans }, changeSummary: summary });
    await refresh();
    setDirty(false);
  };

  const onSave = async () => {
    try {
      await save();
      setMessage('Draft saved. The live page has not changed.');
    } catch {
      /* onError shows it */
    }
  };

  const onPublish = async () => {
    setConfirming(false);
    try {
      if (dirty || !state?.draft) await save();
      await publishDraft.mutateAsync();
      await refresh();
      setDirty(false);
      setMessage('Published. The pricing page updates within about a minute.');
    } catch {
      /* onError shows it */
    }
  };

  const onDiscard = async () => {
    if (!window.confirm('Discard the draft and go back to the live version?')) return;
    try {
      if (state?.draft) await discardDraft.mutateAsync();
      await refresh();
      setDirty(false);
      setMessage('Draft discarded.');
    } catch {
      /* onError shows it */
    }
  };

  const editingLabel = state?.draft
    ? `Editing draft v${state.draft.version}${dirty ? ' (unsaved changes)' : ''}`
    : dirty
      ? 'Unsaved changes (not a draft yet)'
      : state?.live
        ? `Showing live v${state.live.version}`
        : 'Nothing published yet';
  const problems = confirming ? publishProblems : draftProblems;

  return (
    <AuthenticatedLayout>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <PageHeader
          eyebrow="Content"
          title="Pricing page"
          description="Plans, SKUs and prices shown on insighthire.com/pricing. Changes stay in a draft until you publish. Display only — this does not change Stripe, checkout or what customers are billed."
        />

        {query.error ? <p className="mb-4 text-sm text-red-600">{query.error.message}</p> : null}
        {message ? (
          <div className="mb-4 rounded-admin-sm border border-admin-border bg-white px-4 py-2 text-sm text-admin-ink">{message}</div>
        ) : null}

        {query.isLoading || !plans ? (
          <div className="admin-panel py-16 text-center text-sm text-admin-muted">Loading…</div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
            <section className="admin-panel min-w-0 space-y-4 p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-admin-ink">Plans</h2>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      state?.draft || dirty ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {editingLabel}
                  </span>
                </div>
                <button type="button" className={secondaryButton} onClick={() => update([...plans, blankPlan(plans)])}>
                  Add plan
                </button>
              </div>
              <p className="text-xs text-admin-muted">
                Prices are US dollars per year. The page has two switches: “Annual” shows the annual price and “Annual – 2-year
                contract” shows the 2-year price. The order here is the order on the page.
              </p>

              <div className="space-y-2">
                {plans.map((plan, i) => (
                  <PlanEditor
                    key={i}
                    plan={plan}
                    index={i}
                    count={plans.length}
                    onChange={(p) => update(plans.map((x, j) => (j === i ? p : x)))}
                    onMove={(d) => update(movePlan(plans, i, d))}
                    onRemove={() => update(plans.filter((_, j) => j !== i))}
                  />
                ))}
                {plans.length === 0 ? <p className="text-sm text-admin-muted">No plans. Add one to start.</p> : null}
              </div>

              <div className="space-y-3 border-t border-admin-border pt-4">
                <Field label="What changed">
                  <input
                    type="text"
                    value={summary}
                    maxLength={500}
                    onChange={(e) => {
                      setSummary(e.target.value);
                      setDirty(true);
                    }}
                    placeholder="e.g. New 2-year prices for Screen and Hire"
                    className={inputClass}
                  />
                </Field>
                {problems.length ? (
                  <ul className="list-disc space-y-1 pl-5 text-xs text-red-700">
                    {problems.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                ) : null}
                {confirming ? (
                  <div className="rounded-admin-sm border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                    <p>Publish these plans to the live pricing page?</p>
                    <div className="mt-2 flex gap-2">
                      <button type="button" className={primaryButton} disabled={busy || publishProblems.length > 0} onClick={onPublish}>
                        Yes, publish
                      </button>
                      <button type="button" className={secondaryButton} onClick={() => setConfirming(false)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      className={primaryButton}
                      disabled={busy || (!dirty && !state?.draft)}
                      onClick={() => setConfirming(true)}
                    >
                      Publish
                    </button>
                    <button
                      type="button"
                      className={secondaryButton}
                      disabled={busy || !dirty || draftProblems.length > 0}
                      onClick={onSave}
                    >
                      Save draft
                    </button>
                    {state?.draft || dirty ? (
                      <button type="button" className={secondaryButton} disabled={busy} onClick={onDiscard}>
                        Discard draft
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            </section>

            <aside className="space-y-6">
              <section className="admin-panel p-5">
                <h2 className="mb-3 text-sm font-semibold text-admin-ink">Preview of what you are editing</h2>
                <Preview plans={plans} />
              </section>
              <section className="admin-panel p-5">
                <h2 className="mb-3 text-sm font-semibold text-admin-ink">Published versions</h2>
                <ul className="space-y-2 text-xs">
                  {(state?.history ?? []).map((v) => (
                    <li key={v.id} className="border-b border-admin-border pb-2 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-admin-ink">v{v.version}</span>
                        <span
                          className={`rounded px-1.5 py-0.5 ${
                            v.status === 'LIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {v.status === 'LIVE' ? 'Live' : 'Superseded'}
                        </span>
                      </div>
                      <div className="text-admin-muted">
                        {formatDate(v.publishedAt)} · {v.publishedByEmail ?? '—'}
                      </div>
                      {v.changeSummary ? <div className="text-admin-ink">{v.changeSummary}</div> : null}
                    </li>
                  ))}
                </ul>
              </section>
            </aside>
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
}

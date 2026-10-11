'use client';

import { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { dollars, percent } from '../status';

type Org = { id: string; name: string };

const num = (v: string) => (v.trim() === '' ? 0 : Math.round(Number(v)));
const toCents = (v: string) => Math.round(Number(v || '0') * 100);
const errorAlert = (e: { message: string }) => alert(e.message);

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="text-sm block">
      <span className="block text-gray-600 mb-1">{label}</span>
      {children}
      {hint && <span className="block text-xs text-gray-400 mt-0.5">{hint}</span>}
    </label>
  );
}
const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2';

function EarlyPaySettings() {
  const settings = (trpc as any).platformAdmin.vmsMoneySettings.useQuery(undefined, { refetchOnWindowFocus: false });
  const overview = (trpc as any).platformAdmin.vmsEarlyPayOverview.useQuery(undefined, { refetchOnWindowFocus: false });
  const [form, setForm] = useState<Record<string, string>>({});
  useEffect(() => {
    const s = settings.data?.earlyPay;
    if (!s) return;
    setForm({
      advanceRate: String(s.advanceRateBps / 100),
      feePer30: String(s.feeBpsPer30Days / 100),
      minFee: String(s.minFeeCents / 100),
      maxAdvance: String(s.maxAdvanceCents / 100),
      maxOutstanding: String(s.maxOutstandingPerAgencyCents / 100),
      minDaysToDue: String(s.minDaysToDue),
      minTenure: String(s.minAgencyTenureDays),
      ttl: String(s.offerTtlHours),
      provider: s.provider,
    });
  }, [settings.data]);
  const save = (trpc as any).platformAdmin.vmsMoneySetEarlyPay.useMutation({ onSuccess: () => settings.refetch(), onError: errorAlert });
  const cancel = (trpc as any).platformAdmin.vmsEarlyPayCancel.useMutation({ onSuccess: () => overview.refetch(), onError: errorAlert });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });
  const o = overview.data;

  return (
    <>
      <div className="grid sm:grid-cols-3 gap-4">
        <Field label="Advance rate (%)" hint="Share of the agency's receivable paid early">
          <input value={form.advanceRate ?? ''} onChange={set('advanceRate')} className={inputCls} inputMode="decimal" />
        </Field>
        <Field label="Fee per 30 days (%)" hint="Of the advance, per 30 days or part">
          <input value={form.feePer30 ?? ''} onChange={set('feePer30')} className={inputCls} inputMode="decimal" />
        </Field>
        <Field label="Minimum fee ($)">
          <input value={form.minFee ?? ''} onChange={set('minFee')} className={inputCls} inputMode="decimal" />
        </Field>
        <Field label="Largest advance ($)">
          <input value={form.maxAdvance ?? ''} onChange={set('maxAdvance')} className={inputCls} inputMode="decimal" />
        </Field>
        <Field label="Most outstanding per agency ($)">
          <input value={form.maxOutstanding ?? ''} onChange={set('maxOutstanding')} className={inputCls} inputMode="decimal" />
        </Field>
        <Field label="Funder">
          <select value={form.provider ?? 'STRIPE_CAPITAL'} onChange={set('provider')} className={inputCls}>
            <option value="STRIPE_CAPITAL">Stripe Capital (Stripe is the lender)</option>
            <option value="FACTORING_PARTNER">Factoring partner</option>
          </select>
        </Field>
        <Field label="Only invoices due in at least (days)">
          <input value={form.minDaysToDue ?? ''} onChange={set('minDaysToDue')} className={inputCls} inputMode="numeric" />
        </Field>
        <Field label="Agency on the program at least (days)">
          <input value={form.minTenure ?? ''} onChange={set('minTenure')} className={inputCls} inputMode="numeric" />
        </Field>
        <Field label="Offer good for (hours)">
          <input value={form.ttl ?? ''} onChange={set('ttl')} className={inputCls} inputMode="numeric" />
        </Field>
      </div>
      <p className="text-xs text-gray-500">
        With Stripe Capital, Stripe sets the amount and fee for each agency and these rates are not used. The demo uses a simulated funder with these rates.
      </p>
      <button
        onClick={() =>
          save.mutate({
            advanceRateBps: Math.round(Number(form.advanceRate) * 100),
            feeBpsPer30Days: Math.round(Number(form.feePer30) * 100),
            minFeeCents: toCents(form.minFee),
            maxAdvanceCents: toCents(form.maxAdvance),
            maxOutstandingPerAgencyCents: toCents(form.maxOutstanding),
            minDaysToDue: num(form.minDaysToDue),
            minAgencyTenureDays: num(form.minTenure),
            offerTtlHours: num(form.ttl),
            provider: form.provider,
          })
        }
        disabled={save.isLoading}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {save.isLoading ? 'Saving…' : 'Save early-pay terms'}
      </button>

      {o && (
        <div className="pt-4 space-y-2">
          <h3 className="text-sm font-semibold text-gray-900">Advances</h3>
          <p className="text-xs text-gray-500">
            {o.funded} funded · {dollars(o.outstandingCents)} outstanding · {o.open} open offers · {dollars(o.feesCents)} fees to date
          </p>
          <table className="min-w-full text-sm">
            <thead className="text-xs uppercase text-gray-500">
              <tr>
                <th className="text-left py-2">Agency</th>
                <th className="text-left py-2">Invoice</th>
                <th className="text-right py-2">Advance</th>
                <th className="text-right py-2">Fee</th>
                <th className="text-right py-2">Est. APR</th>
                <th className="text-left py-2 pl-4">Funder</th>
                <th className="text-left py-2">Status</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(o.advances ?? []).map((a: any) => (
                <tr key={a.id}>
                  <td className="py-2">{a.agencyName}</td>
                  <td className="py-2">{a.invoiceNumber}</td>
                  <td className="py-2 text-right">{dollars(a.advanceCents)}</td>
                  <td className="py-2 text-right">{dollars(a.feeCents)}</td>
                  <td className="py-2 text-right">{percent(a.estimatedAprBps)}</td>
                  <td className="py-2 pl-4">{a.simulated ? 'Simulated' : a.provider}</td>
                  <td className="py-2">{a.status}</td>
                  <td className="py-2 text-right">
                    {(a.status === 'OFFERED' || a.status === 'ACCEPTED') && (
                      <button onClick={() => confirm('Cancel this early-pay offer?') && cancel.mutate({ id: a.id })} className="text-xs text-red-600">
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function CombinedSettings({ demoOrgs }: { demoOrgs: Org[] }) {
  const settings = (trpc as any).platformAdmin.vmsMoneySettings.useQuery(undefined, { refetchOnWindowFocus: false });
  const demo = demoOrgs[0];
  const overview = (trpc as any).platformAdmin.vmsCombinedOverview.useQuery({ clientOrgId: demo?.id ?? '' }, { enabled: !!demo, refetchOnWindowFocus: false });
  const [days, setDays] = useState('');
  const [max, setMax] = useState('');
  useEffect(() => {
    const s = settings.data?.combinedInvoice;
    if (!s) return;
    setDays(String(s.daysUntilDue));
    setMax(String(s.maxAgencies));
  }, [settings.data]);
  const save = (trpc as any).platformAdmin.vmsMoneySetCombined.useMutation({ onSuccess: () => settings.refetch(), onError: errorAlert });
  return (
    <>
      <div className="grid sm:grid-cols-3 gap-4">
        <Field label="Days until due">
          <input value={days} onChange={(e) => setDays(e.target.value)} className={inputCls} inputMode="numeric" />
        </Field>
        <Field label="Most agencies on one invoice">
          <input value={max} onChange={(e) => setMax(e.target.value)} className={inputCls} inputMode="numeric" />
        </Field>
      </div>
      <p className="text-xs text-gray-500">The client picks one invoice per agency or one combined invoice in the VMS Payments tab, once this is cleared for them.</p>
      <button
        onClick={() => save.mutate({ daysUntilDue: num(days), maxAgencies: num(max) })}
        disabled={save.isLoading}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        Save
      </button>
      {overview.data && (
        <div className="pt-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">
            {demo?.name}: {overview.data.billingMode === 'B' ? 'one combined invoice' : 'one invoice per agency'}
          </h3>
          <ul className="text-sm divide-y divide-gray-100">
            {(overview.data.invoices ?? []).map((c: any) => (
              <li key={c.id} className="py-1.5 flex gap-4">
                <span className="font-medium">{c.number}</span>
                <span className="text-gray-600">
                  {c.periodStart?.slice(0, 10)} to {c.periodEnd?.slice(0, 10)}
                </span>
                <span>{dollars(c.totalCents)}</span>
                <span className="text-gray-500">{c.status}</span>
                {c.simulated && <span className="text-xs text-gray-400">simulated</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

const EMPTY_PLAN = { id: '', name: '', description: '', flat: '', perWorker: '', spendPct: '', min: '', max: '', days: '30', active: true };

function ProgramFeeSettings({ demoOrgs }: { demoOrgs: Org[] }) {
  const [clientOrgId, setClientOrgId] = useState(demoOrgs[0]?.id ?? '');
  const plans = (trpc as any).platformAdmin.vmsFeePlans.useQuery({ clientOrgId: clientOrgId || undefined }, { refetchOnWindowFocus: false });
  const invoices = (trpc as any).platformAdmin.vmsAgencyFeeInvoices.useQuery({ clientOrgId: clientOrgId || undefined }, { refetchOnWindowFocus: false });
  const [plan, setPlan] = useState(EMPTY_PLAN);
  const [assign, setAssign] = useState({ planId: '', partnershipId: '', startsOn: new Date().toISOString().slice(0, 10) });
  const [period, setPeriod] = useState({ periodStart: '', periodEnd: '' });
  const [preview, setPreview] = useState<any[] | null>(null);
  const refresh = () => {
    plans.refetch();
    invoices.refetch();
  };
  const savePlan = (trpc as any).platformAdmin.vmsFeePlanSave.useMutation({ onSuccess: () => (setPlan(EMPTY_PLAN), refresh()), onError: errorAlert });
  const doAssign = (trpc as any).platformAdmin.vmsFeePlanAssign.useMutation({ onSuccess: refresh, onError: errorAlert });
  const unassign = (trpc as any).platformAdmin.vmsFeePlanUnassign.useMutation({ onSuccess: refresh, onError: errorAlert });
  const runPreview = (trpc as any).platformAdmin.vmsProgramFeesPreview.useMutation({ onSuccess: (r: any) => setPreview(r.agencies), onError: errorAlert });
  const run = (trpc as any).platformAdmin.vmsProgramFeesRun.useMutation({
    onSuccess: (r: any) => {
      refresh();
      alert(`Billed ${r.billed.length} agencies.${r.skipped.length ? ` Skipped: ${r.skipped.map((s: any) => `${s.agencyName} (${s.reason})`).join(', ')}` : ''}`);
    },
    onError: errorAlert,
  });
  const p = (k: keyof typeof EMPTY_PLAN) => (e: React.ChangeEvent<HTMLInputElement>) => setPlan({ ...plan, [k]: e.target.value });

  return (
    <>
      <h3 className="text-sm font-semibold text-gray-900">Plans</h3>
      <table className="min-w-full text-sm">
        <thead className="text-xs uppercase text-gray-500">
          <tr>
            <th className="text-left py-2">Plan</th>
            <th className="text-right py-2">Per agency</th>
            <th className="text-right py-2">Per worker</th>
            <th className="text-right py-2">% of spend</th>
            <th className="text-right py-2">Min / cap</th>
            <th className="text-left py-2 pl-4">Active</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {(plans.data?.plans ?? []).map((x: any) => (
            <tr key={x.id}>
              <td className="py-2">{x.name}</td>
              <td className="py-2 text-right">{dollars(x.flatCents)}</td>
              <td className="py-2 text-right">{dollars(x.perWorkerCents)}</td>
              <td className="py-2 text-right">{percent(x.spendBps)}</td>
              <td className="py-2 text-right">
                {dollars(x.minCents)} / {x.maxCents == null ? 'none' : dollars(x.maxCents)}
              </td>
              <td className="py-2 pl-4">{x.active ? 'Yes' : 'No'}</td>
              <td className="py-2 text-right">
                <button
                  onClick={() =>
                    setPlan({
                      id: x.id,
                      name: x.name,
                      description: x.description ?? '',
                      flat: String(x.flatCents / 100),
                      perWorker: String(x.perWorkerCents / 100),
                      spendPct: String(x.spendBps / 100),
                      min: String(x.minCents / 100),
                      max: x.maxCents == null ? '' : String(x.maxCents / 100),
                      days: String(x.daysUntilDue),
                      active: x.active,
                    })
                  }
                  className="text-blue-600 text-xs"
                >
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="rounded-lg border border-gray-200 p-4 space-y-3">
        <h4 className="text-sm font-medium text-gray-900">{plan.id ? `Edit ${plan.name}` : 'New plan'}</h4>
        <div className="grid sm:grid-cols-4 gap-3">
          <Field label="Name">
            <input value={plan.name} onChange={p('name')} className={inputCls} />
          </Field>
          <Field label="Per agency per period ($)">
            <input value={plan.flat} onChange={p('flat')} className={inputCls} inputMode="decimal" />
          </Field>
          <Field label="Per active worker ($)">
            <input value={plan.perWorker} onChange={p('perWorker')} className={inputCls} inputMode="decimal" />
          </Field>
          <Field label="% of approved spend" hint="Not allowed where the program already withholds an agency-funded fee">
            <input value={plan.spendPct} onChange={p('spendPct')} className={inputCls} inputMode="decimal" />
          </Field>
          <Field label="Minimum ($)">
            <input value={plan.min} onChange={p('min')} className={inputCls} inputMode="decimal" />
          </Field>
          <Field label="Cap ($, blank = none)">
            <input value={plan.max} onChange={p('max')} className={inputCls} inputMode="decimal" />
          </Field>
          <Field label="Days until due">
            <input value={plan.days} onChange={p('days')} className={inputCls} inputMode="numeric" />
          </Field>
          <Field label="Active">
            <input type="checkbox" checked={plan.active} onChange={(e) => setPlan({ ...plan, active: e.target.checked })} className="h-4 w-4" />
          </Field>
        </div>
        <Field label="Description (shown to agencies)">
          <input value={plan.description} onChange={p('description')} className={inputCls} />
        </Field>
        <div className="flex gap-3">
          <button
            onClick={() =>
              savePlan.mutate({
                id: plan.id || undefined,
                name: plan.name,
                description: plan.description.trim() || null,
                flatCents: toCents(plan.flat),
                perWorkerCents: toCents(plan.perWorker),
                spendBps: Math.round(Number(plan.spendPct || '0') * 100),
                minCents: toCents(plan.min),
                maxCents: plan.max.trim() === '' ? null : toCents(plan.max),
                daysUntilDue: num(plan.days),
                active: plan.active,
              })
            }
            disabled={savePlan.isLoading || !plan.name.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Save plan
          </button>
          {plan.id && (
            <button onClick={() => setPlan(EMPTY_PLAN)} className="text-sm text-gray-600">
              Cancel
            </button>
          )}
        </div>
      </div>

      <h3 className="text-sm font-semibold text-gray-900 pt-2">Program</h3>
      <Field label="Client organization id" hint={demoOrgs.length ? `Demo: ${demoOrgs.map((o) => `${o.name} (${o.id})`).join(', ')}` : undefined}>
        <input value={clientOrgId} onChange={(e) => setClientOrgId(e.target.value.trim())} className={inputCls} />
      </Field>
      {clientOrgId && (
        <>
          <ul className="text-sm divide-y divide-gray-100">
            {(plans.data?.assignments ?? []).map((a: any) => (
              <li key={a.id} className="py-1.5 flex gap-4 items-center">
                <span className="font-medium">{a.planName}</span>
                <span className="text-gray-600">{a.partnershipId ? `Agency partnership ${a.partnershipId}` : 'Every agency on the program'}</span>
                <span className="text-gray-500">
                  from {String(a.startsOn).slice(0, 10)}
                  {a.endsOn ? ` to ${String(a.endsOn).slice(0, 10)}` : ''}
                </span>
                <button onClick={() => unassign.mutate({ id: a.id })} className="ml-auto text-xs text-red-600">
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <div className="grid sm:grid-cols-4 gap-3 items-end">
            <Field label="Plan">
              <select value={assign.planId} onChange={(e) => setAssign({ ...assign, planId: e.target.value })} className={inputCls}>
                <option value="">Choose…</option>
                {(plans.data?.plans ?? []).filter((x: any) => x.active).map((x: any) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Agency partnership id (blank = all)">
              <input value={assign.partnershipId} onChange={(e) => setAssign({ ...assign, partnershipId: e.target.value.trim() })} className={inputCls} />
            </Field>
            <Field label="Starts on">
              <input type="date" value={assign.startsOn} onChange={(e) => setAssign({ ...assign, startsOn: e.target.value })} className={inputCls} />
            </Field>
            <button
              onClick={() => doAssign.mutate({ clientOrgId, planId: assign.planId, partnershipId: assign.partnershipId || null, startsOn: assign.startsOn })}
              disabled={!assign.planId || doAssign.isLoading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Assign
            </button>
          </div>

          <h3 className="text-sm font-semibold text-gray-900 pt-2">Bill a period</h3>
          <div className="grid sm:grid-cols-4 gap-3 items-end">
            <Field label="From">
              <input type="date" value={period.periodStart} onChange={(e) => setPeriod({ ...period, periodStart: e.target.value })} className={inputCls} />
            </Field>
            <Field label="To">
              <input type="date" value={period.periodEnd} onChange={(e) => setPeriod({ ...period, periodEnd: e.target.value })} className={inputCls} />
            </Field>
            <button
              onClick={() => runPreview.mutate({ clientOrgId, ...period })}
              disabled={!period.periodStart || !period.periodEnd}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              Preview
            </button>
            <button
              onClick={() => confirm('Send program-fee invoices to these agencies through Stripe?') && run.mutate({ clientOrgId, ...period })}
              disabled={!preview?.length || run.isLoading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {run.isLoading ? 'Billing…' : 'Send invoices'}
            </button>
          </div>
          {preview && (
            <ul className="text-sm divide-y divide-gray-100">
              {preview.length === 0 && <li className="py-1.5 text-gray-500">No agency on a plan had approved time in that period.</li>}
              {preview.map((a) => (
                <li key={a.partnershipId} className="py-1.5 flex gap-4">
                  <span className="font-medium">{a.agencyName}</span>
                  <span className="text-gray-600">{a.planName}</span>
                  <span className="text-gray-500">{a.workers} workers</span>
                  <span className="text-gray-500">{dollars(a.spendCents)} spend</span>
                  <span className="ml-auto font-medium">{dollars(a.totalCents)}</span>
                </li>
              ))}
            </ul>
          )}

          <h3 className="text-sm font-semibold text-gray-900 pt-2">Agency invoices</h3>
          <table className="min-w-full text-sm">
            <thead className="text-xs uppercase text-gray-500">
              <tr>
                <th className="text-left py-2">Agency</th>
                <th className="text-left py-2">Period</th>
                <th className="text-left py-2">Plan</th>
                <th className="text-right py-2">Total</th>
                <th className="text-left py-2 pl-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(invoices.data?.invoices ?? []).map((i: any) => (
                <tr key={i.id}>
                  <td className="py-2">{i.agencyName}</td>
                  <td className="py-2">
                    {String(i.periodStart).slice(0, 10)} to {String(i.periodEnd).slice(0, 10)}
                  </td>
                  <td className="py-2">{i.planName}</td>
                  <td className="py-2 text-right">{dollars(Number(i.totalCents))}</td>
                  <td className="py-2 pl-4">
                    {i.status}
                    {i.simulated ? ' (simulated)' : ''}
                    {i.error ? ` · ${i.error}` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}

export function FeatureSettings({ featureKey, demoOrgs }: { featureKey: string; demoOrgs: Org[] }) {
  const body =
    featureKey === 'vms.early_pay' ? (
      <EarlyPaySettings />
    ) : featureKey === 'vms.combined_invoice' ? (
      <CombinedSettings demoOrgs={demoOrgs} />
    ) : featureKey === 'vms.program_fee_billing' ? (
      <ProgramFeeSettings demoOrgs={demoOrgs} />
    ) : featureKey === 'vms.msp_paying_agent' ? (
      <p className="text-sm text-gray-500">The MSP program and its paying-agent setting are configured per client in the VMS MSP settings.</p>
    ) : featureKey === 'vms.direct_1099' ? (
      <p className="text-sm text-gray-500">No staff settings. Until approved, only demo tenants and enabled customers can engage new direct contractors; existing engagements keep working.</p>
    ) : (
      <p className="text-sm text-gray-500">No staff settings. The client configures each AI agent&apos;s pricing, budget and policy in Contractors.</p>
    );
  return (
    <section className="bg-white rounded-lg shadow p-5 space-y-4">
      <h2 className="font-semibold text-gray-900">Feature settings</h2>
      {body}
    </section>
  );
}

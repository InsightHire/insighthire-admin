'use client';
export const dynamic = 'force-dynamic';

/**
 * VMS pay models: how each client program pays contract workers (through
 * their agency, directly by the platform, or both), with a staff lock so the
 * client can't change it, plus platform-wide 1099 totals for workers paid
 * directly. Direct worker pay for a real customer also needs the
 * vms.direct_worker_pay legal review approved and the org enabled.
 */
import Link from 'next/link';
import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';

type Org = { id: string; name: string; demoTenant: boolean };
type PayModel = 'AGENCY_PAY' | 'DIRECT_WORKER_PAY' | 'MIXED';
type Config = {
  payModel: PayModel;
  platformFee: { model: string; perHourCents: number; percentBps: number; formula: string | null };
  processingFeesPaidBy: string;
  payRun: { cadence: string; mode: string; approval: string; timeZone: string };
  workerSignoffRequired: boolean;
  crewGridEntry: boolean;
  classificationAllowed: string;
};
type View = {
  program: Config;
  staffLocked: boolean;
  updatedAt: string | null;
  directPayAllowed: boolean;
  overrides: Array<{ partnershipId: string; staffLocked: boolean; config: Config; updatedAt: string }>;
  partnerships: Array<{ partnershipId: string; agencyName: string; assignments: number; direct: number }>;
};

const MODEL_LABEL: Record<PayModel, string> = {
  AGENCY_PAY: 'Agency pay',
  DIRECT_WORKER_PAY: 'Direct worker pay',
  MIXED: 'Mixed (per assignment)',
};
const CLASS_LABEL: Record<string, string> = { IC_1099_ONLY: '1099 only', W2_VIA_AGENCY: 'W-2 via agency', BOTH: '1099 and W-2' };
const dollars = (c: number) => `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const errorAlert = (e: { message: string }) => alert(e.message);

function feeText(c: Config) {
  const f = c.platformFee;
  if (f.model === 'PER_HOUR') return `${dollars(f.perHourCents)} per hour`;
  if (f.model === 'PERCENT') return `${(f.percentBps / 100).toFixed(2)}% of pay`;
  return f.formula ?? 'Formula';
}

function OrgPicker({ onPick }: { onPick: (o: Org) => void }) {
  const [q, setQ] = useState('');
  const search = (trpc as any).platformAdmin.legalReviewOrgSearch.useQuery({ q: q.trim() }, { enabled: q.trim().length >= 2, refetchOnWindowFocus: false });
  const rows: Org[] = search.data ?? [];
  return (
    <div className="space-y-2">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search client orgs by name or id" className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      {rows.length > 0 && (
        <ul className="max-w-md divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white text-sm">
          {rows.map((o) => (
            <li key={o.id}>
              <button onClick={() => { onPick(o); setQ(''); }} className="w-full px-3 py-2 text-left hover:bg-gray-50">
                {o.name} {o.demoTenant && <span className="ml-1 rounded bg-amber-100 px-1.5 text-xs text-amber-800">demo</span>}
                <span className="ml-2 font-mono text-xs text-gray-400">{o.id}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ModelControls({ config, locked, saving, onSave }: { config: Config; locked: boolean; saving: boolean; onSave: (payModel: PayModel, staffLocked: boolean) => void }) {
  const [model, setModel] = useState<PayModel>(config.payModel);
  const [lock, setLock] = useState(locked);
  const dirty = model !== config.payModel || lock !== locked;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <select value={model} onChange={(e) => setModel(e.target.value as PayModel)} className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm">
        {(Object.keys(MODEL_LABEL) as PayModel[]).map((m) => (
          <option key={m} value={m}>{MODEL_LABEL[m]}</option>
        ))}
      </select>
      <label className="flex items-center gap-1.5 text-sm text-gray-700">
        <input type="checkbox" checked={lock} onChange={(e) => setLock(e.target.checked)} /> Locked by staff
      </label>
      <button
        onClick={() => onSave(model, lock)}
        disabled={!dirty || saving}
        className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  );
}

function ClientPayModel({ org }: { org: Org }) {
  const q = (trpc as any).platformAdmin.vmsPayModel.useQuery({ clientOrgId: org.id }, { refetchOnWindowFocus: false });
  const save = (trpc as any).platformAdmin.vmsSavePayModel.useMutation({ onSuccess: () => q.refetch(), onError: errorAlert });
  if (q.isLoading) return <p className="text-sm text-gray-500">Loading…</p>;
  if (q.error) return <p className="text-sm text-red-600">{q.error.message}</p>;
  const v: View = q.data;
  const p = v.program;
  const overrideFor = (id: string) => v.overrides.find((o) => o.partnershipId === id);
  const submit = (partnershipId: string | null) => (payModel: PayModel, staffLocked: boolean) => save.mutate({ clientOrgId: org.id, partnershipId, patch: { payModel }, staffLocked });

  return (
    <section className="space-y-5 rounded-lg bg-white p-5 shadow">
      <div>
        <h2 className="font-semibold text-gray-900">{org.name}</h2>
        <p className="font-mono text-xs text-gray-400">{org.id}</p>
      </div>
      {!v.directPayAllowed && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Direct worker pay is not cleared for this org. Approve <span className="font-mono">vms.direct_worker_pay</span> and enable the org in{' '}
          <Link href="/legal-review/vms.direct_worker_pay" className="underline">Legal review</Link> first; until then only agency pay can be saved.
        </p>
      )}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-900">Program default</h3>
        <ModelControls key={`${p.payModel}-${v.staffLocked}`} config={p} locked={v.staffLocked} saving={save.isLoading} onSave={submit(null)} />
        <dl className="grid gap-x-6 gap-y-1 text-xs text-gray-600 sm:grid-cols-3">
          <div>Platform fee: {feeText(p)}</div>
          <div>Processing fees paid by: {p.processingFeesPaidBy.toLowerCase()}</div>
          <div>Pay runs: {p.payRun.cadence.toLowerCase()}, {p.payRun.mode.toLowerCase()}, {p.payRun.approval === 'MAKER_CHECKER' ? 'two approvers' : 'one approver'}</div>
          <div>Worker sign-off: {p.workerSignoffRequired ? 'required' : 'off'}</div>
          <div>Crew grid: {p.crewGridEntry ? 'on' : 'off'}</div>
          <div>Worker types: {CLASS_LABEL[p.classificationAllowed] ?? p.classificationAllowed}</div>
        </dl>
        {v.updatedAt && <p className="text-xs text-gray-400">Updated {new Date(v.updatedAt).toLocaleString('en-US')}</p>}
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-900">By agency or crew</h3>
        {v.partnerships.length === 0 ? (
          <p className="text-sm text-gray-500">No active contract workers.</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="text-xs uppercase text-gray-500">
              <tr>
                <th className="py-2 text-left">Agency or crew</th>
                <th className="py-2 text-right">Workers</th>
                <th className="py-2 text-right">Paid directly</th>
                <th className="py-2 pl-6 text-left">Pay model</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {v.partnerships.map((ps) => {
                const o = overrideFor(ps.partnershipId);
                const cfg = o?.config ?? p;
                return (
                  <tr key={ps.partnershipId}>
                    <td className="py-2">
                      {ps.agencyName}
                      {!o && <span className="ml-2 text-xs text-gray-400">program default</span>}
                    </td>
                    <td className="py-2 text-right">{ps.assignments}</td>
                    <td className="py-2 text-right">{ps.direct}</td>
                    <td className="py-2 pl-6">
                      <ModelControls key={`${cfg.payModel}-${o?.staffLocked}`} config={cfg} locked={o?.staffLocked ?? false} saving={save.isLoading} onSave={submit(ps.partnershipId)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-xs text-gray-500">Saving needs a super admin. Changes are audit-logged in the VMS with your staff id.</p>
    </section>
  );
}

function Platform1099() {
  const [year, setYear] = useState(new Date().getFullYear());
  const q = (trpc as any).platformAdmin.vmsDirectPay1099.useQuery({ year }, { refetchOnWindowFocus: false });
  const d = q.data;
  return (
    <section className="space-y-3 rounded-lg bg-white p-5 shadow">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-semibold text-gray-900">1099 totals, workers paid directly (all customers)</h2>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm">
          {[0, 1, 2].map((n) => {
            const y = new Date().getFullYear() - n;
            return <option key={y} value={y}>{y}</option>;
          })}
        </select>
      </div>
      <p className="text-xs text-gray-500">From the VMS ledger, net of reversals. Demo tenants are left out.</p>
      {q.isLoading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : q.error ? (
        <p className="text-sm text-red-600">{q.error.message}</p>
      ) : (
        <>
          <p className="text-sm text-gray-700">
            {d.summary.workers} paid · {d.summary.requires1099} need a 1099 (≥ {dollars(d.thresholdCents)}) · {d.summary.notReady} missing details
          </p>
          {d.workers.length > 0 && (
            <table className="min-w-full text-sm">
              <thead className="text-xs uppercase text-gray-500">
                <tr>
                  <th className="py-2 text-left">Worker</th>
                  <th className="py-2 text-left">Legal name</th>
                  <th className="py-2 text-left">W-9</th>
                  <th className="py-2 text-right">Net paid</th>
                  <th className="py-2 pl-4 text-left">1099</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {d.workers.map((w: any) => (
                  <tr key={w.workerUserId}>
                    <td className="py-2">{w.workerName}</td>
                    <td className="py-2">{w.legalName ?? '—'}</td>
                    <td className="py-2">{w.w9Status}</td>
                    <td className="py-2 text-right">{dollars(w.netCents)}</td>
                    <td className="py-2 pl-4">{!w.requires1099 ? 'Under threshold' : w.ready ? 'Ready' : w.issue ?? 'Needs details'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </section>
  );
}

export default function VmsPayModelsPage() {
  useAdminAuth();
  const [org, setOrg] = useState<Org | null>(null);
  return (
    <AuthenticatedLayout>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">VMS pay models</h1>
          <p className="max-w-3xl text-sm text-gray-500">
            How each client program pays contract workers: through their agency, directly to each worker (GlazierHire-style), or both. Lock a
            pay model so the client can&apos;t change it from Contractors → Direct pay.
          </p>
        </div>
        <OrgPicker onPick={setOrg} />
        {org && <ClientPayModel key={org.id} org={org} />}
        <Platform1099 />
      </div>
    </AuthenticatedLayout>
  );
}

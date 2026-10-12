'use client';
export const dynamic = 'force-dynamic';

/**
 * VMS pay models: how each client program pays contract workers (through
 * their agency, directly by the platform, or both), with a staff lock so the
 * client can't change it, plus platform-wide 1099 totals for workers paid
 * directly. Direct worker pay for a real customer also needs the
 * vms.direct_worker_pay legal review approved and the org enabled.
 * Also: which payment account each program's money runs on (InsightHire
 * payments or the client's own account), never the key, with a staff lock on
 * bringing an own account.
 */
import Link from 'next/link';
import { useState } from 'react';
import { AlertTriangle, Building2, Coins, FileText, Search, UserCheck, Users, Wallet, X } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { AdminPageChrome } from '@/components/admin/page-chrome';
import { SectionCard, DetailList } from '@/components/admin/section-card';
import { StatGrid, StatTile } from '@/components/admin/stat-tile';
import { StatusPill } from '@/components/admin/status-pill';
import { EmptyState } from '@/components/admin/empty-state';
import { Segmented } from '@/components/admin/segmented';
import { DataTableEl, Th, Td } from '@/components/admin/data-table';
import { buttonClass, checkboxClass, inputClass, selectClass } from '@/components/admin/controls';

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

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5 rounded-admin-sm border border-admin-warn/25 bg-admin-warn-soft p-3 text-sm text-amber-900">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-admin-warn" />
      <p>{children}</p>
    </div>
  );
}

function OrgPicker({ onPick }: { onPick: (o: Org) => void }) {
  const [q, setQ] = useState('');
  const search = (trpc as any).platformAdmin.legalReviewOrgSearch.useQuery({ q: q.trim() }, { enabled: q.trim().length >= 2, refetchOnWindowFocus: false });
  const rows: Org[] = search.data ?? [];
  return (
    <div className="relative max-w-xl">
      <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-admin-muted" />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search client orgs by name or id" className={`${inputClass} pl-9`} />
      {rows.length > 0 && (
        <ul className="absolute z-20 mt-1.5 w-full divide-y divide-admin-border overflow-hidden rounded-admin border border-admin-border bg-white text-sm shadow-xl">
          {rows.map((o) => (
            <li key={o.id}>
              <button onClick={() => { onPick(o); setQ(''); }} className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-admin-accent-soft">
                <Building2 className="h-4 w-4 shrink-0 text-admin-muted" />
                <span className="font-medium text-admin-ink">{o.name}</span>
                {o.demoTenant && <StatusPill tone="warn" dot={false}>demo</StatusPill>}
                <span className="ml-auto truncate font-mono text-xs text-admin-muted">{o.id}</span>
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
      <select value={model} onChange={(e) => setModel(e.target.value as PayModel)} className={selectClass}>
        {(Object.keys(MODEL_LABEL) as PayModel[]).map((m) => (
          <option key={m} value={m}>{MODEL_LABEL[m]}</option>
        ))}
      </select>
      <label className="flex items-center gap-2 text-sm text-admin-secondary">
        <input type="checkbox" checked={lock} onChange={(e) => setLock(e.target.checked)} className={checkboxClass} /> Locked by staff
      </label>
      <button onClick={() => onSave(model, lock)} disabled={!dirty || saving} className={buttonClass.primary}>
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  );
}

function ClientPayModel({ org }: { org: Org }) {
  const q = (trpc as any).platformAdmin.vmsPayModel.useQuery({ clientOrgId: org.id }, { refetchOnWindowFocus: false });
  const save = (trpc as any).platformAdmin.vmsSavePayModel.useMutation({ onSuccess: () => q.refetch(), onError: errorAlert });
  if (q.isLoading) return <SectionCard icon={<Coins />} title="Pay model"><p className="text-sm text-admin-muted">Loading…</p></SectionCard>;
  if (q.error) return <SectionCard icon={<Coins />} title="Pay model"><p className="text-sm text-admin-danger">{q.error.message}</p></SectionCard>;
  const v: View = q.data;
  const p = v.program;
  const overrideFor = (id: string) => v.overrides.find((o) => o.partnershipId === id);
  const submit = (partnershipId: string | null) => (payModel: PayModel, staffLocked: boolean) => save.mutate({ clientOrgId: org.id, partnershipId, patch: { payModel }, staffLocked });

  return (
    <SectionCard
      icon={<Coins />}
      title="Pay model"
      description="Program default, plus overrides per agency or crew"
      actions={
        <>
          <StatusPill tone="brand">{MODEL_LABEL[p.payModel]}</StatusPill>
          {v.staffLocked ? <StatusPill tone="neutral">Locked by staff</StatusPill> : null}
        </>
      }
      footer="Saving needs a super admin. Changes are audit-logged in the VMS with your staff id."
    >
      <div className="space-y-6">
        {!v.directPayAllowed && (
          <Notice>
            Direct worker pay is not cleared for this org. Approve <span className="font-mono">vms.direct_worker_pay</span> and enable the org in{' '}
            <Link href="/legal-review/vms.direct_worker_pay" className="font-medium underline">Legal review</Link> first; until then only agency pay can be saved.
          </Notice>
        )}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-admin-ink">Program default</h3>
          <ModelControls key={`${p.payModel}-${v.staffLocked}`} config={p} locked={v.staffLocked} saving={save.isLoading} onSave={submit(null)} />
          <div className="rounded-admin-sm border border-admin-border bg-admin-bg/50 p-4">
            <DetailList
              items={[
                { label: 'Platform fee', value: feeText(p) },
                { label: 'Processing fees paid by', value: p.processingFeesPaidBy.toLowerCase() },
                { label: 'Pay runs', value: `${p.payRun.cadence.toLowerCase()}, ${p.payRun.mode.toLowerCase()}, ${p.payRun.approval === 'MAKER_CHECKER' ? 'two approvers' : 'one approver'}` },
                { label: 'Worker sign-off', value: p.workerSignoffRequired ? 'required' : 'off' },
                { label: 'Crew grid', value: p.crewGridEntry ? 'on' : 'off' },
                { label: 'Worker types', value: CLASS_LABEL[p.classificationAllowed] ?? p.classificationAllowed },
              ]}
            />
          </div>
          {v.updatedAt && <p className="text-xs text-admin-muted">Updated {new Date(v.updatedAt).toLocaleString('en-US')}</p>}
        </div>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-admin-ink">By agency or crew</h3>
          {v.partnerships.length === 0 ? (
            <EmptyState compact className="border-dashed shadow-none" icon={<Users />} title="No active contract workers" description="Agencies and crews show up here once workers are assigned." />
          ) : (
            <div className="overflow-x-auto rounded-admin-sm border border-admin-border">
              <DataTableEl>
                <thead>
                  <tr>
                    <Th>Agency or crew</Th>
                    <Th className="text-right">Workers</Th>
                    <Th className="text-right">Paid directly</Th>
                    <Th>Pay model</Th>
                  </tr>
                </thead>
                <tbody>
                  {v.partnerships.map((ps) => {
                    const o = overrideFor(ps.partnershipId);
                    const cfg = o?.config ?? p;
                    return (
                      <tr key={ps.partnershipId}>
                        <Td className="font-medium text-admin-ink">
                          {ps.agencyName}
                          {!o && <span className="ml-2 text-xs font-normal text-admin-muted">program default</span>}
                        </Td>
                        <Td className="text-right tabular-nums">{ps.assignments}</Td>
                        <Td className="text-right tabular-nums">{ps.direct}</Td>
                        <Td>
                          <ModelControls key={`${cfg.payModel}-${o?.staffLocked}`} config={cfg} locked={o?.staffLocked ?? false} saving={save.isLoading} onSave={submit(ps.partnershipId)} />
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </DataTableEl>
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

type AccountScope = {
  partnershipId: string | null;
  mode: 'PLATFORM' | 'OWN';
  simulated: boolean;
  accountId: string | null;
  accountName: string | null;
  livemode: boolean | null;
  keyHint: string | null;
  webhook: { status: string; lastEventAt: string | null; error: string | null } | null;
  crew?: string | null;
};
type AccountView = {
  demo: boolean;
  legalCleared: boolean;
  locked: boolean;
  lockedReason: string | null;
  program: AccountScope;
  overrides: AccountScope[];
  features: Array<{ feature: string; own: boolean; label: string }>;
  insighthireFee: { bps?: number; perWorkerCents?: number };
  accruedFees: { cents: number; runs: number };
};

function AccountRow({ label, s, onUsePlatform, busy }: { label: string; s: AccountScope; onUsePlatform: () => void; busy: boolean }) {
  return (
    <tr>
      <Td className="font-medium text-admin-ink">{label}</Td>
      <Td>
        <span className="flex flex-wrap items-center gap-1.5">
          {s.mode === 'OWN' ? 'Own account' : 'InsightHire payments'}
          {s.simulated && <StatusPill tone="warn" dot={false}>simulated</StatusPill>}
          {s.livemode === true && <StatusPill tone="success" dot={false}>live</StatusPill>}
          {s.livemode === false && <StatusPill tone="neutral" dot={false}>test</StatusPill>}
        </span>
      </Td>
      <Td mono>{s.accountId ?? '—'}{s.accountName ? <span className="ml-1 font-sans text-admin-muted">{s.accountName}</span> : null}</Td>
      <Td mono>{s.keyHint ?? '—'}</Td>
      <Td className="text-xs">
        {s.webhook ? s.webhook.status.toLowerCase().replace(/_/g, ' ') : '—'}
        {s.webhook?.lastEventAt && <span className="ml-1 text-admin-muted">last event {new Date(s.webhook.lastEventAt).toLocaleString('en-US')}</span>}
        {s.webhook?.error && <span className="block text-admin-danger">{s.webhook.error}</span>}
      </Td>
      <Td className="text-right">
        {s.mode === 'OWN' && (
          <button onClick={onUsePlatform} disabled={busy} className={buttonClass.small}>
            Move to InsightHire payments
          </button>
        )}
      </Td>
    </tr>
  );
}

function ClientPaymentAccount({ org }: { org: Org }) {
  const q = (trpc as any).platformAdmin.vmsPaymentAccount.useQuery({ clientOrgId: org.id }, { refetchOnWindowFocus: false });
  const policy = (trpc as any).platformAdmin.vmsSavePaymentAccountPolicy.useMutation({ onSuccess: () => q.refetch(), onError: errorAlert });
  const usePlatform = (trpc as any).platformAdmin.vmsUsePlatformPaymentAccount.useMutation({
    onSuccess: () => q.refetch(),
    onError: (e: { message: string }, vars: { clientOrgId: string; partnershipId: string | null; force: boolean }) => {
      if (!vars.force && /direct deposit set up/.test(e.message) && confirm(`${e.message}\n\nMove anyway? Those workers will need to set up direct deposit again.`)) {
        usePlatform.mutate({ ...vars, force: true });
        return;
      }
      alert(e.message);
    },
  });
  const [reason, setReason] = useState('');
  if (q.isLoading) return <SectionCard icon={<Wallet />} title="Payment account"><p className="text-sm text-admin-muted">Loading…</p></SectionCard>;
  if (q.error) return <SectionCard icon={<Wallet />} title="Payment account"><p className="text-sm text-admin-danger">{q.error.message}</p></SectionCard>;
  const v: AccountView = q.data;
  const toPlatform = (partnershipId: string | null) => () => {
    if (confirm('Move this program’s money back to InsightHire payments?')) usePlatform.mutate({ clientOrgId: org.id, partnershipId, force: false });
  };
  const fee = v.insighthireFee;

  return (
    <SectionCard
      icon={<Wallet />}
      title="Payment account"
      description="Which account direct worker pay runs on. Keys are never shown here."
      actions={v.locked ? <StatusPill tone="neutral">Own account locked</StatusPill> : null}
      footer="Locking stops the client from connecting or changing an own account; it doesn't move money. Super admin only, audit-logged."
    >
      <div className="space-y-5">
        <p className="text-sm text-admin-secondary">
          With an own account, worker accounts, charges, payouts and 1099 filing live on the client&apos;s account,
          and InsightHire&apos;s fee is recorded as a receivable per paid run (nothing is taken on their account).
        </p>
        {v.demo && <Notice>Demo tenant: own accounts here are simulated and no money moves.</Notice>}
        {!v.demo && !v.legalCleared && (
          <Notice>
            Not cleared. Approve <span className="font-mono">vms.byok_payment_account</span> and enable the org in{' '}
            <Link href="/legal-review/vms.byok_payment_account" className="font-medium underline">Legal review</Link> before the client can bring an own account.
          </Notice>
        )}
        <div className="overflow-x-auto rounded-admin-sm border border-admin-border">
          <DataTableEl>
            <thead>
              <tr>
                <Th>Scope</Th>
                <Th>Account</Th>
                <Th>Account id</Th>
                <Th>Key</Th>
                <Th>Webhook</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              <AccountRow label="Program default" s={v.program} onUsePlatform={toPlatform(null)} busy={usePlatform.isLoading} />
              {v.overrides.map((o) => (
                <AccountRow key={o.partnershipId} label={o.crew ?? o.partnershipId ?? ''} s={o} onUsePlatform={toPlatform(o.partnershipId)} busy={usePlatform.isLoading} />
              ))}
            </tbody>
          </DataTableEl>
        </div>
        <div className="rounded-admin-sm border border-admin-border bg-admin-bg/50 p-4">
          <DetailList
            items={[
              { label: 'InsightHire fee on own account', value: `${((fee.bps ?? 0) / 100).toFixed(2)}% + ${dollars(fee.perWorkerCents ?? 0)} per worker per run` },
              { label: 'Receivable, not yet invoiced', value: `${dollars(v.accruedFees.cents)} (${v.accruedFees.runs} runs)` },
              { label: 'Own account supports', value: `${v.features.filter((f) => f.own).map((f) => f.label).join(', ') || 'nothing'}; the rest stay on InsightHire payments` },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {v.locked ? (
            <>
              <span className="text-sm text-admin-secondary">Own account locked by staff{v.lockedReason ? `: ${v.lockedReason}` : ''}</span>
              <button
                onClick={() => policy.mutate({ clientOrgId: org.id, byokLocked: false, lockedReason: null })}
                disabled={policy.isLoading}
                className={buttonClass.secondary}
              >
                Unlock
              </button>
            </>
          ) : (
            <>
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason shown to the client (optional)" className={`${inputClass} w-72 max-w-full`} />
              <button
                onClick={() => policy.mutate({ clientOrgId: org.id, byokLocked: true, lockedReason: reason.trim() || null })}
                disabled={policy.isLoading}
                className={buttonClass.primary}
              >
                Lock own account
              </button>
            </>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

function Platform1099() {
  const [year, setYear] = useState(new Date().getFullYear());
  const q = (trpc as any).platformAdmin.vmsDirectPay1099.useQuery({ year }, { refetchOnWindowFocus: false });
  const d = q.data;
  const years = [0, 1, 2].map((n) => new Date().getFullYear() - n);
  return (
    <SectionCard
      icon={<FileText />}
      title="1099 totals, workers paid directly (all customers)"
      description="From the VMS ledger, net of reversals. Demo tenants are left out."
      actions={<Segmented size="sm" ariaLabel="Tax year" options={years.map((y) => ({ value: y, label: String(y) }))} value={year} onChange={setYear} />}
    >
      {q.error ? (
        <p className="text-sm text-admin-danger">{q.error.message}</p>
      ) : (
        <div className="space-y-5">
          <StatGrid cols={3}>
            <StatTile label="Workers paid" icon={Users} tone="brand" loading={q.isLoading} value={d?.summary.workers ?? 0} hint={`Tax year ${year}`} />
            <StatTile
              label="Need a 1099"
              icon={UserCheck}
              tone={(d?.summary.requires1099 ?? 0) > 0 ? 'info' : 'muted'}
              loading={q.isLoading}
              value={d?.summary.requires1099 ?? 0}
              hint={d ? `Paid ≥ ${dollars(d.thresholdCents)}` : undefined}
            />
            <StatTile
              label="Missing details"
              icon={AlertTriangle}
              tone={(d?.summary.notReady ?? 0) > 0 ? 'warn' : 'muted'}
              loading={q.isLoading}
              value={d?.summary.notReady ?? 0}
              hint="Legal name or W-9"
            />
          </StatGrid>
          {!q.isLoading && d.workers.length === 0 ? (
            <EmptyState
              compact
              className="border-dashed shadow-none"
              icon={<FileText />}
              title={`No direct-pay workers in ${year}`}
              description="Workers paid directly by the platform show up here with their net pay and 1099 status."
            />
          ) : null}
          {!q.isLoading && d.workers.length > 0 && (
            <div className="overflow-x-auto rounded-admin-sm border border-admin-border">
              <DataTableEl>
                <thead>
                  <tr>
                    <Th>Worker</Th>
                    <Th>Legal name</Th>
                    <Th>W-9</Th>
                    <Th className="text-right">Net paid</Th>
                    <Th>1099</Th>
                  </tr>
                </thead>
                <tbody>
                  {d.workers.map((w: any) => (
                    <tr key={w.workerUserId}>
                      <Td className="font-medium text-admin-ink">{w.workerName}</Td>
                      <Td>{w.legalName ?? '—'}</Td>
                      <Td>{w.w9Status}</Td>
                      <Td className="text-right tabular-nums">{dollars(w.netCents)}</Td>
                      <Td>
                        {!w.requires1099 ? (
                          <StatusPill tone="neutral">Under threshold</StatusPill>
                        ) : w.ready ? (
                          <StatusPill tone="success">Ready</StatusPill>
                        ) : (
                          <StatusPill tone="warn">{w.issue ?? 'Needs details'}</StatusPill>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </DataTableEl>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}

export default function VmsPayModelsPage() {
  useAdminAuth();
  const [org, setOrg] = useState<Org | null>(null);
  return (
    <AuthenticatedLayout>
      <AdminPageChrome
        icon={<Coins />}
        breadcrumbs={[{ label: 'Tenants', href: '/organizations' }, { label: 'VMS pay models' }]}
        title="VMS pay models"
        description={
          <>
            How each client program pays contract workers: through their agency, directly to each worker (GlazierHire-style), or both. Lock a
            pay model so the client can&apos;t change it from Contractors → Direct pay.
          </>
        }
      >
        <div className="space-y-6">
          <SectionCard
            icon={<Building2 />}
            title="Client program"
            description="Pick a client org to see and change its pay model and payment account"
            actions={
              org ? (
                <span className="flex items-center gap-2">
                  <StatusPill tone="brand">{org.name}</StatusPill>
                  {org.demoTenant && <StatusPill tone="warn" dot={false}>demo</StatusPill>}
                  <button onClick={() => setOrg(null)} className={buttonClass.ghost} aria-label="Clear selected org">
                    <X className="h-4 w-4" />
                  </button>
                </span>
              ) : null
            }
          >
            <div className="space-y-4">
              <OrgPicker onPick={setOrg} />
              {org ? (
                <p className="font-mono text-xs text-admin-muted">{org.id}</p>
              ) : (
                <EmptyState
                  compact
                  className="border-dashed shadow-none"
                  icon={<Search />}
                  title="No client selected"
                  description="Search by name or id. The pay model, agency overrides and payment account load here."
                />
              )}
            </div>
          </SectionCard>
          {org && (
            <div className="space-y-6">
              <ClientPayModel key={org.id} org={org} />
              <ClientPaymentAccount key={`acct-${org.id}`} org={org} />
            </div>
          )}
          <Platform1099 />
        </div>
      </AdminPageChrome>
    </AuthenticatedLayout>
  );
}

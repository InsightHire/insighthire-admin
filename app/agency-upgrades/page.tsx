'use client';
export const dynamic = 'force-dynamic';

/**
 * Agency upgrades: turn a free agency (agency portal only) into a full
 * InsightHire org that also uses InsightHire as its own ATS, or back. Same
 * org id, so partnerships, submissions, contractors and history stay. No
 * billing changes. Agencies can ask from the portal; those show first.
 */
import { useState } from 'react';
import { ArrowUpCircle, Briefcase, CheckCircle2, Search } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { AdminPageChrome } from '@/components/admin/page-chrome';
import { SectionCard } from '@/components/admin/section-card';
import { StatusPill } from '@/components/admin/status-pill';
import { EmptyState } from '@/components/admin/empty-state';
import { buttonClass, checkboxClass, inputClass } from '@/components/admin/controls';

type Row = {
  id: string;
  name: string | null;
  orgKind: string;
  fullInsightHire: boolean;
  upgrade: { upgradedAt: string; revertedAt?: string; grantSlugs: string[] } | null;
  request: { requestedAt: string; email: string; note: string | null } | null;
  activeClients: number;
  agencyAdmins: number;
};

const ADMIN_ACTION: Record<string, string> = {
  add_membership: 'Gets a dashboard login as org admin',
  already_member: 'Already in the dashboard',
  invite: 'Gets a team invite email',
  blocked: 'Blocked',
};

function fmt(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
}

function Detail({ orgId, onDone }: { orgId: string; onDone: (message: string) => void }) {
  const adminTrpc = trpc as any;
  const preview = adminTrpc.platformAdmin.agencyUpgrade.preview.useQuery({ organizationId: orgId }, { refetchOnWindowFocus: false });
  const [grants, setGrants] = useState<string[]>([]);
  const [confirmRevert, setConfirmRevert] = useState(false);
  const upgrade = adminTrpc.platformAdmin.agencyUpgrade.upgrade.useMutation({
    onSuccess: (res: any) => {
      preview.refetch();
      onDone(
        `${res.alreadyUpgraded ? 'Re-ran the upgrade' : 'Upgraded'}: ${res.admins.length} admin(s), ${res.record.grantSlugs.length} module(s) on.` +
          (res.authioError ? ` Sign-in org link failed: ${res.authioError}` : ''),
      );
    },
  });
  const revert = adminTrpc.platformAdmin.agencyUpgrade.revert.useMutation({
    onSuccess: (res: any) => {
      preview.refetch();
      setConfirmRevert(false);
      onDone(`Reverted: ${res.membershipsTurnedOff} login(s) and ${res.grantsTurnedOff} module(s) turned off, ${res.invitesRevoked} invite(s) revoked.`);
    },
  });

  if (preview.isLoading) return <p className="text-sm text-admin-muted">Loading…</p>;
  if (preview.error) return <p className="text-sm text-admin-danger">{preview.error.message}</p>;
  const p = preview.data;
  const upgraded = p.upgrade && !p.upgrade.revertedAt;
  const toggle = (slug: string) => setGrants((g) => (g.includes(slug) ? g.filter((s: string) => s !== slug) : [...g, slug]));

  return (
    <div className="space-y-4 rounded-admin-sm border border-admin-border bg-admin-bg/50 p-4">
      <p className="text-sm text-admin-secondary">
        Keeps {p.kept.partnerships} partnership(s) and {p.kept.submissions} submission(s). {p.hasAuthioOrg ? 'Has a sign-in org.' : 'A sign-in org is created on upgrade.'}
      </p>
      <div>
        <h3 className="text-sm font-semibold text-admin-ink">Agency admins</h3>
        <ul className="mt-1 space-y-1 text-sm">
          {p.admins.map((a: any) => (
            <li key={a.partnerUserId} className={a.action === 'blocked' ? 'text-admin-danger' : 'text-admin-secondary'}>
              {[a.firstName, a.lastName].filter(Boolean).join(' ') || a.email} ({a.email}): {ADMIN_ACTION[a.action] ?? a.action}
              {a.reason ? `. ${a.reason}` : ''}
            </li>
          ))}
          {p.admins.length === 0 && <li className="text-admin-muted">No active agency admins.</li>}
        </ul>
      </div>
      {(!p.fullInsightHire || upgraded) && (
        <div>
          <h3 className="text-sm font-semibold text-admin-ink">Modules to turn on</h3>
          <div className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {p.modules.map((m: any) => (
              <label key={m.slug} className="flex items-start gap-2 text-sm text-admin-secondary" title={m.description ?? ''}>
                <input type="checkbox" className={`${checkboxClass} mt-0.5`} disabled={m.granted} checked={m.granted || grants.includes(m.slug)} onChange={() => toggle(m.slug)} />
                <span>
                  {m.name}
                  {m.granted && <span className="text-xs text-admin-muted"> (on)</span>}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {(!p.fullInsightHire || upgraded) && (
          <button
            onClick={() => upgrade.mutate({ organizationId: orgId, grantSlugs: grants })}
            disabled={upgrade.isLoading}
            className={buttonClass.primary}
          >
            {upgrade.isLoading ? 'Working…' : upgraded ? 'Re-run upgrade (adds what is missing)' : 'Upgrade to full InsightHire'}
          </button>
        )}
        {upgraded &&
          (confirmRevert ? (
            <>
              <span className="text-sm text-admin-danger">Turns off the dashboard logins and modules this upgrade added. No data is deleted.</span>
              <button
                onClick={() => revert.mutate({ organizationId: orgId, confirm: true })}
                disabled={revert.isLoading}
                className={buttonClass.danger}
              >
                Confirm revert
              </button>
              <button onClick={() => setConfirmRevert(false)} className={buttonClass.ghost}>
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmRevert(true)}
              className={`${buttonClass.secondary} border-red-300 text-red-700 hover:border-red-400 hover:bg-admin-danger-soft`}
            >
              Revert to free agency
            </button>
          ))}
      </div>
      {upgrade.error && <p className="text-sm text-admin-danger">{upgrade.error.message}</p>}
      {revert.error && <p className="text-sm text-admin-danger">{revert.error.message}</p>}
    </div>
  );
}

export default function AgencyUpgradesPage() {
  useAdminAuth();
  const list = (trpc as any).platformAdmin.agencyUpgrade.list.useQuery(undefined, { refetchOnWindowFocus: false });
  const [open, setOpen] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const rows = ((list.data ?? []) as Row[]).filter((r) => !search.trim() || (r.name ?? '').toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <AuthenticatedLayout>
      <AdminPageChrome
        icon={<ArrowUpCircle />}
        breadcrumbs={[{ label: 'Tenants', href: '/organizations' }, { label: 'Agency upgrades' }]}
        title="Agency upgrades"
        description={
          <>
            Turn a free agency into a full InsightHire org so it can use InsightHire as its own ATS. Same org: partnerships,
            submissions, contractors and history stay. Its agency admins get dashboard logins. No billing changes.
          </>
        }
      >
        <div className="space-y-6">
          {message && (
            <div className="flex items-start gap-2.5 rounded-admin-sm border border-admin-ok/20 bg-admin-ok-soft px-4 py-3 text-sm text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-admin-ok" />
              <p>{message}</p>
            </div>
          )}
          <SectionCard
            icon={<Briefcase />}
            title="Agencies"
            description="Agencies that asked from the portal show first"
            padded={false}
          >
            <div className="border-b border-admin-border px-5 py-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-admin-muted" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter agencies by name"
                  className={`${inputClass} pl-9`}
                />
              </div>
            </div>
            <div className="divide-y divide-admin-border">
              {list.isLoading && <p className="p-5 text-sm text-admin-muted">Loading…</p>}
              {list.error && <p className="p-5 text-sm text-admin-danger">{list.error.message}</p>}
              {rows.map((r) => (
                <div key={r.id} className="space-y-3 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-medium text-admin-ink">
                        {r.name ?? r.id}
                        <StatusPill tone={r.fullInsightHire ? 'brand' : 'neutral'}>
                          {r.fullInsightHire ? 'Full InsightHire' : 'Free agency'}
                        </StatusPill>
                        {r.request && <StatusPill tone="warn">Requested</StatusPill>}
                        <span className="font-mono text-xs font-normal text-admin-muted">{r.id}</span>
                      </p>
                      <p className="mt-1 text-xs text-admin-muted">
                        {r.activeClients} active client(s) · {r.agencyAdmins} admin(s)
                        {r.upgrade && !r.upgrade.revertedAt ? ` · upgraded ${fmt(r.upgrade.upgradedAt)}` : ''}
                        {r.upgrade?.revertedAt ? ` · reverted ${fmt(r.upgrade.revertedAt)}` : ''}
                      </p>
                      {r.request && (
                        <p className="mt-1 text-sm text-amber-800">
                          Requested {fmt(r.request.requestedAt)} by {r.request.email}
                          {r.request.note ? `: “${r.request.note}”` : ''}
                        </p>
                      )}
                    </div>
                    <button onClick={() => setOpen(open === r.id ? null : r.id)} className={buttonClass.small}>
                      {open === r.id ? 'Close' : 'Review'}
                    </button>
                  </div>
                  {open === r.id && (
                    <Detail
                      orgId={r.id}
                      onDone={(m) => {
                        setMessage(m);
                        list.refetch();
                      }}
                    />
                  )}
                </div>
              ))}
              {!list.isLoading && rows.length === 0 && (
                <EmptyState compact className="border-0 shadow-none" icon={<Briefcase />} title="No agencies." />
              )}
            </div>
          </SectionCard>
        </div>
      </AdminPageChrome>
    </AuthenticatedLayout>
  );
}

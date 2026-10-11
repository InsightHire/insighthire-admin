'use client';
export const dynamic = 'force-dynamic';

/**
 * Agency upgrades: turn a free agency (agency portal only) into a full
 * InsightHire org that also uses InsightHire as its own ATS, or back. Same
 * org id, so partnerships, submissions, contractors and history stay. No
 * billing changes. Agencies can ask from the portal; those show first.
 */
import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';

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

  if (preview.isLoading) return <p className="text-sm text-gray-500">Loading…</p>;
  if (preview.error) return <p className="text-sm text-red-600">{preview.error.message}</p>;
  const p = preview.data;
  const upgraded = p.upgrade && !p.upgrade.revertedAt;
  const toggle = (slug: string) => setGrants((g) => (g.includes(slug) ? g.filter((s: string) => s !== slug) : [...g, slug]));

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-700">
        Keeps {p.kept.partnerships} partnership(s) and {p.kept.submissions} submission(s). {p.hasAuthioOrg ? 'Has a sign-in org.' : 'A sign-in org is created on upgrade.'}
      </p>
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Agency admins</h3>
        <ul className="mt-1 space-y-1 text-sm">
          {p.admins.map((a: any) => (
            <li key={a.partnerUserId} className={a.action === 'blocked' ? 'text-red-700' : 'text-gray-700'}>
              {[a.firstName, a.lastName].filter(Boolean).join(' ') || a.email} ({a.email}): {ADMIN_ACTION[a.action] ?? a.action}
              {a.reason ? `. ${a.reason}` : ''}
            </li>
          ))}
          {p.admins.length === 0 && <li className="text-gray-500">No active agency admins.</li>}
        </ul>
      </div>
      {(!p.fullInsightHire || upgraded) && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Modules to turn on</h3>
          <div className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {p.modules.map((m: any) => (
              <label key={m.slug} className="flex items-start gap-2 text-sm text-gray-700" title={m.description ?? ''}>
                <input type="checkbox" disabled={m.granted} checked={m.granted || grants.includes(m.slug)} onChange={() => toggle(m.slug)} />
                <span>
                  {m.name}
                  {m.granted && <span className="text-xs text-gray-400"> (on)</span>}
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
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {upgrade.isLoading ? 'Working…' : upgraded ? 'Re-run upgrade (adds what is missing)' : 'Upgrade to full InsightHire'}
          </button>
        )}
        {upgraded &&
          (confirmRevert ? (
            <>
              <span className="text-sm text-red-700">Turns off the dashboard logins and modules this upgrade added. No data is deleted.</span>
              <button
                onClick={() => revert.mutate({ organizationId: orgId, confirm: true })}
                disabled={revert.isLoading}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                Confirm revert
              </button>
              <button onClick={() => setConfirmRevert(false)} className="text-sm text-gray-600 hover:text-gray-900">
                Cancel
              </button>
            </>
          ) : (
            <button onClick={() => setConfirmRevert(true)} className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50">
              Revert to free agency
            </button>
          ))}
      </div>
      {upgrade.error && <p className="text-sm text-red-600">{upgrade.error.message}</p>}
      {revert.error && <p className="text-sm text-red-600">{revert.error.message}</p>}
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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agency upgrades</h1>
          <p className="text-sm text-gray-500">
            Turn a free agency into a full InsightHire org so it can use InsightHire as its own ATS. Same org: partnerships,
            submissions, contractors and history stay. Its agency admins get dashboard logins. No billing changes.
          </p>
        </div>
        {message && <p className="rounded-lg bg-green-50 px-4 py-2 text-sm text-green-800">{message}</p>}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter agencies by name"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <section className="bg-white rounded-lg shadow divide-y divide-gray-100">
          {list.isLoading && <p className="p-5 text-sm text-gray-500">Loading…</p>}
          {list.error && <p className="p-5 text-sm text-red-600">{list.error.message}</p>}
          {rows.map((r) => (
            <div key={r.id} className="p-5 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-gray-900">
                    {r.name ?? r.id} <span className="text-xs font-mono text-gray-400">{r.id}</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    {r.fullInsightHire ? 'Full InsightHire' : 'Free agency'} · {r.activeClients} active client(s) · {r.agencyAdmins} admin(s)
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
                <button onClick={() => setOpen(open === r.id ? null : r.id)} className="text-sm text-blue-600 hover:text-blue-700">
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
          {!list.isLoading && rows.length === 0 && <p className="p-5 text-sm text-gray-500">No agencies.</p>}
        </section>
      </div>
    </AuthenticatedLayout>
  );
}

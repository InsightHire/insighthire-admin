'use client';
export const dynamic = 'force-dynamic';

/**
 * Agency user migration (TON-1198, AG-P17). A client names which of its
 * users are really agency staff; staff move them onto Agency Partners:
 * pick the client, pick the people, name the agency, preview, apply. Their
 * client seats are removed in a separate step, only after the client confirms.
 */
import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';

type Member = {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  activeInOrg: boolean;
  createdApplications: number;
  ownedCandidates: number;
  alreadyMigrated: boolean;
};

const PERSON_ACTION: Record<string, string> = {
  create_partner_user: 'New agency login',
  add_membership: 'Existing agency login, added to team',
  already_member: 'Already on the team',
  blocked: 'Blocked',
};

const APP_ACTION: Record<string, string> = {
  link: 'Will link',
  already_linked: 'Already linked',
  other_agency: 'Credited to another agency (skipped)',
};

function personName(m: { firstName: string | null; lastName: string | null; email: string }) {
  return [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email;
}

export default function AgencyMigrationPage() {
  useAdminAuth();
  const utils = (trpc as any).useUtils();

  const [search, setSearch] = useState('');
  const [org, setOrg] = useState<{ id: string; name: string } | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [adminUserId, setAdminUserId] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [includeOwned, setIncludeOwned] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [previewKey, setPreviewKey] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [applyResult, setApplyResult] = useState<any>(null);
  const [toRemove, setToRemove] = useState<string[]>([]);
  const [clientConfirmed, setClientConfirmed] = useState(false);
  const [removeResult, setRemoveResult] = useState<any>(null);

  const orgs = (trpc as any).platformAdmin.listOrganizations.useQuery(
    { page: 1, limit: 20, search: search.trim() },
    { enabled: !org && search.trim().length >= 2, refetchOnWindowFocus: false },
  );
  const members = (trpc as any).platformAdmin.agencyMigration.members.useQuery(
    { clientOrgId: org?.id ?? '' },
    { enabled: !!org, refetchOnWindowFocus: false },
  );
  const apply = (trpc as any).platformAdmin.agencyMigration.applyChanges.useMutation({
    onSuccess: (res: any) => {
      setApplyResult(res);
      setPreview(null);
      members.refetch();
    },
    onError: (e: { message: string }) => alert('Migration failed: ' + e.message),
  });
  const removeSeats = (trpc as any).platformAdmin.agencyMigration.removeClientMemberships.useMutation({
    onSuccess: (res: any) => {
      setRemoveResult(res);
      setToRemove([]);
      setClientConfirmed(false);
      members.refetch();
    },
    onError: (e: { message: string }) => alert('Removing seats failed: ' + e.message),
  });

  const input = {
    clientOrgId: org?.id ?? '',
    userIds: selected,
    adminUserId,
    agencyName: agencyName.trim(),
    includeOwnedCandidates: includeOwned,
  };
  const inputKey = JSON.stringify(input);
  const canPreview = !!org && selected.length > 0 && selected.includes(adminUserId) && input.agencyName.length > 0;
  const previewIsCurrent = !!preview && previewKey === inputKey;

  const runPreview = async () => {
    setPreviewing(true);
    setPreviewError('');
    setApplyResult(null);
    try {
      const plan = await utils.platformAdmin.agencyMigration.preview.fetch(input, { staleTime: 0 });
      setPreview(plan);
      setPreviewKey(inputKey);
    } catch (e: any) {
      setPreview(null);
      setPreviewError(e?.message ?? 'Preview failed');
    } finally {
      setPreviewing(false);
    }
  };

  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const memberList: Member[] = members.data ?? [];
  const removable = memberList.filter((m) => m.alreadyMigrated && m.activeInOrg);
  const nameOf = (userId: string) => {
    const m = memberList.find((x) => x.userId === userId);
    return m ? personName(m) : userId;
  };

  return (
    <AuthenticatedLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agency user migration</h1>
          <p className="text-sm text-gray-500">
            Move the people a client names as agency staff onto Agency Partners. Their applications are credited
            to the agency. Their seat in the client stays until the client confirms (step 3).
          </p>
        </div>

        {/* 1. Client */}
        <section className="bg-white rounded-lg shadow p-5 space-y-3">
          <h2 className="font-semibold text-gray-900">1. Client organization</h2>
          {org ? (
            <div className="flex items-center gap-3 text-sm">
              <span className="font-medium">{org.name}</span>
              <span className="text-gray-400 font-mono text-xs">{org.id}</span>
              <button
                onClick={() => {
                  setOrg(null);
                  setSelected([]);
                  setAdminUserId('');
                  setPreview(null);
                  setApplyResult(null);
                  setRemoveResult(null);
                  setToRemove([]);
                }}
                className="text-blue-600 hover:text-blue-700"
              >
                Change
              </button>
            </div>
          ) : (
            <>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search organizations by name or domain"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <ul className="divide-y divide-gray-100">
                {(orgs.data?.organizations ?? [])
                  .filter((o: any) => o.orgKind !== 'SUPPLIER_ONLY' && o.orgKind !== 'AGENCY')
                  .map((o: any) => (
                    <li key={o.id}>
                      <button
                        onClick={() => setOrg({ id: o.id, name: o.name })}
                        className="w-full text-left px-2 py-2 text-sm hover:bg-gray-50"
                      >
                        {o.name} <span className="text-gray-400">{o.domain ?? ''}</span>
                      </button>
                    </li>
                  ))}
              </ul>
            </>
          )}
        </section>

        {/* 2. People + agency */}
        {org && (
          <section className="bg-white rounded-lg shadow p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">2. People the client named, and their agency</h2>
            {members.isLoading ? (
              <p className="text-sm text-gray-500">Loading people…</p>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="text-xs uppercase text-gray-500">
                  <tr>
                    <th className="text-left py-2 w-10">Move</th>
                    <th className="text-left py-2 w-24">Agency admin</th>
                    <th className="text-left py-2">Person</th>
                    <th className="text-left py-2">Client role</th>
                    <th className="text-right py-2">Applications created</th>
                    <th className="text-right py-2">Candidates owned</th>
                    <th className="text-left py-2 pl-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {memberList.map((m) => (
                    <tr key={m.userId}>
                      <td className="py-2">
                        <input
                          type="checkbox"
                          checked={selected.includes(m.userId)}
                          onChange={() => {
                            const next = toggle(selected, m.userId);
                            setSelected(next);
                            if (!next.includes(adminUserId)) setAdminUserId(next[0] ?? '');
                          }}
                        />
                      </td>
                      <td className="py-2">
                        <input
                          type="radio"
                          name="agency-admin"
                          disabled={!selected.includes(m.userId)}
                          checked={adminUserId === m.userId}
                          onChange={() => setAdminUserId(m.userId)}
                        />
                      </td>
                      <td className="py-2">
                        <p className="font-medium text-gray-900">{personName(m)}</p>
                        <p className="text-xs text-gray-500">{m.email}</p>
                      </td>
                      <td className="py-2 text-gray-600">{m.role}</td>
                      <td className="py-2 text-right tabular-nums">{m.createdApplications}</td>
                      <td className="py-2 text-right tabular-nums">{m.ownedCandidates}</td>
                      <td className="py-2 pl-4 text-xs text-gray-500">
                        {m.alreadyMigrated ? 'Migrated' : ''}
                        {!m.activeInOrg ? (m.alreadyMigrated ? ' · seat removed' : 'No active seat') : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                placeholder="Agency name (e.g. Harbor Light Recruiting)"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={includeOwned} onChange={(e) => setIncludeOwned(e.target.checked)} />
                Also credit applications of candidates they own (not just ones they created)
              </label>
            </div>
            <button
              onClick={runPreview}
              disabled={!canPreview || previewing}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {previewing ? 'Previewing…' : 'Preview (no changes)'}
            </button>
            {previewError && <p className="text-sm text-red-600">{previewError}</p>}
          </section>
        )}

        {/* Preview + apply */}
        {org && preview && (
          <section className="bg-white rounded-lg shadow p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">Preview</h2>
            <p className="text-sm text-gray-700">
              {preview.agency.action === 'create' ? 'Create' : 'Reuse'} agency{' '}
              <strong>{preview.agency.name}</strong> and its partnership with <strong>{preview.clientOrg.name}</strong>.
              {' '}{preview.summary.applicationsToLink} application(s) will be credited to the agency
              {preview.summary.applicationsAlreadyLinked > 0 && `, ${preview.summary.applicationsAlreadyLinked} already are`}
              {preview.summary.applicationsOtherAgency > 0 && `, ${preview.summary.applicationsOtherAgency} belong to another agency and are skipped`}.
            </p>
            <ul className="text-sm space-y-1">
              {preview.people.map((p: any) => (
                <li key={p.userId} className={p.action === 'blocked' ? 'text-red-700' : 'text-gray-700'}>
                  {personName(p)} ({p.email}) — {p.role === 'AGENCY_ADMIN' ? 'agency admin' : 'agency recruiter'} ·{' '}
                  {PERSON_ACTION[p.action] ?? p.action}
                  {p.note ? ` — ${p.note}` : ''}
                </li>
              ))}
            </ul>
            {preview.applications.length > 0 && (
              <table className="min-w-full text-sm">
                <thead className="text-xs uppercase text-gray-500">
                  <tr>
                    <th className="text-left py-2">Candidate</th>
                    <th className="text-left py-2">Job</th>
                    <th className="text-left py-2">Added by</th>
                    <th className="text-left py-2">Applied</th>
                    <th className="text-left py-2">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {preview.applications.map((a: any) => (
                    <tr key={a.applicationId}>
                      <td className="py-1.5">{a.candidateName}</td>
                      <td className="py-1.5 text-gray-600">{a.positionTitle}</td>
                      <td className="py-1.5 text-gray-600">
                        {nameOf(a.createdByUserId)}
                        {a.via === 'owner' && <span className="text-xs text-gray-400"> (owner)</span>}
                      </td>
                      <td className="py-1.5 text-gray-600">{new Date(a.appliedAt).toLocaleDateString()}</td>
                      <td className="py-1.5 text-gray-600">{APP_ACTION[a.action] ?? a.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {preview.applicationsTruncated && (
              <p className="text-xs text-gray-500">Showing the first 500 applications; apply covers all of them.</p>
            )}
            <button
              onClick={() => {
                if (!confirm(`Apply this migration for ${preview.clientOrg.name}? Client seats are not removed yet.`)) return;
                apply.mutate(input);
              }}
              disabled={!previewIsCurrent || preview.summary.peopleBlocked > 0 || apply.isLoading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {apply.isLoading ? 'Applying…' : 'Apply migration'}
            </button>
            {!previewIsCurrent && <p className="text-xs text-amber-700">You changed the selection. Preview again before applying.</p>}
          </section>
        )}

        {applyResult && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
            Done. {applyResult.peopleAdded} person(s) added to the agency team, {applyResult.submissionsCreated}{' '}
            application(s) credited ({applyResult.submissionsSkipped} skipped). They sign in at the partner portal
            with the same email.
          </div>
        )}

        {/* 3. Remove client seats */}
        {org && (
          <section className="bg-white rounded-lg shadow p-5 space-y-3">
            <h2 className="font-semibold text-gray-900">3. Remove their client seats (after the client confirms)</h2>
            {removable.length === 0 ? (
              <p className="text-sm text-gray-500">No migrated people still have a seat in this client.</p>
            ) : (
              <>
                <ul className="space-y-1 text-sm">
                  {removable.map((m) => (
                    <li key={m.userId}>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={toRemove.includes(m.userId)}
                          onChange={() => setToRemove(toggle(toRemove, m.userId))}
                        />
                        {personName(m)} <span className="text-gray-500">({m.email})</span>
                      </label>
                    </li>
                  ))}
                </ul>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={clientConfirmed} onChange={(e) => setClientConfirmed(e.target.checked)} />
                  The client confirmed these people should lose access to {org.name}.
                </label>
                <button
                  onClick={() => {
                    if (!confirm(`Remove ${toRemove.length} seat(s) from ${org.name}? They keep their agency access.`)) return;
                    removeSeats.mutate({ clientOrgId: org.id, userIds: toRemove, confirm: true });
                  }}
                  disabled={toRemove.length === 0 || !clientConfirmed || removeSeats.isLoading}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {removeSeats.isLoading ? 'Removing…' : 'Remove client seats'}
                </button>
              </>
            )}
            {removeResult && (
              <p className="text-sm text-green-800">
                Removed {removeResult.removed} seat(s){removeResult.alreadyRemoved > 0 && `, ${removeResult.alreadyRemoved} already removed`}.
              </p>
            )}
          </section>
        )}
      </div>
    </AuthenticatedLayout>
  );
}

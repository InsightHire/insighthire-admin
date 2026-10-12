'use client';
export const dynamic = 'force-dynamic';

/**
 * Agency user migration (TON-1198, AG-P17). A client names which of its
 * users are really agency staff; staff move them onto Agency Partners:
 * pick the client, pick the people, name the agency, preview, apply. Their
 * client seats are removed in a separate step, only after the client confirms.
 */
import { useState } from 'react';
import { Building2, CheckCircle2, Eye, Search, UserMinus, Users, ArrowRightLeft } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { AdminPageChrome } from '@/components/admin/page-chrome';
import { SectionCard } from '@/components/admin/section-card';
import { StatusPill } from '@/components/admin/status-pill';
import { EmptyState } from '@/components/admin/empty-state';
import { DataTableEl, Th, Td } from '@/components/admin/data-table';
import { buttonClass, checkboxClass, inputClass } from '@/components/admin/controls';

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
  const clientOrgs = (orgs.data?.organizations ?? []).filter((o: any) => o.orgKind !== 'SUPPLIER_ONLY' && o.orgKind !== 'AGENCY');

  return (
    <AuthenticatedLayout>
      <AdminPageChrome
        icon={<ArrowRightLeft />}
        breadcrumbs={[{ label: 'Tenants', href: '/organizations' }, { label: 'Agency user migration' }]}
        title="Agency user migration"
        description={
          <>
            Move the people a client names as agency staff onto Agency Partners. Their applications are credited
            to the agency. Their seat in the client stays until the client confirms (step 3).
          </>
        }
      >
        <div className="space-y-6">
          {/* 1. Client */}
          <SectionCard
            icon={<Building2 />}
            title="1. Client organization"
            description="Pick the client whose users are really agency staff"
            actions={
              org ? (
                <span className="flex items-center gap-2">
                  <StatusPill tone="brand">{org.name}</StatusPill>
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
                    className={buttonClass.small}
                  >
                    Change
                  </button>
                </span>
              ) : null
            }
          >
            {org ? (
              <p className="font-mono text-xs text-admin-muted">{org.id}</p>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-admin-muted" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search organizations by name or domain"
                    className={`${inputClass} pl-9`}
                  />
                </div>
                {clientOrgs.length > 0 ? (
                  <ul className="divide-y divide-admin-border overflow-hidden rounded-admin-sm border border-admin-border">
                    {clientOrgs.map((o: any) => (
                      <li key={o.id}>
                        <button
                          onClick={() => setOrg({ id: o.id, name: o.name })}
                          className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-admin-accent-soft"
                        >
                          <Building2 className="h-4 w-4 shrink-0 text-admin-muted" />
                          <span className="font-medium text-admin-ink">{o.name}</span>
                          <span className="text-admin-muted">{o.domain ?? ''}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState
                    compact
                    className="border-dashed shadow-none"
                    icon={<Search />}
                    title="No client selected"
                    description="Search by name or domain. The people the client named load here."
                  />
                )}
              </div>
            )}
          </SectionCard>

          {/* 2. People + agency */}
          {org && (
            <SectionCard icon={<Users />} title="2. People the client named, and their agency">
              <div className="space-y-4">
                {members.isLoading ? (
                  <p className="text-sm text-admin-muted">Loading people…</p>
                ) : (
                  <div className="overflow-x-auto rounded-admin-sm border border-admin-border">
                    <DataTableEl>
                      <thead>
                        <tr>
                          <Th className="w-10">Move</Th>
                          <Th className="w-24">Agency admin</Th>
                          <Th>Person</Th>
                          <Th>Client role</Th>
                          <Th className="text-right">Applications created</Th>
                          <Th className="text-right">Candidates owned</Th>
                          <Th>Status</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {memberList.map((m) => (
                          <tr key={m.userId}>
                            <Td>
                              <input
                                type="checkbox"
                                className={checkboxClass}
                                checked={selected.includes(m.userId)}
                                onChange={() => {
                                  const next = toggle(selected, m.userId);
                                  setSelected(next);
                                  if (!next.includes(adminUserId)) setAdminUserId(next[0] ?? '');
                                }}
                              />
                            </Td>
                            <Td>
                              <input
                                type="radio"
                                name="agency-admin"
                                className="h-4 w-4 border-admin-border-strong text-admin-accent focus:ring-admin-accent/30"
                                disabled={!selected.includes(m.userId)}
                                checked={adminUserId === m.userId}
                                onChange={() => setAdminUserId(m.userId)}
                              />
                            </Td>
                            <Td>
                              <p className="font-medium text-admin-ink">{personName(m)}</p>
                              <p className="text-xs text-admin-muted">{m.email}</p>
                            </Td>
                            <Td>{m.role}</Td>
                            <Td className="text-right tabular-nums">{m.createdApplications}</Td>
                            <Td className="text-right tabular-nums">{m.ownedCandidates}</Td>
                            <Td className="text-xs text-admin-muted">
                              {m.alreadyMigrated ? 'Migrated' : ''}
                              {!m.activeInOrg ? (m.alreadyMigrated ? ' · seat removed' : 'No active seat') : ''}
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </DataTableEl>
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                    placeholder="Agency name (e.g. Harbor Light Recruiting)"
                    className={inputClass}
                  />
                  <label className="flex items-center gap-2 text-sm text-admin-secondary">
                    <input type="checkbox" className={checkboxClass} checked={includeOwned} onChange={(e) => setIncludeOwned(e.target.checked)} />
                    Also credit applications of candidates they own (not just ones they created)
                  </label>
                </div>
                <button onClick={runPreview} disabled={!canPreview || previewing} className={buttonClass.secondary}>
                  {previewing ? 'Previewing…' : 'Preview (no changes)'}
                </button>
                {previewError && <p className="text-sm text-admin-danger">{previewError}</p>}
              </div>
            </SectionCard>
          )}

          {/* Preview + apply */}
          {org && preview && (
            <SectionCard icon={<Eye />} title="Preview">
              <div className="space-y-4">
                <p className="text-sm text-admin-secondary">
                  {preview.agency.action === 'create' ? 'Create' : 'Reuse'} agency{' '}
                  <strong className="text-admin-ink">{preview.agency.name}</strong> and its partnership with{' '}
                  <strong className="text-admin-ink">{preview.clientOrg.name}</strong>.
                  {' '}{preview.summary.applicationsToLink} application(s) will be credited to the agency
                  {preview.summary.applicationsAlreadyLinked > 0 && `, ${preview.summary.applicationsAlreadyLinked} already are`}
                  {preview.summary.applicationsOtherAgency > 0 && `, ${preview.summary.applicationsOtherAgency} belong to another agency and are skipped`}.
                </p>
                <ul className="space-y-1 text-sm">
                  {preview.people.map((p: any) => (
                    <li key={p.userId} className={p.action === 'blocked' ? 'text-admin-danger' : 'text-admin-secondary'}>
                      {personName(p)} ({p.email}) — {p.role === 'AGENCY_ADMIN' ? 'agency admin' : 'agency recruiter'} ·{' '}
                      {PERSON_ACTION[p.action] ?? p.action}
                      {p.note ? ` — ${p.note}` : ''}
                    </li>
                  ))}
                </ul>
                {preview.applications.length > 0 && (
                  <div className="overflow-x-auto rounded-admin-sm border border-admin-border">
                    <DataTableEl>
                      <thead>
                        <tr>
                          <Th>Candidate</Th>
                          <Th>Job</Th>
                          <Th>Added by</Th>
                          <Th>Applied</Th>
                          <Th>Result</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.applications.map((a: any) => (
                          <tr key={a.applicationId}>
                            <Td className="py-2 text-admin-ink">{a.candidateName}</Td>
                            <Td className="py-2">{a.positionTitle}</Td>
                            <Td className="py-2">
                              {nameOf(a.createdByUserId)}
                              {a.via === 'owner' && <span className="text-xs text-admin-muted"> (owner)</span>}
                            </Td>
                            <Td className="py-2">{new Date(a.appliedAt).toLocaleDateString()}</Td>
                            <Td className="py-2">{APP_ACTION[a.action] ?? a.action}</Td>
                          </tr>
                        ))}
                      </tbody>
                    </DataTableEl>
                  </div>
                )}
                {preview.applicationsTruncated && (
                  <p className="text-xs text-admin-muted">Showing the first 500 applications; apply covers all of them.</p>
                )}
                <button
                  onClick={() => {
                    if (!confirm(`Apply this migration for ${preview.clientOrg.name}? Client seats are not removed yet.`)) return;
                    apply.mutate(input);
                  }}
                  disabled={!previewIsCurrent || preview.summary.peopleBlocked > 0 || apply.isLoading}
                  className={buttonClass.primary}
                >
                  {apply.isLoading ? 'Applying…' : 'Apply migration'}
                </button>
                {!previewIsCurrent && <p className="text-xs text-amber-700">You changed the selection. Preview again before applying.</p>}
              </div>
            </SectionCard>
          )}

          {applyResult && (
            <div className="flex items-start gap-2.5 rounded-admin-sm border border-admin-ok/20 bg-admin-ok-soft px-4 py-3 text-sm text-emerald-900">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-admin-ok" />
              <p>
                Done. {applyResult.peopleAdded} person(s) added to the agency team, {applyResult.submissionsCreated}{' '}
                application(s) credited ({applyResult.submissionsSkipped} skipped). They sign in at the partner portal
                with the same email.
              </p>
            </div>
          )}

          {/* 3. Remove client seats */}
          {org && (
            <SectionCard icon={<UserMinus />} title="3. Remove their client seats (after the client confirms)">
              <div className="space-y-3">
                {removable.length === 0 ? (
                  <EmptyState
                    compact
                    className="border-dashed shadow-none"
                    icon={<UserMinus />}
                    title="No migrated people still have a seat in this client."
                  />
                ) : (
                  <>
                    <ul className="space-y-1 text-sm">
                      {removable.map((m) => (
                        <li key={m.userId}>
                          <label className="flex items-center gap-2 text-admin-ink">
                            <input
                              type="checkbox"
                              className={checkboxClass}
                              checked={toRemove.includes(m.userId)}
                              onChange={() => setToRemove(toggle(toRemove, m.userId))}
                            />
                            {personName(m)} <span className="text-admin-muted">({m.email})</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                    <label className="flex items-center gap-2 text-sm text-admin-secondary">
                      <input type="checkbox" className={checkboxClass} checked={clientConfirmed} onChange={(e) => setClientConfirmed(e.target.checked)} />
                      The client confirmed these people should lose access to {org.name}.
                    </label>
                    <button
                      onClick={() => {
                        if (!confirm(`Remove ${toRemove.length} seat(s) from ${org.name}? They keep their agency access.`)) return;
                        removeSeats.mutate({ clientOrgId: org.id, userIds: toRemove, confirm: true });
                      }}
                      disabled={toRemove.length === 0 || !clientConfirmed || removeSeats.isLoading}
                      className={buttonClass.danger}
                    >
                      {removeSeats.isLoading ? 'Removing…' : 'Remove client seats'}
                    </button>
                  </>
                )}
                {removeResult && (
                  <p className="text-sm text-emerald-800">
                    Removed {removeResult.removed} seat(s){removeResult.alreadyRemoved > 0 && `, ${removeResult.alreadyRemoved} already removed`}.
                  </p>
                )}
              </div>
            </SectionCard>
          )}
        </div>
      </AdminPageChrome>
    </AuthenticatedLayout>
  );
}

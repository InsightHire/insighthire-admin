/**
 * Platform Admin → Org → Company Culture (read-only).
 *
 * Phase 7.1 — quiz pivot: with sliders the quiz no longer materializes
 * a `culture_quiz_templates` row or a per-org scenario library, so the
 * #quiz-templates and #scenarios sections are gone. The recruiter-side
 * surface is now just "what dimensions does this profile have" — same
 * data the #profile + #groups sections already render.
 *
 * Single coherent inspection page for everything related to an org's
 * Company Culture configuration:
 *   - Status pill: Enabled / Granted but not configured / Not granted /
 *     Platform-wide off.
 *   - Summary cards: platform flag, per-tenant grant, org master toggle,
 *     scoring weight, profile version, last-updated.
 *   - Stacked sections (anchored, deep-linkable from the Quick Actions
 *     panel):
 *       #profile             — Org default culture profile (dims, values,
 *                              dealbreakers).
 *       #groups              — Culture groups + their dimensions.
 *       #interview-templates — interview_templates filtered to CULTURAL_FIT.
 *       #candidate-signals   — last 50 candidate_culture_signals.
 *       #signal-access-log   — last 50 reads of culture-signal data.
 *
 * Read-only by contract. Mutations (toggle / archive / regenerate / etc.)
 * happen via the existing "Login as Admin" affordance on the parent org
 * page, which drops the platform admin into the customer app as the org
 * admin where the customer-side mutation surfaces are wired.
 *
 * The page is robust to "culture not enabled" — every section renders an
 * empty/disabled placeholder if the data simply isn't there.
 */
'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import {
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { ExternalLink, HeartHandshake } from 'lucide-react';
import { AdminPage } from '@/components/admin/page-chrome';
import { PageHeader } from '@/components/admin/page-header';
import { StatGrid, StatTile } from '@/components/admin/stat-tile';
import { buttonClass, checkboxClass } from '@/components/admin/controls';
import { openImpersonationLink } from '@/lib/impersonation-link';

type CultureStatus =
  | 'ENABLED'
  | 'GRANTED_NOT_CONFIGURED'
  | 'NOT_GRANTED'
  | 'PLATFORM_OFF';

interface DimensionRow {
  dimensionKey: string;
  value: number;
  importance: 'LOW' | 'MEDIUM' | 'HIGH';
  label: string;
  leftAnchor: string;
  rightAnchor: string;
}

function statusPill(status: CultureStatus | undefined) {
  switch (status) {
    case 'ENABLED':
      return {
        label: 'Enabled',
        className: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
        helper: 'Platform on, tenant granted, org master toggle on, profile saved.',
      };
    case 'GRANTED_NOT_CONFIGURED':
      return {
        label: 'Granted but not configured',
        className: 'bg-amber-100 text-amber-900 ring-amber-200',
        helper: 'Tenant has the grant but the org admin has not finished setup or has the master toggle off.',
      };
    case 'NOT_GRANTED':
      return {
        label: 'Not granted',
        className: 'bg-slate-200 text-admin-ink ring-slate-300',
        helper: 'Platform-wide flag is on, but this tenant has no org_feature_grants row (or granted = false).',
      };
    case 'PLATFORM_OFF':
      return {
        label: 'Platform-wide off',
        className: 'bg-red-100 text-red-900 ring-red-200',
        helper: 'platform_integration_settings.enabled is false — no org can use this feature today.',
      };
    default:
      return {
        label: '…',
        className: 'bg-slate-100 text-admin-secondary ring-slate-200',
        helper: 'Loading status…',
      };
  }
}

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

function formatPercent(weight: number | null | undefined): string {
  if (weight === null || weight === undefined) return '—';
  return `${Math.round(weight * 100)}%`;
}

function ImportancePill({ importance }: { importance: 'LOW' | 'MEDIUM' | 'HIGH' }) {
  const cls =
    importance === 'HIGH'
      ? 'bg-admin-accent-soft text-admin-accent-ink ring-admin-accent-border'
      : importance === 'MEDIUM'
        ? 'bg-admin-info-soft text-sky-800 ring-sky-200'
        : 'bg-slate-100 text-admin-secondary ring-slate-200';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${cls}`}
    >
      {importance}
    </span>
  );
}

function DimensionStaticSlider({ dim }: { dim: DimensionRow }) {
  // Map -100..+100 onto 0..100 for the visual offset.
  const pct = Math.max(0, Math.min(100, (dim.value + 100) / 2));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-admin-ink truncate" title={dim.label}>
          {dim.label}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-mono text-admin-secondary">{dim.value}</span>
          <ImportancePill importance={dim.importance} />
        </div>
      </div>
      <div className="relative h-2 w-full rounded-full bg-gradient-to-r from-sky-100 via-slate-100 to-amber-100">
        <div
          className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-admin-accent ring-2 ring-white"
          style={{ left: `calc(${pct}% - 6px)` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 h-px w-px bg-slate-400"
          style={{ left: '50%' }}
        />
      </div>
      <div className="flex justify-between text-[11px] text-admin-muted">
        <span>{dim.leftAnchor}</span>
        <span>{dim.rightAnchor}</span>
      </div>
    </div>
  );
}

function CollapsibleSection({
  id,
  title,
  count,
  defaultOpen = true,
  children,
  toolbar,
}: {
  id: string;
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
  toolbar?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section id={id} className="admin-panel scroll-mt-20 overflow-hidden">
      <header className="border-b border-admin-border px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2 text-left flex-1 min-w-0"
          >
            {open ? (
              <ChevronDownIcon className="h-4 w-4 text-admin-muted shrink-0" />
            ) : (
              <ChevronRightIcon className="h-4 w-4 text-admin-muted shrink-0" />
            )}
            <h2 className="truncate text-[15px] font-semibold text-admin-ink">{title}</h2>
            {typeof count === 'number' && (
              <span className="ml-1 text-sm text-admin-muted">({count})</span>
            )}
          </button>
          {toolbar && <div className="flex items-center gap-2 shrink-0">{toolbar}</div>}
        </div>
      </header>
      {open && <div className="p-5">{children}</div>}
    </section>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-admin-sm border border-dashed border-admin-border-strong bg-admin-bg px-4 py-6 text-sm text-admin-secondary">
      <InformationCircleIcon className="h-5 w-5 text-admin-muted shrink-0" />
      <span>{children}</span>
    </div>
  );
}

export default function OrganizationCulturePage() {
  const params = useParams();
  const { isLoading: authLoading } = useAdminAuth();
  const orgId = params.id as string;

  const [includeArchivedGroups, setIncludeArchivedGroups] = useState(false);
  const [includeArchivedInterviewTemplates, setIncludeArchivedInterviewTemplates] = useState(false);

  const [openInterviewTemplateId, setOpenInterviewTemplateId] = useState<string | null>(null);
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);

  const enabled = !authLoading && Boolean(orgId);

  // The repo-wide trpc client is typed `createTRPCReact<any>()`, which makes
  // every property access surface a confusing built-in TS collision error.
  // Aliasing through `any` keeps the call sites readable + matches how this
  // is handled elsewhere in this app.
  const trpcAny = trpc as unknown as any;

  const { data: orgData } = trpcAny.platformAdmin.getOrganization.useQuery(
    { id: orgId },
    { enabled },
  );

  const { data: summary, isLoading: loadingSummary } =
    trpcAny.platformAdmin.org.cultureSummary.useQuery({ organizationId: orgId }, { enabled });

  const { data: profile, isLoading: loadingProfile } =
    trpcAny.platformAdmin.org.cultureProfile.useQuery({ organizationId: orgId }, { enabled });

  const { data: groupsData, isLoading: loadingGroups } =
    trpcAny.platformAdmin.org.cultureGroups.useQuery(
      { organizationId: orgId, includeArchived: includeArchivedGroups },
      { enabled },
    );

  const { data: interviewTemplatesData, isLoading: loadingInterviewTemplates } =
    trpcAny.platformAdmin.org.cultureInterviewTemplates.useQuery(
      { organizationId: orgId, includeArchived: includeArchivedInterviewTemplates },
      { enabled },
    );

  const { data: signalsData, isLoading: loadingSignals } =
    trpcAny.platformAdmin.org.cultureCandidateSignals.useQuery(
      { organizationId: orgId, limit: 50 },
      { enabled },
    );

  // Part B — recent reads of culture signals (compliance audit log).
  const { data: accessLogData, isLoading: loadingAccessLog } =
    trpcAny.platformAdmin.org.cultureSignalAccessLog.useQuery(
      { organizationId: orgId, limit: 50 },
      { enabled },
    );

  const impersonateMutation = trpcAny.platformAdmin.impersonateOrganization.useMutation({
    onSuccess: (data: { loginUrl: string }) => {
      openImpersonationLink(data);
    },
  });

  if (authLoading || loadingSummary) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-admin-accent border-t-transparent" />
      </div>
    );
  }

  const status = summary?.status as CultureStatus | undefined;
  const pill = statusPill(status);

  const orgName = orgData?.organization?.name || '(Unnamed organization)';
  const profileExists = profile?.exists === true;
  const dimensions = (profile?.dimensions ?? []) as DimensionRow[];

  return (
    <AdminPage>
      <PageHeader
        eyebrow="Company Culture"
        icon={<HeartHandshake />}
        breadcrumbs={[
          { label: 'Tenants', href: '/organizations' },
          { label: orgName, href: `/organizations/${orgId}` },
          { label: 'Company culture' },
        ]}
        title={orgName}
        meta={
          <span
            title={pill.helper}
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${pill.className}`}
          >
            {pill.label}
          </span>
        }
        description={pill.helper}
        actions={
          <button
            type="button"
            onClick={() => impersonateMutation.mutate({ organizationId: orgId })}
            disabled={impersonateMutation.isPending}
            title="Open the customer app as an org admin to make changes"
            className={buttonClass.primary}
          >
            <ExternalLink className="h-4 w-4" />
            {impersonateMutation.isPending ? 'Opening…' : 'Login as Admin'}
          </button>
        }
      />

      <div className="space-y-6">
        {/* Summary cards */}
        <section aria-label="Culture status summary">
          <StatGrid cols={5}>
            <SummaryCard
              title="Platform flag"
              value={summary?.platform.enabled ? 'On' : 'Off'}
              tone={summary?.platform.enabled ? 'good' : 'bad'}
              hint={`platform_integration_settings.${summary?.platform.slug}`}
            />
            <SummaryCard
              title="Per-tenant grant"
              value={summary?.grant.granted ? 'Granted' : 'Not granted'}
              tone={summary?.grant.granted ? 'good' : 'warn'}
              hint={
                summary?.grant.grantedAt
                  ? `Granted ${formatDate(summary.grant.grantedAt)}`
                  : 'No org_feature_grants row'
              }
            />
            <SummaryCard
              title="Org master toggle"
              value={summary?.profile.exists ? (summary.profile.enabled ? 'On' : 'Off') : '—'}
              tone={
                summary?.profile.exists
                  ? summary.profile.enabled
                    ? 'good'
                    : 'warn'
                  : 'neutral'
              }
              hint="org_culture_profiles.enabled"
            />
            <SummaryCard
              title="Scoring weight"
              value={summary?.profile.exists ? formatPercent(summary.profile.scoringWeight) : '—'}
              tone="neutral"
              hint="How much culture sways ranking"
            />
            <SummaryCard
              title="Profile version"
              value={summary?.profile.exists ? `v${summary.profile.profileVersion}` : '—'}
              tone="neutral"
              hint={
                summary?.profile.updatedAt
                  ? `Updated ${formatDate(summary.profile.updatedAt)}`
                  : 'No profile saved yet'
              }
            />
          </StatGrid>
        </section>

        {/* Sections */}
        <CollapsibleSection
          id="profile"
          title="Org default profile"
          defaultOpen
        >
          {loadingProfile ? (
            <SectionLoading />
          ) : !profileExists ? (
            <EmptyHint>
              No <code>org_culture_profiles</code> row exists for this organization. The org admin
              hasn't completed Settings → Culture yet. Use Login-as-Admin to set it up, or have the
              customer do it themselves.
            </EmptyHint>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {dimensions.map((d) => (
                  <DimensionStaticSlider key={d.dimensionKey} dim={d} />
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-admin-sm border border-admin-border bg-admin-bg/50 p-4">
                  <h3 className="text-sm font-semibold text-admin-ink mb-2">Values</h3>
                  {profile?.values && profile.values.length > 0 ? (
                    <ul className="flex flex-wrap gap-2">
                      {profile.values.map((v: string) => (
                        <li
                          key={v}
                          className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-medium text-admin-ink ring-1 ring-slate-200"
                        >
                          {v}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-admin-muted">No values set.</p>
                  )}
                </div>

                <div className="rounded-admin-sm border border-admin-danger/20 bg-admin-danger-soft/60 p-4">
                  <h3 className="text-sm font-semibold text-red-900 mb-2 flex items-center gap-1">
                    <ExclamationTriangleIcon className="h-4 w-4" />
                    Dealbreakers
                  </h3>
                  {profile?.dealbreakers && profile.dealbreakers.length > 0 ? (
                    <ul className="space-y-1">
                      {profile.dealbreakers.map((d: string) => (
                        <li key={d} className="text-sm text-red-900">• {d}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-red-900/70">No dealbreakers set.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </CollapsibleSection>

        <CollapsibleSection
          id="groups"
          title="Culture groups"
          count={groupsData?.groups.length}
          toolbar={
            <ArchiveToggle
              checked={includeArchivedGroups}
              onChange={setIncludeArchivedGroups}
            />
          }
        >
          {loadingGroups ? (
            <SectionLoading />
          ) : !groupsData || groupsData.groups.length === 0 ? (
            <EmptyHint>No culture groups for this organization.</EmptyHint>
          ) : (
            <div className="overflow-x-auto rounded-admin-sm border border-admin-border">
              <table className="min-w-full divide-y divide-admin-border text-sm">
                <thead>
                  <tr>
                    <th className="whitespace-nowrap bg-admin-bg/70 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-admin-muted">Name</th>
                    <th className="whitespace-nowrap bg-admin-bg/70 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-admin-muted">Description</th>
                    <th className="whitespace-nowrap bg-admin-bg/70 px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-admin-muted">Scoring weight</th>
                    <th className="whitespace-nowrap bg-admin-bg/70 px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-admin-muted">Positions</th>
                    <th className="whitespace-nowrap bg-admin-bg/70 px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-admin-muted">Version</th>
                    <th className="whitespace-nowrap bg-admin-bg/70 px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-admin-muted">Last updated</th>
                    <th className="whitespace-nowrap bg-admin-bg/70 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-admin-muted">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-admin-border">
                  {groupsData.groups.map((g: any) => {
                    const isOpen = openGroupId === g.id;
                    return (
                      <>
                        <tr
                          key={g.id}
                          className="hover:bg-admin-bg/70 cursor-pointer"
                          onClick={() => setOpenGroupId(isOpen ? null : g.id)}
                        >
                          <td className="px-4 py-2 font-medium text-admin-ink">
                            <div className="flex items-center gap-2">
                              {isOpen ? (
                                <ChevronDownIcon className="h-4 w-4 text-admin-muted" />
                              ) : (
                                <ChevronRightIcon className="h-4 w-4 text-admin-muted" />
                              )}
                              {g.name}
                            </div>
                          </td>
                          <td className="px-4 py-2 text-admin-secondary truncate max-w-xs">
                            {g.description || '—'}
                          </td>
                          <td className="px-4 py-2 text-right text-admin-secondary">
                            {g.scoringWeight === null ? (
                              <span className="text-admin-muted" title="Inherits org default">
                                inherit
                              </span>
                            ) : (
                              formatPercent(g.scoringWeight)
                            )}
                          </td>
                          <td className="px-4 py-2 text-right text-admin-secondary">{g.positionCount}</td>
                          <td className="px-4 py-2 text-right text-admin-secondary">v{g.groupVersion}</td>
                          <td className="px-4 py-2 text-right text-admin-muted">
                            {formatDate(g.updatedAt)}
                          </td>
                          <td className="px-4 py-2">
                            {g.isArchived ? (
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs text-admin-secondary">
                                Archived
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
                                Active
                              </span>
                            )}
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="bg-admin-accent-soft/40">
                            <td colSpan={7} className="px-4 py-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
                                {g.dimensions.map((d: DimensionRow) => (
                                  <DimensionStaticSlider
                                    key={d.dimensionKey}
                                    dim={d}
                                  />
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CollapsibleSection>

        <CollapsibleSection
          id="interview-templates"
          title="Interview templates"
          count={interviewTemplatesData?.templates.length}
          toolbar={
            <ArchiveToggle
              checked={includeArchivedInterviewTemplates}
              onChange={setIncludeArchivedInterviewTemplates}
            />
          }
        >
          {loadingInterviewTemplates ? (
            <SectionLoading />
          ) : !interviewTemplatesData || interviewTemplatesData.templates.length === 0 ? (
            <EmptyHint>
              No <code>CULTURAL_FIT</code> interview templates for this org. Generate from
              Settings → Culture in the customer app.
            </EmptyHint>
          ) : (
            <div className="overflow-x-auto rounded-admin-sm border border-admin-border">
              <table className="min-w-full divide-y divide-admin-border text-sm">
                <thead>
                  <tr>
                    <th className="whitespace-nowrap bg-admin-bg/70 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-admin-muted">Title</th>
                    <th className="whitespace-nowrap bg-admin-bg/70 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-admin-muted">Profile source</th>
                    <th className="whitespace-nowrap bg-admin-bg/70 px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-admin-muted">Questions</th>
                    <th className="whitespace-nowrap bg-admin-bg/70 px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-admin-muted">Usage</th>
                    <th className="whitespace-nowrap bg-admin-bg/70 px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-admin-muted">Updated</th>
                    <th className="whitespace-nowrap bg-admin-bg/70 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-admin-muted">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-admin-border">
                  {interviewTemplatesData.templates.map((t: any) => {
                    const isOpen = openInterviewTemplateId === t.id;
                    return (
                      <>
                        <tr
                          key={t.id}
                          className="hover:bg-admin-bg/70 cursor-pointer"
                          onClick={() => setOpenInterviewTemplateId(isOpen ? null : t.id)}
                        >
                          <td className="px-4 py-2 font-medium text-admin-ink">
                            <div className="flex items-center gap-2">
                              {isOpen ? (
                                <ChevronDownIcon className="h-4 w-4 text-admin-muted" />
                              ) : (
                                <ChevronRightIcon className="h-4 w-4 text-admin-muted" />
                              )}
                              <span>{t.title}</span>
                            </div>
                            {t.description && (
                              <p className="text-xs text-admin-muted ml-6 truncate max-w-md">
                                {t.description}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-2 text-admin-secondary">{t.cultureProfileSourceLabel}</td>
                          <td className="px-4 py-2 text-right text-admin-secondary">{t.questionCount}</td>
                          <td className="px-4 py-2 text-right text-admin-secondary">{t.usageCount}</td>
                          <td className="px-4 py-2 text-right text-admin-muted">
                            {formatDate(t.updatedAt)}
                          </td>
                          <td className="px-4 py-2">
                            {t.isActive ? (
                              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs text-admin-secondary">
                                Archived
                              </span>
                            )}
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="bg-admin-accent-soft/40">
                            <td colSpan={6} className="px-4 py-4">
                              <InterviewTemplateQuestions questions={t.questions} />
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CollapsibleSection>

        <CollapsibleSection
          id="candidate-signals"
          title="Recent culture signals"
          count={signalsData?.signals.length}
        >
          {loadingSignals ? (
            <SectionLoading />
          ) : !signalsData || signalsData.signals.length === 0 ? (
            <EmptyHint>
              No <code>candidate_culture_signals</code> rows yet. The Phase 4 scorer hasn't fired
              for any candidates in this org — usually because the org master toggle is off, no
              positions are configured, or no candidates have completed scoreable signals yet.
            </EmptyHint>
          ) : (
            <div className="overflow-x-auto rounded-admin-sm border border-admin-border">
              <table className="min-w-full divide-y divide-admin-border text-sm">
                <thead>
                  <tr>
                    <th className="whitespace-nowrap bg-admin-bg/70 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-admin-muted">Candidate</th>
                    <th className="whitespace-nowrap bg-admin-bg/70 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-admin-muted">Position</th>
                    <th className="whitespace-nowrap bg-admin-bg/70 px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-admin-muted">Score</th>
                    <th className="whitespace-nowrap bg-admin-bg/70 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-admin-muted">Source layers</th>
                    <th className="whitespace-nowrap bg-admin-bg/70 px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-admin-muted">Computed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-admin-border">
                  {signalsData.signals.map((s: any) => (
                    <tr key={s.id} className="hover:bg-admin-bg/70">
                      <td className="px-4 py-2">
                        <Link
                          href={`/candidate/${s.candidateId}`}
                          className="text-admin-accent-ink hover:underline font-medium"
                        >
                          {s.candidateName || s.candidateEmail || s.candidateId}
                        </Link>
                        {s.candidateEmail && (
                          <p className="text-xs text-admin-muted truncate max-w-xs">
                            {s.candidateEmail}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <span className="text-admin-ink">{s.positionTitle}</span>
                        <p className="text-xs text-admin-muted">{s.positionStatus}</p>
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-admin-ink">
                        {Math.round(Number(s.overallScore))}
                      </td>
                      <td className="px-4 py-2 text-xs text-admin-secondary">
                        <SignalSourceLayers signal={s} />
                      </td>
                      <td className="px-4 py-2 text-right text-admin-muted">
                        {formatDate(s.computedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {signalsData.nextCursor && (
                <p className="border-t border-admin-border px-4 py-3 text-xs text-admin-muted">
                  Showing the most recent 50 signals. Older signals are still in
                  the database — use a direct DB query for deeper investigations.
                </p>
              )}
            </div>
          )}
        </CollapsibleSection>

        {/*
          Part B — SOC2 / GDPR compliance trail of every read of a
          candidate_culture_signals row. Sits below the signals table
          so platform support can pivot from "what scores exist for
          this org" to "who has been looking at them" without leaving
          the page. Access is platform-admin only by virtue of the
          parent route guard. Logging is fire-and-forget and dedupes
          repeat reads from the position pipeline within 5 minutes.
        */}
        <CollapsibleSection
          id="signal-access-log"
          title="Recent reads of culture signals"
          count={accessLogData?.accesses?.length}
        >
          {loadingAccessLog ? (
            <SectionLoading />
          ) : !accessLogData ||
            !accessLogData.accesses ||
            accessLogData.accesses.length === 0 ? (
            <EmptyHint>
              No <code>candidate_culture_signal_access_log</code> rows yet.
              Either no recruiter has opened a Culture Fit card / pipeline
              column for this org, or culture-fit scoring isn&apos;t in use
              here. Logging is fire-and-forget and never blocks reads.
            </EmptyHint>
          ) : (
            <div className="overflow-x-auto rounded-admin-sm border border-admin-border">
              <table className="min-w-full divide-y divide-admin-border text-sm">
                <thead>
                  <tr>
                    <th className="whitespace-nowrap bg-admin-bg/70 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-admin-muted">When</th>
                    <th className="whitespace-nowrap bg-admin-bg/70 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-admin-muted">Reader</th>
                    <th className="whitespace-nowrap bg-admin-bg/70 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-admin-muted">Candidate</th>
                    <th className="whitespace-nowrap bg-admin-bg/70 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-admin-muted">Position</th>
                    <th className="whitespace-nowrap bg-admin-bg/70 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-admin-muted">Surface</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-admin-border">
                  {accessLogData.accesses.map((a: any) => (
                    <tr key={a.id} className="hover:bg-admin-bg/70">
                      <td className="px-4 py-2 text-admin-secondary whitespace-nowrap">
                        {formatDate(a.readAt)}
                      </td>
                      <td className="px-4 py-2">
                        <span className="text-admin-ink font-medium">
                          {a.readByName}
                        </span>
                        {a.readByEmail && (
                          <p className="text-xs text-admin-muted truncate max-w-xs">
                            {a.readByEmail}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <span className="text-admin-ink">{a.candidateName}</span>
                        {a.candidateEmail && (
                          <p className="text-xs text-admin-muted truncate max-w-xs">
                            {a.candidateEmail}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-2 text-admin-secondary">{a.positionTitle}</td>
                      <td className="px-4 py-2">
                        <SourcePill source={a.source} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {accessLogData.nextCursor && (
                <p className="border-t border-admin-border px-4 py-3 text-xs text-admin-muted">
                  Showing the most recent 50 reads. Older entries remain in
                  the audit log and can be queried directly for deeper
                  forensic investigations.
                </p>
              )}
            </div>
          )}
        </CollapsibleSection>
      </div>
    </AdminPage>
  );
}

function SourcePill({ source }: { source: string }) {
  const map: Record<string, { label: string; cls: string; help: string }> = {
    candidate_detail: {
      label: 'Candidate Fit card',
      cls: 'bg-admin-accent-soft text-admin-accent-ink ring-admin-accent-border',
      help: 'Recruiter opened the Culture Fit card on the candidate detail page.',
    },
    position_list_column: {
      label: 'Position pipeline',
      cls: 'bg-admin-info-soft text-sky-800 ring-sky-200',
      help: 'Culture column on the position pipeline list (deduped per recruiter+position per 5 min).',
    },
    platform_admin: {
      label: 'Platform admin',
      cls: 'bg-purple-100 text-purple-800 ring-purple-200',
      help: 'Platform admin opened the org culture page (this page).',
    },
    export: {
      label: 'Export',
      cls: 'bg-amber-100 text-amber-900 ring-amber-200',
      help: 'Bulk export job touched the signal row.',
    },
  };
  const meta = map[source] ?? {
    label: source,
    cls: 'bg-slate-100 text-admin-secondary ring-slate-200',
    help: source,
  };
  return (
    <span
      title={meta.help}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ${meta.cls}`}
    >
      {meta.label}
    </span>
  );
}

function ArchiveToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label
      className="inline-flex items-center gap-2 text-xs text-admin-secondary cursor-pointer"
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={checkboxClass}
      />
      Include archived
    </label>
  );
}

function SummaryCard({
  title,
  value,
  tone,
  hint,
}: {
  title: string;
  value: string;
  tone: 'good' | 'warn' | 'bad' | 'neutral';
  hint: string;
}) {
  const statTone = tone === 'good' ? 'ok' : tone === 'warn' ? 'warn' : tone === 'bad' ? 'critical' : 'muted';
  return <StatTile label={title} value={value} hint={<span title={hint}>{hint}</span>} tone={statTone} />;
}

function SectionLoading() {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-admin-accent border-t-transparent" />
    </div>
  );
}

function InterviewTemplateQuestions({
  questions,
}: {
  questions: Array<{
    id: string;
    order: number;
    weight: number;
    isRequired: boolean;
    customTimeLimit: number | null;
    customInstructions: string | null;
    text: string | null;
    description: string | null;
    category: string | null;
    type: string | null;
    skills: string[];
  }>;
}) {
  if (!questions.length) {
    return <p className="text-sm text-admin-muted">No questions on this template.</p>;
  }
  return (
    <ol className="space-y-2">
      {questions.map((q) => (
        <li key={q.id} className="rounded-admin-sm border border-admin-border bg-white p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-admin-muted">
              #{q.order} · {q.category ?? '—'} · {q.type ?? '—'}
              {!q.isRequired && (
                <span className="ml-2 inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-medium text-admin-secondary">
                  optional
                </span>
              )}
            </p>
            <span className="text-xs text-admin-muted font-mono">weight {q.weight}</span>
          </div>
          <p className="text-sm text-admin-ink mt-1">{q.text || '(no text)'}</p>
          {q.description && (
            <p className="text-xs text-admin-secondary mt-1">{q.description}</p>
          )}
          {q.skills.length > 0 && (
            <p className="text-xs text-admin-muted mt-1">
              Skills: {q.skills.join(', ')}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}

function SignalSourceLayers({
  signal,
}: {
  signal: {
    cultureGroupId: string | null;
    cultureGroupName: string | null;
    cultureGroupArchived: boolean | null;
    groupVersion: number | null;
    profileVersion: number;
    positionOverrideHash: string | null;
    dimensionScores: unknown;
  };
}) {
  const layers: Array<{ label: string; tone: 'good' | 'neutral' | 'warn' }> = [];
  layers.push({ label: `org v${signal.profileVersion}`, tone: 'good' });
  if (signal.cultureGroupId) {
    layers.push({
      label: `group "${signal.cultureGroupName ?? signal.cultureGroupId}"${signal.cultureGroupArchived ? ' (archived)' : ''} v${signal.groupVersion ?? '?'}`,
      tone: signal.cultureGroupArchived ? 'warn' : 'good',
    });
  }
  if (signal.positionOverrideHash) {
    layers.push({ label: `override`, tone: 'good' });
  }

  // Inspect dimensionScores JSON for source breakdown if present.
  const ds = signal.dimensionScores as unknown;
  let usedQuiz = false;
  let usedInterview = false;
  if (ds && typeof ds === 'object') {
    const meta = (ds as Record<string, unknown>).sources;
    if (Array.isArray(meta)) {
      usedQuiz = meta.includes('quiz');
      usedInterview = meta.includes('interview');
    }
  }
  if (usedQuiz) layers.push({ label: 'quiz', tone: 'neutral' });
  if (usedInterview) layers.push({ label: 'interview', tone: 'neutral' });

  return (
    <div className="flex flex-wrap items-center gap-1">
      {layers.map((l, idx) => {
        const cls =
          l.tone === 'good'
            ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
            : l.tone === 'warn'
              ? 'bg-amber-50 text-amber-900 ring-amber-200'
              : 'bg-slate-100 text-admin-secondary ring-slate-200';
        return (
          <span
            key={idx}
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] ring-1 ${cls}`}
          >
            {l.label}
          </span>
        );
      })}
    </div>
  );
}

// Suppress unused-warning for icons we want available but only conditionally render.
// (CheckCircleIcon / XCircleIcon are referenced in the future-proof pill helpers above.)
void CheckCircleIcon;
void XCircleIcon;

/**
 * Platform Admin → Org → Company Culture (read-only).
 *
 * Single coherent inspection page for everything related to an org's
 * Company Culture configuration:
 *   - Status pill: Enabled / Granted but not configured / Not granted /
 *     Platform-wide off.
 *   - Summary cards: platform flag, per-tenant grant, org master toggle,
 *     scoring weight, profile version, last-updated.
 *   - Stacked sections (anchored, deep-linkable from the Quick Actions
 *     panel):
 *       #profile           — Org default culture profile (8 dims, values,
 *                            dealbreakers).
 *       #groups            — Culture groups + their dimensions.
 *       #quiz-templates    — culture_quiz_templates with snapshot items.
 *       #interview-templates — interview_templates filtered to CULTURAL_FIT.
 *       #scenarios         — org_culture_quiz_scenarios grouped by dimension.
 *       #candidate-signals — last 50 candidate_culture_signals.
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
  ArrowLeftIcon,
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XCircleIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

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

interface QuizOption {
  id?: unknown;
  label?: unknown;
  dimensionValue?: unknown;
  weight?: unknown;
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
        className: 'bg-gray-200 text-gray-800 ring-gray-300',
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
        className: 'bg-gray-100 text-gray-700 ring-gray-200',
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
      ? 'bg-indigo-100 text-indigo-800 ring-indigo-200'
      : importance === 'MEDIUM'
        ? 'bg-blue-50 text-blue-800 ring-blue-200'
        : 'bg-gray-100 text-gray-700 ring-gray-200';
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
        <span className="text-sm font-medium text-gray-900 truncate" title={dim.label}>
          {dim.label}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-mono text-gray-600">{dim.value}</span>
          <ImportancePill importance={dim.importance} />
        </div>
      </div>
      <div className="relative h-2 w-full rounded-full bg-gradient-to-r from-blue-100 via-gray-100 to-amber-100">
        <div
          className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-indigo-600 ring-2 ring-white"
          style={{ left: `calc(${pct}% - 6px)` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 h-px w-px bg-gray-400"
          style={{ left: '50%' }}
        />
      </div>
      <div className="flex justify-between text-[11px] text-gray-500">
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
    <section id={id} className="bg-white rounded-xl shadow-sm border border-gray-200/60 overflow-hidden scroll-mt-20">
      <header className="px-6 py-4 bg-gradient-to-r from-slate-50 to-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2 text-left flex-1 min-w-0"
          >
            {open ? (
              <ChevronDownIcon className="h-5 w-5 text-gray-500 shrink-0" />
            ) : (
              <ChevronRightIcon className="h-5 w-5 text-gray-500 shrink-0" />
            )}
            <h2 className="text-lg font-semibold text-gray-900 truncate">{title}</h2>
            {typeof count === 'number' && (
              <span className="ml-1 text-sm text-gray-500">({count})</span>
            )}
          </button>
          {toolbar && <div className="flex items-center gap-2 shrink-0">{toolbar}</div>}
        </div>
      </header>
      {open && <div className="p-6">{children}</div>}
    </section>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-600">
      <InformationCircleIcon className="h-5 w-5 text-gray-400 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

export default function OrganizationCulturePage() {
  const params = useParams();
  const { isLoading: authLoading } = useAdminAuth();
  const orgId = params.id as string;

  const [includeArchivedGroups, setIncludeArchivedGroups] = useState(false);
  const [includeArchivedQuizTemplates, setIncludeArchivedQuizTemplates] = useState(false);
  const [includeArchivedInterviewTemplates, setIncludeArchivedInterviewTemplates] = useState(false);
  const [includeArchivedScenarios, setIncludeArchivedScenarios] = useState(false);

  const [openTemplateId, setOpenTemplateId] = useState<string | null>(null);
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

  const { data: quizTemplatesData, isLoading: loadingQuizTemplates } =
    trpcAny.platformAdmin.org.cultureQuizTemplates.useQuery(
      { organizationId: orgId, includeArchived: includeArchivedQuizTemplates },
      { enabled },
    );

  const { data: interviewTemplatesData, isLoading: loadingInterviewTemplates } =
    trpcAny.platformAdmin.org.cultureInterviewTemplates.useQuery(
      { organizationId: orgId, includeArchived: includeArchivedInterviewTemplates },
      { enabled },
    );

  const { data: scenariosData, isLoading: loadingScenarios } =
    trpcAny.platformAdmin.org.cultureScenarios.useQuery(
      { organizationId: orgId, includeArchived: includeArchivedScenarios },
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
      window.open(data.loginUrl, '_blank');
    },
  });

  if (authLoading || loadingSummary) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  const status = summary?.status as CultureStatus | undefined;
  const pill = statusPill(status);

  const orgName = orgData?.organization?.name || '(Unnamed organization)';
  const profileExists = profile?.exists === true;
  const dimensions = (profile?.dimensions ?? []) as DimensionRow[];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <Link
                href={`/organizations/${orgId}`}
                className="p-2 hover:bg-gray-100 rounded-lg shrink-0"
                aria-label="Back to organization"
              >
                <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
              </Link>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide text-gray-500">Company Culture</p>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold text-gray-900 truncate">{orgName}</h1>
                  <span
                    title={pill.helper}
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${pill.className}`}
                  >
                    {pill.label}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">{pill.helper}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => impersonateMutation.mutate({ organizationId: orgId })}
                disabled={impersonateMutation.isPending}
                title="Open the customer app as an org admin to make changes"
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                {impersonateMutation.isPending ? 'Opening…' : 'Login as Admin'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Summary cards */}
        <section aria-label="Culture status summary">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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
          </div>
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
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Values</h3>
                  {profile?.values && profile.values.length > 0 ? (
                    <ul className="flex flex-wrap gap-2">
                      {profile.values.map((v: string) => (
                        <li
                          key={v}
                          className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-800 ring-1 ring-gray-200"
                        >
                          {v}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500">No values set.</p>
                  )}
                </div>

                <div className="rounded-lg border border-red-200 bg-red-50/40 p-4">
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
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">Name</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">Description</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-600">Scoring weight</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-600">Positions</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-600">Version</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-600">Last updated</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {groupsData.groups.map((g: any) => {
                    const isOpen = openGroupId === g.id;
                    return (
                      <>
                        <tr
                          key={g.id}
                          className="hover:bg-blue-50/50 cursor-pointer"
                          onClick={() => setOpenGroupId(isOpen ? null : g.id)}
                        >
                          <td className="px-4 py-2 font-medium text-gray-900">
                            <div className="flex items-center gap-2">
                              {isOpen ? (
                                <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                              ) : (
                                <ChevronRightIcon className="h-4 w-4 text-gray-500" />
                              )}
                              {g.name}
                            </div>
                          </td>
                          <td className="px-4 py-2 text-gray-600 truncate max-w-xs">
                            {g.description || '—'}
                          </td>
                          <td className="px-4 py-2 text-right text-gray-700">
                            {g.scoringWeight === null ? (
                              <span className="text-gray-500" title="Inherits org default">
                                inherit
                              </span>
                            ) : (
                              formatPercent(g.scoringWeight)
                            )}
                          </td>
                          <td className="px-4 py-2 text-right text-gray-700">{g.positionCount}</td>
                          <td className="px-4 py-2 text-right text-gray-700">v{g.groupVersion}</td>
                          <td className="px-4 py-2 text-right text-gray-500">
                            {formatDate(g.updatedAt)}
                          </td>
                          <td className="px-4 py-2">
                            {g.isArchived ? (
                              <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
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
                          <tr className="bg-blue-50/30">
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
          id="quiz-templates"
          title="Quiz templates"
          count={quizTemplatesData?.templates.length}
          toolbar={
            <ArchiveToggle
              checked={includeArchivedQuizTemplates}
              onChange={setIncludeArchivedQuizTemplates}
            />
          }
        >
          {loadingQuizTemplates ? (
            <SectionLoading />
          ) : !quizTemplatesData || quizTemplatesData.templates.length === 0 ? (
            <EmptyHint>No culture quiz templates have been generated for this org.</EmptyHint>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">Title</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">Profile source</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-600">Items</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-600">Generated</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-600">Updated</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {quizTemplatesData.templates.map((t: any) => {
                    const isOpen = openTemplateId === t.id;
                    return (
                      <>
                        <tr
                          key={t.id}
                          className="hover:bg-blue-50/50 cursor-pointer"
                          onClick={() => setOpenTemplateId(isOpen ? null : t.id)}
                        >
                          <td className="px-4 py-2 font-medium text-gray-900">
                            <div className="flex items-center gap-2">
                              {isOpen ? (
                                <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                              ) : (
                                <ChevronRightIcon className="h-4 w-4 text-gray-500" />
                              )}
                              <span>{t.title}</span>
                            </div>
                            {t.description && (
                              <p className="text-xs text-gray-500 ml-6 truncate max-w-md">
                                {t.description}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-2 text-gray-700">{t.cultureProfileSourceLabel}</td>
                          <td className="px-4 py-2 text-right text-gray-700">{t.itemCount}</td>
                          <td className="px-4 py-2 text-right text-gray-500">
                            {formatDate(t.generatedAt)} (v{t.profileVersionAtGen})
                          </td>
                          <td className="px-4 py-2 text-right text-gray-500">
                            {formatDate(t.updatedAt)}
                          </td>
                          <td className="px-4 py-2">
                            {t.isActive ? (
                              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                                Archived
                              </span>
                            )}
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="bg-blue-50/30">
                            <td colSpan={6} className="px-4 py-4">
                              <QuizTemplateItems items={t.items} />
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
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">Title</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">Profile source</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-600">Questions</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-600">Usage</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-600">Updated</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {interviewTemplatesData.templates.map((t: any) => {
                    const isOpen = openInterviewTemplateId === t.id;
                    return (
                      <>
                        <tr
                          key={t.id}
                          className="hover:bg-blue-50/50 cursor-pointer"
                          onClick={() => setOpenInterviewTemplateId(isOpen ? null : t.id)}
                        >
                          <td className="px-4 py-2 font-medium text-gray-900">
                            <div className="flex items-center gap-2">
                              {isOpen ? (
                                <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                              ) : (
                                <ChevronRightIcon className="h-4 w-4 text-gray-500" />
                              )}
                              <span>{t.title}</span>
                            </div>
                            {t.description && (
                              <p className="text-xs text-gray-500 ml-6 truncate max-w-md">
                                {t.description}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-2 text-gray-700">{t.cultureProfileSourceLabel}</td>
                          <td className="px-4 py-2 text-right text-gray-700">{t.questionCount}</td>
                          <td className="px-4 py-2 text-right text-gray-700">{t.usageCount}</td>
                          <td className="px-4 py-2 text-right text-gray-500">
                            {formatDate(t.updatedAt)}
                          </td>
                          <td className="px-4 py-2">
                            {t.isActive ? (
                              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                                Archived
                              </span>
                            )}
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="bg-blue-50/30">
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
          id="scenarios"
          title="Scenarios"
          count={scenariosData?.scenarios.length}
          toolbar={
            <ArchiveToggle
              checked={includeArchivedScenarios}
              onChange={setIncludeArchivedScenarios}
            />
          }
        >
          {loadingScenarios ? (
            <SectionLoading />
          ) : !scenariosData || scenariosData.scenarios.length === 0 ? (
            <EmptyHint>
              No <code>org_culture_quiz_scenarios</code> rows. They get seeded on first quiz
              generation; if this org has never generated a culture quiz, this will be empty.
            </EmptyHint>
          ) : (
            <div className="space-y-6">
              {scenariosData.byDimension.map((dim: any) => (
                <div key={dim.dimensionKey} className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <SparklesIcon className="h-4 w-4 text-amber-500" />
                    {dim.label}
                    <span className="text-xs text-gray-500 font-normal">
                      {dim.leftAnchor} ↔ {dim.rightAnchor}
                    </span>
                    <span className="text-xs text-gray-400 font-normal">
                      ({dim.scenarios.length})
                    </span>
                  </h3>
                  {dim.scenarios.length === 0 ? (
                    <p className="text-xs text-gray-500 ml-6">No scenarios for this dimension.</p>
                  ) : (
                    <div className="space-y-2 ml-6">
                      {dim.scenarios.map((s: any) => (
                        <ScenarioCard key={s.id} scenario={s} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
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
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">Candidate</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">Position</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-600">Score</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">Source layers</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-600">Computed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {signalsData.signals.map((s: any) => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2">
                        <Link
                          href={`/candidate/${s.candidateId}`}
                          className="text-indigo-600 hover:underline font-medium"
                        >
                          {s.candidateName || s.candidateEmail || s.candidateId}
                        </Link>
                        {s.candidateEmail && (
                          <p className="text-xs text-gray-500 truncate max-w-xs">
                            {s.candidateEmail}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <span className="text-gray-800">{s.positionTitle}</span>
                        <p className="text-xs text-gray-500">{s.positionStatus}</p>
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-gray-800">
                        {Math.round(Number(s.overallScore))}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-600">
                        <SignalSourceLayers signal={s} />
                      </td>
                      <td className="px-4 py-2 text-right text-gray-500">
                        {formatDate(s.computedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {signalsData.nextCursor && (
                <p className="mt-4 text-xs text-gray-500">
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
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">When</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">Reader</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">Candidate</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">Position</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">Surface</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {accessLogData.accesses.map((a: any) => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-600 whitespace-nowrap">
                        {formatDate(a.readAt)}
                      </td>
                      <td className="px-4 py-2">
                        <span className="text-gray-900 font-medium">
                          {a.readByName}
                        </span>
                        {a.readByEmail && (
                          <p className="text-xs text-gray-500 truncate max-w-xs">
                            {a.readByEmail}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <span className="text-gray-800">{a.candidateName}</span>
                        {a.candidateEmail && (
                          <p className="text-xs text-gray-500 truncate max-w-xs">
                            {a.candidateEmail}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-2 text-gray-700">{a.positionTitle}</td>
                      <td className="px-4 py-2">
                        <SourcePill source={a.source} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {accessLogData.nextCursor && (
                <p className="mt-4 text-xs text-gray-500">
                  Showing the most recent 50 reads. Older entries remain in
                  the audit log and can be queried directly for deeper
                  forensic investigations.
                </p>
              )}
            </div>
          )}
        </CollapsibleSection>
      </div>
    </div>
  );
}

function SourcePill({ source }: { source: string }) {
  const map: Record<string, { label: string; cls: string; help: string }> = {
    candidate_detail: {
      label: 'Candidate Fit card',
      cls: 'bg-indigo-100 text-indigo-800 ring-indigo-200',
      help: 'Recruiter opened the Culture Fit card on the candidate detail page.',
    },
    position_list_column: {
      label: 'Position pipeline',
      cls: 'bg-blue-100 text-blue-800 ring-blue-200',
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
    cls: 'bg-gray-100 text-gray-700 ring-gray-200',
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
      className="inline-flex items-center gap-2 text-xs text-gray-600 cursor-pointer"
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600"
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
  const toneClass =
    tone === 'good'
      ? 'border-emerald-200 bg-emerald-50/40'
      : tone === 'warn'
        ? 'border-amber-200 bg-amber-50/40'
        : tone === 'bad'
          ? 'border-red-200 bg-red-50/40'
          : 'border-gray-200 bg-white';
  const valueClass =
    tone === 'good'
      ? 'text-emerald-800'
      : tone === 'warn'
        ? 'text-amber-900'
        : tone === 'bad'
          ? 'text-red-900'
          : 'text-gray-900';
  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{title}</p>
      <p className={`mt-1 text-xl font-bold ${valueClass}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1 truncate" title={hint}>
        {hint}
      </p>
    </div>
  );
}

function SectionLoading() {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent" />
    </div>
  );
}

function QuizTemplateItems({
  items,
}: {
  items: Array<{
    id: string;
    order: number;
    scenario: string;
    options: unknown;
    dimensionKey: string;
    estimatedSeconds: number;
    sourceScenario: { isCustom: boolean; isActive: boolean; seedScenarioId: string | null } | null;
  }>;
}) {
  if (!items.length) {
    return <p className="text-sm text-gray-500">No items pinned to this template.</p>;
  }
  return (
    <ol className="space-y-3">
      {items.map((it) => {
        const opts = (Array.isArray(it.options) ? it.options : []) as QuizOption[];
        return (
          <li key={it.id} className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-gray-500">
                  #{it.order} · {it.dimensionKey} · ~{it.estimatedSeconds}s
                  {it.sourceScenario?.isCustom && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-800">
                      custom
                    </span>
                  )}
                  {it.sourceScenario && !it.sourceScenario.isActive && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-700">
                      source archived
                    </span>
                  )}
                </p>
                <p className="text-sm text-gray-900 mt-1">{it.scenario}</p>
              </div>
            </div>
            <ul className="mt-3 space-y-1">
              {opts.map((o, idx) => {
                const id = typeof o.id === 'string' ? o.id : `opt-${idx}`;
                const label = typeof o.label === 'string' ? o.label : '(missing label)';
                const dv = typeof o.dimensionValue === 'number' ? o.dimensionValue : null;
                const w = typeof o.weight === 'number' ? o.weight : null;
                return (
                  <li
                    key={id}
                    className="flex items-center justify-between gap-3 rounded-md bg-gray-50 px-3 py-1.5 text-xs"
                  >
                    <span className="text-gray-800">{label}</span>
                    <span className="font-mono text-gray-600 shrink-0">
                      dimVal {dv === null ? '—' : dv} · weight {w === null ? '—' : w}
                    </span>
                  </li>
                );
              })}
            </ul>
          </li>
        );
      })}
    </ol>
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
    return <p className="text-sm text-gray-500">No questions on this template.</p>;
  }
  return (
    <ol className="space-y-2">
      {questions.map((q) => (
        <li key={q.id} className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500">
              #{q.order} · {q.category ?? '—'} · {q.type ?? '—'}
              {!q.isRequired && (
                <span className="ml-2 inline-flex items-center rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-700">
                  optional
                </span>
              )}
            </p>
            <span className="text-xs text-gray-500 font-mono">weight {q.weight}</span>
          </div>
          <p className="text-sm text-gray-900 mt-1">{q.text || '(no text)'}</p>
          {q.description && (
            <p className="text-xs text-gray-600 mt-1">{q.description}</p>
          )}
          {q.skills.length > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              Skills: {q.skills.join(', ')}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}

function ScenarioCard({
  scenario,
}: {
  scenario: {
    id: string;
    dimensionKey: string;
    scenario: string;
    options: unknown;
    estimatedSeconds: number;
    isActive: boolean;
    isCustom: boolean;
    seedScenarioId: string | null;
  };
}) {
  const opts = (Array.isArray(scenario.options) ? scenario.options : []) as QuizOption[];
  return (
    <div
      className={`rounded-lg border bg-white p-3 ${
        scenario.isActive ? 'border-gray-200' : 'border-gray-200 opacity-60'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-gray-900 flex-1">{scenario.scenario}</p>
        <div className="flex items-center gap-1 shrink-0">
          {scenario.isCustom ? (
            <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-800">
              custom
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-800">
              seeded
            </span>
          )}
          {scenario.isActive ? (
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
              active
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-700">
              archived
            </span>
          )}
        </div>
      </div>
      <ul className="mt-2 space-y-1">
        {opts.map((o, idx) => {
          const id = typeof o.id === 'string' ? o.id : `opt-${idx}`;
          const label = typeof o.label === 'string' ? o.label : '(missing label)';
          const dv = typeof o.dimensionValue === 'number' ? o.dimensionValue : null;
          const w = typeof o.weight === 'number' ? o.weight : null;
          return (
            <li
              key={id}
              className="flex items-center justify-between gap-3 rounded-md bg-gray-50 px-3 py-1.5 text-xs"
            >
              <span className="text-gray-800">{label}</span>
              <span className="font-mono text-gray-600 shrink-0">
                dimVal {dv === null ? '—' : dv} · weight {w === null ? '—' : w}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[10px] text-gray-400">
        ~{scenario.estimatedSeconds}s · {scenario.id}
        {scenario.seedScenarioId && ` · seed ${scenario.seedScenarioId}`}
      </p>
    </div>
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
              : 'bg-gray-100 text-gray-700 ring-gray-200';
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

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { useIsSuperAdmin } from '@/lib/use-super-admin';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  EnvelopeIcon,
  EyeIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  DocumentChartBarIcon,
  PaperClipIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/24/outline';
import { OrgFeatureGrantsSection } from '@/components/platform-admin/org-feature-grants';
import { DemoTenantPanel } from '@/components/platform-admin/demo-tenant-panel';
import { DemoTenantBadge, DemoTenantToggle } from '@/components/platform-admin/demo-tenant-toggle';
import { SandboxBadge, SandboxOrgPanel } from '@/components/platform-admin/sandbox-org-panel';
import { OrgTimelineSection } from '@/components/platform-admin/org-timeline';
import { SupportActionsSection } from '@/components/platform-admin/support-actions';
import { OrgAuthenticationSection } from '@/components/platform-admin/org-authentication';
import { OrgLegalAcceptanceSection } from '@/components/platform-admin/org-legal-acceptance';
import { openImpersonationLink } from '@/lib/impersonation-link';
import {
  AlertTriangle,
  Building2,
  ClipboardList,
  CreditCard,
  ExternalLink,
  FileBarChart,
  Gauge,
  Info,
  Languages,
  LayoutDashboard,
  ListChecks,
  Receipt,
  Route,
  Sparkles,
  Users,
  Briefcase,
  History,
  PenSquare,
  Zap,
} from 'lucide-react';
import { AdminPage } from '@/components/admin/page-chrome';
import { PageHeader } from '@/components/admin/page-header';
import { SectionCard, DetailList } from '@/components/admin/section-card';
import { StatGrid, StatTile } from '@/components/admin/stat-tile';
import { StatusPill, type StatusTone } from '@/components/admin/status-pill';
import { EmptyState } from '@/components/admin/empty-state';
import { buttonClass, checkboxClass, inputClass, selectClass } from '@/components/admin/controls';

type DangerModal = 'none' | 'suspend' | 'archive' | 'reactivate' | 'permanent';

export default function OrganizationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { isLoading: authLoading } = useAdminAuth();
  const isSuperAdmin = useIsSuperAdmin();
  const orgId = params.id as string;

  const [editingSubscription, setEditingSubscription] = useState(false);
  const [newPlan, setNewPlan] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [newExpiresAt, setNewExpiresAt] = useState(''); // datetime-local value
  const [newBillingComped, setNewBillingComped] = useState(false);
  const [dangerModal, setDangerModal] = useState<DangerModal>('none');
  const [dangerReason, setDangerReason] = useState('');
  const [permanentConfirmName, setPermanentConfirmName] = useState('');
  const [reactivateAs, setReactivateAs] = useState<'ACTIVE' | 'TRIAL'>('ACTIVE');
  const [actionMessage, setActionMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const { data, isLoading, refetch } = trpc.platformAdmin.getOrganization.useQuery({ id: orgId }, {
    enabled: !authLoading,
  });

  // PR — Culture: lightweight per-org counts + status for the Quick Actions
  // sidebar. Always queried (regardless of culture grant state) so platform
  // ops can see at-a-glance "no culture configured" without clicking in.
  // Cast through `any` to avoid the repo-wide createTRPCReact<any>() type
  // collision diagnostic that fires on every property access.
  const { data: cultureSummary } = (trpc as unknown as any).platformAdmin.org.cultureSummary.useQuery(
    { organizationId: orgId },
    { enabled: !authLoading },
  );

  // Careers page roll-up (public job listings + direct apply). Same
  // pattern as cultureSummary — always queried, cast through `any`.
  const { data: careersSummary, refetch: refetchCareers } = (trpc as unknown as any).careers.platform.summary.useQuery(
    { organizationId: orgId },
    { enabled: !authLoading },
  );
  const verifyCareersDomain = (trpc as unknown as any).careers.platform.verifyCustomDomain.useMutation({
    onSuccess: () => { void refetchCareers(); },
  });

  const updateSubscription = trpc.platformAdmin.updateSubscription.useMutation({
    onSuccess: () => {
      setEditingSubscription(false);
      refetch();
    },
  });

  const impersonateMutation = trpc.platformAdmin.impersonateOrganization.useMutation({
    onSuccess: (data) => {
      openImpersonationLink(data);
    },
  });

  const suspendMutation = trpc.platformAdmin.suspendOrganization.useMutation({
    onSuccess: () => {
      setDangerModal('none');
      setDangerReason('');
      setActionMessage({ type: 'ok', text: 'Organization suspended. Subscription canceled; users deactivated.' });
      refetch();
    },
    onError: (e) => setActionMessage({ type: 'err', text: e.message }),
  });

  const archiveMutation = trpc.platformAdmin.archiveOrganization.useMutation({
    onSuccess: () => {
      setDangerModal('none');
      setDangerReason('');
      setActionMessage({ type: 'ok', text: 'Organization archived (hidden from directory). Restore with Reactivate.' });
      refetch();
    },
    onError: (e) => setActionMessage({ type: 'err', text: e.message }),
  });

  const reactivateMutation = trpc.platformAdmin.reactivateOrganization.useMutation({
    onSuccess: () => {
      setDangerModal('none');
      setActionMessage({ type: 'ok', text: 'Organization reactivated.' });
      refetch();
    },
    onError: (e) => setActionMessage({ type: 'err', text: e.message }),
  });

  const permanentDeleteMutation = trpc.platformAdmin.permanentDeleteOrganization.useMutation({
    onSuccess: () => {
      setDangerModal('none');
      setPermanentConfirmName('');
      router.push('/organizations');
    },
    onError: (e) => setActionMessage({ type: 'err', text: e.message }),
  });

  const backfillOrgDefaultsMutation = trpc.platformAdmin.backfillOrgDefaultSeeds.useMutation({
    onSuccess: (res) => {
      const r = res.results[0];
      const detail =
        r && 'seeded' in r && r.seeded
          ? ` templates +${r.seeded.emailTemplates}, reasons +${r.seeded.rejectionReasons}, ratings +${r.seeded.ratingCategories}`
          : res.backfilledOrganizations === 0
            ? ' (nothing missing)'
            : '';
      setActionMessage({
        type: 'ok',
        text: `Org defaults: scanned ${res.organizationsScanned}, backfilled ${res.backfilledOrganizations}${detail}`,
      });
    },
    onError: (e) => setActionMessage({ type: 'err', text: e.message }),
  });

  useEffect(() => {
    if (!actionMessage) return;
    const t = setTimeout(() => setActionMessage(null), 10000);
    return () => clearTimeout(t);
  }, [actionMessage]);

  const closeDangerModal = () => {
    setDangerModal('none');
    setDangerReason('');
    setPermanentConfirmName('');
  };

  const openDangerModal = (kind: Exclude<DangerModal, 'none'>) => {
    setDangerModal(kind);
    setDangerReason('');
    setPermanentConfirmName('');
  };

  const handleUpdateSubscription = async () => {
    if (!newPlan || !newStatus) return;

    await updateSubscription.mutateAsync({
      organizationId: orgId,
      plan: newPlan as any,
      status: newStatus as any,
      expiresAt: newExpiresAt ? new Date(newExpiresAt) : undefined,
      billingComped: newBillingComped,
    });
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-admin-accent border-t-transparent" />
      </div>
    );
  }

  if (!data) {
    return (
      <AdminPage>
        <EmptyState icon={<Building2 />} title="Organization not found" />
      </AdminPage>
    );
  }

  const { organization, usage } = data;
  const isArchived = Boolean(organization.deletedAt);
  const settings = (organization.settings as Record<string, unknown> | null) ?? {};
  const isDemoTenant = settings.demoTenant === true;
  const isSandbox = settings.sandbox === true;
  const permanentDeleteConfirmHint =
    (organization.name || organization.domain || '').trim() || '(organization has no name or domain — set one before permanent delete)';

  return (
    <AdminPage width="wide">
      <PageHeader
        icon={<Building2 />}
        breadcrumbs={[
          { label: 'Tenants', href: '/organizations' },
          { label: 'Organizations', href: '/organizations' },
          { label: organization.name || '(Onboarding Incomplete)' },
        ]}
        title={organization.name || '(Onboarding Incomplete)'}
        meta={
          <>
            {isArchived && (
              <span className="rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide bg-admin-ink text-white">
                Archived
              </span>
            )}
            {isDemoTenant && <DemoTenantBadge />}
            {isSandbox && <SandboxBadge />}
            <StatusPill tone={getStatusTone(organization.subscriptionStatus)}>
              {organization.subscriptionStatus}
            </StatusPill>
            <StatusPill tone="info" dot={false}>
              {organization.subscriptionPlan}
            </StatusPill>
          </>
        }
        description={organization.domain}
        actions={
          <>
            <Link
              href={`/attention?org=${orgId}`}
              className="inline-flex items-center gap-1.5 rounded-admin-sm border border-admin-warn/40 bg-admin-warn-soft px-3.5 py-2 text-sm font-medium text-amber-800 shadow-sm hover:bg-amber-100"
            >
              <AlertTriangle className="h-4 w-4" />
              Attention
            </Link>
            <button
              type="button"
              onClick={() =>
                backfillOrgDefaultsMutation.mutate({
                  organizationId: orgId,
                  dryRun: false,
                })
              }
              disabled={backfillOrgDefaultsMutation.isPending || isArchived}
              title="Adds missing default email templates, rejection reasons, and rating categories (idempotent)"
              className={buttonClass.secondary}
            >
              <Sparkles className="h-4 w-4 text-amber-500" />
              {backfillOrgDefaultsMutation.isPending ? 'Seeding…' : 'Seed org defaults'}
            </button>
            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => impersonateMutation.mutate({ organizationId: orgId })}
                disabled={impersonateMutation.isPending || isArchived}
                title={isArchived ? 'Archived organizations cannot be opened via Login as Admin' : undefined}
                className={buttonClass.primary}
              >
                <ExternalLink className="h-4 w-4" />
                {impersonateMutation.isPending ? 'Opening...' : 'Login as Admin'}
              </button>
            )}
          </>
        }
      />

      {actionMessage && (
        <div className="mb-6">
          <div
            className={`rounded-admin-sm px-4 py-3 text-sm ${
              actionMessage.type === 'ok'
                ? 'border border-admin-ok/20 bg-admin-ok-soft text-emerald-900'
                : 'border border-admin-danger/20 bg-admin-danger-soft text-red-900'
            }`}
            role="alert"
          >
            {actionMessage.text}
            <button
              type="button"
              onClick={() => setActionMessage(null)}
              className="ml-3 underline font-medium"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Position → Candidates Tracking (full detail) */}
            <SectionCard
              icon={<FileBarChart />}
              title="Position & Candidate Tracking"
              description="Email sent, visited, steps, AI scoring, report. Status shows where they are (invited, in progress, waiting on processing, or done)."
              href={`/organizations/${orgId}/positions`}
              hrefLabel="View All Positions"
              padded={false}
            >
              <PositionCandidatesTrackingSection orgId={orgId} />
            </SectionCard>

            {/* Scoring Health */}
            <SectionCard
              icon={<Gauge />}
              title="Scoring Health"
              description="Responses pending, processing, or failed in the AI scoring pipeline"
              padded={false}
            >
              <ScoringHealthSection orgId={orgId} />
            </SectionCard>

            {/* Usage Stats */}
            <SectionCard icon={<Users />} title="Usage Statistics" description="Totals across this organization">
              <StatGrid cols={3}>
                <StatTile label="Total Users" icon={Users} tone="brand" value={usage.total_users || 0} />
                <StatTile label="Candidates" icon={Users} tone="ok" value={usage.total_candidates || 0} />
                <StatTile label="Assessments" icon={ClipboardList} tone="info" value={usage.total_assessments || 0} />
                <StatTile label="Hiring Flows" icon={Route} tone="warn" value={usage.total_journeys || 0} />
                <StatTile label="Positions" icon={Briefcase} tone="muted" value={usage.total_positions || 0} />
                {usage.avg_journey_score > 0 && (
                  <StatTile
                    label="Average hiring flow score"
                    icon={Gauge}
                    tone="brand"
                    value={`${Math.round(parseFloat(usage.avg_journey_score))}%`}
                  />
                )}
              </StatGrid>
            </SectionCard>

            <DemoTenantToggle
              organizationId={orgId}
              organizationName={organization.name || ''}
              demoTenant={isDemoTenant}
              canEdit={isSuperAdmin && !isArchived}
              onSaved={refetch}
            />
            {isDemoTenant && <DemoTenantPanel organizationId={orgId} />}

            <SandboxOrgPanel
              organizationId={orgId}
              organizationName={organization.name || ''}
              isSandbox={isSandbox}
              canEdit={isSuperAdmin && !isArchived && !isSandbox}
            />

            <OrgFeatureGrantsSection organizationId={orgId} />

            <SupportActionsSection organizationId={orgId} />

            <OrgAuthenticationSection organizationId={orgId} />

            <OrgLegalAcceptanceSection organizationId={orgId} />

            <OrgTimelineSection organizationId={orgId} />

            {/* Payment History */}
            {data.paymentHistory && data.paymentHistory.length > 0 && (
              <SectionCard icon={<Receipt />} title="Payment History & Receipts">
                <div className="space-y-3">
                  {data.paymentHistory.map((payment: any) => (
                    <div key={payment.id} className="flex justify-between items-center py-2 border-b border-admin-border">
                      <div>
                        <p className="font-medium text-admin-ink">
                          ${payment.amount.toFixed(2)} {payment.currency.toUpperCase()}
                          {payment.number ? <span className="ml-2 text-xs text-admin-muted font-mono">#{payment.number}</span> : null}
                        </p>
                        <p className="text-sm text-admin-muted">
                          {payment.paidAt ? new Date(payment.paidAt).toLocaleDateString() : 'Pending'}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {payment.invoiceUrl && (
                          <a
                            href={payment.invoiceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium text-admin-accent-ink hover:underline"
                          >
                            Invoice
                          </a>
                        )}
                        {payment.invoicePdf && (
                          <a
                            href={payment.invoicePdf}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium text-admin-accent-ink hover:underline"
                          >
                            PDF
                          </a>
                        )}
                        {payment.receiptUrl && (
                          <a
                            href={payment.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium text-admin-accent-ink hover:underline"
                          >
                            Receipt
                          </a>
                        )}
                        <StatusPill tone={payment.status === 'paid' ? 'success' : 'warn'}>
                          {payment.status}
                        </StatusPill>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Subscription History */}
            {data.subscriptionHistory && data.subscriptionHistory.length > 0 && (
              <SectionCard icon={<History />} title="Subscription Changes">
                <div className="space-y-3">
                  {data.subscriptionHistory.map((change, idx) => (
                    <div key={idx} className="py-2 border-b border-admin-border">
                      <p className="text-sm font-medium text-admin-ink">{change.action}</p>
                      <p className="text-xs text-admin-muted">
                        {new Date(change.changedAt).toLocaleString()}
                      </p>
                      {change.details && (
                        <p className="text-xs text-admin-secondary mt-1">
                          {JSON.stringify(change.details)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Authoring settings (PR — admin alignment) */}
            <OrgAuthoringSettingsSection
              organizationId={orgId}
              settings={(data.organization.settings as Record<string, unknown> | null) || null}
              onSaved={refetch}
            />

            <OrgDashboardSettingsSection
              organizationId={orgId}
              settings={(data.organization.settings as Record<string, unknown> | null) || null}
              onSaved={refetch}
            />

            <OrgCrmOnlySection
              organizationId={orgId}
              settings={(data.organization.settings as Record<string, unknown> | null) || null}
              onSaved={refetch}
            />

            {/* Per-org language settings */}
            <OrgI18nSettingsSection organizationId={orgId} onSaved={refetch} />

            {/* Per-org positions readiness summary */}
            <OrgPositionsReadinessSection organizationId={orgId} />

            {/* Subscription Management */}
            <SectionCard
              icon={<CreditCard />}
              title="Subscription"
              actions={
                !editingSubscription && (
                  <button
                    onClick={() => {
                      setEditingSubscription(true);
                      setNewPlan(organization.subscriptionPlan);
                      setNewStatus(organization.subscriptionStatus);
                      setNewBillingComped(Boolean((organization as { billingComped?: boolean }).billingComped));
                      setNewExpiresAt(
                        organization.subscriptionExpiresAt
                          ? new Date(organization.subscriptionExpiresAt).toISOString().slice(0, 16)
                          : ''
                      );
                    }}
                    className={buttonClass.small}
                  >
                    Edit
                  </button>
                )
              }
            >
              {editingSubscription ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-admin-secondary mb-2">
                      Subscription Plan
                    </label>
                    <select
                      value={newPlan}
                      onChange={(e) => setNewPlan(e.target.value)}
                      className={`${selectClass} w-full`}
                    >
                      <option value="TRIAL">Trial</option>
                      <option value="PILOT">1-Role Pilot</option>
                      <option value="STARTER">Starter</option>
                      <option value="PROFESSIONAL">Professional</option>
                      <option value="ENTERPRISE">Enterprise</option>
                      <option value="ENTERPRISE_PLUS">Enterprise Plus</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-admin-secondary mb-2">
                      Status
                    </label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      className={`${selectClass} w-full`}
                    >
                      <option value="TRIAL">Trial</option>
                      <option value="ACTIVE">Active</option>
                      <option value="PAST_DUE">Past Due</option>
                      <option value="CANCELED">Canceled</option>
                      <option value="EXPIRED">Expired</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-admin-secondary mb-2">
                      Subscription expires (optional)
                    </label>
                    <input
                      type="datetime-local"
                      value={newExpiresAt}
                      onChange={(e) => setNewExpiresAt(e.target.value)}
                      className={inputClass}
                    />
                    <p className="text-xs text-admin-muted mt-1">Leave blank to keep current expiry unchanged when saving.</p>
                  </div>

                  <div className="rounded-admin-sm border border-violet-100 bg-violet-50/50 p-4">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newBillingComped}
                        onChange={(e) => setNewBillingComped(e.target.checked)}
                        className="mt-1 rounded border-admin-border-strong text-violet-600 focus:ring-violet-500"
                      />
                      <span>
                        <span className="block text-sm font-medium text-admin-ink">Complimentary (comped) billing</span>
                        <span className="block text-xs text-admin-secondary mt-1">
                          Plan is granted without Stripe. Paid MRR on the billing dashboard excludes this org. Use for pilots,
                          partners, and legacy accounts before Stripe checkout.
                        </span>
                      </span>
                    </label>
                  </div>

                  <div className="flex space-x-3">
                    <button
                      onClick={handleUpdateSubscription}
                      disabled={updateSubscription.isLoading}
                      className={buttonClass.primary}
                    >
                      {updateSubscription.isLoading ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                      onClick={() => setEditingSubscription(false)}
                      className={buttonClass.secondary}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-admin-secondary">Plan</span>
                    <span className="text-sm font-medium text-admin-ink">{organization.subscriptionPlan}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-admin-secondary">Status</span>
                    <span className="text-sm font-medium text-admin-ink">{organization.subscriptionStatus}</span>
                  </div>
                  {organization.subscriptionExpiresAt && (
                    <div className="flex justify-between">
                      <span className="text-sm text-admin-secondary">Expires</span>
                      <span className="text-sm font-medium text-admin-ink">
                        {new Date(organization.subscriptionExpiresAt).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2 border-t border-admin-border">
                    <span className="text-sm text-admin-secondary">Billing</span>
                    {(organization as { billingComped?: boolean }).billingComped ? (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-violet-100 text-violet-900">
                        Comped
                      </span>
                    ) : organization.stripeCustomerId ? (
                      <span className="text-xs font-medium text-admin-accent-ink">Stripe</span>
                    ) : (
                      <span className="text-xs text-admin-muted">No Stripe customer</span>
                    )}
                  </div>
                </div>
              )}
            </SectionCard>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Organization Info */}
            <OrgDetailsSection
              organizationId={orgId}
              organization={organization}
              isArchived={isArchived}
              onSaved={refetch}
            />

            {/* Quick Actions */}
            <SectionCard icon={<Zap />} title="Quick Actions" bodyClassName="p-3">
              <div className="space-y-0.5">
                <Link
                  href={`/attention?org=${orgId}`}
                  className="block w-full rounded-admin-sm px-3 py-2 text-left text-sm font-medium text-amber-700 hover:bg-admin-warn-soft"
                >
                  Open attention queue →
                </Link>
                <Link
                  href={`/organizations/${orgId}/candidates`}
                  className="block w-full rounded-admin-sm px-3 py-2 text-left text-sm text-admin-secondary hover:bg-admin-accent-soft hover:text-admin-accent-ink"
                >
                  View Candidates ({usage.total_candidates || 0})
                </Link>
                <Link
                  href={`/organizations/${orgId}/positions`}
                  className="block w-full rounded-admin-sm px-3 py-2 text-left text-sm font-medium text-admin-accent-ink hover:bg-admin-accent-soft"
                >
                  Candidate AI Forensics →
                </Link>
                <Link
                  href={`/organizations/${orgId}/users`}
                  className="block w-full rounded-admin-sm px-3 py-2 text-left text-sm text-admin-secondary hover:bg-admin-accent-soft hover:text-admin-accent-ink"
                >
                  Manage Users ({organization._count.users})
                </Link>
                <Link
                  href={`/organizations/${orgId}/assessments`}
                  className="block w-full rounded-admin-sm px-3 py-2 text-left text-sm text-admin-secondary hover:bg-admin-accent-soft hover:text-admin-accent-ink"
                >
                  View Assessments ({organization._count.assessments})
                </Link>
                <Link
                  href={`/organizations/${orgId}/interviews`}
                  className="block w-full rounded-admin-sm px-3 py-2 text-left text-sm text-admin-secondary hover:bg-admin-accent-soft hover:text-admin-accent-ink"
                >
                  View Interviews ({organization._count.interview_sessions})
                </Link>
                <Link
                  href={`/organizations/${orgId}/journeys`}
                  className="block w-full rounded-admin-sm px-3 py-2 text-left text-sm text-admin-secondary hover:bg-admin-accent-soft hover:text-admin-accent-ink"
                >
                  View Journeys ({usage.total_journeys || 0})
                </Link>
                <Link
                  href={`/organizations/${orgId}/personas`}
                  className="block w-full rounded-admin-sm px-3 py-2 text-left text-sm text-admin-secondary hover:bg-admin-accent-soft hover:text-admin-accent-ink"
                >
                  View AI Avatars
                </Link>

                {/* Culture — 6 entries, always shown (counts will read 0 if
                    the org doesn't have culture configured) so platform ops
                    can see "no culture configured" at-a-glance without
                    clicking in. */}
                <div className="my-2 border-t border-admin-border" />
                <Link
                  href={`/organizations/${orgId}/culture`}
                  className="block w-full rounded-admin-sm px-3 py-2 text-left text-sm text-admin-secondary hover:bg-admin-accent-soft hover:text-admin-accent-ink"
                >
                  View Culture Profiles ({cultureSummary?.counts.profiles ?? 0})
                </Link>
                <Link
                  href={`/organizations/${orgId}/culture#groups`}
                  className="block w-full rounded-admin-sm px-3 py-2 text-left text-sm text-admin-secondary hover:bg-admin-accent-soft hover:text-admin-accent-ink"
                >
                  View Culture Groups ({cultureSummary?.counts.groups ?? 0})
                </Link>
                <Link
                  href={`/organizations/${orgId}/culture#interview-templates`}
                  className="block w-full rounded-admin-sm px-3 py-2 text-left text-sm text-admin-secondary hover:bg-admin-accent-soft hover:text-admin-accent-ink"
                >
                  View Culture Interview Templates ({cultureSummary?.counts.interviewTemplates ?? 0})
                </Link>
                <Link
                  href={`/organizations/${orgId}/culture#candidate-signals`}
                  className="block w-full rounded-admin-sm px-3 py-2 text-left text-sm text-admin-secondary hover:bg-admin-accent-soft hover:text-admin-accent-ink"
                >
                  View Candidate Culture Signals ({cultureSummary?.counts.candidateSignals ?? 0})
                </Link>
                <div className="my-2 border-t border-admin-border" />

                {/*
                  Public careers page (job listings + direct apply).
                  Sourced from `careers.platform.summary` — surfaces
                  enabled-state + published count + the public URL so
                  platform support can pop into the org's careers page
                  in a new tab.
                */}
                {careersSummary?.publicUrl ? (
                  <a
                    href={careersSummary.publicUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="block w-full rounded-admin-sm px-3 py-2 text-left text-sm text-admin-secondary hover:bg-admin-accent-soft hover:text-admin-accent-ink"
                    title={`Open ${careersSummary.publicUrl} in a new tab`}
                  >
                    Careers Page (Enabled · {careersSummary.publishedPositionCount} listed) ↗
                  </a>
                ) : (
                  <span
                    className="block w-full cursor-default rounded-admin-sm px-3 py-2 text-left text-sm text-admin-muted"
                    title={
                      careersSummary
                        ? 'Org admin has not enabled the public careers page yet.'
                        : 'Loading…'
                    }
                  >
                    Careers Page ({careersSummary ? 'Disabled' : '—'})
                  </span>
                )}
                {careersSummary?.customCareersDomain ? (
                  <div className="px-3 py-2 text-sm text-admin-secondary">
                    <p className="break-all">
                      {careersSummary.customCareersDomain}
                      {' · '}
                      {careersSummary.customCareersDomainVerified ? 'Verified' : 'Not verified'}
                    </p>
                    <button
                      type="button"
                      className="mt-1 text-sm font-medium text-admin-accent-ink hover:underline disabled:opacity-50"
                      disabled={verifyCareersDomain.isPending}
                      onClick={() => verifyCareersDomain.mutate({
                        organizationId: orgId,
                        verified: !careersSummary.customCareersDomainVerified,
                      })}
                    >
                      {careersSummary.customCareersDomainVerified ? 'Mark unverified' : 'Verify domain'}
                    </button>
                  </div>
                ) : null}
                <div className="my-2 border-t border-admin-border" />

                <Link
                  href={`/audit?org=${orgId}`}
                  className="block w-full rounded-admin-sm px-3 py-2 text-left text-sm text-admin-secondary hover:bg-admin-accent-soft hover:text-admin-accent-ink"
                >
                  View Audit Logs
                </Link>
                <button type="button" className="w-full rounded-admin-sm px-3 py-2 text-left text-sm text-admin-secondary hover:bg-admin-accent-soft hover:text-admin-accent-ink">
                  Export Metadata
                </button>
              </div>
            </SectionCard>

            <section className="admin-panel overflow-hidden border-admin-danger/25">
              <header className="flex items-center gap-3 border-b border-admin-danger/15 bg-admin-danger-soft/50 px-5 py-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-admin-danger/20 bg-white text-admin-danger">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-[15px] font-semibold text-red-900">Account control</h2>
                  <p className="mt-0.5 text-xs text-admin-muted">
                    Suspend, archive, reactivate, or permanently delete. All actions are audited.
                  </p>
                </div>
              </header>
              <div className="p-5">
              {!isSuperAdmin ? (
                <p className="text-sm text-admin-muted italic">Super admin only.</p>
              ) : (
                <div className="space-y-2">
                  {!isArchived ? (
                    <>
                      <button
                        type="button"
                        onClick={() => openDangerModal('suspend')}
                        className="w-full rounded-admin-sm border border-admin-danger/20 px-4 py-2 text-left text-sm text-red-700 hover:bg-admin-danger-soft"
                      >
                        Suspend organization
                      </button>
                      <button
                        type="button"
                        onClick={() => openDangerModal('archive')}
                        className="w-full rounded-admin-sm border border-admin-danger/20 px-4 py-2 text-left text-sm text-red-700 hover:bg-admin-danger-soft"
                      >
                        Archive (soft-delete)
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openDangerModal('reactivate')}
                      className="w-full rounded-admin-sm border border-admin-ok/25 px-4 py-2 text-left text-sm text-green-800 hover:bg-admin-ok-soft"
                    >
                      Reactivate organization
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => openDangerModal('permanent')}
                    className="w-full rounded-admin-sm bg-red-700 px-4 py-2 text-left text-sm font-medium text-white hover:bg-red-800"
                  >
                    Delete permanently…
                  </button>
                </div>
              )}
              </div>
            </section>
          </div>
        </div>
      </div>

      {dangerModal !== 'none' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.target === e.currentTarget && closeDangerModal()}
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-admin border border-admin-border bg-white p-6 shadow-2xl">
            {dangerModal === 'suspend' && (
              <>
                <h3 className="text-lg font-semibold text-admin-ink">Suspend organization</h3>
                <p className="text-sm text-admin-secondary mt-2">
                  Cancels subscription, deactivates all users, and records an audit entry. The org remains visible unless you archive it.
                </p>
                <label className="block text-sm font-medium text-admin-secondary mt-4">Reason (required)</label>
                <textarea
                  value={dangerReason}
                  onChange={(e) => setDangerReason(e.target.value)}
                  rows={3}
                  className={`${inputClass} mt-1`}
                  placeholder="e.g. Chargeback / ToS violation / customer request"
                />
                <div className="flex justify-end gap-2 mt-6">
                  <button type="button" onClick={closeDangerModal} className={buttonClass.secondary}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!dangerReason.trim() || suspendMutation.isPending}
                    onClick={() => suspendMutation.mutate({ organizationId: orgId, reason: dangerReason.trim() })}
                    className={buttonClass.danger}
                  >
                    {suspendMutation.isPending ? 'Suspending…' : 'Suspend'}
                  </button>
                </div>
              </>
            )}
            {dangerModal === 'archive' && (
              <>
                <h3 className="text-lg font-semibold text-admin-ink">Archive organization</h3>
                <p className="text-sm text-admin-secondary mt-2">
                  Hides the org from the default directory, cancels subscription, and deactivates users. You can reactivate later.
                </p>
                <label className="block text-sm font-medium text-admin-secondary mt-4">Reason (required)</label>
                <textarea
                  value={dangerReason}
                  onChange={(e) => setDangerReason(e.target.value)}
                  rows={3}
                  className={`${inputClass} mt-1`}
                  placeholder="e.g. Churned — keep data for 90 days"
                />
                <div className="flex justify-end gap-2 mt-6">
                  <button type="button" onClick={closeDangerModal} className={buttonClass.secondary}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!dangerReason.trim() || archiveMutation.isPending}
                    onClick={() => archiveMutation.mutate({ organizationId: orgId, reason: dangerReason.trim() })}
                    className={buttonClass.danger}
                  >
                    {archiveMutation.isPending ? 'Archiving…' : 'Archive'}
                  </button>
                </div>
              </>
            )}
            {dangerModal === 'reactivate' && (
              <>
                <h3 className="text-lg font-semibold text-admin-ink">Reactivate organization</h3>
                <p className="text-sm text-admin-secondary mt-2">
                  Clears archive status, sets subscription status, and reactivates users.
                </p>
                <label className="block text-sm font-medium text-admin-secondary mt-4">Subscription status after reactivate</label>
                <select
                  value={reactivateAs}
                  onChange={(e) => setReactivateAs(e.target.value as 'ACTIVE' | 'TRIAL')}
                  className={`${inputClass} mt-1`}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="TRIAL">TRIAL</option>
                </select>
                <div className="flex justify-end gap-2 mt-6">
                  <button type="button" onClick={closeDangerModal} className={buttonClass.secondary}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={reactivateMutation.isPending}
                    onClick={() =>
                      reactivateMutation.mutate({ organizationId: orgId, subscriptionStatus: reactivateAs })
                    }
                    className={buttonClass.primary}
                  >
                    {reactivateMutation.isPending ? 'Reactivating…' : 'Reactivate'}
                  </button>
                </div>
              </>
            )}
            {dangerModal === 'permanent' && (
              <>
                <h3 className="text-lg font-semibold text-admin-ink">Delete organization permanently</h3>
                <p className="text-sm text-admin-secondary mt-2">
                  This removes the organization record from the database. This may fail if related data still exists (foreign keys). Type the exact{' '}
                  <strong>organization name</strong>, or if the name is empty, the <strong>domain</strong>, to confirm.
                </p>
                <p className="text-xs font-mono bg-slate-100 rounded px-2 py-1 mt-3 break-all">{permanentDeleteConfirmHint}</p>
                <label className="block text-sm font-medium text-admin-secondary mt-4">Confirmation</label>
                <input
                  type="text"
                  value={permanentConfirmName}
                  onChange={(e) => setPermanentConfirmName(e.target.value)}
                  className={`${inputClass} mt-1`}
                  placeholder={permanentDeleteConfirmHint}
                  autoComplete="off"
                />
                <div className="flex justify-end gap-2 mt-6">
                  <button type="button" onClick={closeDangerModal} className={buttonClass.secondary}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={permanentConfirmName.trim().length < 2 || permanentDeleteMutation.isPending}
                    onClick={() =>
                      permanentDeleteMutation.mutate({
                        organizationId: orgId,
                        confirmationName: permanentConfirmName.trim(),
                      })
                    }
                    className={`${buttonClass.danger} bg-red-800 hover:bg-red-900`}
                  >
                    {permanentDeleteMutation.isPending ? 'Deleting…' : 'Delete permanently'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </AdminPage>
  );
}

function PositionCandidatesTrackingSection({ orgId }: { orgId: string }) {
  const [expandedPositions, setExpandedPositions] = useState<Set<string>>(new Set());
  const [expandedCandidates, setExpandedCandidates] = useState<Set<string>>(new Set());

  const { data, isLoading } = trpc.platformAdmin.getOrgPositionCandidatesDetail.useQuery(
    { organizationId: orgId, limit: 200 },
    { enabled: !!orgId }
  );

  const togglePosition = (id: string) => {
    setExpandedPositions(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleCandidate = (sessionId: string) => {
    if (!sessionId) return;
    setExpandedCandidates(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-admin-accent border-t-transparent" />
      </div>
    );
  }

  if (!data?.positions?.length) {
    return (
      <EmptyState
        compact
        className="border-0 shadow-none"
        icon={<FileBarChart />}
        title="No positions with hiring flow tracking yet"
      />
    );
  }

  return (
    <div className="divide-y divide-admin-border">
      {data.positions.map((pos) => {
        const isExpanded = expandedPositions.has(pos.positionId);
        const candidateCount = pos.candidates?.length ?? 0;
        const visitedCount = pos.candidates?.filter(c => c.visited).length ?? 0;
        const jobResumeCount = pos.candidates?.filter((c: any) => c.hasJobResume).length ?? 0;
        const reportCompleteCount = pos.candidates?.filter(c => c.reportComplete).length ?? 0;

        return (
          <div key={pos.positionId}>
            <button
              onClick={() => togglePosition(pos.positionId)}
              className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-admin-bg/70"
            >
              {isExpanded ? (
                <ChevronDownIcon className="h-5 w-5 text-admin-muted shrink-0" />
              ) : (
                <ChevronRightIcon className="h-5 w-5 text-admin-muted shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-admin-ink truncate">{pos.positionTitle}</h3>
                <p className="text-sm text-admin-muted">{pos.journeyName}</p>
              </div>
              <div className="flex items-center gap-6 shrink-0">
                <span className="text-sm text-admin-secondary">
                  <span className="font-medium text-admin-ink">{candidateCount}</span> candidates
                </span>
                <span className="text-sm text-admin-secondary">
                  <span className="font-medium text-admin-ink">{jobResumeCount}</span> resumes
                </span>
                <span className="text-sm text-emerald-600">
                  <span className="font-medium">{visitedCount}</span> visited
                </span>
                <span className="text-sm text-admin-accent-ink">
                  <span className="font-medium">{reportCompleteCount}</span> reports
                </span>
              </div>
            </button>

            {isExpanded && (
              <div className="border-t border-admin-border bg-admin-bg/50">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-admin-border bg-admin-bg">
                        <th className="whitespace-nowrap px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-admin-muted">Candidate</th>
                        <th className="px-3 py-2.5 text-center text-admin-muted" title="Email sent">
                          <EnvelopeIcon className="h-4 w-4 inline-block" />
                        </th>
                        <th className="px-3 py-2.5 text-center text-admin-muted" title="Resume attached to this job (amber = resume on candidate profile only)">
                          <PaperClipIcon className="h-4 w-4 inline-block" />
                        </th>
                        <th className="px-3 py-2.5 text-center text-admin-muted" title="Visited">
                          <EyeIcon className="h-4 w-4 inline-block" />
                        </th>
                        <th className="whitespace-nowrap px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-admin-muted">Step</th>
                        <th className="whitespace-nowrap px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-admin-muted">AI Scored</th>
                        <th className="px-3 py-2.5 text-center text-admin-muted" title="Report complete">
                          <DocumentChartBarIcon className="h-4 w-4 inline-block" />
                        </th>
                        <th className="whitespace-nowrap px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-admin-muted">
                          <span className="inline-flex items-center gap-1">
                            Status
                            <span title="Report Complete = all done, report ready · In Interview = recording videos · Stuck in Scoring = AI scoring pending/failed · Invited = email sent, waiting for visit · Not invited = not sent yet" className="text-admin-muted cursor-help">
                              <QuestionMarkCircleIcon className="h-4 w-4" />
                            </span>
                          </span>
                        </th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {pos.candidates?.map((c) => (
                        <CandidateRow
                          key={c.applicationId}
                          candidate={c}
                          orgId={orgId}
                          expanded={expandedCandidates.has(c.sessionId || '')}
                          onToggle={() => toggleCandidate(c.sessionId || '')}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CandidateRow({
  candidate,
  orgId,
  expanded,
  onToggle,
}: {
  candidate: {
    candidateId: string;
    candidateName: string;
    candidateEmail: string;
    sessionId: string | null;
    emailSent: boolean;
    visited: boolean;
    nodesDone: number;
    nodesTotal: number;
    aiScoredCount: number;
    aiScoredTotal: number;
    reportComplete: boolean;
    hasJobResume?: boolean;
    hasProfileResume?: boolean;
    overallScore: number | null;
    applicationStatus: string;
    lastActivityAt: Date | null;
    startedAt: Date | null;
    videosRecorded?: number;
    videosTotal?: number;
    currentStepLabel?: string | null;
    currentStepIndex?: number | null;
    derivedStatus?: string;
  };
  orgId: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { data: nodeData, isLoading: loadingNodes } = trpc.platformAdmin.getCandidateJourneyNodeStatus.useQuery(
    { sessionId: candidate.sessionId! },
    { enabled: expanded && !!candidate.sessionId }
  );

  const canExpand = !!candidate.sessionId && candidate.visited;

  return (
    <>
      <tr className="border-b border-admin-border transition-colors hover:bg-white/80">
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {canExpand ? (
              <button
                onClick={onToggle}
                className="p-0.5 rounded hover:bg-slate-200 text-admin-muted"
              >
                {expanded ? (
                  <ChevronDownIcon className="h-4 w-4" />
                ) : (
                  <ChevronRightIcon className="h-4 w-4" />
                )}
              </button>
            ) : (
              <span className="w-5" />
            )}
            <Link
              href={`/candidate/${candidate.candidateId}`}
              className="font-medium text-admin-ink hover:text-admin-accent-ink hover:underline"
            >
              {candidate.candidateName || candidate.candidateEmail || 'Unknown'}
            </Link>
          </div>
          {candidate.candidateEmail && (
            <p className="text-xs text-admin-muted ml-7 truncate max-w-[200px]">{candidate.candidateEmail}</p>
          )}
        </td>
        <td className="px-3 py-3 text-center">
          {candidate.emailSent ? (
            <CheckCircleIcon className="h-5 w-5 text-emerald-500 mx-auto" />
          ) : (
            <XCircleIcon className="h-5 w-5 text-admin-border-strong mx-auto" />
          )}
        </td>
        <td className="px-3 py-3 text-center">
          {candidate.hasJobResume ? (
            <span title="Resume attached to this job">
              <CheckCircleIcon className="h-5 w-5 text-emerald-500 mx-auto" />
            </span>
          ) : candidate.hasProfileResume ? (
            <span title="Resume on candidate profile only — not attached to this job">
              <PaperClipIcon className="h-5 w-5 text-amber-500 mx-auto" />
            </span>
          ) : (
            <span title="No resume">
              <XCircleIcon className="h-5 w-5 text-admin-border-strong mx-auto" />
            </span>
          )}
        </td>
        <td className="px-3 py-3 text-center">
          {candidate.visited ? (
            <CheckCircleIcon className="h-5 w-5 text-emerald-500 mx-auto" />
          ) : (
            <XCircleIcon className="h-5 w-5 text-admin-border-strong mx-auto" />
          )}
        </td>
        <td className="px-4 py-3">
          <div className="space-y-0.5">
            {(candidate.videosTotal ?? 0) > 0 ? (
              <p className="text-admin-secondary">
                {candidate.videosRecorded ?? 0} of {candidate.videosTotal} videos recorded
              </p>
            ) : (
              <p className="text-admin-secondary">
                {candidate.nodesDone}/{candidate.nodesTotal} steps
              </p>
            )}
            {candidate.currentStepLabel && candidate.currentStepIndex != null && (
              <p className="text-xs text-admin-muted truncate max-w-[180px]" title={candidate.currentStepLabel}>
                On step {candidate.currentStepIndex}: {candidate.currentStepLabel}
              </p>
            )}
            {!candidate.currentStepLabel && candidate.nodesDone > 0 && candidate.nodesDone >= (candidate.nodesTotal || 1) && (
              <p className="text-xs text-emerald-600">All steps complete</p>
            )}
          </div>
        </td>
        <td className="px-4 py-3">
          <span className="font-mono text-admin-secondary">
            {candidate.aiScoredCount}/{candidate.aiScoredTotal}
          </span>
        </td>
        <td className="px-3 py-3 text-center">
          {candidate.reportComplete ? (
            <CheckCircleIcon className="h-5 w-5 text-emerald-500 mx-auto" />
          ) : (
            <XCircleIcon className="h-5 w-5 text-admin-border-strong mx-auto" />
          )}
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <StatusPill tone={getDerivedStatusTone(resolveStatus(candidate))}>
            {getDerivedStatusLabel(resolveStatus(candidate))}
          </StatusPill>
          {candidate.overallScore != null && (
            <div className="text-xs text-admin-muted mt-0.5">{Math.round(candidate.overallScore)}%</div>
          )}
        </td>
        <td className="w-8" />
      </tr>
      {expanded && candidate.sessionId && (
        <tr className="border-b border-admin-border bg-admin-accent-soft/30">
          <td colSpan={9} className="px-4 py-4">
            <div className="ml-7 border-l-2 border-admin-accent-border pl-4">
              <h4 className="text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-2">Step-level progress</h4>
              {loadingNodes ? (
                <div className="flex items-center gap-2 text-sm text-admin-muted">
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-admin-accent border-t-transparent" />
                  Loading…
                </div>
              ) : nodeData?.nodes?.length ? (
                <div className="flex flex-wrap gap-2">
                  {nodeData.nodes.map((n) => (
                    <div
                      key={n.nodeId}
                      className="inline-flex items-center gap-2 rounded-admin-sm border border-admin-border bg-white px-3 py-1.5 text-sm"
                    >
                      <span className="font-medium text-admin-secondary truncate max-w-[140px]">{n.label || n.nodeType}</span>
                      <span className="text-admin-muted">•</span>
                      {n.submitted ? (
                        <CheckCircleIcon className="h-4 w-4 text-emerald-500 shrink-0" />
                      ) : (
                        <XCircleIcon className="h-4 w-4 text-admin-border-strong shrink-0" />
                      )}
                      <span className="text-xs text-admin-muted">Uploaded</span>
                      {n.status === 'COMPLETED' || n.status === 'COMPLETE' ? (
                        <>
                          <CheckCircleIcon className="h-4 w-4 text-emerald-500 shrink-0" />
                          <span className="text-xs font-medium text-emerald-700">
                            Scored {n.score != null ? `(${Math.round(n.score)})` : ''}
                          </span>
                        </>
                      ) : n.status === 'FAILED' ? (
                        <>
                          <ExclamationTriangleIcon className="h-4 w-4 text-amber-500 shrink-0" />
                          <span className="text-xs text-amber-700">Failed</span>
                          {n.processingError && (
                            <span className="text-xs text-admin-muted truncate max-w-[120px]" title={n.processingError}>
                              {n.processingError}
                            </span>
                          )}
                        </>
                      ) : n.status === 'PROCESSING' ? (
                        <span className="text-xs text-amber-600">Processing…</span>
                      ) : (
                        <span className="text-xs text-admin-muted">Pending</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-admin-muted">No node data</p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function ScoringHealthSection({ orgId }: { orgId: string }) {
  const { data, isLoading } = trpc.platformAdmin.getOrgScoringHealth.useQuery(
    { organizationId: orgId, limit: 50 },
    { enabled: !!orgId }
  );

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-amber-500 border-t-transparent" />
      </div>
    );
  }

  const stuckCount = data?.stuckCount ?? 0;
  const items = data?.items ?? [];

  if (stuckCount === 0) {
    return (
      <div className="m-4 flex items-center gap-3 rounded-admin-sm border border-admin-ok/20 bg-admin-ok-soft p-4 text-emerald-700">
        <CheckCircleIcon className="h-6 w-6 shrink-0" />
        <p className="font-medium">All scoring pipelines healthy</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <StatusPill tone="warn">
          {stuckCount} pipeline item{stuckCount !== 1 ? 's' : ''} need attention
        </StatusPill>
      </div>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {items.map((item) => (
          <div
            key={item.responseId}
            className="flex items-start gap-3 rounded-admin-sm border border-admin-warn/20 bg-admin-warn-soft/40 p-3 transition-colors hover:bg-admin-warn-soft"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-admin-ink">{item.candidateName || item.candidateEmail || 'Unknown'}</span>
                <span className="text-xs text-admin-muted">•</span>
                <span className="text-xs text-admin-secondary">{item.journeyName || 'Hiring flow'}</span>
                <StatusPill
                  tone={item.status === 'FAILED' ? 'danger' : item.status === 'PROCESSING' ? 'warn' : 'neutral'}
                >
                  {item.status}
                </StatusPill>
              </div>
              <p className="text-xs text-admin-muted mt-1">
                Node: {item.nodeType} {item.nodeId ? `(${item.nodeId.slice(0, 8)}…)` : ''}
              </p>
              {item.processingError && (
                <p className="text-xs text-red-600 mt-1 truncate" title={item.processingError}>
                  {item.processingError}
                </p>
              )}
            </div>
            {item.candidateId && (
              <Link
                href={`/candidate/${item.candidateId}`}
                className="shrink-0 text-xs font-medium text-admin-accent-ink hover:underline"
              >
                View →
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function resolveStatus(c: {
  derivedStatus?: string;
  applicationStatus: string;
  visited: boolean;
  emailSent: boolean;
  nodesDone: number;
  nodesTotal: number;
  reportComplete: boolean;
}): string {
  if (c.derivedStatus) return c.derivedStatus;
  if (c.reportComplete) return 'REPORT_COMPLETE';
  if (c.visited && c.nodesDone > 0 && c.nodesDone < c.nodesTotal) return 'IN_INTERVIEW';
  if (c.visited && c.nodesDone === 0) return 'NOT_STARTED';
  if (!c.visited && c.emailSent) return 'INVITED';
  return 'NEW';
}

function getDerivedStatusLabel(status: string): string {
  switch ((status || '').toUpperCase()) {
    case 'REPORT_COMPLETE': return 'Complete';
    case 'STUCK_IN_SCORING': return 'Stuck';
    case 'IN_INTERVIEW': return 'Recording';
    case 'NOT_STARTED': return 'Visited';
    case 'INVITED': return 'Invited';
    case 'NEW': return 'New';
    case 'SCORED':
    case 'COMPLETED': return 'Scored';
    case 'IN_PROGRESS':
    case 'IN_PROG': return 'In Progress';
    case 'REJECTED': return 'Rejected';
    case 'HIRED': return 'Hired';
    default: return status ? String(status) : 'New';
  }
}

function getDerivedStatusTone(status: string): StatusTone {
  switch ((status || '').toUpperCase()) {
    case 'REPORT_COMPLETE':
    case 'SCORED':
    case 'COMPLETED': return 'success';
    case 'STUCK_IN_SCORING': return 'warn';
    case 'IN_INTERVIEW':
    case 'IN_PROGRESS':
    case 'IN_PROG': return 'info';
    case 'NOT_STARTED':
    case 'INVITED': return 'neutral';
    case 'NEW': return 'neutral';
    case 'REJECTED': return 'danger';
    case 'HIRED': return 'brand';
    default: return 'neutral';
  }
}

function getStatusTone(status: string): StatusTone {
  switch (status) {
    case 'ACTIVE': return 'success';
    case 'TRIAL': return 'warn';
    case 'PAST_DUE': return 'warn';
    case 'CANCELED':
    case 'EXPIRED': return 'neutral';
    default: return 'neutral';
  }
}

const INDUSTRY_OPTIONS = [
  'TECHNOLOGY', 'HEALTHCARE', 'FINANCE', 'EDUCATION', 'RETAIL', 'MANUFACTURING',
  'CONSULTING', 'MARKETING', 'SALES', 'HUMAN_RESOURCES', 'LEGAL', 'REAL_ESTATE',
  'HOSPITALITY', 'TRANSPORTATION', 'ENERGY', 'MEDIA', 'NONPROFIT', 'GOVERNMENT', 'OTHER',
] as const;

const SIZE_OPTIONS = [
  { value: 'STARTUP', label: 'Startup (1-10)' },
  { value: 'SMALL', label: 'Small (11-50)' },
  { value: 'MEDIUM', label: 'Medium (51-200)' },
  { value: 'LARGE', label: 'Large (201-1000)' },
  { value: 'ENTERPRISE', label: 'Enterprise (1000+)' },
] as const;

function OrgDetailsSection({
  organizationId,
  organization,
  isArchived,
  onSaved,
}: {
  organizationId: string;
  organization: {
    id: string;
    name: string | null;
    domain: string | null;
    industry: string;
    size: string;
    website?: string | null;
    createdAt: string | Date;
  };
  isArchived: boolean;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(organization.name ?? '');
  const [domain, setDomain] = useState(organization.domain ?? '');
  const [industry, setIndustry] = useState(organization.industry);
  const [size, setSize] = useState(organization.size);
  const [website, setWebsite] = useState(organization.website ?? '');
  const [error, setError] = useState<string | null>(null);

  const updateOrganization = trpc.platformAdmin.updateOrganization.useMutation({
    onSuccess: () => {
      setEditing(false);
      setError(null);
      onSaved();
    },
    onError: (e) => setError(e.message),
  });

  const startEdit = () => {
    setName(organization.name ?? '');
    setDomain(organization.domain ?? '');
    setIndustry(organization.industry);
    setSize(organization.size);
    setWebsite(organization.website ?? '');
    setError(null);
    setEditing(true);
  };

  return (
    <SectionCard
      icon={<Info />}
      title="Details"
      actions={
        !editing && !isArchived && (
          <button type="button" onClick={startEdit} className={buttonClass.small}>
            Edit
          </button>
        )
      }
    >

      {editing ? (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-admin-secondary mb-1">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-admin-secondary mb-1">Domain</label>
            <input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="acme.com"
              className={inputClass}
            />
            <p className="text-xs text-admin-muted mt-1">
              Customer tenant identity (unique among tenants). The platform shell does not count.
              Does not change the public careers slug.
            </p>
            {error && error.toLowerCase().includes('domain') && (
              <p className="text-sm text-red-600 mt-1">{error}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-admin-secondary mb-1">Industry</label>
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className={`${selectClass} w-full`}
            >
              {INDUSTRY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-admin-secondary mb-1">Company size</label>
            <select
              value={size}
              onChange={(e) => setSize(e.target.value)}
              className={`${selectClass} w-full`}
            >
              {SIZE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-admin-secondary mb-1">Website</label>
            <input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://acme.com"
              className={inputClass}
            />
            <p className="text-xs text-admin-muted mt-1">Public marketing URL. Not unique; not the tenant domain.</p>
          </div>
          {error && !error.toLowerCase().includes('domain') && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={() => {
                if (!name.trim()) {
                  setError('Name is required.');
                  return;
                }
                updateOrganization.mutate({
                  organizationId,
                  name: name.trim(),
                  domain: domain.trim() || null,
                  industry: industry as any,
                  size: size as any,
                  website: website.trim() || null,
                });
              }}
              disabled={updateOrganization.isLoading}
              className={buttonClass.primary}
            >
              {updateOrganization.isLoading ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
              className={buttonClass.secondary}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <DetailList
          cols={2}
          items={[
            { label: 'Name', value: <span className="font-medium">{organization.name || '—'}</span> },
            { label: 'Domain', value: <span className="font-medium">{organization.domain || '—'}</span> },
            { label: 'Industry', value: <span className="font-medium">{organization.industry}</span> },
            { label: 'Company Size', value: <span className="font-medium">{organization.size}</span> },
            { label: 'Website', value: <span className="font-medium break-all">{organization.website || '—'}</span> },
            {
              label: 'Created',
              value: <span className="font-medium">{new Date(organization.createdAt).toLocaleDateString()}</span>,
            },
            {
              label: 'Organization ID',
              value: <span className="admin-mono break-all text-xs text-admin-muted">{organization.id}</span>,
            },
          ]}
        />
      )}
    </SectionCard>
  );
}

/**
 * Per-org authoring settings (PR — admin alignment).
 *
 * Mirrors the customer-side toggle at /dashboard/settings/organization
 * so platform support can flip the org's autoGenerateQuestionVideos
 * flag while debugging HeyGen quotas / persona issues.
 */
function OrgAuthoringSettingsSection({
  organizationId,
  settings,
  onSaved,
}: {
  organizationId: string;
  settings: Record<string, unknown> | null;
  onSaved: () => void;
}) {
  const utils = trpc.useUtils();
  const enabled = (settings?.autoGenerateQuestionVideos as boolean | undefined) !== false;

  const setAuthoringSettings = trpc.platformAdmin.setOrgAuthoringSettings.useMutation({
    onSuccess: () => {
      utils.platformAdmin.getOrganization.invalidate({ id: organizationId });
      onSaved();
    },
  });

  return (
    <SectionCard
      icon={<PenSquare />}
      title="Authoring settings"
      description="Same toggles that the org admin sees in their settings, exposed here for support."
    >
      <label className="flex cursor-pointer items-start gap-3 rounded-admin-sm border border-admin-border p-3 hover:bg-admin-bg/70">
        <input
          type="checkbox"
          checked={enabled}
          disabled={setAuthoringSettings.isLoading}
          onChange={(e) => setAuthoringSettings.mutate({
            organizationId,
            autoGenerateQuestionVideos: e.target.checked,
          })}
          className={`${checkboxClass} mt-1`}
        />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-admin-ink">Auto-generate avatar videos on question save</span>
            {setAuthoringSettings.isLoading && <span className="text-xs text-admin-muted">Saving…</span>}
          </div>
          <p className="text-xs text-admin-secondary mt-1">
            When on, saving a video question kicks off AI avatar video rendering automatically.
            Turn off if this org is hitting quota or persona issues.
          </p>
        </div>
      </label>
    </SectionCard>
  );
}

function OrgDashboardSettingsSection({
  organizationId,
  settings,
  onSaved,
}: {
  organizationId: string;
  settings: Record<string, unknown> | null;
  onSaved: () => void;
}) {
  const utils = (trpc as any).useUtils();
  const enabled = settings?.supportChatEnabled === true;

  const setDashboardSettings = (trpc as any).platformAdmin.setOrgDashboardSettings.useMutation({
    onSuccess: () => {
      utils.platformAdmin.getOrganization.invalidate({ id: organizationId });
      onSaved();
    },
  });

  return (
    <SectionCard
      icon={<LayoutDashboard />}
      title="Dashboard settings"
      description="Tenant-specific controls for the recruiter dashboard."
    >
      <label className="flex cursor-pointer items-start gap-3 rounded-admin-sm border border-admin-border p-3 hover:bg-admin-bg/70">
        <input
          type="checkbox"
          checked={enabled}
          disabled={setDashboardSettings.isLoading}
          aria-invalid={Boolean(setDashboardSettings.error)}
          aria-describedby="support-chatbot-help support-chatbot-error"
          onChange={(e) => setDashboardSettings.mutate({
            organizationId,
            supportChatEnabled: e.target.checked,
          })}
          className={`${checkboxClass} mt-1`}
        />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-admin-ink">Support chatbot</span>
            {setDashboardSettings.isLoading && <span className="text-xs text-admin-muted">Saving…</span>}
          </div>
          <p id="support-chatbot-help" className="text-xs text-admin-secondary mt-1">
            Show the support chatbot in this tenant&apos;s recruiter dashboard. Its launcher uses the tenant&apos;s primary brand color.
          </p>
          {setDashboardSettings.error && (
            <p id="support-chatbot-error" role="alert" className="text-xs text-red-600 mt-1">
              {setDashboardSettings.error.message}
            </p>
          )}
        </div>
      </label>
    </SectionCard>
  );
}

function OrgCrmOnlySection({
  organizationId,
  settings,
  onSaved,
}: {
  organizationId: string;
  settings: Record<string, unknown> | null;
  onSaved: () => void;
}) {
  const utils = (trpc as any).useUtils();
  const enabled = settings?.crmOnly === true;

  const setCrmOnly = (trpc as any).platformAdmin.setOrgCrmOnly.useMutation({
    onSuccess: () => {
      utils.platformAdmin.getOrganization.invalidate({ id: organizationId });
      onSaved();
    },
  });

  return (
    <SectionCard
      icon={<Users />}
      title="InsightCRM"
      description="How this tenant manages its people in InsightCRM."
    >
      <label className="flex cursor-pointer items-start gap-3 rounded-admin-sm border border-admin-border p-3 hover:bg-admin-bg/70">
        <input
          type="checkbox"
          checked={enabled}
          disabled={setCrmOnly.isLoading}
          aria-invalid={Boolean(setCrmOnly.error)}
          aria-describedby="crm-only-help crm-only-error"
          onChange={(e) => setCrmOnly.mutate({ organizationId, crmOnly: e.target.checked })}
          className={`${checkboxClass} mt-1`}
        />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-admin-ink">CRM-only organization</span>
            {setCrmOnly.isLoading && <span className="text-xs text-admin-muted">Saving…</span>}
          </div>
          <p id="crm-only-help" className="text-xs text-admin-secondary mt-1">
            Turn on when this company uses InsightCRM but not InsightHire hiring. Their CRM admins then invite,
            change roles and remove people in CRM Settings → Team. Leave off for tenants that use InsightHire;
            they keep managing people in InsightHire.
          </p>
          {setCrmOnly.error && (
            <p id="crm-only-error" role="alert" className="text-xs text-red-600 mt-1">
              {setCrmOnly.error.message}
            </p>
          )}
        </div>
      </label>
    </SectionCard>
  );
}

/**
 * Per-org language settings (platform admin override).
 *
 * Mirrors org admin controls on the customer dashboard so support can
 * configure candidate-facing locales without impersonation.
 */
function OrgI18nSettingsSection({
  organizationId,
  onSaved,
}: {
  organizationId: string;
  onSaved: () => void;
}) {
  const { data, isLoading } = trpc.i18n.getEffectiveForOrganization.useQuery(
    { organizationId },
    { refetchOnWindowFocus: false },
  );
  const { data: platformData } = trpc.i18n.getPlatformConfig.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const [defaultLocale, setDefaultLocale] = useState('en');
  const [enabledLocales, setEnabledLocales] = useState<string[]>(['en']);
  const [languagePicker, setLanguagePicker] = useState(true);

  useEffect(() => {
    if (!data) return;
    setDefaultLocale(data.defaultLocale);
    setEnabledLocales([...data.enabledLocales]);
    setLanguagePicker(data.languagePicker);
  }, [data]);

  const setOrgSettings = trpc.i18n.setOrgSettings.useMutation({
    onSuccess: () => onSaved(),
  });

  const platformLocales =
    platformData?.config.enabledLocales ?? ['en', 'es', 'fr', 'de', 'ja'];

  const toggleLocale = (code: string) => {
    setEnabledLocales((prev) => {
      if (prev.includes(code)) {
        const next = prev.filter((c) => c !== code);
        return next.length > 0 ? next : prev;
      }
      return [...prev, code];
    });
  };

  const handleSave = () => {
    const locales = enabledLocales.length > 0 ? enabledLocales : ['en'];
    const defaultLoc = locales.includes(defaultLocale) ? defaultLocale : locales[0];
    setOrgSettings.mutate({
      organizationId,
      defaultLocale: defaultLoc as 'en' | 'es' | 'fr' | 'de' | 'ja',
      enabledLocales: locales as Array<'en' | 'es' | 'fr' | 'de' | 'ja'>,
      candidateLanguagePicker: languagePicker,
    });
  };

  const LOCALE_LABELS: Record<string, string> = {
    en: 'English',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    ja: 'Japanese',
  };

  if (isLoading) {
    return (
      <SectionCard icon={<Languages />} title="Language settings">
        <p className="text-sm text-admin-muted">Loading…</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      icon={<Languages />}
      title="Language settings"
      description="Candidate-facing locales for this org. Only platform-enabled languages can be selected."
    >
      {!platformData?.config.candidateExperienceEnabled && (
        <p className="mb-4 rounded-admin-sm border border-admin-warn/25 bg-admin-warn-soft px-3 py-2 text-sm text-amber-800">
          Platform candidate translations are currently disabled — UI will stay English.
        </p>
      )}

      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium text-admin-ink mb-2">Enabled languages</p>
          <div className="space-y-2">
            {platformLocales.map((code) => (
              <label
                key={code}
                className="flex cursor-pointer items-center gap-3 rounded-admin-sm border border-admin-border px-3 py-2 hover:bg-admin-bg/70"
              >
                <input
                  type="checkbox"
                  checked={enabledLocales.includes(code)}
                  onChange={() => toggleLocale(code)}
                  className={checkboxClass}
                />
                <span className="text-sm text-admin-ink">{LOCALE_LABELS[code] ?? code}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-admin-ink mb-1">Default for candidates</label>
          <select
            value={enabledLocales.includes(defaultLocale) ? defaultLocale : enabledLocales[0]}
            onChange={(e) => setDefaultLocale(e.target.value)}
            className={`${selectClass} w-full max-w-xs`}
          >
            {enabledLocales.map((code) => (
              <option key={code} value={code}>
                {LOCALE_LABELS[code] ?? code}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={languagePicker}
            onChange={(e) => setLanguagePicker(e.target.checked)}
            className={`${checkboxClass} mt-1`}
          />
          <div>
            <span className="text-sm font-medium text-admin-ink">Show language picker on candidate pages</span>
            <p className="text-xs text-admin-secondary mt-0.5">When off, candidates see the default locale only.</p>
          </div>
        </label>

        <button
          type="button"
          onClick={handleSave}
          disabled={setOrgSettings.isLoading}
          className={buttonClass.primary}
        >
          {setOrgSettings.isLoading ? 'Saving…' : 'Save language settings'}
        </button>
      </div>
    </SectionCard>
  );
}

/**
 * Per-org positions readiness summary.
 *
 * Lists open/draft positions in the org with their PR8 readiness state
 * and concrete blockers, so support can debug "why isn't customer X
 * able to invite candidates" without bouncing into impersonation.
 */
function OrgPositionsReadinessSection({ organizationId }: { organizationId: string }) {
  const { data, isLoading } = trpc.platformAdmin.getOrgPositionsReadiness.useQuery(
    { organizationId, limit: 50 },
    { refetchOnWindowFocus: false },
  );

  if (isLoading) {
    return (
      <SectionCard icon={<ListChecks />} title="Positions readiness">
        <p className="text-sm text-admin-muted">Loading…</p>
      </SectionCard>
    );
  }

  if (!data || data.positions.length === 0) {
    return (
      <SectionCard icon={<ListChecks />} title="Positions readiness">
        <EmptyState
          compact
          className="border-dashed shadow-none"
          icon={<ListChecks />}
          title="No open or draft positions to evaluate."
        />
      </SectionCard>
    );
  }

  const { positions, summary } = data;

  return (
    <SectionCard
      icon={<ListChecks />}
      title="Positions readiness"
      description="Why each open position can or cannot accept candidates."
      actions={
        <>
          <StatusPill tone="success">{summary.ready} ready</StatusPill>
          <StatusPill tone="info">{summary.preparing} preparing</StatusPill>
          <StatusPill tone="warn">{summary.needsSetup} needs setup</StatusPill>
        </>
      }
    >
      <ul className="divide-y divide-admin-border rounded-admin-sm border border-admin-border">
        {positions.map((p: { id: string; title: string; status: string; readiness: { state: string; blockers: Array<{ type: string; label: string }>; preparingCount: number } }) => {
          const stateClass =
            p.readiness.state === 'READY'
              ? 'bg-green-50 text-green-800 ring-green-200'
              : p.readiness.state === 'PREPARING'
                ? 'bg-admin-info-soft text-sky-800 ring-sky-200'
                : 'bg-amber-50 text-amber-900 ring-amber-200';
          return (
            <li key={p.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-admin-ink truncate">{p.title}</p>
                    <span className="text-xs text-admin-muted">{p.status}</span>
                    <span
                      className={
                        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ' + stateClass
                      }
                    >
                      {p.readiness.state === 'READY' && 'Ready'}
                      {p.readiness.state === 'PREPARING' && `Preparing ${p.readiness.preparingCount}`}
                      {p.readiness.state === 'NEEDS_SETUP' && `${p.readiness.blockers.length} blocker${p.readiness.blockers.length === 1 ? '' : 's'}`}
                    </span>
                  </div>
                  {p.readiness.blockers.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5 text-xs text-amber-900">
                      {p.readiness.blockers.slice(0, 4).map((b, idx) => (
                        <li key={`${b.type}-${idx}`} className="flex items-start gap-2">
                          <span aria-hidden className="text-amber-500">•</span>
                          <span>{b.label}</span>
                        </li>
                      ))}
                      {p.readiness.blockers.length > 4 && (
                        <li className="text-admin-muted">…and {p.readiness.blockers.length - 4} more</li>
                      )}
                    </ul>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}

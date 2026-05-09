'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import {
  ArrowLeftIcon,
  BuildingOfficeIcon,
  UsersIcon,
  ChartBarIcon,
  ArrowTopRightOnSquareIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  EnvelopeIcon,
  EyeIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  DocumentChartBarIcon,
  SparklesIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/24/outline';

type DangerModal = 'none' | 'suspend' | 'archive' | 'reactivate' | 'permanent';

export default function OrganizationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { isLoading: authLoading } = useAdminAuth();
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
  const { data: careersSummary } = (trpc as unknown as any).careers.platform.summary.useQuery(
    { organizationId: orgId },
    { enabled: !authLoading },
  );

  const updateSubscription = trpc.platformAdmin.updateSubscription.useMutation({
    onSuccess: () => {
      setEditingSubscription(false);
      refetch();
    },
  });

  const impersonateMutation = trpc.platformAdmin.impersonateOrganization.useMutation({
    onSuccess: (data) => {
      window.open(data.loginUrl, '_blank');
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!data) {
    return <div>Organization not found</div>;
  }

  const { organization, usage } = data;
  const isArchived = Boolean(organization.deletedAt);
  const permanentDeleteConfirmHint =
    (organization.name || organization.domain || '').trim() || '(organization has no name or domain — set one before permanent delete)';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                href="/organizations"
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
              </Link>
              <div className="flex items-center space-x-3">
                <BuildingOfficeIcon className="h-8 w-8 text-blue-600" />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-bold text-gray-900">
                      {organization.name || '(Onboarding Incomplete)'}
                    </h1>
                    {isArchived && (
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-800 text-white uppercase tracking-wide">
                        Archived
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{organization.domain}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3 flex-wrap gap-2 justify-end">
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
                className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 text-gray-800 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                <SparklesIcon className="h-4 w-4 text-amber-500" />
                {backfillOrgDefaultsMutation.isPending ? 'Seeding…' : 'Seed org defaults'}
              </button>
              <button
                type="button"
                onClick={() => impersonateMutation.mutate({ organizationId: orgId })}
                disabled={impersonateMutation.isPending || isArchived}
                title={isArchived ? 'Archived organizations cannot be opened via Login as Admin' : undefined}
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                {impersonateMutation.isPending ? 'Opening...' : 'Login as Admin'}
              </button>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(organization.subscriptionStatus)}`}>
                {organization.subscriptionStatus}
              </span>
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                {organization.subscriptionPlan}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {actionMessage && (
          <div
            className={`rounded-lg px-4 py-3 text-sm ${
              actionMessage.type === 'ok'
                ? 'bg-green-50 border border-green-200 text-green-900'
                : 'bg-red-50 border border-red-200 text-red-900'
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
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Position → Candidates Tracking (full detail) */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200/60 overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-gray-50 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DocumentChartBarIcon className="h-6 w-6 text-indigo-600" />
                    <h2 className="text-lg font-semibold text-gray-900">Position & Candidate Tracking</h2>
                  </div>
                  <Link
                    href={`/organizations/${orgId}/positions`}
                    className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    View All Positions →
                  </Link>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Email sent, visited, steps, AI scoring, report. Status shows where they are (invited, in progress, waiting on processing, or done).
                </p>
              </div>
              <PositionCandidatesTrackingSection orgId={orgId} />
            </div>

            {/* Scoring Health */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200/60 overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <SparklesIcon className="h-6 w-6 text-amber-600" />
                  <h2 className="text-lg font-semibold text-gray-900">Scoring Health</h2>
                </div>
                <p className="text-sm text-gray-500 mt-1">Responses pending, processing, or failed in the AI scoring pipeline</p>
              </div>
              <ScoringHealthSection orgId={orgId} />
            </div>

            {/* Usage Stats */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Usage Statistics</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-blue-600 font-medium">Total Users</p>
                      <p className="text-2xl font-bold text-blue-900">{usage.total_users || 0}</p>
                    </div>
                    <UsersIcon className="h-8 w-8 text-blue-600" />
                  </div>
                </div>

                <div className="bg-green-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-green-600 font-medium">Candidates</p>
                      <p className="text-2xl font-bold text-green-900">{usage.total_candidates || 0}</p>
                    </div>
                    <ChartBarIcon className="h-8 w-8 text-green-600" />
                  </div>
                </div>

                <div className="bg-purple-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-purple-600 font-medium">Assessments</p>
                      <p className="text-2xl font-bold text-purple-900">{usage.total_assessments || 0}</p>
                    </div>
                    <ChartBarIcon className="h-8 w-8 text-purple-600" />
                  </div>
                </div>

                <div className="bg-orange-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-orange-600 font-medium">Hiring Flows</p>
                      <p className="text-2xl font-bold text-orange-900">{usage.total_journeys || 0}</p>
                    </div>
                    <ChartBarIcon className="h-8 w-8 text-orange-600" />
                  </div>
                </div>

                <div className="bg-indigo-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-indigo-600 font-medium">Positions</p>
                      <p className="text-2xl font-bold text-indigo-900">{usage.total_positions || 0}</p>
                    </div>
                    <ChartBarIcon className="h-8 w-8 text-indigo-600" />
                  </div>
                </div>
              </div>

              {usage.avg_journey_score > 0 && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Average hiring flow score</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {Math.round(parseFloat(usage.avg_journey_score))}%
                  </p>
                </div>
              )}
            </div>

            {/* Payment History */}
            {data.paymentHistory && data.paymentHistory.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment History</h2>
                <div className="space-y-3">
                  {data.paymentHistory.map((payment) => (
                    <div key={payment.id} className="flex justify-between items-center py-2 border-b border-gray-100">
                      <div>
                        <p className="font-medium text-gray-900">
                          ${payment.amount.toFixed(2)} {payment.currency.toUpperCase()}
                        </p>
                        <p className="text-sm text-gray-500">
                          {payment.paidAt ? new Date(payment.paidAt).toLocaleDateString() : 'Pending'}
                        </p>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        payment.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {payment.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Subscription History */}
            {data.subscriptionHistory && data.subscriptionHistory.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Subscription Changes</h2>
                <div className="space-y-3">
                  {data.subscriptionHistory.map((change, idx) => (
                    <div key={idx} className="py-2 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900">{change.action}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(change.changedAt).toLocaleString()}
                      </p>
                      {change.details && (
                        <p className="text-xs text-gray-600 mt-1">
                          {JSON.stringify(change.details)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Authoring settings (PR — admin alignment) */}
            <OrgAuthoringSettingsSection
              organizationId={orgId}
              settings={(data.organization.settings as Record<string, unknown> | null) || null}
              onSaved={refetch}
            />

            {/* Per-org positions readiness summary */}
            <OrgPositionsReadinessSection organizationId={orgId} />

            {/* Subscription Management */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Subscription</h2>
                {!editingSubscription && (
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
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Edit
                  </button>
                )}
              </div>

              {editingSubscription ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Subscription Plan
                    </label>
                    <select
                      value={newPlan}
                      onChange={(e) => setNewPlan(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="TRIAL">Trial</option>
                      <option value="STARTER">Starter</option>
                      <option value="PROFESSIONAL">Professional</option>
                      <option value="ENTERPRISE">Enterprise</option>
                      <option value="ENTERPRISE_PLUS">Enterprise Plus</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status
                    </label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="TRIAL">Trial</option>
                      <option value="ACTIVE">Active</option>
                      <option value="PAST_DUE">Past Due</option>
                      <option value="CANCELED">Canceled</option>
                      <option value="EXPIRED">Expired</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Subscription expires (optional)
                    </label>
                    <input
                      type="datetime-local"
                      value={newExpiresAt}
                      onChange={(e) => setNewExpiresAt(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                    <p className="text-xs text-gray-500 mt-1">Leave blank to keep current expiry unchanged when saving.</p>
                  </div>

                  <div className="rounded-lg border border-violet-100 bg-violet-50/50 p-4">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newBillingComped}
                        onChange={(e) => setNewBillingComped(e.target.checked)}
                        className="mt-1 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                      />
                      <span>
                        <span className="block text-sm font-medium text-gray-900">Complimentary (comped) billing</span>
                        <span className="block text-xs text-gray-600 mt-1">
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
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {updateSubscription.isLoading ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                      onClick={() => setEditingSubscription(false)}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Plan</span>
                    <span className="text-sm font-medium text-gray-900">{organization.subscriptionPlan}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Status</span>
                    <span className="text-sm font-medium text-gray-900">{organization.subscriptionStatus}</span>
                  </div>
                  {organization.subscriptionExpiresAt && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Expires</span>
                      <span className="text-sm font-medium text-gray-900">
                        {new Date(organization.subscriptionExpiresAt).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                    <span className="text-sm text-gray-600">Billing</span>
                    {(organization as { billingComped?: boolean }).billingComped ? (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-violet-100 text-violet-900">
                        Comped
                      </span>
                    ) : organization.stripeCustomerId ? (
                      <span className="text-xs font-medium text-indigo-800">Stripe</span>
                    ) : (
                      <span className="text-xs text-gray-500">No Stripe customer</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Organization Info */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Details</h2>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Industry</p>
                  <p className="text-sm font-medium text-gray-900">{organization.industry}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Company Size</p>
                  <p className="text-sm font-medium text-gray-900">{organization.size}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Created</p>
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(organization.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Organization ID</p>
                  <p className="text-xs font-mono text-gray-500">{organization.id}</p>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="space-y-2">
                <Link
                  href={`/organizations/${orgId}/candidates`}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
                >
                  View Candidates ({usage.total_candidates || 0})
                </Link>
                <Link
                  href={`/organizations/${orgId}/positions`}
                  className="block w-full text-left px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 rounded-lg"
                >
                  Candidate AI Forensics →
                </Link>
                <Link
                  href={`/organizations/${orgId}/users`}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
                >
                  Manage Users ({organization._count.users})
                </Link>
                <Link
                  href={`/organizations/${orgId}/assessments`}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
                >
                  View Assessments ({organization._count.assessments})
                </Link>
                <Link
                  href={`/organizations/${orgId}/interviews`}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
                >
                  View Interviews ({organization._count.interview_sessions})
                </Link>
                <Link
                  href={`/organizations/${orgId}/journeys`}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
                >
                  View Journeys ({usage.total_journeys || 0})
                </Link>
                <Link
                  href={`/organizations/${orgId}/personas`}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
                >
                  View AI Avatars
                </Link>

                {/* Culture — 6 entries, always shown (counts will read 0 if
                    the org doesn't have culture configured) so platform ops
                    can see "no culture configured" at-a-glance without
                    clicking in. */}
                <div className="my-2 border-t border-gray-100" />
                <Link
                  href={`/organizations/${orgId}/culture`}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
                >
                  View Culture Profiles ({cultureSummary?.counts.profiles ?? 0})
                </Link>
                <Link
                  href={`/organizations/${orgId}/culture#groups`}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
                >
                  View Culture Groups ({cultureSummary?.counts.groups ?? 0})
                </Link>
                <Link
                  href={`/organizations/${orgId}/culture#quiz-templates`}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
                >
                  View Culture Quiz Templates ({cultureSummary?.counts.quizTemplates ?? 0})
                </Link>
                <Link
                  href={`/organizations/${orgId}/culture#interview-templates`}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
                >
                  View Culture Interview Templates ({cultureSummary?.counts.interviewTemplates ?? 0})
                </Link>
                <Link
                  href={`/organizations/${orgId}/culture#scenarios`}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
                >
                  View Culture Scenarios ({cultureSummary?.counts.scenarios ?? 0})
                </Link>
                <Link
                  href={`/organizations/${orgId}/culture#candidate-signals`}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
                >
                  View Candidate Culture Signals ({cultureSummary?.counts.candidateSignals ?? 0})
                </Link>
                <div className="my-2 border-t border-gray-100" />

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
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
                    title={`Open ${careersSummary.publicUrl} in a new tab`}
                  >
                    Careers Page (Enabled · {careersSummary.publishedPositionCount} listed) ↗
                  </a>
                ) : (
                  <span
                    className="block w-full text-left px-4 py-2 text-sm text-gray-500 rounded-lg cursor-default"
                    title={
                      careersSummary
                        ? 'Org admin has not enabled the public careers page yet.'
                        : 'Loading…'
                    }
                  >
                    Careers Page ({careersSummary ? 'Disabled' : '—'})
                  </span>
                )}
                <div className="my-2 border-t border-gray-100" />

                <Link
                  href={`/audit?org=${orgId}`}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
                >
                  View Audit Logs
                </Link>
                <button type="button" className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg">
                  Export Metadata
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow border border-red-100 p-6">
              <h2 className="text-lg font-semibold text-red-900 mb-1 flex items-center gap-2">
                <ExclamationTriangleIcon className="h-5 w-5 shrink-0" />
                Account control
              </h2>
              <p className="text-xs text-gray-600 mb-4">
                Suspend, archive, reactivate, or permanently delete. All actions are audited.
              </p>
              <div className="space-y-2">
                {!isArchived ? (
                  <>
                    <button
                      type="button"
                      onClick={() => openDangerModal('suspend')}
                      className="w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-50 rounded-lg border border-red-100"
                    >
                      Suspend organization
                    </button>
                    <button
                      type="button"
                      onClick={() => openDangerModal('archive')}
                      className="w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-50 rounded-lg border border-red-100"
                    >
                      Archive (soft-delete)
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => openDangerModal('reactivate')}
                    className="w-full text-left px-4 py-2 text-sm text-green-800 hover:bg-green-50 rounded-lg border border-green-200"
                  >
                    Reactivate organization
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openDangerModal('permanent')}
                  className="w-full text-left px-4 py-2 text-sm font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg"
                >
                  Delete permanently…
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {dangerModal !== 'none' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.target === e.currentTarget && closeDangerModal()}
        >
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6">
            {dangerModal === 'suspend' && (
              <>
                <h3 className="text-lg font-semibold text-gray-900">Suspend organization</h3>
                <p className="text-sm text-gray-600 mt-2">
                  Cancels subscription, deactivates all users, and records an audit entry. The org remains visible unless you archive it.
                </p>
                <label className="block text-sm font-medium text-gray-700 mt-4">Reason (required)</label>
                <textarea
                  value={dangerReason}
                  onChange={(e) => setDangerReason(e.target.value)}
                  rows={3}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="e.g. Chargeback / ToS violation / customer request"
                />
                <div className="flex justify-end gap-2 mt-6">
                  <button type="button" onClick={closeDangerModal} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!dangerReason.trim() || suspendMutation.isPending}
                    onClick={() => suspendMutation.mutate({ organizationId: orgId, reason: dangerReason.trim() })}
                    className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    {suspendMutation.isPending ? 'Suspending…' : 'Suspend'}
                  </button>
                </div>
              </>
            )}
            {dangerModal === 'archive' && (
              <>
                <h3 className="text-lg font-semibold text-gray-900">Archive organization</h3>
                <p className="text-sm text-gray-600 mt-2">
                  Hides the org from the default directory, cancels subscription, and deactivates users. You can reactivate later.
                </p>
                <label className="block text-sm font-medium text-gray-700 mt-4">Reason (required)</label>
                <textarea
                  value={dangerReason}
                  onChange={(e) => setDangerReason(e.target.value)}
                  rows={3}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="e.g. Churned — keep data for 90 days"
                />
                <div className="flex justify-end gap-2 mt-6">
                  <button type="button" onClick={closeDangerModal} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!dangerReason.trim() || archiveMutation.isPending}
                    onClick={() => archiveMutation.mutate({ organizationId: orgId, reason: dangerReason.trim() })}
                    className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    {archiveMutation.isPending ? 'Archiving…' : 'Archive'}
                  </button>
                </div>
              </>
            )}
            {dangerModal === 'reactivate' && (
              <>
                <h3 className="text-lg font-semibold text-gray-900">Reactivate organization</h3>
                <p className="text-sm text-gray-600 mt-2">
                  Clears archive status, sets subscription status, and reactivates users.
                </p>
                <label className="block text-sm font-medium text-gray-700 mt-4">Subscription status after reactivate</label>
                <select
                  value={reactivateAs}
                  onChange={(e) => setReactivateAs(e.target.value as 'ACTIVE' | 'TRIAL')}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="TRIAL">TRIAL</option>
                </select>
                <div className="flex justify-end gap-2 mt-6">
                  <button type="button" onClick={closeDangerModal} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={reactivateMutation.isPending}
                    onClick={() =>
                      reactivateMutation.mutate({ organizationId: orgId, subscriptionStatus: reactivateAs })
                    }
                    className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {reactivateMutation.isPending ? 'Reactivating…' : 'Reactivate'}
                  </button>
                </div>
              </>
            )}
            {dangerModal === 'permanent' && (
              <>
                <h3 className="text-lg font-semibold text-gray-900">Delete organization permanently</h3>
                <p className="text-sm text-gray-600 mt-2">
                  This removes the organization record from the database. This may fail if related data still exists (foreign keys). Type the exact{' '}
                  <strong>organization name</strong>, or if the name is empty, the <strong>domain</strong>, to confirm.
                </p>
                <p className="text-xs font-mono bg-gray-100 rounded px-2 py-1 mt-3 break-all">{permanentDeleteConfirmHint}</p>
                <label className="block text-sm font-medium text-gray-700 mt-4">Confirmation</label>
                <input
                  type="text"
                  value={permanentConfirmName}
                  onChange={(e) => setPermanentConfirmName(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder={permanentDeleteConfirmHint}
                  autoComplete="off"
                />
                <div className="flex justify-end gap-2 mt-6">
                  <button type="button" onClick={closeDangerModal} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
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
                    className="px-4 py-2 text-sm bg-red-800 text-white rounded-lg hover:bg-red-900 disabled:opacity-50"
                  >
                    {permanentDeleteMutation.isPending ? 'Deleting…' : 'Delete permanently'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
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
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!data?.positions?.length) {
    return (
      <div className="p-8 text-center text-gray-500">
        <DocumentChartBarIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
        <p>No positions with hiring flow tracking yet</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {data.positions.map((pos) => {
        const isExpanded = expandedPositions.has(pos.positionId);
        const candidateCount = pos.candidates?.length ?? 0;
        const visitedCount = pos.candidates?.filter(c => c.visited).length ?? 0;
        const reportCompleteCount = pos.candidates?.filter(c => c.reportComplete).length ?? 0;

        return (
          <div key={pos.positionId} className="bg-white">
            <button
              onClick={() => togglePosition(pos.positionId)}
              className="w-full px-6 py-4 flex items-center gap-3 hover:bg-gray-50/80 transition-colors text-left"
            >
              {isExpanded ? (
                <ChevronDownIcon className="h-5 w-5 text-gray-500 shrink-0" />
              ) : (
                <ChevronRightIcon className="h-5 w-5 text-gray-500 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 truncate">{pos.positionTitle}</h3>
                <p className="text-sm text-gray-500">{pos.journeyName}</p>
              </div>
              <div className="flex items-center gap-6 shrink-0">
                <span className="text-sm text-gray-600">
                  <span className="font-medium text-gray-900">{candidateCount}</span> candidates
                </span>
                <span className="text-sm text-emerald-600">
                  <span className="font-medium">{visitedCount}</span> visited
                </span>
                <span className="text-sm text-indigo-600">
                  <span className="font-medium">{reportCompleteCount}</span> reports
                </span>
              </div>
            </button>

            {isExpanded && (
              <div className="border-t border-gray-100 bg-gray-50/50">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-100/80">
                        <th className="px-4 py-3 text-left font-semibold text-gray-600">Candidate</th>
                        <th className="px-3 py-3 text-center font-semibold text-gray-600" title="Email sent">
                          <EnvelopeIcon className="h-4 w-4 inline-block" />
                        </th>
                        <th className="px-3 py-3 text-center font-semibold text-gray-600" title="Visited">
                          <EyeIcon className="h-4 w-4 inline-block" />
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-600">Step</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-600">AI Scored</th>
                        <th className="px-3 py-3 text-center font-semibold text-gray-600" title="Report complete">
                          <DocumentChartBarIcon className="h-4 w-4 inline-block" />
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-600">
                          <span className="inline-flex items-center gap-1">
                            Status
                            <span title="Report Complete = all done, report ready · In Interview = recording videos · Stuck in Scoring = AI scoring pending/failed · Invited = email sent, waiting for visit · Not invited = not sent yet" className="text-gray-400 cursor-help">
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
      <tr className="border-b border-gray-100 hover:bg-white/80 transition-colors">
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {canExpand ? (
              <button
                onClick={onToggle}
                className="p-0.5 rounded hover:bg-gray-200 text-gray-500"
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
              className="font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
            >
              {candidate.candidateName || candidate.candidateEmail || 'Unknown'}
            </Link>
          </div>
          {candidate.candidateEmail && (
            <p className="text-xs text-gray-500 ml-7 truncate max-w-[200px]">{candidate.candidateEmail}</p>
          )}
        </td>
        <td className="px-3 py-3 text-center">
          {candidate.emailSent ? (
            <CheckCircleIcon className="h-5 w-5 text-emerald-500 mx-auto" />
          ) : (
            <XCircleIcon className="h-5 w-5 text-gray-300 mx-auto" />
          )}
        </td>
        <td className="px-3 py-3 text-center">
          {candidate.visited ? (
            <CheckCircleIcon className="h-5 w-5 text-emerald-500 mx-auto" />
          ) : (
            <XCircleIcon className="h-5 w-5 text-gray-300 mx-auto" />
          )}
        </td>
        <td className="px-4 py-3">
          <div className="space-y-0.5">
            {(candidate.videosTotal ?? 0) > 0 ? (
              <p className="text-gray-700">
                {candidate.videosRecorded ?? 0} of {candidate.videosTotal} videos recorded
              </p>
            ) : (
              <p className="text-gray-700">
                {candidate.nodesDone}/{candidate.nodesTotal} steps
              </p>
            )}
            {candidate.currentStepLabel && candidate.currentStepIndex != null && (
              <p className="text-xs text-gray-500 truncate max-w-[180px]" title={candidate.currentStepLabel}>
                On step {candidate.currentStepIndex}: {candidate.currentStepLabel}
              </p>
            )}
            {!candidate.currentStepLabel && candidate.nodesDone > 0 && candidate.nodesDone >= (candidate.nodesTotal || 1) && (
              <p className="text-xs text-emerald-600">All steps complete</p>
            )}
          </div>
        </td>
        <td className="px-4 py-3">
          <span className="font-mono text-gray-700">
            {candidate.aiScoredCount}/{candidate.aiScoredTotal}
          </span>
        </td>
        <td className="px-3 py-3 text-center">
          {candidate.reportComplete ? (
            <CheckCircleIcon className="h-5 w-5 text-emerald-500 mx-auto" />
          ) : (
            <XCircleIcon className="h-5 w-5 text-gray-300 mx-auto" />
          )}
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getDerivedStatusBadge(resolveStatus(candidate))}`}>
            {getDerivedStatusLabel(resolveStatus(candidate))}
          </span>
          {candidate.overallScore != null && (
            <div className="text-xs text-gray-500 mt-0.5">{Math.round(candidate.overallScore)}%</div>
          )}
        </td>
        <td className="w-8" />
      </tr>
      {expanded && candidate.sessionId && (
        <tr className="bg-indigo-50/30 border-b border-gray-100">
          <td colSpan={8} className="px-4 py-4">
            <div className="ml-7 pl-4 border-l-2 border-indigo-200">
              <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Step-level progress</h4>
              {loadingNodes ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <div className="animate-spin rounded-full h-3 w-3 border-2 border-indigo-500 border-t-transparent" />
                  Loading…
                </div>
              ) : nodeData?.nodes?.length ? (
                <div className="flex flex-wrap gap-2">
                  {nodeData.nodes.map((n) => (
                    <div
                      key={n.nodeId}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-sm"
                    >
                      <span className="font-medium text-gray-700 truncate max-w-[140px]">{n.label || n.nodeType}</span>
                      <span className="text-gray-400">•</span>
                      {n.submitted ? (
                        <CheckCircleIcon className="h-4 w-4 text-emerald-500 shrink-0" />
                      ) : (
                        <XCircleIcon className="h-4 w-4 text-gray-300 shrink-0" />
                      )}
                      <span className="text-xs text-gray-500">Uploaded</span>
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
                            <span className="text-xs text-gray-500 truncate max-w-[120px]" title={n.processingError}>
                              {n.processingError}
                            </span>
                          )}
                        </>
                      ) : n.status === 'PROCESSING' ? (
                        <span className="text-xs text-amber-600">Processing…</span>
                      ) : (
                        <span className="text-xs text-gray-400">Pending</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No node data</p>
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
      <div className="p-6 flex items-center gap-3 text-emerald-600 bg-emerald-50/50 rounded-lg mx-4 mb-4">
        <CheckCircleIcon className="h-6 w-6 shrink-0" />
        <p className="font-medium">All scoring pipelines healthy</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-sm font-medium">
          <ExclamationTriangleIcon className="h-4 w-4" />
          {stuckCount} pipeline item{stuckCount !== 1 ? 's' : ''} need attention
        </span>
      </div>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {items.map((item) => (
          <div
            key={item.responseId}
            className="flex items-start gap-3 p-3 rounded-lg border border-amber-200/60 bg-amber-50/30 hover:bg-amber-50/50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-gray-900">{item.candidateName || item.candidateEmail || 'Unknown'}</span>
                <span className="text-xs text-gray-500">•</span>
                <span className="text-xs text-gray-600">{item.journeyName || 'Hiring flow'}</span>
                <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                  item.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                  item.status === 'PROCESSING' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'
                }`}>
                  {item.status}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
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
                className="shrink-0 text-xs font-medium text-indigo-600 hover:text-indigo-700"
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

function getDerivedStatusBadge(status: string) {
  switch ((status || '').toUpperCase()) {
    case 'REPORT_COMPLETE':
    case 'SCORED':
    case 'COMPLETED': return 'bg-emerald-100 text-emerald-800';
    case 'STUCK_IN_SCORING': return 'bg-amber-100 text-amber-800';
    case 'IN_INTERVIEW':
    case 'IN_PROGRESS':
    case 'IN_PROG': return 'bg-blue-100 text-blue-800';
    case 'NOT_STARTED':
    case 'INVITED': return 'bg-gray-100 text-gray-700';
    case 'NEW': return 'bg-slate-100 text-slate-600';
    case 'REJECTED': return 'bg-red-100 text-red-800';
    case 'HIRED': return 'bg-purple-100 text-purple-800';
    default: return 'bg-gray-100 text-gray-700';
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case 'ACTIVE': return 'bg-green-100 text-green-800';
    case 'TRIAL': return 'bg-yellow-100 text-yellow-800';
    case 'PAST_DUE': return 'bg-orange-100 text-orange-800';
    case 'CANCELED':
    case 'EXPIRED': return 'bg-gray-100 text-gray-800';
    default: return 'bg-gray-100 text-gray-800';
  }
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
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Authoring settings</h2>
      <p className="text-sm text-gray-500 mb-4">
        Same toggles that the org admin sees in their settings, exposed here for support.
      </p>
      <label className="flex items-start gap-3 cursor-pointer rounded-md border border-gray-200 p-3 hover:bg-gray-50">
        <input
          type="checkbox"
          checked={enabled}
          disabled={setAuthoringSettings.isLoading}
          onChange={(e) => setAuthoringSettings.mutate({
            organizationId,
            autoGenerateQuestionVideos: e.target.checked,
          })}
          className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">Auto-generate avatar videos on question save</span>
            {setAuthoringSettings.isLoading && <span className="text-xs text-gray-500">Saving…</span>}
          </div>
          <p className="text-xs text-gray-600 mt-1">
            When on, saving a video question kicks off HeyGen+ElevenLabs rendering automatically.
            Turn off if this org is hitting quota or persona issues.
          </p>
        </div>
      </label>
    </div>
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
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Positions readiness</h2>
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    );
  }

  if (!data || data.positions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Positions readiness</h2>
        <p className="text-sm text-gray-500">No open or draft positions to evaluate.</p>
      </div>
    );
  }

  const { positions, summary } = data;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Positions readiness</h2>
          <p className="text-sm text-gray-500">
            Why each open position can or cannot accept candidates.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2 py-1 rounded-full bg-green-100 text-green-800">
            {summary.ready} ready
          </span>
          <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-800">
            {summary.preparing} preparing
          </span>
          <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-900">
            {summary.needsSetup} needs setup
          </span>
        </div>
      </div>

      <ul className="divide-y divide-gray-100 border border-gray-200 rounded-md">
        {positions.map((p: { id: string; title: string; status: string; readiness: { state: string; blockers: Array<{ type: string; label: string }>; preparingCount: number } }) => {
          const stateClass =
            p.readiness.state === 'READY'
              ? 'bg-green-50 text-green-800 ring-green-200'
              : p.readiness.state === 'PREPARING'
                ? 'bg-blue-50 text-blue-800 ring-blue-200'
                : 'bg-amber-50 text-amber-900 ring-amber-200';
          return (
            <li key={p.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900 truncate">{p.title}</p>
                    <span className="text-xs text-gray-500">{p.status}</span>
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
                        <li className="text-gray-500">…and {p.readiness.blockers.length - 4} more</li>
                      )}
                    </ul>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

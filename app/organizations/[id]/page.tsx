'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
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

export default function OrganizationDetailPage() {
  const params = useParams();
  const { isLoading: authLoading } = useAdminAuth();
  const orgId = params.id as string;

  const [editingSubscription, setEditingSubscription] = useState(false);
  const [newPlan, setNewPlan] = useState('');
  const [newStatus, setNewStatus] = useState('');

  const { data, isLoading, refetch } = trpc.platformAdmin.getOrganization.useQuery({ id: orgId }, {
    enabled: !authLoading,
  });

  const updateSubscription = trpc.platformAdmin.updateSubscription.useMutation({
    onSuccess: () => {
      setEditingSubscription(false);
      refetch();
    },
  });

  const impersonateMutation = trpc.platformAdmin.impersonateOrganization.useMutation({
    onSuccess: (data) => {
      // Open the login URL in a new tab
      window.open(data.loginUrl, '_blank');
    },
  });

  const handleUpdateSubscription = async () => {
    if (!newPlan || !newStatus) return;

    await updateSubscription.mutateAsync({
      organizationId: orgId,
      plan: newPlan as any,
      status: newStatus as any,
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
                  <h1 className="text-2xl font-bold text-gray-900">
                    {organization.name || '(Onboarding Incomplete)'}
                  </h1>
                  <p className="text-sm text-gray-600">{organization.domain}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => impersonateMutation.mutate({ organizationId: orgId })}
                disabled={impersonateMutation.isPending}
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                  Email sent, visited, steps, AI scoring, report. Status: where they are in the journey (invited, recording, stuck, or done).
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
                <p className="text-sm text-gray-500 mt-1">Stuck or failed AI scoring items</p>
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
                      <p className="text-sm text-orange-600 font-medium">Journeys</p>
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
                  <p className="text-sm text-gray-600">Average Journey Score</p>
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
                <Link
                  href={`/audit?org=${orgId}`}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
                >
                  View Audit Logs
                </Link>
                <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg">
                  Export Metadata
                </button>
                <button
                  onClick={() => {
                    const reason = prompt('Reason for suspension:');
                    if (reason) {
                      // TODO: Call suspend mutation
                      alert('Organization suspended');
                    }
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                >
                  Suspend Organization
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
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
        <p>No positions with journey tracking yet</p>
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
        <td className="px-4 py-3">
          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getDerivedStatusBadge(resolveStatus(candidate))}`}>
            {getDerivedStatusLabel(resolveStatus(candidate))}
          </span>
          {candidate.overallScore != null && (
            <span className="ml-2 text-xs text-gray-500">Score: {Math.round(candidate.overallScore)}</span>
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
          {stuckCount} stuck item{stuckCount !== 1 ? 's' : ''}
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
                <span className="text-xs text-gray-600">{item.journeyName || 'Journey'}</span>
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
    case 'REPORT_COMPLETE': return 'Report ready';
    case 'STUCK_IN_SCORING': return 'Stuck in scoring';
    case 'IN_INTERVIEW': return 'Recording videos';
    case 'NOT_STARTED': return 'Opened link, not started';
    case 'INVITED': return 'Invited, awaiting visit';
    case 'NEW': return 'Not invited yet';
    case 'SCORED':
    case 'COMPLETED': return 'Scored';
    case 'IN_PROGRESS':
    case 'IN_PROG': return 'In progress';
    case 'REJECTED': return 'Rejected';
    case 'HIRED': return 'Hired';
    default: return status ? String(status) : 'Not invited yet';
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

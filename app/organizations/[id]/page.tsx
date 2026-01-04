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
  CreditCardIcon,
  ClockIcon,
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
            <div className="flex items-center space-x-2">
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
            {/* Positions Overview */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Positions</h2>
                <Link
                  href={`/organizations/${orgId}/positions`}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  View All →
                </Link>
              </div>
              <PositionsSection orgId={orgId} />
            </div>

            {/* Journey Progress */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Active Journeys</h2>
                <Link
                  href={`/organizations/${orgId}/journeys`}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  View All →
                </Link>
              </div>
              <JourneyProgressSection orgId={orgId} />
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

function PositionsSection({ orgId }: { orgId: string }) {
  const { data } = trpc.platformAdmin.getOrganizationPositions.useQuery({
    organizationId: orgId,
    limit: 5
  });

  if (!data || data.positions.length === 0) {
    return <p className="text-sm text-gray-500">No positions created yet</p>;
  }

  return (
    <div className="space-y-3">
      {data.positions.map((position: any) => (
        <div key={position.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="font-medium text-gray-900">{position.title}</h3>
              <p className="text-sm text-gray-500">{position.department} • {position.location}</p>
              <div className="mt-2 flex items-center space-x-4">
                <span className={`px-2 py-1 text-xs rounded-full ${
                  position.status === 'OPEN' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {position.status}
                </span>
                {position.targetHires && (
                  <span className="text-xs text-gray-600">
                    Target: {position.currentHires || 0}/{position.targetHires} hires
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-6 text-sm">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{position._count.candidate_profiles}</p>
                <p className="text-xs text-gray-500">Candidates</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{position._count.applications}</p>
                <p className="text-xs text-gray-500">Applications</p>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function JourneyProgressSection({ orgId }: { orgId: string }) {
  // Query for journey sessions with progress data
  const { data } = trpc.platformAdmin.getOrganizationJourneySessions.useQuery({
    organizationId: orgId,
    limit: 5,
    status: 'IN_PROGRESS'
  }, {
    retry: false
  });

  if (!data || !data.sessions || data.sessions.length === 0) {
    return <p className="text-sm text-gray-500">No active journeys</p>;
  }

  return (
    <div className="space-y-3">
      {data.sessions.map((session: any) => (
        <Link
          key={session.id}
          href={`/candidate/${session.candidateId}`}
          className="block border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:bg-blue-50/50 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="font-medium text-gray-900 hover:text-blue-600">{session.candidateName}</h3>
              <p className="text-sm text-gray-500">{session.journeyName || session.positionTitle}</p>
            </div>
            <span className="text-sm font-semibold text-blue-600">
              {Math.round(parseFloat(session.completionPercentage || 0))}% Complete
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${Math.min(100, Math.max(0, parseFloat(session.completionPercentage || '0')))}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Started {new Date(session.startedAt).toLocaleDateString()}
          </p>
        </Link>
      ))}
    </div>
  );
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

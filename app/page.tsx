'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import {
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  BuildingOfficeIcon,
  UsersIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  ClockIcon,
  CreditCardIcon,
} from '@heroicons/react/24/outline';

export default function DashboardPage() {
  const router = useRouter();
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    const adminToken = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    if (!adminToken) {
      router.push('/login');
    } else {
      setIsAuthed(true);
    }
  }, [router]);

  // Fetch health summary
  const { data: healthData, isLoading } = trpc.platformAdmin.getJourneyHealthSummary.useQuery(
    undefined,
    { enabled: isAuthed, refetchInterval: 30000 }
  );

  // Fetch stuck candidates for preview
  const { data: stuckData } = trpc.platformAdmin.getStuckCandidates.useQuery(
    { stuckType: 'all', limit: 5 },
    { enabled: isAuthed, refetchInterval: 30000 }
  );

  if (!isAuthed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const alerts = healthData?.alerts || { critical: 0, warning: 0, info: 0, total: 0 };
  const hasIssues = alerts.total > 0;

  return (
    <AuthenticatedLayout>
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Platform Dashboard</h1>
        <p className="text-gray-600 mt-1">Monitor candidate journeys and system health</p>
      </div>

      {/* CRITICAL ALERT BANNER - Only shows when there are stuck candidates */}
      {hasIssues && (
        <Link href="/stuck-candidates">
          <div className={`mb-8 rounded-xl p-6 cursor-pointer transition-all hover:scale-[1.01] ${
            alerts.critical > 0 
              ? 'bg-gradient-to-r from-red-600 to-red-700 shadow-lg shadow-red-200' 
              : alerts.warning > 0
              ? 'bg-gradient-to-r from-yellow-500 to-orange-500 shadow-lg shadow-yellow-200'
              : 'bg-gradient-to-r from-blue-500 to-blue-600 shadow-lg shadow-blue-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                {alerts.critical > 0 ? (
                  <div className="p-3 bg-white/20 rounded-full">
                    <ExclamationCircleIcon className="h-8 w-8 text-white" />
                  </div>
                ) : (
                  <div className="p-3 bg-white/20 rounded-full">
                    <ExclamationTriangleIcon className="h-8 w-8 text-white" />
                  </div>
                )}
                <div className="text-white">
                  <h2 className="text-xl font-bold">
                    {alerts.critical > 0 && `${alerts.critical} Critical Issue${alerts.critical !== 1 ? 's' : ''}`}
                    {alerts.critical === 0 && alerts.warning > 0 && `${alerts.warning} Candidate${alerts.warning !== 1 ? 's' : ''} Need Attention`}
                    {alerts.critical === 0 && alerts.warning === 0 && `${alerts.info} Pending Job${alerts.info !== 1 ? 's' : ''}`}
                  </h2>
                  <p className="text-white/80 mt-1">
                    {alerts.critical > 0 && 'Candidates have failed AI processing - requires immediate attention'}
                    {alerts.critical === 0 && alerts.warning > 0 && 'Candidates inactive for 24+ hours in their journey'}
                    {alerts.critical === 0 && alerts.warning === 0 && 'Jobs pending for over 1 hour'}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2 text-white font-medium">
                <span>View Details</span>
                <ArrowRightIcon className="h-5 w-5" />
              </div>
            </div>
          </div>
        </Link>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Active Journeys</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {isLoading ? '...' : healthData?.activeSessions || 0}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <UsersIcon className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Completed (24h)</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {isLoading ? '...' : healthData?.completedLast24h || 0}
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <CheckCircleIcon className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className={`rounded-xl shadow-sm border p-6 ${
          alerts.critical > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Failed Processing</p>
              <p className={`text-3xl font-bold mt-1 ${alerts.critical > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                {isLoading ? '...' : (healthData?.metrics?.failedInterviewResponses || 0) + (healthData?.metrics?.failedAssessmentResponses || 0)}
              </p>
            </div>
            <div className={`p-3 rounded-full ${alerts.critical > 0 ? 'bg-red-200' : 'bg-gray-100'}`}>
              <ExclamationCircleIcon className={`h-6 w-6 ${alerts.critical > 0 ? 'text-red-600' : 'text-gray-400'}`} />
            </div>
          </div>
        </div>

        <div className={`rounded-xl shadow-sm border p-6 ${
          alerts.warning > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Inactive (24h+)</p>
              <p className={`text-3xl font-bold mt-1 ${alerts.warning > 0 ? 'text-yellow-600' : 'text-gray-900'}`}>
                {isLoading ? '...' : healthData?.metrics?.inactiveCandidates || 0}
              </p>
            </div>
            <div className={`p-3 rounded-full ${alerts.warning > 0 ? 'bg-yellow-200' : 'bg-gray-100'}`}>
              <ClockIcon className={`h-6 w-6 ${alerts.warning > 0 ? 'text-yellow-600' : 'text-gray-400'}`} />
            </div>
          </div>
        </div>
      </div>

      {/* Stuck Candidates Preview */}
      {stuckData && stuckData.candidates.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Stuck Candidates</h2>
              <p className="text-sm text-gray-500">Candidates requiring attention</p>
            </div>
            <Link 
              href="/stuck-candidates"
              className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center space-x-1"
            >
              <span>View All ({stuckData.total})</span>
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {stuckData.candidates.slice(0, 5).map((candidate: any) => (
              <Link 
                key={candidate.id} 
                href={`/candidate/${candidate.candidateId}`}
                className="px-6 py-4 flex items-center justify-between hover:bg-blue-50 cursor-pointer transition-colors block"
              >
                <div className="flex items-center space-x-4">
                  <div className={`p-2 rounded-full ${
                    candidate.stuckReason === 'failed_processing' ? 'bg-red-100' :
                    candidate.stuckReason === 'inactive_24h' ? 'bg-yellow-100' : 'bg-orange-100'
                  }`}>
                    {candidate.stuckReason === 'failed_processing' ? (
                      <ExclamationCircleIcon className="h-5 w-5 text-red-600" />
                    ) : (
                      <ClockIcon className="h-5 w-5 text-yellow-600" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-blue-600">{candidate.candidateName}</p>
                    <p className="text-sm text-gray-500">
                      {candidate.journeyName} • {candidate.organizationName}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    candidate.stuckReason === 'failed_processing' ? 'bg-red-100 text-red-700' :
                    candidate.stuckReason === 'inactive_24h' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-orange-100 text-orange-700'
                  }`}>
                    {candidate.stuckReason === 'failed_processing' ? 'Failed' :
                     candidate.stuckReason === 'inactive_24h' ? 'Inactive 24h+' : 'Pending'}
                  </span>
                  <p className="text-xs text-gray-500 mt-1">{candidate.completionPercentage}% complete</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/organizations" className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-blue-100 rounded-full">
              <BuildingOfficeIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Organizations</h3>
              <p className="text-sm text-gray-500">Manage all organizations</p>
            </div>
          </div>
        </Link>

        <Link href="/background-jobs" className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-purple-100 rounded-full">
              <ClockIcon className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Background Jobs</h3>
              <p className="text-sm text-gray-500">Monitor job queues</p>
            </div>
          </div>
        </Link>

        <Link href="/settings/admins" className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-violet-100 rounded-full">
              <UsersIcon className="h-6 w-6 text-violet-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Admin Users</h3>
              <p className="text-sm text-gray-500">Invite and manage platform admins</p>
            </div>
          </div>
        </Link>

        <Link href="/billing" className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-indigo-100 rounded-full">
              <CreditCardIcon className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Billing</h3>
              <p className="text-sm text-gray-500">Subscriptions, collections, Stripe</p>
            </div>
          </div>
        </Link>

        <Link href="/stuck-candidates" className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center space-x-4">
            <div className={`p-3 rounded-full ${hasIssues ? 'bg-red-100' : 'bg-green-100'}`}>
              {hasIssues ? (
                <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
              ) : (
                <CheckCircleIcon className="h-6 w-6 text-green-600" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Stuck Candidates</h3>
              <p className="text-sm text-gray-500">
                {hasIssues ? `${alerts.total} issue${alerts.total !== 1 ? 's' : ''} found` : 'All clear'}
              </p>
            </div>
          </div>
        </Link>
      </div>
    </div>
    </AuthenticatedLayout>
  );
}

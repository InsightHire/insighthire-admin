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
  ArrowTrendingUpIcon,
  EyeIcon,
  MapPinIcon,
  CpuChipIcon,
} from '@heroicons/react/24/outline';

function attentionReasonLabel(reason: string): { label: string; className: string } {
  switch (reason) {
    case 'failed_processing':
      return { label: 'Technical — failed step', className: 'bg-red-100 text-red-800' };
    case 'stuck_at_gate':
      return { label: 'Technical — scoring gate', className: 'bg-purple-100 text-purple-800' };
    case 'inactive_24h':
      return { label: 'Engagement — quiet 24h+', className: 'bg-slate-100 text-slate-800' };
    case 'pending_too_long':
      return { label: 'Pipeline — queue delay', className: 'bg-amber-100 text-amber-900' };
    default:
      return { label: reason, className: 'bg-gray-100 text-gray-800' };
  }
}

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

  const { data: healthData, isLoading } = trpc.platformAdmin.getJourneyHealthSummary.useQuery(
    undefined,
    { enabled: isAuthed, refetchInterval: 30000 }
  );

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
  const analytics = healthData?.analytics;
  const techBreakdown = healthData?.technicalSessionBreakdown;
  const hasIssues = alerts.total > 0;

  const failedResponses =
    (healthData?.metrics?.failedInterviewResponses || 0) + (healthData?.metrics?.failedAssessmentResponses || 0);

  return (
    <AuthenticatedLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Platform Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Hiring flow funnel, pipeline health, and sessions that need a second look—technical issues vs. normal candidate
            drop-off.
          </p>
        </div>

        {/* Ops alert banner — matches API semantics (not “stuck” for quiet candidates) */}
        {hasIssues && (
          <Link href="/stuck-candidates">
            <div
              className={`mb-8 rounded-xl p-6 cursor-pointer transition-all hover:scale-[1.01] ${
                alerts.critical > 0
                  ? 'bg-gradient-to-r from-red-600 to-red-700 shadow-lg shadow-red-200'
                  : alerts.warning > 0
                    ? 'bg-gradient-to-r from-amber-500 to-orange-600 shadow-lg shadow-amber-200'
                    : 'bg-gradient-to-r from-blue-500 to-indigo-600 shadow-lg shadow-blue-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-white/20 rounded-full">
                    {alerts.critical > 0 ? (
                      <ExclamationCircleIcon className="h-8 w-8 text-white" />
                    ) : (
                      <ExclamationTriangleIcon className="h-8 w-8 text-white" />
                    )}
                  </div>
                  <div className="text-white">
                    <h2 className="text-xl font-bold">
                      {alerts.critical > 0 &&
                        `${alerts.critical} session${alerts.critical !== 1 ? 's' : ''} with failed or stuck processing`}
                      {alerts.critical === 0 &&
                        alerts.warning > 0 &&
                        `${alerts.warning} location anomaly record${alerts.warning !== 1 ? 's' : ''} (7 days)`}
                      {alerts.critical === 0 &&
                        alerts.warning === 0 &&
                        alerts.info > 0 &&
                        `${alerts.info} session${alerts.info !== 1 ? 's' : ''} in the processing queue over 1 hour`}
                    </h2>
                    <p className="text-white/90 mt-1 text-sm max-w-2xl">
                      {alerts.critical > 0 &&
                        'Transcription, AI scoring, or related jobs failed—retry or inspect the pipeline. This is different from candidates who simply have not returned yet.'}
                      {alerts.critical === 0 &&
                        alerts.warning > 0 &&
                        'IP / geo jumps on hiring flow links—worth reviewing for fraud or shared links. Open Hiring flow attention for details.'}
                      {alerts.critical === 0 &&
                        alerts.warning === 0 &&
                        alerts.info > 0 &&
                        'Uploaded video is waiting too long in PENDING—check workers, queues, and external APIs.'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 text-white font-medium shrink-0">
                  <span>Open hiring flow attention</span>
                  <ArrowRightIcon className="h-5 w-5" />
                </div>
              </div>
            </div>
          </Link>
        )}

        {/* Funnel & activity */}
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Hiring flow activity</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">In progress</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {isLoading ? '…' : healthData?.activeSessions ?? 0}
                </p>
                <p className="text-xs text-gray-500 mt-1">Active hiring flow sessions now</p>
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
                  {isLoading ? '…' : healthData?.completedLast24h ?? 0}
                </p>
                <p className="text-xs text-gray-500 mt-1">Finished hiring flows</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <CheckCircleIcon className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Started (24h)</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {isLoading ? '…' : analytics?.sessionsStartedLast24h ?? '—'}
                </p>
                <p className="text-xs text-gray-500 mt-1">New sessions (volume)</p>
              </div>
              <div className="p-3 bg-cyan-100 rounded-full">
                <ArrowTrendingUpIcon className="h-6 w-6 text-cyan-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Awaiting review</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {isLoading ? '…' : analytics?.sessionsAwaitingReview ?? '—'}
                </p>
                <p className="text-xs text-gray-500 mt-1">Status: awaiting review</p>
              </div>
              <div className="p-3 bg-violet-100 rounded-full">
                <EyeIcon className="h-6 w-6 text-violet-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Pipeline & attention (what ops should care about) */}
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Pipeline & attention</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div
            className={`rounded-xl shadow-sm border p-6 ${
              alerts.critical > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Technical — sessions</p>
                <p className={`text-3xl font-bold mt-1 ${alerts.critical > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                  {isLoading ? '…' : techBreakdown?.combinedUniqueSessions ?? alerts.critical}
                </p>
                <p className="text-xs text-gray-600 mt-2">
                  Failed responses:{' '}
                  <span className="font-medium text-gray-900">{techBreakdown?.failedResponses ?? '—'}</span>
                  <span className="mx-1 text-gray-400">·</span>
                  Stuck in processing:{' '}
                  <span className="font-medium text-gray-900">{techBreakdown?.stuckProcessing ?? '—'}</span>
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Response-level failures logged: <span className="font-mono">{failedResponses}</span>
                </p>
              </div>
              <div className={`p-3 rounded-full ${alerts.critical > 0 ? 'bg-red-200' : 'bg-gray-100'}`}>
                <CpuChipIcon className={`h-6 w-6 ${alerts.critical > 0 ? 'text-red-600' : 'text-gray-400'}`} />
              </div>
            </div>
          </div>

          <div
            className={`rounded-xl shadow-sm border p-6 ${
              alerts.info > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Queue — slow jobs</p>
                <p className={`text-3xl font-bold mt-1 ${alerts.info > 0 ? 'text-amber-800' : 'text-gray-900'}`}>
                  {isLoading ? '…' : healthData?.metrics?.pendingTooLong ?? 0}
                </p>
                <p className="text-xs text-gray-500 mt-1">Sessions with video pending &gt;1h</p>
              </div>
              <div className={`p-3 rounded-full ${alerts.info > 0 ? 'bg-amber-200' : 'bg-gray-100'}`}>
                <ClockIcon className={`h-6 w-6 ${alerts.info > 0 ? 'text-amber-700' : 'text-gray-400'}`} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Engagement — quiet 24h+</p>
                <p className="text-3xl font-bold text-slate-800 mt-1">
                  {isLoading ? '…' : analytics?.lowEngagementSessions24h ?? healthData?.metrics?.inactiveCandidates ?? 0}
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  Still in progress, no activity in 24h—usually life, not a platform bug. Nudge via the tenant, not an
                  incident.
                </p>
              </div>
              <div className="p-3 bg-slate-100 rounded-full">
                <ClockIcon className="h-6 w-6 text-slate-500" />
              </div>
            </div>
          </div>

          <div
            className={`rounded-xl shadow-sm border p-6 ${
              alerts.warning > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Geo checks (7d)</p>
                <p className={`text-3xl font-bold mt-1 ${alerts.warning > 0 ? 'text-amber-800' : 'text-gray-900'}`}>
                  {isLoading ? '…' : healthData?.metrics?.locationAnomalies ?? 0}
                </p>
                <p className="text-xs text-gray-500 mt-1">Location anomaly log events</p>
              </div>
              <div className={`p-3 rounded-full ${alerts.warning > 0 ? 'bg-amber-200' : 'bg-gray-100'}`}>
                <MapPinIcon className={`h-6 w-6 ${alerts.warning > 0 ? 'text-amber-700' : 'text-gray-400'}`} />
              </div>
            </div>
          </div>
        </div>

        {/* Attention queue preview */}
        {stuckData && stuckData.candidates.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Hiring flow attention queue</h2>
                <p className="text-sm text-gray-500">
                  Mixed list: technical failures, slow queues, and low engagement—filter on the full page.
                </p>
              </div>
              <Link
                href="/stuck-candidates"
                className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center space-x-1"
              >
                <span>View all ({stuckData.total})</span>
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
            {stuckData.summary && (
              <div className="px-6 py-3 bg-slate-50 border-b border-gray-100 flex flex-wrap gap-3 text-xs">
                <span className="px-2 py-1 rounded-full bg-red-100 text-red-800">
                  Technical failed: {stuckData.summary.failedProcessing}
                </span>
                <span className="px-2 py-1 rounded-full bg-purple-100 text-purple-800">
                  Scoring gate: {stuckData.summary.stuckAtGate}
                </span>
                <span className="px-2 py-1 rounded-full bg-slate-200 text-slate-800">
                  Quiet 24h+: {stuckData.summary.inactive24h}
                </span>
                <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-900">
                  Queue delay: {stuckData.summary.pendingTooLong}
                </span>
              </div>
            )}
            <div className="divide-y divide-gray-100">
              {stuckData.candidates.slice(0, 5).map((candidate: any) => {
                const { label, className } = attentionReasonLabel(candidate.stuckReason);
                return (
                  <Link
                    key={candidate.id}
                    href={`/candidate/${candidate.candidateId}`}
                    className="px-6 py-4 flex items-center justify-between hover:bg-blue-50/50 cursor-pointer transition-colors block"
                  >
                    <div className="flex items-center space-x-4 min-w-0">
                      <div className="p-2 rounded-full bg-gray-100 shrink-0">
                        <UsersIcon className="h-5 w-5 text-gray-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-blue-600 truncate">{candidate.candidateName}</p>
                        <p className="text-sm text-gray-500 truncate">
                          {candidate.journeyName} · {candidate.organizationName}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${className}`}>{label}</span>
                      <p className="text-xs text-gray-500 mt-1">{candidate.completionPercentage}% through hiring flow</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link
            href="/organizations"
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
          >
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

          <Link
            href="/background-jobs"
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
          >
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

          <Link
            href="/settings/admins"
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
          >
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

          <Link
            href="/billing"
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
          >
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

          <Link
            href="/stuck-candidates"
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center space-x-4">
              <div className={`p-3 rounded-full ${hasIssues ? 'bg-amber-100' : 'bg-green-100'}`}>
                {hasIssues ? (
                  <ExclamationTriangleIcon className="h-6 w-6 text-amber-600" />
                ) : (
                  <CheckCircleIcon className="h-6 w-6 text-green-600" />
                )}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Hiring flow attention</h3>
                <p className="text-sm text-gray-500">
                  {hasIssues
                    ? `${alerts.total} ops item${alerts.total !== 1 ? 's' : ''} (technical, queue, geo)`
                    : 'No technical or queue alerts'}
                </p>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}

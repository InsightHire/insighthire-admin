'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import {
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  ArrowPathIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  UserGroupIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

type AttentionReason = 'failed_processing' | 'inactive_24h' | 'pending_too_long' | 'stuck_at_gate';

interface AttentionSessionRow {
  id: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string | null;
  journeyId: string;
  journeyName: string;
  organizationId: string;
  organizationName: string | null;
  positionTitle: string | null;
  status: string;
  stuckReason: AttentionReason;
  stuckSince: string;
  lastActivityAt: string | null;
  completionPercentage: number;
  currentNodeId: string | null;
  failedResponseCount: number;
  pendingResponseCount: number;
}

interface PipelineResponse {
  id: string;
  type: 'interview' | 'assessment';
  questionText: string;
  videoUploaded: boolean;
  transcriptionCompleted: boolean;
  transcriptionError: string | null;
  aiEvaluationCompleted: boolean;
  aiEvaluationError: string | null;
  scoreGenerated: boolean;
  overallStatus: 'completed' | 'in_progress' | 'failed' | 'pending';
  processingStatus: string;
  createdAt: string;
  processedAt: string | null;
}

export default function JourneyAttentionPage() {
  const { isLoading: authLoading } = useAdminAuth();
  const [expandedCandidate, setExpandedCandidate] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<Set<string>>(new Set());
  const [dismissing, setDismissing] = useState<Set<string>>(new Set());
  const [stuckTypeFilter, setStuckTypeFilter] = useState<'all' | 'failed_processing' | 'inactive' | 'pending_too_long'>('all');

  // Fetch journey health summary
  const { data: healthData, refetch: refetchHealth } = trpc.platformAdmin.getJourneyHealthSummary.useQuery(
    undefined,
    { enabled: !authLoading, refetchInterval: 30000 }
  );

  // Fetch stuck candidates
  const { data: stuckData, refetch: refetchStuck, isLoading: loadingStuck } = trpc.platformAdmin.getStuckCandidates.useQuery(
    { stuckType: stuckTypeFilter, limit: 100 },
    { enabled: !authLoading, refetchInterval: 30000 }
  );

  // Retry mutation
  const retryMutation = trpc.platformAdmin.retryStuckCandidate.useMutation();
  const bulkRetryMutation = trpc.platformAdmin.bulkRetryStuckCandidates.useMutation();
  const dismissMutation = trpc.platformAdmin.dismissStuckCandidate.useMutation();

  // Pipeline query (only when expanded)
  const { data: pipelineData, isLoading: loadingPipeline } = trpc.platformAdmin.getProcessingPipelineStatus.useQuery(
    { candidateId: expandedCandidate || '' },
    { enabled: !!expandedCandidate }
  );

  const handleRetryCandidate = async (candidateId: string) => {
    setRetrying(prev => new Set(prev).add(candidateId));
    try {
      await retryMutation.mutateAsync({ candidateId, retryType: 'all' });
      await refetchStuck();
      await refetchHealth();
    } catch (error) {
      console.error('Retry failed:', error);
      alert('Retry failed: ' + (error as Error).message);
    } finally {
      setRetrying(prev => {
        const newSet = new Set(prev);
        newSet.delete(candidateId);
        return newSet;
      });
    }
  };

  const handleDismiss = async (sessionId: string) => {
    if (
      !confirm(
        'Remove this session from the attention list? It can appear again if the same condition triggers later.',
      )
    )
      return;
    setDismissing(prev => new Set(prev).add(sessionId));
    try {
      await dismissMutation.mutateAsync({ sessionId });
      await refetchStuck();
      await refetchHealth();
    } catch (error) {
      console.error('Dismiss failed:', error);
      alert('Remove failed: ' + (error as Error).message);
    } finally {
      setDismissing(prev => {
        const next = new Set(prev);
        next.delete(sessionId);
        return next;
      });
    }
  };

  const handleBulkRetry = async () => {
    if (!confirm('Retry failed / stuck processing jobs across candidates (technical queue). Continue?')) {
      return;
    }
    try {
      const result = await bulkRetryMutation.mutateAsync({ stuckType: 'all' });
      alert(`Successfully retried ${result.totalRetried} jobs`);
      await refetchStuck();
      await refetchHealth();
    } catch (error) {
      console.error('Bulk retry failed:', error);
      alert('Bulk retry failed: ' + (error as Error).message);
    }
  };

  const getAttentionReasonBadge = (reason: AttentionReason) => {
    switch (reason) {
      case 'failed_processing':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
            Technical — failed step
          </span>
        );
      case 'inactive_24h':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-800">
            Engagement — quiet 24h+
          </span>
        );
      case 'pending_too_long':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-900">
            Pipeline — queue delay
          </span>
        );
      case 'stuck_at_gate':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
            Technical — scoring gate
          </span>
        );
      default:
        return null;
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    return 'Just now';
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const alerts = healthData?.alerts || { critical: 0, warning: 0, info: 0, total: 0 };

  return (
    <div className="p-6 max-w-full">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <UserGroupIcon className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Hiring flow attention center</h1>
              <p className="text-gray-600">
                Technical failures and slow jobs are ops issues. “Quiet 24h+” is usually normal candidate drop-off—not
                broken software.
              </p>
            </div>
          </div>
          <button
            onClick={handleBulkRetry}
            disabled={bulkRetryMutation.isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center space-x-2"
          >
            <ArrowPathIcon className={`h-5 w-5 ${bulkRetryMutation.isLoading ? 'animate-spin' : ''}`} />
            <span>Retry failed processing</span>
          </button>
        </div>
      </div>

      {/* Ops alert strip (matches dashboard semantics) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className={`rounded-lg p-4 ${alerts.critical > 0 ? 'bg-red-50 border-2 border-red-200' : 'bg-gray-50 border border-gray-200'}`}>
          <div className="flex items-center space-x-3">
            <ExclamationCircleIcon className={`h-8 w-8 ${alerts.critical > 0 ? 'text-red-600' : 'text-gray-400'}`} />
            <div>
              <p className="text-sm font-medium text-gray-600">Technical sessions</p>
              <p className={`text-2xl font-bold ${alerts.critical > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                {alerts.critical}
              </p>
              <p className="text-xs text-gray-500">Failed or long-running processing</p>
            </div>
          </div>
        </div>

        <div className={`rounded-lg p-4 ${alerts.warning > 0 ? 'bg-amber-50 border-2 border-amber-200' : 'bg-gray-50 border border-gray-200'}`}>
          <div className="flex items-center space-x-3">
            <ExclamationTriangleIcon className={`h-8 w-8 ${alerts.warning > 0 ? 'text-amber-600' : 'text-gray-400'}`} />
            <div>
              <p className="text-sm font-medium text-gray-600">Geo (7d)</p>
              <p className={`text-2xl font-bold ${alerts.warning > 0 ? 'text-amber-700' : 'text-gray-900'}`}>
                {alerts.warning}
              </p>
              <p className="text-xs text-gray-500">Location anomaly events</p>
            </div>
          </div>
        </div>

        <div className={`rounded-lg p-4 ${alerts.info > 0 ? 'bg-amber-50 border-2 border-amber-200' : 'bg-gray-50 border border-gray-200'}`}>
          <div className="flex items-center space-x-3">
            <InformationCircleIcon className={`h-8 w-8 ${alerts.info > 0 ? 'text-amber-700' : 'text-gray-400'}`} />
            <div>
              <p className="text-sm font-medium text-gray-600">Queue backlog</p>
              <p className={`text-2xl font-bold ${alerts.info > 0 ? 'text-amber-800' : 'text-gray-900'}`}>
                {alerts.info}
              </p>
              <p className="text-xs text-gray-500">Video pending &gt;1h</p>
            </div>
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <CheckCircleIcon className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-sm font-medium text-gray-600">In progress</p>
              <p className="text-2xl font-bold text-green-600">{healthData?.activeSessions || 0}</p>
              <p className="text-xs text-gray-500">Active hiring flow sessions</p>
            </div>
          </div>
        </div>
      </div>

      {stuckData?.summary && (
        <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-800 mb-2">This list — breakdown</p>
          <div className="flex flex-wrap gap-2 text-xs">
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
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium text-gray-700">Filter by:</span>
          <select
            value={stuckTypeFilter}
            onChange={(e) => setStuckTypeFilter(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
          >
            <option value="all">All categories</option>
            <option value="failed_processing">Technical — failed only</option>
            <option value="inactive">Engagement — quiet 24h+ only</option>
            <option value="pending_too_long">Pipeline — queue delay only</option>
          </select>
          <button
            onClick={() => { refetchStuck(); refetchHealth(); }}
            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 flex items-center space-x-1"
          >
            <ArrowPathIcon className="h-4 w-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Attention list */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Sessions ({stuckData?.total || 0})</h2>
          <p className="text-sm text-gray-500">
            Filter to technical or pipeline items when triaging. Engagement rows are for visibility—tenants nudge
            candidates; that is not a platform incident.
          </p>
        </div>

        <div className="divide-y divide-gray-200">
          {loadingStuck ? (
            <div className="px-6 py-8 text-center text-gray-500">
              <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
              <p>Loading attention list…</p>
            </div>
          ) : (stuckData?.candidates || []).length > 0 ? (
            (stuckData?.candidates as AttentionSessionRow[]).map((candidate) => (
              <div key={candidate.id} className="hover:bg-gray-50">
                {/* Main Row */}
                <div className="px-6 py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <a 
                          href={`/candidate/${candidate.candidateId}`}
                          className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {candidate.candidateName}
                        </a>
                        {getAttentionReasonBadge(candidate.stuckReason)}
                      </div>
                      {candidate.candidateEmail && (
                        <p className="text-xs text-gray-500 mb-2">{candidate.candidateEmail}</p>
                      )}
                      <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                        {candidate.organizationName && (
                          <span className="flex items-center space-x-1">
                            <span>🏢</span>
                            <span>{candidate.organizationName}</span>
                          </span>
                        )}
                        {candidate.journeyName && (
                          <span className="flex items-center space-x-1">
                            <span>🗺️</span>
                            <span>{candidate.journeyName}</span>
                          </span>
                        )}
                        {candidate.positionTitle && (
                          <span className="flex items-center space-x-1">
                            <span>💼</span>
                            <span>{candidate.positionTitle}</span>
                          </span>
                        )}
                        <span className="flex items-center space-x-1">
                          <ClockIcon className="h-3 w-3" />
                          <span>Since {formatTimeAgo(candidate.stuckSince)}</span>
                        </span>
                      </div>
                      <div className="mt-2 flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-500">Progress:</span>
                          <div className="w-32 h-2 bg-gray-200 rounded-full">
                            <div
                              className="h-2 bg-blue-600 rounded-full"
                              style={{ width: `${candidate.completionPercentage}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium">{candidate.completionPercentage}%</span>
                        </div>
                        {candidate.failedResponseCount > 0 && (
                          <span className="text-xs text-red-600">
                            {candidate.failedResponseCount} failed response(s)
                          </span>
                        )}
                        {candidate.pendingResponseCount > 0 && (
                          <span className="text-xs text-orange-600">
                            {candidate.pendingResponseCount} pending response(s)
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      <a
                        href={`/candidate/${candidate.candidateId}`}
                        className="px-3 py-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md flex items-center space-x-1"
                      >
                        <span>View Details</span>
                      </a>
                      <button
                        onClick={() => setExpandedCandidate(
                          expandedCandidate === candidate.candidateId ? null : candidate.candidateId
                        )}
                        className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md flex items-center space-x-1"
                      >
                        {expandedCandidate === candidate.candidateId ? (
                          <>
                            <ChevronUpIcon className="h-4 w-4" />
                            <span>Hide Pipeline</span>
                          </>
                        ) : (
                          <>
                            <ChevronDownIcon className="h-4 w-4" />
                            <span>View Pipeline</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleDismiss(candidate.id)}
                        disabled={dismissing.has(candidate.id)}
                        title="Remove from queue"
                        className={`px-3 py-2 rounded-md text-sm font-medium flex items-center space-x-2 ${
                          dismissing.has(candidate.id)
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`}
                      >
                        <TrashIcon className={`h-4 w-4 ${dismissing.has(candidate.id) ? 'animate-pulse' : ''}`} />
                        <span>{dismissing.has(candidate.id) ? 'Removing...' : 'Remove from queue'}</span>
                      </button>
                      <button
                        onClick={() => handleRetryCandidate(candidate.candidateId)}
                        disabled={retrying.has(candidate.candidateId)}
                        className={`px-4 py-2 rounded-md text-sm font-medium flex items-center space-x-2 ${
                          retrying.has(candidate.candidateId)
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        <ArrowPathIcon className={`h-4 w-4 ${retrying.has(candidate.candidateId) ? 'animate-spin' : ''}`} />
                        <span>{retrying.has(candidate.candidateId) ? 'Retrying...' : 'Retry'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Pipeline View */}
                {expandedCandidate === candidate.candidateId && (
                  <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                    <h4 className="text-sm font-medium text-gray-900 mb-4">Processing Pipeline</h4>
                    {loadingPipeline ? (
                      <div className="text-center py-4">
                        <div className="animate-spin h-6 w-6 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
                      </div>
                    ) : (pipelineData?.responses || []).length > 0 ? (
                      <div className="space-y-3">
                        {(pipelineData?.responses as PipelineResponse[]).map((response) => (
                          <div key={response.id} className="bg-white rounded-lg p-4 border border-gray-200">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <span className={`px-2 py-1 text-xs font-medium rounded ${
                                  response.type === 'interview' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                                }`}>
                                  {response.type === 'interview' ? 'Interview' : 'Assessment'}
                                </span>
                                <p className="text-sm text-gray-700 mt-1 line-clamp-2">
                                  {response.questionText}
                                </p>
                              </div>
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                response.overallStatus === 'completed' ? 'bg-green-100 text-green-800' :
                                response.overallStatus === 'failed' ? 'bg-red-100 text-red-800' :
                                response.overallStatus === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {response.overallStatus.replace('_', ' ')}
                              </span>
                            </div>
                            
                            {/* Pipeline Steps */}
                            <div className="flex items-center space-x-2 text-xs">
                              {/* Video */}
                              <div className={`flex items-center space-x-1 px-2 py-1 rounded ${
                                response.videoUploaded ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                              }`}>
                                {response.videoUploaded ? <CheckCircleIcon className="h-4 w-4" /> : <ClockIcon className="h-4 w-4" />}
                                <span>Video</span>
                              </div>
                              <span className="text-gray-400">→</span>
                              
                              {/* Transcription */}
                              <div className={`flex items-center space-x-1 px-2 py-1 rounded ${
                                response.transcriptionCompleted ? 'bg-green-100 text-green-800' :
                                response.transcriptionError ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-500'
                              }`}>
                                {response.transcriptionCompleted ? <CheckCircleIcon className="h-4 w-4" /> :
                                 response.transcriptionError ? <XCircleIcon className="h-4 w-4" /> :
                                 <ClockIcon className="h-4 w-4" />}
                                <span>Transcription</span>
                              </div>
                              <span className="text-gray-400">→</span>
                              
                              {/* AI Evaluation */}
                              <div className={`flex items-center space-x-1 px-2 py-1 rounded ${
                                response.aiEvaluationCompleted ? 'bg-green-100 text-green-800' :
                                response.aiEvaluationError ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-500'
                              }`}>
                                {response.aiEvaluationCompleted ? <CheckCircleIcon className="h-4 w-4" /> :
                                 response.aiEvaluationError ? <XCircleIcon className="h-4 w-4" /> :
                                 <ClockIcon className="h-4 w-4" />}
                                <span>AI Eval</span>
                              </div>
                              <span className="text-gray-400">→</span>
                              
                              {/* Score */}
                              <div className={`flex items-center space-x-1 px-2 py-1 rounded ${
                                response.scoreGenerated ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                              }`}>
                                {response.scoreGenerated ? <CheckCircleIcon className="h-4 w-4" /> : <ClockIcon className="h-4 w-4" />}
                                <span>Score</span>
                              </div>
                            </div>

                            {/* Error Messages */}
                            {(response.transcriptionError || response.aiEvaluationError) && (
                              <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-700">
                                <strong>Error:</strong> {response.transcriptionError || response.aiEvaluationError}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 text-center py-4">No responses found for this candidate</p>
                    )}

                    {pipelineData && (
                      <div className="mt-4 flex items-center space-x-4 text-xs text-gray-600">
                        <span>Total: {pipelineData.summary.total}</span>
                        <span className="text-green-600">Completed: {pipelineData.summary.completed}</span>
                        <span className="text-red-600">Failed: {pipelineData.summary.failed}</span>
                        <span className="text-yellow-600">In Progress: {pipelineData.summary.inProgress}</span>
                        <span className="text-gray-500">Pending: {pipelineData.summary.pending}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="px-6 py-12 text-center">
              <CheckCircleIcon className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <p className="text-lg font-medium text-gray-900">Nothing in this list</p>
              <p className="text-sm text-gray-500 mt-1">
                No rows match the current filter. Technical and queue issues may still appear on the dashboard when they
                trigger.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

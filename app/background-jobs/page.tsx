'use client';
export const dynamic = 'force-dynamic';


import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import {
  FunnelIcon,
  ArrowPathIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';

interface FailedJob {
  id: string;
  type: string;
  responseId: string;
  candidateId: string;
  candidateName: string;
  candidateEmail?: string;
  organizationId?: string;
  organizationName?: string;
  questionId?: string;
  questionText?: string;
  assessmentId?: string;
  assessmentName?: string;
  journeyId?: string;
  journeyName?: string;
  positionId?: string;
  positionTitle?: string;
  error: string;
  failedAt: string;
  retryCount: number;
  metadata?: any;
}

export default function BackgroundJobsAdmin() {
  const { isLoading: authLoading } = useAdminAuth();
  const [activeTab, setActiveTab] = useState<'failed' | 'pending' | 'completed'>('failed');
  const [retrying, setRetrying] = useState<Set<string>>(new Set());
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  // Filters
  const [filters, setFilters] = useState({
    organizationId: '',
    questionId: '',
    assessmentId: '',
    journeyId: '',
    jobType: '' as '' | 'transcription' | 'scoring' | 'video_generation',
    searchText: '',
  });

  // Get all organizations for dropdown
  const { data: orgsData } = trpc.platformAdmin.listOrganizations.useQuery({
    page: 1,
  }, {
    enabled: !authLoading,
    retry: false,
  });

  // Get queue stats
  const { data: queueStats } = trpc.platformAdmin.getJobQueues.useQuery(undefined, {
    enabled: !authLoading,
    retry: false,
    refetchInterval: 30000,
  });

  // Get failed jobs
  const { data: failedData, refetch: refetchFailed, isLoading: loadingFailed, error: failedError } = trpc.platformAdmin.getFailedJobs.useQuery({ queue: 'all', limit: 100, status: 'FAILED' }, {
    enabled: !authLoading && activeTab === 'failed',
    retry: false,
  });

  // DEBUG: Log errors
  if (failedError) {
    console.error('❌ Failed jobs error:', failedError);
  }

  // Get pending jobs
  const { data: pendingData, refetch: refetchPending, isLoading: loadingPending } = trpc.platformAdmin.getFailedJobs.useQuery({ queue: 'all', limit: 100, status: 'PENDING' }, {
    enabled: !authLoading && activeTab === 'pending',
    retry: false,
  });

  // Get completed jobs
  const { data: completedData, refetch: refetchCompleted, isLoading: loadingCompleted } = trpc.platformAdmin.getFailedJobs.useQuery({ queue: 'all', limit: 100, status: 'COMPLETED' }, {
    enabled: !authLoading && activeTab === 'completed',
    retry: false,
  });

  const retryMutation = trpc.platformAdmin.retryJob.useMutation();
  
  // AI Feedback Backfill
  const [backfillRunning, setBackfillRunning] = useState(false);
  const [backfillResult, setBackfillResult] = useState<any>(null);
  const backfillMutation = trpc.platformAdmin.backfillAssessmentAiFeedback.useMutation();

  const retryTranscription = async (jobId: string, jobType: 'transcription' | 'scoring') => {
    setRetrying(prev => new Set(prev).add(jobId));
    try {
      await retryMutation.mutateAsync({ jobId, jobType });
      setTimeout(() => {
        refetchFailed();
        setRetrying(prev => {
          const newSet = new Set(prev);
          newSet.delete(jobId);
          return newSet;
        });
      }, 2000);
    } catch (error) {
      console.error('Retry failed:', error);
      alert('Retry failed: ' + (error as Error).message);
      setRetrying(prev => {
        const newSet = new Set(prev);
        newSet.delete(jobId);
        return newSet;
      });
    }
  };

  // Apply filters to jobs
  const filterJobs = (jobs: FailedJob[] | undefined) => {
    if (!jobs) return [];

    return jobs.filter(job => {
      if (filters.organizationId && job.organizationId !== filters.organizationId) return false;
      if (filters.questionId && job.questionId !== filters.questionId) return false;
      if (filters.assessmentId && job.assessmentId !== filters.assessmentId) return false;
      if (filters.journeyId && job.journeyId !== filters.journeyId) return false;
      if (filters.jobType && job.type !== filters.jobType) return false;
      if (filters.searchText) {
        const search = filters.searchText.toLowerCase();
        const matchesName = job.candidateName?.toLowerCase().includes(search);
        const matchesEmail = job.candidateEmail?.toLowerCase().includes(search);
        const matchesError = job.error?.toLowerCase().includes(search);
        const matchesQuestion = job.questionText?.toLowerCase().includes(search);
        if (!matchesName && !matchesEmail && !matchesError && !matchesQuestion) return false;
      }
      return true;
    });
  };

  const filteredFailedJobs = filterJobs(failedData?.jobs as FailedJob[] | undefined);
  const filteredPendingJobs = filterJobs(pendingData?.jobs as FailedJob[] | undefined);

  // DEBUG: Check what data we're getting


  // Get unique values for filter dropdowns with cascading logic
  const allJobs = (failedData?.jobs as FailedJob[] || []);

  // Show ALL organizations from system, not just ones with failed jobs
  const allOrganizations = orgsData?.organizations || [];

  // Simple cascading: Org filters all child dropdowns
  const jobsForDropdowns = filters.organizationId
    ? allJobs.filter(j => j.organizationId === filters.organizationId)
    : allJobs;

  const uniqueJourneys = Array.from(new Set(jobsForDropdowns.map(j => j.journeyId).filter(Boolean)));
  const uniqueAssessments = Array.from(new Set(jobsForDropdowns.map(j => j.assessmentId).filter(Boolean)));
  const uniqueQuestions = Array.from(new Set(jobsForDropdowns.map(j => j.questionId).filter(Boolean)));

  const clearFilters = () => {
    setFilters({
      organizationId: '',
      questionId: '',
      assessmentId: '',
      journeyId: '',
      jobType: '',
      searchText: '',
    });
  };

  const hasActiveFilters = Object.values(filters).some(v => v !== '');

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Background Jobs Management</h1>
        <p className="text-gray-600">Monitor and retry failed background processing jobs with detailed filtering</p>
      </div>

      {/* Queue Overview Cards */}
      {queueStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {queueStats.queues.map((queue: any) => (
            <div key={queue.name} className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 capitalize mb-4">
                {queue.name.replace('-', ' ')}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-yellow-50 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-900">{queue.waiting}</div>
                  <div className="text-xs text-yellow-700">Waiting</div>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-900">{queue.active}</div>
                  <div className="text-xs text-blue-700">Active</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-900">{queue.completed}</div>
                  <div className="text-xs text-green-700">Last 24h</div>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-900">{queue.failed}</div>
                  <div className="text-xs text-red-700">Failed</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* AI Feedback Backfill */}
      <div className="bg-white rounded-lg shadow-sm border border-purple-200 p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Assessment AI Feedback Backfill</h3>
        <p className="text-sm text-gray-600 mb-4">
          Re-score assessment TEXT/CODING responses with detailed AI feedback (strengths, improvements, feedback).
          Responses already scored with rich feedback will be skipped.
        </p>
        <div className="flex items-center space-x-3">
          <button
            onClick={async () => {
              // Dry run first
              try {
                const dryResult = await backfillMutation.mutateAsync({ dryRun: true, limit: 200 });
                setBackfillResult(dryResult);
              } catch (e: any) {
                alert('Error: ' + e.message);
              }
            }}
            disabled={backfillRunning}
            className="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 text-sm font-medium"
          >
            Preview (Dry Run)
          </button>
          <button
            onClick={async () => {
              if (!confirm('This will call OpenAI for each response. Continue?')) return;
              setBackfillRunning(true);
              setBackfillResult(null);
              try {
                const result = await backfillMutation.mutateAsync({ dryRun: false, limit: 200 });
                setBackfillResult(result);
              } catch (e: any) {
                alert('Error: ' + e.message);
              } finally {
                setBackfillRunning(false);
              }
            }}
            disabled={backfillRunning}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center space-x-2 ${
              backfillRunning
                ? 'bg-purple-300 text-purple-100 cursor-not-allowed'
                : 'bg-purple-600 text-white hover:bg-purple-700'
            }`}
          >
            {backfillRunning && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
            <span>{backfillRunning ? 'Scoring...' : 'Run Backfill'}</span>
          </button>
        </div>
        {backfillResult && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg text-sm">
            <div className="font-medium mb-2">
              {backfillResult.dryRun ? 'Preview Results' : 'Backfill Complete'}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="text-center p-2 bg-white rounded border">
                <div className="text-xl font-bold">{backfillResult.totalFound}</div>
                <div className="text-xs text-gray-500">Total TEXT/CODING</div>
              </div>
              <div className="text-center p-2 bg-white rounded border">
                <div className="text-xl font-bold text-purple-600">{backfillResult.needsBackfill}</div>
                <div className="text-xs text-gray-500">Need AI Feedback</div>
              </div>
              {!backfillResult.dryRun && (
                <>
                  <div className="text-center p-2 bg-green-50 rounded border border-green-200">
                    <div className="text-xl font-bold text-green-700">{backfillResult.scored}</div>
                    <div className="text-xs text-green-600">Scored</div>
                  </div>
                  <div className="text-center p-2 bg-red-50 rounded border border-red-200">
                    <div className="text-xl font-bold text-red-700">{backfillResult.failed}</div>
                    <div className="text-xs text-red-600">Failed</div>
                  </div>
                </>
              )}
            </div>
            {!backfillResult.dryRun && backfillResult.results?.length > 0 && (
              <div className="mt-3 space-y-1 max-h-40 overflow-y-auto">
                {backfillResult.results.map((r: any, i: number) => (
                  <div key={i} className="text-xs text-gray-600 flex items-center space-x-2">
                    <span className="font-mono">{r.responseId.slice(0, 12)}...</span>
                    <span>{r.oldScore} → {r.newScore}</span>
                    <span className={r.hasStrengths ? 'text-green-600' : 'text-red-600'}>
                      {r.hasStrengths ? 'Has strengths' : 'No strengths'}
                    </span>
                    <span className={r.hasFeedback ? 'text-green-600' : 'text-red-600'}>
                      {r.hasFeedback ? 'Has feedback' : 'No feedback'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filters Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <FunnelIcon className="h-5 w-5 text-gray-500" />
            <h3 className="font-medium text-gray-900">Filters</h3>
            {hasActiveFilters && (
              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                Active
              </span>
            )}
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-gray-600 hover:text-gray-900 flex items-center space-x-1"
            >
              <XMarkIcon className="h-4 w-4" />
              <span>Clear all</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search (candidate name, email, error, question)
            </label>
            <input
              type="text"
              value={filters.searchText}
              onChange={(e) => setFilters(prev => ({ ...prev, searchText: e.target.value }))}
              placeholder="Search jobs..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Job Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Job Type</label>
            <select
              value={filters.jobType}
              onChange={(e) => setFilters(prev => ({ ...prev, jobType: e.target.value as any }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white"
            >
              <option value="" className="text-gray-900">All Types</option>
              <option value="transcription">Transcription</option>
              <option value="scoring">Scoring</option>
              <option value="video_generation">Video Generation</option>
            </select>
          </div>

          {/* Organization */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Organization ({allOrganizations.length})
            </label>
            <select
              value={filters.organizationId}
              onChange={(e) => setFilters(prev => ({ ...prev, organizationId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white"
            >
              <option value="" className="text-gray-900">All Organizations</option>
              {allOrganizations.map((org: any) => (
                <option key={org.id} value={org.id}>
                  {org.name || org.domain || org.id}
                </option>
              ))}
            </select>
          </div>

          {/* Journey */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Journey ({uniqueJourneys.length})
            </label>
            <select
              value={filters.journeyId}
              onChange={(e) => setFilters(prev => ({ ...prev, journeyId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white"
            >
              <option value="" className="text-gray-900">All Hiring Flows</option>
              {uniqueJourneys.map(jId => {
                const job = allJobs.find(j => j.journeyId === jId);
                return (
                  <option key={jId} value={jId}>
                    {job?.journeyName || jId}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Assessment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Assessment ({uniqueAssessments.length})
            </label>
            <select
              value={filters.assessmentId}
              onChange={(e) => setFilters(prev => ({ ...prev, assessmentId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white"
            >
              <option value="" className="text-gray-900">All Assessments</option>
              {uniqueAssessments.map(aId => {
                const job = allJobs.find(j => j.assessmentId === aId);
                return (
                  <option key={aId} value={aId}>
                    {job?.assessmentName || aId}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Question (Interview) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Interview Question ({uniqueQuestions.length})
            </label>
            <select
              value={filters.questionId}
              onChange={(e) => setFilters(prev => ({ ...prev, questionId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white"
            >
              <option value="" className="text-gray-900">All Interview Questions</option>
              {uniqueQuestions.map(qId => {
                const job = allJobs.find(j => j.questionId === qId);
                return (
                  <option key={qId} value={qId}>
                    {job?.questionText?.substring(0, 50) || qId}...
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="mt-3 text-sm text-gray-600">
            Showing {activeTab === 'failed' ? filteredFailedJobs.length : filteredPendingJobs.length} of {activeTab === 'failed' ? (failedData?.jobs?.length || 0) : (pendingData?.jobs?.length || 0)} jobs
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('failed')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'failed'
                ? 'border-red-500 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            ❌ Failed Jobs {failedData?.jobs ? `(${filteredFailedJobs.length})` : ''}
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'pending'
                ? 'border-yellow-500 text-yellow-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            ⏳ Pending Jobs {pendingData?.jobs ? `(${filteredPendingJobs.length})` : ''}
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'completed'
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            ✅ Recent Completed
          </button>
        </nav>
      </div>

      {/* Failed Jobs */}
      {activeTab === 'failed' && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium">Failed Jobs - Detailed View</h2>
            <p className="text-sm text-gray-500">Click on a job to see full details and troubleshoot</p>
          </div>

          <div className="divide-y divide-gray-200">
            {loadingFailed ? (
              <div className="px-6 py-8 text-center text-gray-500">
                <p>Loading failed jobs...</p>
              </div>
            ) : filteredFailedJobs.length > 0 ? (
              filteredFailedJobs.map(job => (
                <DetailedJobRow
                  key={job.id}
                  job={job}
                  isExpanded={expandedJob === job.id}
                  onToggleExpand={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
                  onRetry={() => retryTranscription(job.responseId || job.id, job.type as any)}
                  isRetrying={retrying.has(job.responseId || job.id)}
                />
              ))
            ) : (
              <div className="px-6 py-8 text-center text-gray-500">
                {hasActiveFilters ? (
                  <>
                    <p className="text-lg">🔍 No jobs match your filters</p>
                    <button
                      onClick={clearFilters}
                      className="mt-2 text-sm text-blue-600 hover:text-blue-800"
                    >
                      Clear filters
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-lg">✅ No failed jobs found</p>
                    <p className="text-sm mt-2">🎉 All background processing is healthy!</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pending Jobs */}
      {activeTab === 'pending' && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium">Pending Jobs ({filteredPendingJobs.length})</h2>
            <p className="text-sm text-gray-500">Jobs waiting to be processed by background workers</p>
          </div>
          {loadingPending ? (
            <div className="px-6 py-8 text-center text-gray-500">
              <p>Loading pending jobs...</p>
            </div>
          ) : filteredPendingJobs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Candidate</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Organization</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Question/Assessment</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {filteredPendingJobs.map(job => (
                    <tr key={job.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                          {job.type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{job.candidateName}</div>
                        {job.candidateEmail && <div className="text-sm text-gray-500">{job.candidateEmail}</div>}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {job.organizationName || 'Unknown'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 max-w-md truncate">
                          {job.assessmentName || job.questionText || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {job.failedAt ? new Date(job.failedAt).toLocaleString() : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-8 text-center text-gray-500">
              <p>✅ No pending jobs - all caught up!</p>
            </div>
          )}
        </div>
      )}

      {/* Completed Jobs */}
      {activeTab === 'completed' && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium">Recently Completed</h2>
              <p className="text-sm text-gray-500">Last 100 successfully processed jobs</p>
            </div>
            <button onClick={() => refetchCompleted()} className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
              <ArrowPathIcon className="h-4 w-4" /> Refresh
            </button>
          </div>
          {loadingCompleted ? (
            <div className="px-6 py-8 text-center text-gray-500">Loading completed jobs...</div>
          ) : completedData?.jobs && completedData.jobs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Candidate</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hiring Flow</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Question</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Completed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {completedData.jobs.map((job: any) => {
                    const score = (() => {
                      try {
                        if (job.metadata?.aiAnalysis) {
                          const ai = typeof job.metadata.aiAnalysis === 'string' ? JSON.parse(job.metadata.aiAnalysis) : job.metadata.aiAnalysis;
                          return ai?.overallScore || ai?.score;
                        }
                        return job.metadata?.score;
                      } catch { return null; }
                    })();
                    return (
                      <tr key={job.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-900">{job.candidateName || 'Unknown'}</div>
                          {job.candidateEmail && <div className="text-xs text-gray-500">{job.candidateEmail}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            job.type === 'transcription' ? 'bg-purple-100 text-purple-800' :
                            job.type === 'scoring' ? 'bg-blue-100 text-blue-800' :
                            job.type === 'video_generation' ? 'bg-orange-100 text-orange-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {job.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {job.journeyName || job.assessmentName || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-700 max-w-xs truncate" title={job.questionText}>
                            {job.questionText?.substring(0, 60) || '—'}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {score != null ? (
                            <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                              score >= 80 ? 'bg-green-100 text-green-800' :
                              score >= 60 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {Math.round(score)}%
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                          {job.failedAt ? new Date(job.failedAt).toLocaleString() : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-8 text-center text-gray-500">No recently completed jobs</div>
          )}
        </div>
      )}
    </div>
  );
}

function DetailedJobRow({
  job,
  isExpanded,
  onToggleExpand,
  onRetry,
  isRetrying
}: {
  job: FailedJob;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onRetry: () => void;
  isRetrying: boolean;
}) {
  return (
    <div className="px-6 py-4 hover:bg-gray-50">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Header */}
          <div className="flex items-center space-x-3 mb-2">
            <span className="text-2xl">
              {job.type === 'transcription' ? '🎥' : job.type === 'scoring' ? '📊' : '🎬'}
            </span>
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-medium text-gray-900">
                  {job.type === 'interview_transcription' ? 'Interview Transcription' :
                   job.type === 'assessment_scoring' ? 'Assessment Scoring' : job.type}
                </h3>
                <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded-full">
                  Failed {job.retryCount || 0}x
                </span>
              </div>
              <p className="text-sm text-gray-600 font-medium">{job.candidateName}</p>
              {job.candidateEmail && (
                <p className="text-xs text-gray-500">{job.candidateEmail}</p>
              )}
            </div>

            <button
              onClick={onToggleExpand}
              className="text-gray-400 hover:text-gray-600"
            >
              {isExpanded ? (
                <ChevronUpIcon className="h-5 w-5" />
              ) : (
                <ChevronDownIcon className="h-5 w-5" />
              )}
            </button>
          </div>

          {/* Quick Info */}
          <div className="ml-11 space-y-1">
            <div className="flex flex-wrap gap-3 text-xs text-gray-600">
              {job.organizationName && (
                <span className="flex items-center space-x-1">
                  <span>🏢</span>
                  <span>{job.organizationName}</span>
                </span>
              )}
              {job.positionTitle && (
                <span className="flex items-center space-x-1">
                  <span>💼</span>
                  <span>{job.positionTitle}</span>
                </span>
              )}
              {job.journeyName && (
                <span className="flex items-center space-x-1">
                  <span>🗺️</span>
                  <span>{job.journeyName}</span>
                </span>
              )}
              <span className="flex items-center space-x-1">
                <span>⏰</span>
                <span>{new Date(job.failedAt).toLocaleString()}</span>
              </span>
            </div>

            {/* Error Preview */}
            <div className="text-sm text-red-600 bg-red-50 p-2 rounded truncate">
              <strong>Error:</strong> {job.error?.substring(0, 100)}...
            </div>
          </div>

          {/* Expanded Details */}
          {isExpanded && (
            <div className="ml-11 mt-4 border-t pt-4 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                {/* IDs Column */}
                <div className="space-y-2 text-xs">
                  <h4 className="font-medium text-gray-900 mb-2">Identifiers</h4>
                  <div><strong>Job ID:</strong> <code className="bg-gray-100 px-1 py-0.5 rounded">{job.id}</code></div>
                  <div><strong>Response ID:</strong> <code className="bg-gray-100 px-1 py-0.5 rounded">{job.responseId}</code></div>
                  <div><strong>Candidate ID:</strong> <code className="bg-gray-100 px-1 py-0.5 rounded">{job.candidateId}</code></div>
                  {job.organizationId && <div><strong>Org ID:</strong> <code className="bg-gray-100 px-1 py-0.5 rounded">{job.organizationId}</code></div>}
                  {job.questionId && <div><strong>Question ID:</strong> <code className="bg-gray-100 px-1 py-0.5 rounded">{job.questionId}</code></div>}
                  {job.assessmentId && <div><strong>Assessment ID:</strong> <code className="bg-gray-100 px-1 py-0.5 rounded">{job.assessmentId}</code></div>}
                  {job.journeyId && <div><strong>Hiring flow ID:</strong> <code className="bg-gray-100 px-1 py-0.5 rounded">{job.journeyId}</code></div>}
                  {job.positionId && <div><strong>Position ID:</strong> <code className="bg-gray-100 px-1 py-0.5 rounded">{job.positionId}</code></div>}
                </div>

                {/* Details Column */}
                <div className="space-y-2 text-xs">
                  <h4 className="font-medium text-gray-900 mb-2">Details</h4>
                  {job.questionText && (
                    <div className="bg-blue-50 p-2 rounded">
                      <strong>Question:</strong> {job.questionText}
                    </div>
                  )}
                  {job.metadata && (
                    <div className="bg-gray-50 p-2 rounded">
                      <strong>Metadata:</strong>
                      <pre className="mt-1 text-xs overflow-x-auto">
                        {JSON.stringify(job.metadata, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>

              {/* Full Error */}
              <div className="bg-red-50 p-3 rounded">
                <h4 className="font-medium text-red-900 mb-2">Full Error Message</h4>
                <pre className="text-xs text-red-800 whitespace-pre-wrap font-mono">
                  {job.error}
                </pre>
              </div>
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center space-x-2">
          <button
            onClick={onToggleExpand}
            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md"
          >
            {isExpanded ? 'Hide Details' : 'Show Details'}
          </button>
          <button
            onClick={onRetry}
            disabled={isRetrying}
            className={`px-4 py-2 rounded-md text-sm font-medium flex items-center space-x-2 ${
              isRetrying
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            <ArrowPathIcon className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
            <span>{isRetrying ? 'Retrying...' : 'Retry Now'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

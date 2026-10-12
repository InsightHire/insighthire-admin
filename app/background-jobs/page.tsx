'use client';
export const dynamic = 'force-dynamic';


import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { QueueTrendsSection } from '@/components/platform-admin/queue-trends';
import {
  Activity,
  BarChart3,
  Briefcase,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Film,
  Filter,
  Hourglass,
  Layers,
  Map as MapIcon,
  RefreshCw,
  Search,
  Sparkles,
  Video,
  X,
  XCircle,
} from 'lucide-react';
import { AdminPage } from '@/components/admin/page-chrome';
import { PageHeader } from '@/components/admin/page-header';
import { SectionCard } from '@/components/admin/section-card';
import { StatusPill } from '@/components/admin/status-pill';
import { EmptyState } from '@/components/admin/empty-state';
import { Segmented } from '@/components/admin/segmented';
import { DataTableEl, Th, Td } from '@/components/admin/data-table';
import { buttonClass, checkboxClass, inputClass, selectClass } from '@/components/admin/controls';

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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

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
  const dismissMutation = (trpc.platformAdmin as any).dismissFailedJob.useMutation({
    onSuccess: () => {
      void refetchFailed();
      void refetchPending();
      setSelected(new Set());
    },
  });
  const bulkDismissMutation = (trpc.platformAdmin as any).bulkDismissFailedJobs.useMutation({
    onSuccess: () => {
      void refetchFailed();
      void refetchPending();
      setSelected(new Set());
    },
  });
  
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

  const sortJobs = (jobs: FailedJob[]) =>
    [...jobs].sort((a, b) => {
      const at = a.failedAt ? new Date(a.failedAt).getTime() : 0;
      const bt = b.failedAt ? new Date(b.failedAt).getTime() : 0;
      return sortDir === 'desc' ? bt - at : at - bt;
    });

  const filteredFailedJobs = sortJobs(filterJobs(failedData?.jobs as FailedJob[] | undefined));
  const filteredPendingJobs = sortJobs(filterJobs(pendingData?.jobs as FailedJob[] | undefined));

  const visibleJobsForTab =
    activeTab === 'pending' ? filteredPendingJobs : filteredFailedJobs;

  const jobKey = (job: FailedJob) => `${job.type}:${job.id}`;
  const toggleSelect = (job: FailedJob) => {
    const k = jobKey(job);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };
  const selectAllVisible = () => {
    setSelected(new Set(visibleJobsForTab.map(jobKey)));
  };
  const clearSelection = () => setSelected(new Set());

  const switchTab = (tab: 'failed' | 'pending' | 'completed') => {
    setActiveTab(tab);
    setSelected(new Set());
    setExpandedJob(null);
  };

  const dismissOne = async (job: FailedJob) => {
    const label = activeTab === 'pending' ? 'pending job' : 'failure';
    if (!confirm(`Remove this ${job.type} ${label} from the queue?\n\n${job.candidateName}\n${job.error?.slice(0, 120) || ''}\n\n(Does not delete or cancel the underlying response — only hides it here. Workers can still process it.)`)) {
      return;
    }
    try {
      await dismissMutation.mutateAsync({
        jobId: job.id,
        jobType: job.type,
        reason: activeTab === 'pending' ? 'Dismissed pending from Pipeline UI' : 'Dismissed from Pipeline UI',
      });
    } catch (e: any) {
      alert(e?.message || 'Dismiss failed');
    }
  };

  const dismissSelected = async () => {
    const jobs = visibleJobsForTab
      .filter((j) => selected.has(jobKey(j)))
      .map((j) => ({ jobId: j.id, jobType: j.type }));
    if (jobs.length === 0) return;
    const kind = activeTab === 'pending' ? 'pending' : 'failed';
    if (!confirm(`Remove ${jobs.length} ${kind} job(s) from this queue?\n\nThey stay in the DB and can still be processed; they just stop showing here.`)) {
      return;
    }
    try {
      await bulkDismissMutation.mutateAsync({
        jobs,
        reason: activeTab === 'pending' ? 'Bulk dismissed pending from Pipeline UI' : 'Bulk dismissed from Pipeline UI',
      });
    } catch (e: any) {
      alert(e?.message || 'Bulk dismiss failed');
    }
  };

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
        <div className="animate-spin h-8 w-8 border-4 border-admin-accent border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const sortButton = (
    <button
      type="button"
      onClick={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
      className={buttonClass.small}
    >
      {sortDir === 'desc' ? 'Newest first' : 'Oldest first'}
    </button>
  );

  const selectionActions = (visibleCount: number) =>
    selected.size > 0 ? (
      <>
        <button
          type="button"
          onClick={dismissSelected}
          disabled={bulkDismissMutation.isPending}
          className={`${buttonClass.primary} px-3 py-1 text-xs`}
        >
          <X className="h-3.5 w-3.5" />
          Dismiss {selected.size} selected
        </button>
        <button type="button" onClick={clearSelection} className={`${buttonClass.ghost} text-xs`}>
          Clear
        </button>
      </>
    ) : (
      <button
        type="button"
        onClick={selectAllVisible}
        disabled={visibleCount === 0}
        className={`${buttonClass.ghost} text-xs`}
      >
        Select all visible
      </button>
    );

  const noMatch = (
    <EmptyState
      compact
      className="border-0 shadow-none"
      icon={<Search />}
      title="No jobs match your filters"
      action={
        <button onClick={clearFilters} className={buttonClass.secondary}>
          Clear filters
        </button>
      }
    />
  );

  return (
    <AdminPage className="pt-0 sm:px-6 lg:px-6 lg:pt-0">
      <PageHeader
        icon={<Activity />}
        breadcrumbs={[{ label: 'Operations' }, { label: 'Pipeline', href: '/pipeline' }, { label: 'Background jobs' }]}
        title="Background Jobs Management"
        description="Monitor and retry failed background processing jobs with detailed filtering"
      />

      <div className="space-y-6">
      {/* Queue Overview Cards */}
      {queueStats && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {queueStats.queues.map((queue: any) => (
            <SectionCard key={queue.name} icon={<Layers />} title={<span className="capitalize">{queue.name.replace('-', ' ')}</span>}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-admin-sm border border-admin-warn/20 bg-admin-warn-soft p-3 text-center">
                  <div className="text-2xl font-bold tabular-nums text-amber-900">{queue.waiting}</div>
                  <div className="text-xs text-amber-700">Waiting</div>
                </div>
                <div className="rounded-admin-sm border border-admin-info/20 bg-admin-info-soft p-3 text-center">
                  <div className="text-2xl font-bold tabular-nums text-sky-900">{queue.active}</div>
                  <div className="text-xs text-sky-700">Active</div>
                </div>
                <div className="rounded-admin-sm border border-admin-ok/20 bg-admin-ok-soft p-3 text-center">
                  <div className="text-2xl font-bold tabular-nums text-emerald-900">{queue.completed}</div>
                  <div className="text-xs text-emerald-700">Last 24h</div>
                </div>
                <div className="rounded-admin-sm border border-admin-danger/20 bg-admin-danger-soft p-3 text-center">
                  <div className="text-2xl font-bold tabular-nums text-red-900">{queue.failed}</div>
                  <div className="text-xs text-red-700">Failed</div>
                </div>
              </div>
            </SectionCard>
          ))}
        </div>
      )}

      <QueueTrendsSection />

      {/* AI Feedback Backfill */}
      <SectionCard
        icon={<Sparkles />}
        title="Assessment AI Feedback Backfill"
        description={
          <>
            Re-score assessment TEXT/CODING responses with detailed AI feedback (strengths, improvements, feedback).
            Responses already scored with rich feedback will be skipped.
          </>
        }
        actions={
          <>
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
              className={buttonClass.secondary}
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
              className={buttonClass.primary}
            >
              {backfillRunning && <RefreshCw className="h-4 w-4 animate-spin" />}
              <span>{backfillRunning ? 'Scoring...' : 'Run Backfill'}</span>
            </button>
          </>
        }
      >
        {backfillResult ? (
          <div className="space-y-3 text-sm">
            <div className="font-medium text-admin-ink">
              {backfillResult.dryRun ? 'Preview Results' : 'Backfill Complete'}
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-admin-sm border border-admin-border p-2 text-center">
                <div className="text-xl font-bold tabular-nums text-admin-ink">{backfillResult.totalFound}</div>
                <div className="text-xs text-admin-muted">Total TEXT/CODING</div>
              </div>
              <div className="rounded-admin-sm border border-admin-accent-border bg-admin-accent-soft p-2 text-center">
                <div className="text-xl font-bold tabular-nums text-admin-accent-ink">{backfillResult.needsBackfill}</div>
                <div className="text-xs text-admin-muted">Need AI Feedback</div>
              </div>
              {!backfillResult.dryRun && (
                <>
                  <div className="rounded-admin-sm border border-green-200 bg-green-50 p-2 text-center">
                    <div className="text-xl font-bold tabular-nums text-green-700">{backfillResult.scored}</div>
                    <div className="text-xs text-green-600">Scored</div>
                  </div>
                  <div className="rounded-admin-sm border border-red-200 bg-red-50 p-2 text-center">
                    <div className="text-xl font-bold tabular-nums text-red-700">{backfillResult.failed}</div>
                    <div className="text-xs text-red-600">Failed</div>
                  </div>
                </>
              )}
            </div>
            {!backfillResult.dryRun && backfillResult.results?.length > 0 && (
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-admin-sm border border-admin-border bg-admin-bg/50 p-2">
                {backfillResult.results.map((r: any, i: number) => (
                  <div key={i} className="flex items-center space-x-2 text-xs text-admin-secondary">
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
        ) : (
          <p className="text-sm text-admin-muted">Run a preview to see how many responses need AI feedback.</p>
        )}
      </SectionCard>

      {/* Filters Section */}
      <SectionCard
        icon={<Filter />}
        title="Filters"
        description={
          hasActiveFilters
            ? `Showing ${activeTab === 'failed' ? filteredFailedJobs.length : filteredPendingJobs.length} of ${activeTab === 'failed' ? (failedData?.jobs?.length || 0) : (pendingData?.jobs?.length || 0)} jobs`
            : undefined
        }
        actions={
          hasActiveFilters ? (
            <>
              <StatusPill tone="brand">Active</StatusPill>
              <button onClick={clearFilters} className={`${buttonClass.ghost} text-xs`}>
                <X className="h-3.5 w-3.5" />
                <span>Clear all</span>
              </button>
            </>
          ) : null
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Search */}
          <div className="md:col-span-3">
            <label className="mb-1 block text-xs font-medium text-admin-secondary">
              Search (candidate name, email, error, question)
            </label>
            <input
              type="text"
              value={filters.searchText}
              onChange={(e) => setFilters(prev => ({ ...prev, searchText: e.target.value }))}
              placeholder="Search jobs..."
              className={inputClass}
            />
          </div>

          {/* Job Type */}
          <div>
            <label className="mb-1 block text-xs font-medium text-admin-secondary">Job Type</label>
            <select
              value={filters.jobType}
              onChange={(e) => setFilters(prev => ({ ...prev, jobType: e.target.value as any }))}
              className={`${selectClass} w-full`}
            >
              <option value="">All Types</option>
              <option value="transcription">Transcription</option>
              <option value="scoring">Scoring</option>
              <option value="video_generation">Video Generation</option>
            </select>
          </div>

          {/* Organization */}
          <div>
            <label className="mb-1 block text-xs font-medium text-admin-secondary">
              Organization ({allOrganizations.length})
            </label>
            <select
              value={filters.organizationId}
              onChange={(e) => setFilters(prev => ({ ...prev, organizationId: e.target.value }))}
              className={`${selectClass} w-full`}
            >
              <option value="">All Organizations</option>
              {allOrganizations.map((org: any) => (
                <option key={org.id} value={org.id}>
                  {org.name || org.domain || org.id}
                </option>
              ))}
            </select>
          </div>

          {/* Journey */}
          <div>
            <label className="mb-1 block text-xs font-medium text-admin-secondary">
              Journey ({uniqueJourneys.length})
            </label>
            <select
              value={filters.journeyId}
              onChange={(e) => setFilters(prev => ({ ...prev, journeyId: e.target.value }))}
              className={`${selectClass} w-full`}
            >
              <option value="">All Hiring Flows</option>
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
            <label className="mb-1 block text-xs font-medium text-admin-secondary">
              Assessment ({uniqueAssessments.length})
            </label>
            <select
              value={filters.assessmentId}
              onChange={(e) => setFilters(prev => ({ ...prev, assessmentId: e.target.value }))}
              className={`${selectClass} w-full`}
            >
              <option value="">All Assessments</option>
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
            <label className="mb-1 block text-xs font-medium text-admin-secondary">
              Interview Question ({uniqueQuestions.length})
            </label>
            <select
              value={filters.questionId}
              onChange={(e) => setFilters(prev => ({ ...prev, questionId: e.target.value }))}
              className={`${selectClass} w-full`}
            >
              <option value="">All Interview Questions</option>
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
      </SectionCard>

      {/* Tabs */}
      <Segmented
        ariaLabel="Job status"
        options={[
          { value: 'failed', label: 'Failed Jobs', count: failedData?.jobs ? filteredFailedJobs.length : undefined },
          { value: 'pending', label: 'Pending Jobs', count: pendingData?.jobs ? filteredPendingJobs.length : undefined },
          { value: 'completed', label: 'Recent Completed' },
        ]}
        value={activeTab}
        onChange={switchTab}
      />

      {/* Failed Jobs */}
      {activeTab === 'failed' && (
        <SectionCard
          icon={<XCircle />}
          title="Failed Jobs"
          description="Sorted by date · dismiss hides from this queue (keeps the response)"
          padded={false}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {sortButton}
              {selectionActions(filteredFailedJobs.length)}
            </div>
          }
        >
          <div className="divide-y divide-admin-border">
            {loadingFailed ? (
              <div className="px-6 py-8 text-center text-sm text-admin-muted">
                <p>Loading failed jobs...</p>
              </div>
            ) : filteredFailedJobs.length > 0 ? (
              filteredFailedJobs.map(job => (
                <DetailedJobRow
                  key={job.id}
                  job={job}
                  selected={selected.has(jobKey(job))}
                  onToggleSelect={() => toggleSelect(job)}
                  isExpanded={expandedJob === job.id}
                  onToggleExpand={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
                  onRetry={() => retryTranscription(job.responseId || job.id, job.type as any)}
                  onDismiss={() => dismissOne(job)}
                  isRetrying={retrying.has(job.responseId || job.id)}
                  isDismissing={dismissMutation.isPending}
                />
              ))
            ) : hasActiveFilters ? (
              noMatch
            ) : (
              <EmptyState
                compact
                className="border-0 shadow-none"
                icon={<CheckCircle2 className="text-admin-ok" />}
                title="No failed jobs found"
                description="All background processing is healthy!"
              />
            )}
          </div>
        </SectionCard>
      )}

      {/* Pending Jobs */}
      {activeTab === 'pending' && (
        <SectionCard
          icon={<Hourglass />}
          title={`Pending Jobs (${filteredPendingJobs.length})`}
          description="Waiting/processing · dismiss hides from this queue (does not cancel workers)"
          padded={false}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {sortButton}
              {selectionActions(filteredPendingJobs.length)}
            </div>
          }
        >
          {loadingPending ? (
            <div className="px-6 py-8 text-center text-sm text-admin-muted">
              <p>Loading pending jobs...</p>
            </div>
          ) : filteredPendingJobs.length > 0 ? (
            <div className="overflow-x-auto">
              <DataTableEl>
                <thead>
                  <tr>
                    <Th className="w-10">
                      <span className="sr-only">Select</span>
                    </Th>
                    <Th>Type</Th>
                    <Th>Candidate</Th>
                    <Th>Organization</Th>
                    <Th>Question/Assessment</Th>
                    <Th>Submitted</Th>
                    <Th className="text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPendingJobs.map(job => (
                    <tr key={job.id}>
                      <Td>
                        <input
                          type="checkbox"
                          checked={selected.has(jobKey(job))}
                          onChange={() => toggleSelect(job)}
                          className={checkboxClass}
                          aria-label={`Select ${job.candidateName}`}
                        />
                      </Td>
                      <Td>
                        <StatusPill tone="brand" dot={false}>{job.type}</StatusPill>
                      </Td>
                      <Td>
                        <div className="font-medium text-admin-ink">{job.candidateName}</div>
                        {job.candidateEmail && <div className="text-admin-muted">{job.candidateEmail}</div>}
                      </Td>
                      <Td className="text-admin-ink">
                        {job.organizationName || 'Unknown'}
                      </Td>
                      <Td>
                        <div className="max-w-md truncate text-admin-ink">
                          {job.assessmentName || job.questionText || 'N/A'}
                        </div>
                      </Td>
                      <Td className="whitespace-nowrap text-admin-muted">
                        {job.failedAt ? new Date(job.failedAt).toLocaleString() : 'N/A'}
                      </Td>
                      <Td className="text-right">
                        <button
                          type="button"
                          onClick={() => dismissOne(job)}
                          disabled={dismissMutation.isPending}
                          className={buttonClass.small}
                          title="Hide from this queue without canceling processing"
                        >
                          Dismiss
                        </button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </DataTableEl>
            </div>
          ) : hasActiveFilters ? (
            noMatch
          ) : (
            <EmptyState
              compact
              className="border-0 shadow-none"
              icon={<CheckCircle2 className="text-admin-ok" />}
              title="No pending jobs - all caught up!"
            />
          )}
        </SectionCard>
      )}

      {/* Completed Jobs */}
      {activeTab === 'completed' && (
        <SectionCard
          icon={<CheckCircle2 />}
          title="Recently Completed"
          description="Last 100 successfully processed jobs"
          padded={false}
          actions={
            <button onClick={() => refetchCompleted()} className={buttonClass.small}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
          }
        >
          {loadingCompleted ? (
            <div className="px-6 py-8 text-center text-sm text-admin-muted">Loading completed jobs...</div>
          ) : completedData?.jobs && completedData.jobs.length > 0 ? (
            <div className="overflow-x-auto">
              <DataTableEl>
                <thead>
                  <tr>
                    <Th>Candidate</Th>
                    <Th>Type</Th>
                    <Th>Hiring Flow</Th>
                    <Th>Question</Th>
                    <Th>Score</Th>
                    <Th>Completed</Th>
                  </tr>
                </thead>
                <tbody>
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
                      <tr key={job.id}>
                        <Td>
                          <div className="font-medium text-admin-ink">{job.candidateName || 'Unknown'}</div>
                          {job.candidateEmail && <div className="text-xs text-admin-muted">{job.candidateEmail}</div>}
                        </Td>
                        <Td>
                          <StatusPill
                            dot={false}
                            tone={
                              job.type === 'transcription' ? 'brand' :
                              job.type === 'scoring' ? 'info' :
                              job.type === 'video_generation' ? 'warn' :
                              'neutral'
                            }
                          >
                            {job.type}
                          </StatusPill>
                        </Td>
                        <Td>
                          {job.journeyName || job.assessmentName || '—'}
                        </Td>
                        <Td>
                          <div className="max-w-xs truncate" title={job.questionText}>
                            {job.questionText?.substring(0, 60) || '—'}
                          </div>
                        </Td>
                        <Td>
                          {score != null ? (
                            <StatusPill
                              dot={false}
                              className="font-bold"
                              tone={score >= 80 ? 'success' : score >= 60 ? 'warn' : 'danger'}
                            >
                              {Math.round(score)}%
                            </StatusPill>
                          ) : (
                            <span className="text-xs text-admin-muted">—</span>
                          )}
                        </Td>
                        <Td className="whitespace-nowrap text-xs text-admin-muted">
                          {job.failedAt ? new Date(job.failedAt).toLocaleString() : '—'}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </DataTableEl>
            </div>
          ) : (
            <EmptyState compact className="border-0 shadow-none" icon={<CheckCircle2 />} title="No recently completed jobs" />
          )}
        </SectionCard>
      )}
      </div>
    </AdminPage>
  );
}

function DetailedJobRow({
  job,
  selected,
  onToggleSelect,
  isExpanded,
  onToggleExpand,
  onRetry,
  onDismiss,
  isRetrying,
  isDismissing,
}: {
  job: FailedJob;
  selected: boolean;
  onToggleSelect: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onRetry: () => void;
  onDismiss: () => void;
  isRetrying: boolean;
  isDismissing: boolean;
}) {
  const TypeIcon = job.type === 'transcription' ? Video : job.type === 'scoring' ? BarChart3 : Film;
  return (
    <div className="px-5 py-4 transition-colors hover:bg-admin-bg/70">
      <div className="flex items-start justify-between gap-3">
        <div className="pt-1">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            className={checkboxClass}
            aria-label={`Select ${job.candidateName}`}
          />
        </div>
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="mb-2 flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-admin-danger/20 bg-admin-danger-soft text-admin-danger">
              <TypeIcon className="h-4 w-4" />
            </span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium text-admin-ink">
                  {job.type === 'interview_transcription' ? 'Interview Transcription' :
                   job.type === 'assessment_scoring' ? 'Assessment Scoring' : job.type}
                </h3>
                <StatusPill tone="danger">Failed {job.retryCount || 0}x</StatusPill>
              </div>
              <p className="text-sm font-medium text-admin-secondary">{job.candidateName}</p>
              {job.candidateEmail && (
                <p className="text-xs text-admin-muted">{job.candidateEmail}</p>
              )}
            </div>

            <button
              onClick={onToggleExpand}
              className="text-admin-muted hover:text-admin-ink"
            >
              {isExpanded ? (
                <ChevronUp className="h-5 w-5" />
              ) : (
                <ChevronDown className="h-5 w-5" />
              )}
            </button>
          </div>

          {/* Quick Info */}
          <div className="ml-11 space-y-1.5">
            <div className="flex flex-wrap gap-3 text-xs text-admin-secondary">
              {job.organizationName && (
                <span className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5 text-admin-muted" />
                  <span>{job.organizationName}</span>
                </span>
              )}
              {job.positionTitle && (
                <span className="flex items-center gap-1">
                  <Briefcase className="h-3.5 w-3.5 text-admin-muted" />
                  <span>{job.positionTitle}</span>
                </span>
              )}
              {job.journeyName && (
                <span className="flex items-center gap-1">
                  <MapIcon className="h-3.5 w-3.5 text-admin-muted" />
                  <span>{job.journeyName}</span>
                </span>
              )}
              <span className="flex items-center gap-1 font-medium text-admin-ink">
                <Clock className="h-3.5 w-3.5 text-admin-muted" />
                <span>{new Date(job.failedAt).toLocaleString()}</span>
              </span>
            </div>

            {/* Error Preview */}
            <div className="truncate rounded-admin-sm bg-admin-danger-soft p-2 text-sm text-red-700">
              <strong>Error:</strong> {job.error?.substring(0, 100)}...
            </div>
          </div>

          {/* Expanded Details */}
          {isExpanded && (
            <div className="ml-11 mt-4 space-y-3 border-t border-admin-border pt-4">
              <div className="grid grid-cols-2 gap-4">
                {/* IDs Column */}
                <div className="space-y-2 text-xs text-admin-secondary">
                  <h4 className="mb-2 font-medium text-admin-ink">Identifiers</h4>
                  <div><strong>Job ID:</strong> <code className="admin-mono rounded bg-slate-100 px-1 py-0.5">{job.id}</code></div>
                  <div><strong>Response ID:</strong> <code className="admin-mono rounded bg-slate-100 px-1 py-0.5">{job.responseId}</code></div>
                  <div><strong>Candidate ID:</strong> <code className="admin-mono rounded bg-slate-100 px-1 py-0.5">{job.candidateId}</code></div>
                  {job.organizationId && <div><strong>Org ID:</strong> <code className="admin-mono rounded bg-slate-100 px-1 py-0.5">{job.organizationId}</code></div>}
                  {job.questionId && <div><strong>Question ID:</strong> <code className="admin-mono rounded bg-slate-100 px-1 py-0.5">{job.questionId}</code></div>}
                  {job.assessmentId && <div><strong>Assessment ID:</strong> <code className="admin-mono rounded bg-slate-100 px-1 py-0.5">{job.assessmentId}</code></div>}
                  {job.journeyId && <div><strong>Hiring flow ID:</strong> <code className="admin-mono rounded bg-slate-100 px-1 py-0.5">{job.journeyId}</code></div>}
                  {job.positionId && <div><strong>Position ID:</strong> <code className="admin-mono rounded bg-slate-100 px-1 py-0.5">{job.positionId}</code></div>}
                </div>

                {/* Details Column */}
                <div className="space-y-2 text-xs text-admin-secondary">
                  <h4 className="mb-2 font-medium text-admin-ink">Details</h4>
                  {job.questionText && (
                    <div className="rounded-admin-sm bg-admin-info-soft p-2">
                      <strong>Question:</strong> {job.questionText}
                    </div>
                  )}
                  {job.metadata && (
                    <div className="rounded-admin-sm bg-admin-bg p-2">
                      <strong>Metadata:</strong>
                      <pre className="mt-1 overflow-x-auto text-xs">
                        {JSON.stringify(job.metadata, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>

              {/* Full Error */}
              <div className="rounded-admin-sm border border-admin-danger/20 bg-admin-danger-soft p-3">
                <h4 className="mb-2 font-medium text-red-900">Full Error Message</h4>
                <pre className="whitespace-pre-wrap font-mono text-xs text-red-800">
                  {job.error}
                </pre>
              </div>
            </div>
          )}
        </div>

        <div className="ml-auto flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <button
            onClick={onToggleExpand}
            className={buttonClass.ghost}
          >
            {isExpanded ? 'Hide Details' : 'Show Details'}
          </button>
          <button
            onClick={onDismiss}
            disabled={isDismissing}
            className={buttonClass.secondary}
            title="Hide from this queue without deleting the response"
          >
            Dismiss
          </button>
          <button
            onClick={onRetry}
            disabled={isRetrying || job.type === 'video_generation'}
            className={buttonClass.primary}
          >
            <RefreshCw className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
            <span>{isRetrying ? 'Retrying...' : 'Retry Now'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

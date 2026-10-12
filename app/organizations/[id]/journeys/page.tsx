'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import {
  ArrowUpDown,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Filter,
  Route,
  Search,
  Trophy,
  Users,
  XCircle,
} from 'lucide-react';
import { AdminPageChrome } from '@/components/admin/page-chrome';
import { SectionCard } from '@/components/admin/section-card';
import { StatGrid, StatTile } from '@/components/admin/stat-tile';
import { StatusPill } from '@/components/admin/status-pill';
import { EmptyState } from '@/components/admin/empty-state';
import { DataTableEl, Th, Td } from '@/components/admin/data-table';
import { buttonClass, inputClass, selectClass } from '@/components/admin/controls';

type SortKey = 'candidateName' | 'status' | 'score' | 'startedAt' | 'lastActivityAt' | 'completionPercentage' | 'rank';
type SortDir = 'asc' | 'desc';

export default function OrganizationJourneysPage() {
  const params = useParams();
  const { isLoading: authLoading } = useAdminAuth();
  const orgId = params.id as string;

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [journeyFilter, setJourneyFilter] = useState<string>('ALL');
  const [positionFilter, setPositionFilter] = useState<string>('ALL');

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>('startedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Pagination
  const [page, setPage] = useState(1);
  const perPage = 25;

  const { data, isLoading, error } = trpc.platformAdmin.getOrganizationJourneySessions.useQuery({
    organizationId: orgId,
    limit: 500,
  }, {
    enabled: !authLoading,
    retry: false,
  });

  const { data: orgData } = trpc.platformAdmin.getOrganization.useQuery({ id: orgId }, {
    enabled: !authLoading,
  });

  // Client-side filter + sort + paginate
  const { filtered, totalFiltered, totalPages } = useMemo(() => {
    if (!data?.sessions) return { filtered: [], totalFiltered: 0, totalPages: 0 };

    let items = [...data.sessions];

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(s =>
        s.candidateName?.toLowerCase().includes(q) ||
        s.candidateEmail?.toLowerCase().includes(q) ||
        s.journeyName?.toLowerCase().includes(q) ||
        s.positionTitle?.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter !== 'ALL') {
      items = items.filter(s => s.status === statusFilter);
    }

    // Journey filter
    if (journeyFilter !== 'ALL') {
      items = items.filter(s => s.journeyName === journeyFilter);
    }

    // Position filter
    if (positionFilter !== 'ALL') {
      items = items.filter(s => s.positionTitle === positionFilter);
    }

    // Sort
    items.sort((a: any, b: any) => {
      let av: any, bv: any;
      switch (sortKey) {
        case 'candidateName':
          av = a.candidateName?.toLowerCase() || '';
          bv = b.candidateName?.toLowerCase() || '';
          break;
        case 'status': {
          const order: Record<string, number> = { COMPLETED: 0, IN_PROGRESS: 1, ABANDONED: 2 };
          av = order[a.status] ?? 3;
          bv = order[b.status] ?? 3;
          break;
        }
        case 'score':
          av = a.overallScore ? parseFloat(a.overallScore) : -1;
          bv = b.overallScore ? parseFloat(b.overallScore) : -1;
          break;
        case 'rank':
          av = a.rank ?? 9999;
          bv = b.rank ?? 9999;
          break;
        case 'completionPercentage':
          av = parseFloat(a.completionPercentage || '0');
          bv = parseFloat(b.completionPercentage || '0');
          break;
        case 'startedAt':
          av = a.startedAt ? new Date(a.startedAt).getTime() : 0;
          bv = b.startedAt ? new Date(b.startedAt).getTime() : 0;
          break;
        case 'lastActivityAt':
          av = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
          bv = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
          break;
        default:
          av = 0; bv = 0;
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    const totalFiltered = items.length;
    const totalPages = Math.ceil(totalFiltered / perPage);
    const paginated = items.slice((page - 1) * perPage, page * perPage);

    return { filtered: paginated, totalFiltered, totalPages };
  }, [data, search, statusFilter, journeyFilter, positionFilter, sortKey, sortDir, page]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'candidateName' ? 'asc' : 'desc');
    }
    setPage(1);
  };

  const SortHeader = ({ label, sortField, className = '' }: { label: string; sortField: SortKey; className?: string }) => (
    <th
      className={`cursor-pointer select-none whitespace-nowrap bg-admin-bg/70 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-admin-muted hover:text-admin-ink ${className}`}
      onClick={() => toggleSort(sortField)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortKey === sortField ? (
          sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 text-admin-border-strong" />
        )}
      </div>
    </th>
  );

  const stats = data?.stats;

  const formatDate = (d: string | null | undefined) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const timeAgo = (d: string | null | undefined) => {
    if (!d) return '-';
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return formatDate(d);
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-admin-accent border-t-transparent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold text-admin-ink">Error loading hiring flows</h2>
          <pre className="mt-2 max-w-lg rounded-admin-sm bg-admin-danger-soft p-3 text-sm text-admin-danger">{error.message}</pre>
        </div>
      </div>
    );
  }

  return (
    <AdminPageChrome
      width="wide"
      icon={<Route />}
      breadcrumbs={[
        { label: 'Tenants', href: '/organizations' },
        { label: orgData?.organization?.name || 'Organization', href: `/organizations/${orgId}` },
        { label: 'Hiring flow sessions' },
      ]}
      title="Hiring flow sessions"
      description={orgData?.organization?.name || 'Organization'}
    >
      <div className="space-y-6">
        {/* Stats Cards */}
        {stats && (
          <StatGrid cols={5}>
            <StatTile label="Total Candidates" icon={Users} tone="brand" value={stats.total} />
            <StatTile label="Completed" icon={CheckCircle2} tone="ok" value={stats.completed} />
            <StatTile label="In Progress" icon={Clock} tone="info" value={stats.inProgress} />
            <StatTile label="Abandoned" icon={XCircle} tone="critical" value={stats.abandoned} />
            <StatTile label="Avg Score" icon={Trophy} tone="warn" value={stats.avgScore !== null ? `${stats.avgScore}%` : '-'} />
          </StatGrid>
        )}

        <SectionCard padded={false}>
          {/* Filters Bar */}
          <div className="flex flex-wrap items-center gap-3 border-b border-admin-border px-4 py-3">
            <Filter className="h-4 w-4 text-admin-muted" />
            {/* Search */}
            <div className="relative min-w-[200px] max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-muted" />
              <input
                type="text"
                placeholder="Search name, email, journey..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className={`${inputClass} pl-9`}
              />
            </div>
            {/* Status */}
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className={selectClass}
            >
              <option value="ALL">All Statuses</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="ABANDONED">Abandoned</option>
            </select>
            {/* Journey */}
            {data?.journeyNames && data.journeyNames.length > 1 && (
              <select
                value={journeyFilter}
                onChange={(e) => { setJourneyFilter(e.target.value); setPage(1); }}
                className={`${selectClass} max-w-[200px] truncate`}
              >
                <option value="ALL">All hiring flows</option>
                {data.journeyNames.map((j: string) => (
                  <option key={j} value={j}>{j}</option>
                ))}
              </select>
            )}
            {/* Position */}
            {data?.positionTitles && data.positionTitles.length > 1 && (
              <select
                value={positionFilter}
                onChange={(e) => { setPositionFilter(e.target.value); setPage(1); }}
                className={`${selectClass} max-w-[200px] truncate`}
              >
                <option value="ALL">All Positions</option>
                {data.positionTitles.map((p: string) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            )}
            {/* Result count */}
            <span className="ml-auto text-xs text-admin-muted">
              {totalFiltered} result{totalFiltered !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Table */}
          {filtered.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <DataTableEl>
                  <thead>
                    <tr>
                      <SortHeader label="Rank" sortField="rank" className="w-16" />
                      <SortHeader label="Candidate" sortField="candidateName" />
                      <Th>Hiring flow / Position</Th>
                      <SortHeader label="Progress" sortField="completionPercentage" />
                      <SortHeader label="Status" sortField="status" />
                      <SortHeader label="Score" sortField="score" className="w-20" />
                      <SortHeader label="Started" sortField="startedAt" />
                      <SortHeader label="Last Activity" sortField="lastActivityAt" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((session: any) => {
                      const score = session.overallScore ? Math.round(parseFloat(session.overallScore)) : null;
                      const scoreColor = score !== null
                        ? score >= 80 ? 'text-green-700 bg-green-50' : score >= 60 ? 'text-amber-700 bg-amber-50' : 'text-red-700 bg-red-50'
                        : '';

                      return (
                        <tr
                          key={session.id}
                          className="cursor-pointer"
                          onClick={() => window.location.href = `/candidate/${session.candidateId}`}
                        >
                          {/* Rank */}
                          <Td className="text-center">
                            {session.rank ? (
                              <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                                session.rank === 1 ? 'bg-amber-100 text-amber-700' :
                                session.rank === 2 ? 'bg-slate-200 text-slate-700' :
                                session.rank === 3 ? 'bg-orange-100 text-orange-700' :
                                'bg-slate-100 text-admin-muted'
                              }`}>
                                #{session.rank}
                              </span>
                            ) : (
                              <span className="text-admin-border-strong">-</span>
                            )}
                          </Td>
                          {/* Candidate */}
                          <Td>
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-admin-accent-border bg-admin-accent-soft text-xs font-bold text-admin-accent-ink">
                                {(session.candidateName || '?')[0]?.toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="truncate font-medium text-admin-ink">{session.candidateName}</div>
                                <div className="truncate text-xs text-admin-muted">{session.candidateEmail}</div>
                              </div>
                            </div>
                          </Td>
                          {/* Journey / Position */}
                          <Td>
                            <div className="max-w-[200px] truncate text-admin-ink">{session.journeyName || '-'}</div>
                            {session.positionTitle && (
                              <div className="max-w-[200px] truncate text-xs text-admin-muted">{session.positionTitle}</div>
                            )}
                          </Td>
                          {/* Progress */}
                          <Td>
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-20 flex-1 rounded-full bg-slate-100">
                                <div
                                  className={`h-1.5 rounded-full transition-all ${
                                    session.status === 'COMPLETED' ? 'bg-admin-ok' :
                                    session.status === 'ABANDONED' ? 'bg-red-400' :
                                    'bg-admin-accent'
                                  }`}
                                  style={{ width: `${Math.min(100, parseFloat(session.completionPercentage || '0'))}%` }}
                                />
                              </div>
                              <span className="w-8 text-right text-xs tabular-nums text-admin-muted">
                                {Math.round(parseFloat(session.completionPercentage || '0'))}%
                              </span>
                            </div>
                            {session.totalSteps > 0 && (
                              <div className="mt-0.5 text-[10px] text-admin-muted">
                                {session.completedSteps}/{session.totalSteps} questions
                              </div>
                            )}
                          </Td>
                          {/* Status */}
                          <Td className="whitespace-nowrap">
                            <StatusPill
                              tone={
                                session.status === 'COMPLETED' ? 'success' :
                                session.status === 'IN_PROGRESS' ? 'info' :
                                'neutral'
                              }
                            >
                              {session.status === 'IN_PROGRESS' ? 'In Progress' :
                               session.status === 'COMPLETED' ? 'Completed' :
                               session.status === 'ABANDONED' ? 'Abandoned' : session.status}
                            </StatusPill>
                            {session.sessionCount > 1 && (
                              <span className="ml-1 text-[10px] text-admin-muted">{session.sessionCount} attempts</span>
                            )}
                          </Td>
                          {/* Score */}
                          <Td>
                            {score !== null ? (
                              <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-bold ${scoreColor}`}>
                                {score}%
                              </span>
                            ) : (
                              <span className="text-xs text-admin-border-strong">-</span>
                            )}
                          </Td>
                          {/* Started */}
                          <Td className="text-xs text-admin-muted">
                            {formatDate(session.startedAt)}
                          </Td>
                          {/* Last Activity */}
                          <Td className="text-xs text-admin-muted">
                            {timeAgo(session.lastActivityAt)}
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </DataTableEl>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-admin-border bg-admin-bg/50 px-4 py-3">
                  <p className="text-xs text-admin-muted">
                    Showing {(page - 1) * perPage + 1}-{Math.min(page * perPage, totalFiltered)} of {totalFiltered}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className={buttonClass.small}
                    >
                      Previous
                    </button>
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 7) {
                        pageNum = i + 1;
                      } else if (page <= 4) {
                        pageNum = i + 1;
                      } else if (page >= totalPages - 3) {
                        pageNum = totalPages - 6 + i;
                      } else {
                        pageNum = page - 3 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setPage(pageNum)}
                          className={`h-8 w-8 rounded-admin-sm text-xs ${
                            page === pageNum
                              ? 'bg-admin-accent font-medium text-white'
                              : 'border border-transparent text-admin-secondary hover:border-admin-border hover:bg-white'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className={buttonClass.small}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <EmptyState
              compact
              className="border-0 shadow-none"
              icon={<Users />}
              title="No hiring flow sessions found"
              description={search || statusFilter !== 'ALL' ? 'Try adjusting your filters' : 'No candidates have started journeys yet'}
            />
          )}
        </SectionCard>
      </div>
    </AdminPageChrome>
  );
}

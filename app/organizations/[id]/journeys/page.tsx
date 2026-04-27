'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import {
  ArrowLeftIcon,
  MagnifyingGlassIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  UserGroupIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  TrophyIcon,
  ArrowsUpDownIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';

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
      className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none ${className}`}
      onClick={() => toggleSort(sortField)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortKey === sortField ? (
          sortDir === 'asc' ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />
        ) : (
          <ArrowsUpDownIcon className="h-3 w-3 text-gray-300" />
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900">Error loading hiring flows</h2>
          <pre className="mt-2 text-sm text-red-600 bg-red-50 p-3 rounded max-w-lg">{error.message}</pre>
        </div>
      </div>
    );
  }

  return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b">
          <div className="max-w-[1400px] mx-auto px-6 py-5">
            <div className="flex items-center gap-4">
              <Link href={`/organizations/${orgId}`} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <ArrowLeftIcon className="h-5 w-5 text-gray-500" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Hiring flow sessions</h1>
                <p className="text-sm text-gray-500">{orgData?.organization?.name || 'Organization'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-6">
          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <UserGroupIcon className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                    <p className="text-xs text-gray-500">Total Candidates</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-50 rounded-lg">
                    <CheckCircleIcon className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-700">{stats.completed}</p>
                    <p className="text-xs text-gray-500">Completed</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <ClockIcon className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-blue-700">{stats.inProgress}</p>
                    <p className="text-xs text-gray-500">In Progress</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-50 rounded-lg">
                    <XCircleIcon className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-600">{stats.abandoned}</p>
                    <p className="text-xs text-gray-500">Abandoned</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-50 rounded-lg">
                    <TrophyIcon className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-amber-700">{stats.avgScore !== null ? `${stats.avgScore}%` : '-'}</p>
                    <p className="text-xs text-gray-500">Avg Score</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Filters Bar */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-gray-400">
                <FunnelIcon className="h-4 w-4" />
              </div>
              {/* Search */}
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search name, email, journey..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              {/* Status */}
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[200px] truncate"
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
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[200px] truncate"
                >
                  <option value="ALL">All Positions</option>
                  {data.positionTitles.map((p: string) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              )}
              {/* Result count */}
              <span className="text-xs text-gray-400 ml-auto">
                {totalFiltered} result{totalFiltered !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Table */}
          {filtered.length > 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <SortHeader label="Rank" sortField="rank" className="w-16" />
                      <SortHeader label="Candidate" sortField="candidateName" />
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Hiring flow / Position</th>
                      <SortHeader label="Progress" sortField="completionPercentage" />
                      <SortHeader label="Status" sortField="status" />
                      <SortHeader label="Score" sortField="score" className="w-20" />
                      <SortHeader label="Started" sortField="startedAt" />
                      <SortHeader label="Last Activity" sortField="lastActivityAt" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map((session: any) => {
                      const score = session.overallScore ? Math.round(parseFloat(session.overallScore)) : null;
                      const scoreColor = score !== null
                        ? score >= 80 ? 'text-green-700 bg-green-50' : score >= 60 ? 'text-amber-700 bg-amber-50' : 'text-red-700 bg-red-50'
                        : '';

                      return (
                        <tr
                          key={session.id}
                          className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                          onClick={() => window.location.href = `/candidate/${session.candidateId}`}
                        >
                          {/* Rank */}
                          <td className="px-4 py-3 text-center">
                            {session.rank ? (
                              <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                                session.rank === 1 ? 'bg-amber-100 text-amber-700' :
                                session.rank === 2 ? 'bg-gray-200 text-gray-700' :
                                session.rank === 3 ? 'bg-orange-100 text-orange-700' :
                                'bg-gray-100 text-gray-500'
                              }`}>
                                #{session.rank}
                              </span>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                          {/* Candidate */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                                {(session.candidateName || '?')[0]?.toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-gray-900 truncate">{session.candidateName}</div>
                                <div className="text-xs text-gray-500 truncate">{session.candidateEmail}</div>
                              </div>
                            </div>
                          </td>
                          {/* Journey / Position */}
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-900 truncate max-w-[200px]">{session.journeyName || '-'}</div>
                            {session.positionTitle && (
                              <div className="text-xs text-gray-500 truncate max-w-[200px]">{session.positionTitle}</div>
                            )}
                          </td>
                          {/* Progress */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-100 rounded-full h-1.5 w-20">
                                <div
                                  className={`h-1.5 rounded-full transition-all ${
                                    session.status === 'COMPLETED' ? 'bg-green-500' :
                                    session.status === 'ABANDONED' ? 'bg-red-400' :
                                    'bg-blue-500'
                                  }`}
                                  style={{ width: `${Math.min(100, parseFloat(session.completionPercentage || '0'))}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-500 w-8 text-right">
                                {Math.round(parseFloat(session.completionPercentage || '0'))}%
                              </span>
                            </div>
                            {session.totalSteps > 0 && (
                              <div className="text-[10px] text-gray-400 mt-0.5">
                                {session.completedSteps}/{session.totalSteps} questions
                              </div>
                            )}
                          </td>
                          {/* Status */}
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${
                              session.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                              session.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {session.status === 'IN_PROGRESS' ? 'In Progress' :
                               session.status === 'COMPLETED' ? 'Completed' :
                               session.status === 'ABANDONED' ? 'Abandoned' : session.status}
                            </span>
                            {session.sessionCount > 1 && (
                              <span className="ml-1 text-[10px] text-gray-400">{session.sessionCount} attempts</span>
                            )}
                          </td>
                          {/* Score */}
                          <td className="px-4 py-3">
                            {score !== null ? (
                              <span className={`inline-flex items-center px-2 py-0.5 text-xs font-bold rounded ${scoreColor}`}>
                                {score}%
                              </span>
                            ) : (
                              <span className="text-xs text-gray-300">-</span>
                            )}
                          </td>
                          {/* Started */}
                          <td className="px-4 py-3 text-xs text-gray-500">
                            {formatDate(session.startedAt)}
                          </td>
                          {/* Last Activity */}
                          <td className="px-4 py-3 text-xs text-gray-500">
                            {timeAgo(session.lastActivityAt)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
                  <p className="text-xs text-gray-500">
                    Showing {(page - 1) * perPage + 1}-{Math.min(page * perPage, totalFiltered)} of {totalFiltered}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-3 py-1 text-xs border rounded-md hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
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
                          className={`w-8 h-8 text-xs rounded-md ${
                            page === pageNum
                              ? 'bg-blue-600 text-white font-medium'
                              : 'hover:bg-white border border-transparent hover:border-gray-200'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-3 py-1 text-xs border rounded-md hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <UserGroupIcon className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No hiring flow sessions found</p>
              <p className="text-sm text-gray-400 mt-1">
                {search || statusFilter !== 'ALL' ? 'Try adjusting your filters' : 'No candidates have started journeys yet'}
              </p>
            </div>
          )}
        </div>
      </div>
  );
}

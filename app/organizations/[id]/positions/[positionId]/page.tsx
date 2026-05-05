'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import {
  ArrowLeftIcon,
  BriefcaseIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  UserIcon,
} from '@heroicons/react/24/outline';

type StatusFilter = '' | 'NEW' | 'IN_REVIEW' | 'INTERVIEWED' | 'OFFERED' | 'HIRED' | 'REJECTED' | 'WITHDRAWN';

type SortKey =
  | 'name'
  | 'status'
  | 'aiScore'
  | 'humanScore'
  | 'delta'
  | 'absDelta'
  | 'orchestratorCoverage'
  | 'completion'
  | 'lastActivity'
  | 'appliedAt';
type SortDir = 'asc' | 'desc';

export default function OrganizationPositionDetailPage() {
  const params = useParams();
  const orgId = params.id as string;
  const positionId = params.positionId as string;
  const { isLoading: authLoading } = useAdminAuth();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  // Default: highest AI score first, so the "best" candidates surface at the top.
  const [sortKey, setSortKey] = useState<SortKey>('aiScore');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const { data: orgData } = trpc.platformAdmin.getOrganization.useQuery(
    { id: orgId },
    { enabled: !authLoading },
  );

  const { data, isLoading, error } = trpc.platformAdmin.getPositionCandidates.useQuery(
    {
      organizationId: orgId,
      positionId,
      limit: 200,
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    { enabled: !authLoading, retry: 1 },
  );

  const position = data?.position as any;
  const rawCandidates = (data?.candidates ?? []) as any[];
  const calibration = data?.calibration as any;

  const sortedCandidates = (() => {
    const arr = [...rawCandidates];
    const dir = sortDir === 'asc' ? 1 : -1;
    const cmpNum = (a: number | null | undefined, b: number | null | undefined) => {
      // Nulls always last regardless of direction.
      if (a == null && b == null) return 0;
      if (a == null) return 1;
      if (b == null) return -1;
      return (a - b) * dir;
    };
    const cmpStr = (a: string | null | undefined, b: string | null | undefined) => {
      const av = (a || '').toLowerCase();
      const bv = (b || '').toLowerCase();
      if (!av && !bv) return 0;
      if (!av) return 1;
      if (!bv) return -1;
      return av.localeCompare(bv) * dir;
    };
    const cmpDate = (a: string | null | undefined, b: string | null | undefined) => {
      const av = a ? new Date(a).getTime() : null;
      const bv = b ? new Date(b).getTime() : null;
      return cmpNum(av, bv);
    };
    arr.sort((x, y) => {
      switch (sortKey) {
        case 'name': return cmpStr(x.candidateName, y.candidateName);
        case 'status': return cmpStr(x.applicationStatus, y.applicationStatus);
        case 'aiScore': return cmpNum(x.aiScore, y.aiScore);
        case 'humanScore': return cmpNum(x.humanScore, y.humanScore);
        case 'delta': return cmpNum(x.delta, y.delta);
        case 'absDelta':
          return cmpNum(x.delta != null ? Math.abs(x.delta) : null, y.delta != null ? Math.abs(y.delta) : null);
        case 'orchestratorCoverage': return cmpNum(x.orchestratorCoverage, y.orchestratorCoverage);
        case 'completion': return cmpNum(x.completionPercentage, y.completionPercentage);
        case 'lastActivity': return cmpDate(x.lastActivityAt, y.lastActivityAt);
        case 'appliedAt': return cmpDate(x.appliedAt, y.appliedAt);
        default: return 0;
      }
    });
    return arr;
  })();
  const candidates = sortedCandidates;

  const toggleSort = (key: SortKey, _e?: React.MouseEvent) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      // Strings default ascending (A→Z); everything else descending (high→low).
      setSortDir(key === 'name' || key === 'status' ? 'asc' : 'desc');
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-800 font-medium">Error loading position</p>
            <p className="text-red-600 text-sm mt-1">{error.message}</p>
            <Link
              href={`/organizations/${orgId}/positions`}
              className="inline-flex items-center mt-4 text-sm text-blue-700 hover:text-blue-900"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-1" /> Back to positions
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!position) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Position not found.</div>
      </div>
    );
  }

  const orgName = orgData?.organization?.name || 'Organization';

  const scoredCount = candidates.filter(c => c.aiScore != null).length;
  const reviewedCount = candidates.filter(c => c.humanScore != null).length;
  const deltas = candidates
    .map(c => c.delta)
    .filter((d): d is number => d != null);
  const avgDelta = deltas.length
    ? deltas.reduce((s, d) => s + d, 0) / deltas.length
    : null;
  const avgAi = (() => {
    const vals = candidates.map(c => c.aiScore).filter((x): x is number => x != null);
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
  })();
  const avgHuman = (() => {
    const vals = candidates.map(c => c.humanScore).filter((x): x is number => x != null);
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
  })();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center text-xs text-gray-500 mb-2">
            <Link href="/organizations" className="hover:text-gray-900">Organizations</Link>
            <ChevronRightIcon className="h-3.5 w-3.5 mx-1" />
            <Link href={`/organizations/${orgId}`} className="hover:text-gray-900">{orgName}</Link>
            <ChevronRightIcon className="h-3.5 w-3.5 mx-1" />
            <Link href={`/organizations/${orgId}/positions`} className="hover:text-gray-900">Positions</Link>
            <ChevronRightIcon className="h-3.5 w-3.5 mx-1" />
            <span className="text-gray-900">{position.title}</span>
          </div>

          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <Link
                href={`/organizations/${orgId}/positions`}
                className="p-2 hover:bg-gray-100 rounded-lg mt-0.5"
                aria-label="Back to positions"
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </Link>
              <div>
                <div className="flex items-center space-x-3">
                  <BriefcaseIcon className="h-6 w-6 text-gray-400" />
                  <h1 className="text-2xl font-bold text-gray-900">{position.title}</h1>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(position.status)}`}>
                    {position.status}
                  </span>
                </div>
                <div className="mt-1 text-sm text-gray-600 space-x-3">
                  {position.department && <span>{position.department}</span>}
                  {position.location && <span>·  {position.location}</span>}
                  {position.employmentType && <span>·  {position.employmentType}</span>}
                </div>
                <div className="mt-1 text-xs text-gray-500 font-mono">{position.id}</div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {calibration?.driftDetected && (
                <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
                  <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                  Calibration drift: {calibration.driftDirection}
                </span>
              )}
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as StatusFilter)}
                className="px-3 py-2 border rounded-lg text-sm text-gray-900 bg-white"
              >
                <option value="">All applications</option>
                <option value="NEW">New</option>
                <option value="IN_REVIEW">In review</option>
                <option value="INTERVIEWED">Interviewed</option>
                <option value="OFFERED">Offered</option>
                <option value="HIRED">Hired</option>
                <option value="REJECTED">Rejected</option>
                <option value="WITHDRAWN">Withdrawn</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <KpiCard label="Applications" value={candidates.length} />
          <KpiCard label="AI scored" value={`${scoredCount}`} sub={avgAi != null ? `avg ${avgAi.toFixed(1)}` : undefined} />
          <KpiCard label="Human reviewed" value={`${reviewedCount}`} sub={avgHuman != null ? `avg ${avgHuman.toFixed(1)}` : undefined} />
          <KpiCard
            label="AI vs human Δ"
            value={avgDelta != null ? `${avgDelta > 0 ? '+' : ''}${avgDelta.toFixed(1)}` : '—'}
            sub={avgDelta != null ? (Math.abs(avgDelta) < 5 ? 'aligned' : avgDelta > 0 ? 'AI higher' : 'AI lower') : undefined}
            tone={avgDelta != null ? (Math.abs(avgDelta) < 5 ? 'ok' : Math.abs(avgDelta) < 12 ? 'warn' : 'alert') : 'neutral'}
          />
          <KpiCard label="Target hires" value={`${position.currentHires ?? 0} / ${position.targetHires ?? 0}`} />
        </div>

        {data?.diagnostics && scoredCount === 0 && data.diagnostics.candidatesWithSession > 0 && (
          <div className="mb-6 border-2 border-amber-300 bg-amber-50 rounded-lg p-4 text-xs text-amber-900">
            <div className="font-semibold mb-1">⚠ AI scored = 0 — diagnostic snapshot</div>
            <div className="text-amber-800">
              Of <strong>{data.diagnostics.applications}</strong> applications: <strong>{data.diagnostics.candidatesWithSession}</strong> have a journey session, <strong>{data.diagnostics.candidatesCompleted}</strong> are COMPLETED, <strong>{data.diagnostics.candidatesWithAiScore}</strong> resolved an AI score, <strong>{data.diagnostics.candidatesWithHumanScore}</strong> have a human review, <strong>{data.diagnostics.candidatesWithOrchestratorAssessments}</strong> have orchestrator question assessments. <span className="block mt-1">Click any completed candidate (e.g. Evelyn or Annette) to see the per-response score-source diagnostic banner inline.</span>
            </div>
          </div>
        )}

        {/* Candidates table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">
              Candidates <span className="text-sm font-normal text-gray-500">({candidates.length})</span>
            </h2>
            <div className="text-xs text-gray-500">
              Click a header to sort. Shift-click <span className="font-mono">Δ</span> to sort by |Δ| (largest disagreement). Click any row for full AI forensics.
            </div>
          </div>
          {candidates.length === 0 ? (
            <div className="p-12 text-center text-gray-500 text-sm">
              No applications match the current filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <SortableTh sortKey="name" current={sortKey} dir={sortDir} onClick={toggleSort}>Candidate</SortableTh>
                    <SortableTh sortKey="status" current={sortKey} dir={sortDir} onClick={toggleSort}>Status</SortableTh>
                    <SortableTh sortKey="aiScore" current={sortKey} dir={sortDir} onClick={toggleSort} align="right">AI score</SortableTh>
                    <SortableTh sortKey="humanScore" current={sortKey} dir={sortDir} onClick={toggleSort} align="right">Human score</SortableTh>
                    <SortableTh sortKey="delta" current={sortKey} dir={sortDir} onClick={toggleSort} align="right" tooltip="Click to sort by signed Δ. Shift-click to sort by |Δ| (largest disagreement first).">Δ</SortableTh>
                    <SortableTh sortKey="orchestratorCoverage" current={sortKey} dir={sortDir} onClick={toggleSort} align="right">Conv. LLM coverage</SortableTh>
                    <SortableTh sortKey="completion" current={sortKey} dir={sortDir} onClick={toggleSort} align="right">Progress</SortableTh>
                    <SortableTh sortKey="lastActivity" current={sortKey} dir={sortDir} onClick={toggleSort} align="right">Last activity</SortableTh>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {candidates.map(c => (
                    <CandidateRow
                      key={c.applicationId}
                      c={c}
                      hrefRoot={`/organizations/${orgId}/positions/${positionId}/candidates/${c.candidateId}`}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
      {children}
    </th>
  );
}

function SortableTh({
  sortKey,
  current,
  dir,
  onClick,
  children,
  align = 'left',
  tooltip,
}: {
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onClick: (k: SortKey, e?: React.MouseEvent) => void;
  children: React.ReactNode;
  align?: 'left' | 'right';
  tooltip?: string;
}) {
  const active = current === sortKey;
  const arrow = !active ? '↕' : dir === 'asc' ? '↑' : '↓';
  return (
    <th
      className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-900 ${align === 'right' ? 'text-right' : 'text-left'}`}
      onClick={(e) => {
        // Shift-click on Δ column sorts by absolute value (largest disagreement)
        if (sortKey === 'delta' && e.shiftKey) {
          onClick('absDelta', e);
        } else {
          onClick(sortKey, e);
        }
      }}
      title={tooltip || `Sort by ${typeof children === 'string' ? children : sortKey}`}
    >
      <span className={`inline-flex items-center ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
        <span>{children}</span>
        <span className={`ml-1 ${active ? 'text-gray-900' : 'text-gray-300'}`}>{arrow}</span>
      </span>
    </th>
  );
}

function CandidateRow({ c, hrefRoot }: { c: any; hrefRoot: string }) {
  const scoreUrl = c.sessionId ? `${hrefRoot}?sessionId=${c.sessionId}` : hrefRoot;
  return (
    <tr
      className="hover:bg-gray-50 cursor-pointer"
      onClick={() => {
        window.location.href = scoreUrl;
      }}
    >
      <td className="px-6 py-4">
        <div className="flex items-center space-x-3">
          <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
            <UserIcon className="h-4 w-4 text-gray-500" />
          </div>
          <div>
            <Link
              href={scoreUrl}
              className="text-sm font-medium text-blue-700 hover:text-blue-900 hover:underline"
              onClick={e => e.stopPropagation()}
            >
              {c.candidateName}
            </Link>
            <div className="text-xs text-gray-500">{c.candidateEmail || '—'}</div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${appStatusColor(c.applicationStatus)}`}>
          {c.applicationStatus}
        </span>
        {c.applicationStage && (
          <div className="text-xs text-gray-500 mt-0.5">{c.applicationStage}</div>
        )}
      </td>
      <td className="px-6 py-4 text-sm">
        {c.aiScore != null ? (
          <ScoreBar value={c.aiScore} color="blue" />
        ) : (
          <span className="text-gray-400 text-xs">not scored</span>
        )}
      </td>
      <td className="px-6 py-4 text-sm">
        {c.humanScore != null ? (
          <ScoreBar value={c.humanScore} color="emerald" />
        ) : (
          <span className="text-gray-400 text-xs">not reviewed</span>
        )}
      </td>
      <td className="px-6 py-4 text-sm">
        <DeltaBadge delta={c.delta} />
      </td>
      <td className="px-6 py-4">
        {c.orchestratorCoverage != null ? (
          <div className="flex items-center space-x-2">
            <div className="w-24 bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${c.orchestratorCoverage >= 80 ? 'bg-emerald-500' : c.orchestratorCoverage >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                style={{ width: `${Math.min(100, c.orchestratorCoverage)}%` }}
              />
            </div>
            <span className="text-xs text-gray-600 tabular-nums">{c.orchestratorCoverage}%</span>
          </div>
        ) : (
          <span className="text-gray-400 text-xs">—</span>
        )}
        <div className="text-xs text-gray-400 mt-0.5">{c.orchestratorAssessed} Q</div>
      </td>
      <td className="px-6 py-4 text-sm text-gray-900">
        <div className="flex items-center space-x-2">
          <div className="w-20 bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full"
              style={{ width: `${Math.min(100, c.completionPercentage || 0)}%` }}
            />
          </div>
          <span className="text-xs text-gray-600 tabular-nums">{Math.round(c.completionPercentage || 0)}%</span>
        </div>
        <div className="text-xs text-gray-500 mt-0.5">{c.sessionStatus || '—'}</div>
      </td>
      <td className="px-6 py-4 text-sm text-gray-500">
        {c.lastActivityAt ? new Date(c.lastActivityAt).toLocaleString() : '—'}
      </td>
    </tr>
  );
}

function ScoreBar({ value, color }: { value: number; color: 'blue' | 'emerald' }) {
  const bar = color === 'blue' ? 'bg-blue-500' : 'bg-emerald-500';
  const rounded = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center space-x-2">
      <div className="w-20 bg-gray-200 rounded-full h-2">
        <div className={`${bar} h-2 rounded-full`} style={{ width: `${rounded}%` }} />
      </div>
      <span className="text-xs tabular-nums text-gray-700">{value.toFixed(0)}</span>
    </div>
  );
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta == null) return <span className="text-gray-400 text-xs">—</span>;
  const abs = Math.abs(delta);
  const tone =
    abs < 5 ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : abs < 12 ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-red-50 text-red-700 border-red-200';
  const sign = delta > 0 ? '+' : '';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${tone}`}>
      {sign}{delta.toFixed(1)}
    </span>
  );
}

function KpiCard({
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: 'neutral' | 'ok' | 'warn' | 'alert';
}) {
  const toneCls =
    tone === 'ok' ? 'border-emerald-200 bg-emerald-50'
    : tone === 'warn' ? 'border-amber-200 bg-amber-50'
    : tone === 'alert' ? 'border-red-200 bg-red-50'
    : 'border-gray-200 bg-white';
  return (
    <div className={`rounded-lg border ${toneCls} p-4`}>
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-900 tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-xs text-gray-600">{sub}</div>}
    </div>
  );
}

function getStatusColor(status: string) {
  switch (status) {
    case 'OPEN': return 'bg-green-100 text-green-800';
    case 'DRAFT': return 'bg-gray-100 text-gray-800';
    case 'ON_HOLD': return 'bg-yellow-100 text-yellow-800';
    case 'CLOSED': return 'bg-red-100 text-red-800';
    case 'FILLED': return 'bg-blue-100 text-blue-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

function appStatusColor(status: string) {
  switch (status) {
    case 'NEW': return 'bg-blue-100 text-blue-800';
    case 'IN_REVIEW': return 'bg-amber-100 text-amber-800';
    case 'INTERVIEWED': return 'bg-indigo-100 text-indigo-800';
    case 'OFFERED': return 'bg-purple-100 text-purple-800';
    case 'HIRED': return 'bg-emerald-100 text-emerald-800';
    case 'REJECTED': return 'bg-red-100 text-red-800';
    case 'WITHDRAWN': return 'bg-gray-100 text-gray-700';
    default: return 'bg-gray-100 text-gray-800';
  }
}

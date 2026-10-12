'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AlertTriangle, ArrowLeft, Briefcase, User, Users } from 'lucide-react';
import { AdminPage } from '@/components/admin/page-chrome';
import { PageHeader } from '@/components/admin/page-header';
import { SectionCard } from '@/components/admin/section-card';
import { StatGrid, StatTile } from '@/components/admin/stat-tile';
import { StatusPill, type StatusTone } from '@/components/admin/status-pill';
import { EmptyState } from '@/components/admin/empty-state';
import { DataTableEl } from '@/components/admin/data-table';
import { buttonClass, selectClass } from '@/components/admin/controls';

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
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-admin-accent border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <AdminPage>
        <div className="rounded-admin border border-admin-danger/30 bg-admin-danger-soft p-6">
          <p className="font-medium text-red-800">Error loading position</p>
          <p className="mt-1 text-sm text-admin-danger">{error.message}</p>
          <Link
            href={`/organizations/${orgId}/positions`}
            className={`${buttonClass.secondary} mt-4`}
          >
            <ArrowLeft className="h-4 w-4" /> Back to positions
          </Link>
        </div>
      </AdminPage>
    );
  }

  if (!position) {
    return (
      <AdminPage>
        <EmptyState icon={<Briefcase />} title="Position not found." />
      </AdminPage>
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
    <AdminPage>
      <PageHeader
        icon={<Briefcase />}
        breadcrumbs={[
          { label: 'Organizations', href: '/organizations' },
          { label: orgName, href: `/organizations/${orgId}` },
          { label: 'Positions', href: `/organizations/${orgId}/positions` },
          { label: position.title },
        ]}
        title={position.title}
        meta={<StatusPill tone={getStatusTone(position.status)}>{position.status}</StatusPill>}
        description={
          <>
            <span className="space-x-3">
              {position.department && <span>{position.department}</span>}
              {position.location && <span>·  {position.location}</span>}
              {position.employmentType && <span>·  {position.employmentType}</span>}
            </span>
            <span className="admin-mono mt-1 block text-xs text-admin-muted">{position.id}</span>
          </>
        }
        actions={
          <>
            <Link
              href={`/organizations/${orgId}/positions`}
              className={buttonClass.secondary}
              aria-label="Back to positions"
            >
              <ArrowLeft className="h-4 w-4" />
              Positions
            </Link>
            {calibration?.driftDetected && (
              <span className="inline-flex items-center gap-1 rounded-admin-sm border border-admin-warn/25 bg-admin-warn-soft px-3 py-2 text-xs font-medium text-amber-800">
                <AlertTriangle className="h-4 w-4" />
                Calibration drift: {calibration.driftDirection}
              </span>
            )}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as StatusFilter)}
              className={selectClass}
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
          </>
        }
      />

      {/* KPI strip */}
      <StatGrid cols={5} className="mb-6">
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
      </StatGrid>

      {data?.diagnostics && scoredCount === 0 && data.diagnostics.candidatesWithSession > 0 && (
        <div className="mb-6 flex gap-2.5 rounded-admin-sm border border-admin-warn/25 bg-admin-warn-soft p-4 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-admin-warn" />
          <div>
            <div className="mb-1 font-semibold">AI scored = 0 — diagnostic snapshot</div>
            <div className="text-amber-800">
              Of <strong>{data.diagnostics.applications}</strong> applications: <strong>{data.diagnostics.candidatesWithSession}</strong> have a journey session, <strong>{data.diagnostics.candidatesCompleted}</strong> are COMPLETED, <strong>{data.diagnostics.candidatesWithAiScore}</strong> resolved an AI score, <strong>{data.diagnostics.candidatesWithHumanScore}</strong> have a human review, <strong>{data.diagnostics.candidatesWithOrchestratorAssessments}</strong> have orchestrator question assessments. <span className="mt-1 block">Click any completed candidate (e.g. Evelyn or Annette) to see the per-response score-source diagnostic banner inline.</span>
            </div>
          </div>
        </div>
      )}

      {/* Candidates table */}
      <SectionCard
        icon={<Users />}
        title={<>Candidates <span className="text-sm font-normal text-admin-muted">({candidates.length})</span></>}
        description={<>Click a header to sort. Shift-click <span className="font-mono">Δ</span> to sort by |Δ| (largest disagreement). Click any row for full AI forensics.</>}
        padded={false}
      >
        {candidates.length === 0 ? (
          <EmptyState
            compact
            className="border-0 shadow-none"
            icon={<Users />}
            title="No applications match the current filter."
          />
        ) : (
          <div className="overflow-x-auto">
            <DataTableEl>
              <thead>
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
              <tbody>
                {candidates.map(c => (
                  <CandidateRow
                    key={c.applicationId}
                    c={c}
                    hrefRoot={`/organizations/${orgId}/positions/${positionId}/candidates/${c.candidateId}`}
                  />
                ))}
              </tbody>
            </DataTableEl>
          </div>
        )}
      </SectionCard>
    </AdminPage>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="bg-admin-bg/70 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-admin-muted">
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
      className={`cursor-pointer select-none whitespace-nowrap bg-admin-bg/70 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-admin-muted hover:text-admin-ink ${align === 'right' ? 'text-right' : 'text-left'}`}
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
        <span className={`ml-1 ${active ? 'text-admin-ink' : 'text-admin-border-strong'}`}>{arrow}</span>
      </span>
    </th>
  );
}

function CandidateRow({ c, hrefRoot }: { c: any; hrefRoot: string }) {
  const scoreUrl = c.sessionId ? `${hrefRoot}?sessionId=${c.sessionId}` : hrefRoot;
  return (
    <tr
      className="cursor-pointer"
      onClick={() => {
        window.location.href = scoreUrl;
      }}
    >
      <td className="px-4 py-3">
        <div className="flex items-center space-x-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-admin-border bg-admin-bg">
            <User className="h-4 w-4 text-admin-muted" />
          </div>
          <div>
            <Link
              href={scoreUrl}
              className="text-sm font-medium text-admin-ink hover:text-admin-accent-ink hover:underline"
              onClick={e => e.stopPropagation()}
            >
              {c.candidateName}
            </Link>
            <div className="text-xs text-admin-muted">{c.candidateEmail || '—'}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <StatusPill tone={appStatusTone(c.applicationStatus)}>{c.applicationStatus}</StatusPill>
        {c.applicationStage && (
          <div className="mt-0.5 text-xs text-admin-muted">{c.applicationStage}</div>
        )}
      </td>
      <td className="px-4 py-3 text-sm">
        {c.aiScore != null ? (
          <ScoreBar value={c.aiScore} color="blue" />
        ) : (
          <span className="text-xs text-admin-muted">not scored</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm">
        {c.humanScore != null ? (
          <ScoreBar value={c.humanScore} color="emerald" />
        ) : (
          <span className="text-xs text-admin-muted">not reviewed</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm">
        <DeltaBadge delta={c.delta} />
      </td>
      <td className="px-4 py-3">
        {c.orchestratorCoverage != null ? (
          <div className="flex items-center space-x-2">
            <div className="h-1.5 w-24 rounded-full bg-slate-100">
              <div
                className={`h-1.5 rounded-full ${c.orchestratorCoverage >= 80 ? 'bg-emerald-500' : c.orchestratorCoverage >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                style={{ width: `${Math.min(100, c.orchestratorCoverage)}%` }}
              />
            </div>
            <span className="text-xs tabular-nums text-admin-secondary">{c.orchestratorCoverage}%</span>
          </div>
        ) : (
          <span className="text-xs text-admin-muted">—</span>
        )}
        <div className="mt-0.5 text-xs text-admin-muted">{c.orchestratorAssessed} Q</div>
      </td>
      <td className="px-4 py-3 text-sm text-admin-ink">
        <div className="flex items-center space-x-2">
          <div className="h-1.5 w-20 rounded-full bg-slate-100">
            <div
              className="h-1.5 rounded-full bg-admin-accent"
              style={{ width: `${Math.min(100, c.completionPercentage || 0)}%` }}
            />
          </div>
          <span className="text-xs tabular-nums text-admin-secondary">{Math.round(c.completionPercentage || 0)}%</span>
        </div>
        <div className="mt-0.5 text-xs text-admin-muted">{c.sessionStatus || '—'}</div>
      </td>
      <td className="px-4 py-3 text-right text-sm text-admin-muted">
        {c.lastActivityAt ? new Date(c.lastActivityAt).toLocaleString() : '—'}
      </td>
    </tr>
  );
}

function ScoreBar({ value, color }: { value: number; color: 'blue' | 'emerald' }) {
  const bar = color === 'blue' ? 'bg-sky-500' : 'bg-emerald-500';
  const rounded = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center space-x-2">
      <div className="h-1.5 w-20 rounded-full bg-slate-100">
        <div className={`${bar} h-1.5 rounded-full`} style={{ width: `${rounded}%` }} />
      </div>
      <span className="text-xs tabular-nums text-admin-secondary">{value.toFixed(0)}</span>
    </div>
  );
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta == null) return <span className="text-xs text-admin-muted">—</span>;
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
  const statTone = tone === 'ok' ? 'ok' : tone === 'warn' ? 'warn' : tone === 'alert' ? 'critical' : 'muted';
  return <StatTile label={label} value={value} hint={sub} tone={statTone} />;
}

function getStatusTone(status: string): StatusTone {
  switch (status) {
    case 'OPEN': return 'success';
    case 'DRAFT': return 'neutral';
    case 'ON_HOLD': return 'warn';
    case 'CLOSED': return 'danger';
    case 'FILLED': return 'info';
    default: return 'neutral';
  }
}

function appStatusTone(status: string): StatusTone {
  switch (status) {
    case 'NEW': return 'info';
    case 'IN_REVIEW': return 'warn';
    case 'INTERVIEWED': return 'brand';
    case 'OFFERED': return 'brand';
    case 'HIRED': return 'success';
    case 'REJECTED': return 'danger';
    case 'WITHDRAWN': return 'neutral';
    default: return 'neutral';
  }
}

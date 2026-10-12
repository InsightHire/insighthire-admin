'use client';
export const dynamic = 'force-dynamic';

/**
 * Scoring runs review — every response the scoring engine processed, with a
 * full drill-down: what the AI saw (transcript), what it decided (score,
 * dimensions, recommendation), and why (rationale, strengths, red flags),
 * plus the scoring event timeline (model/prompt versions, score changes).
 */
import { useState } from 'react';
import { AlertTriangle, Bot, X } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { AdminPageChrome } from '@/components/admin/page-chrome';
import { SectionCard, DetailList } from '@/components/admin/section-card';
import { StatusPill, type StatusTone } from '@/components/admin/status-pill';
import { EmptyState } from '@/components/admin/empty-state';
import { DataTableEl, Th, Td } from '@/components/admin/data-table';
import { buttonClass, checkboxClass, selectClass } from '@/components/admin/controls';

const STATUS_TONE: Record<string, StatusTone> = {
  COMPLETED: 'success',
  PROCESSING: 'info',
  PENDING: 'neutral',
  FAILED: 'danger',
};

/** aiAnalysis keys rendered as 0-100 dimension bars, in display order. */
const DIMENSION_KEYS: Array<[string, string]> = [
  ['overallScore', 'Overall'],
  ['hireRecommendation', 'Hire recommendation'],
  ['culturalFit', 'Cultural fit'],
  ['analyticalThinking', 'Analytical thinking'],
  ['creativeProblemSolving', 'Creative problem solving'],
  ['decisionMaking', 'Decision making'],
  ['leadership', 'Leadership'],
  ['influence', 'Influence'],
  ['emotionalIntelligence', 'Emotional intelligence'],
  ['situationClarity', 'Situation clarity (STAR)'],
  ['taskDefinition', 'Task definition (STAR)'],
  ['actionSpecificity', 'Action specificity (STAR)'],
  ['resultQuantification', 'Result quantification (STAR)'],
  ['starMethodScore', 'STAR method'],
  ['confidenceLevel', 'Model confidence'],
];

const LIST_KEYS: Array<[string, string, string]> = [
  ['keyStrengths', 'Key strengths', 'text-green-700'],
  ['redFlags', 'Red flags', 'text-red-700'],
  ['developmentAreas', 'Development areas', 'text-amber-700'],
  ['standoutMoments', 'Standout moments', 'text-admin-accent-ink'],
];

function ScoreBadge({ value }: { value: number | null }) {
  if (value == null) return <span className="text-admin-muted">—</span>;
  const color = value >= 70 ? 'text-green-700' : value >= 40 ? 'text-amber-700' : 'text-red-700';
  return <span className={`font-semibold tabular-nums ${color}`}>{Math.round(value)}</span>;
}

function DimensionBar({ label, value }: { label: string; value: number }) {
  const color = value >= 70 ? 'bg-green-500' : value >= 40 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <span className="w-52 shrink-0 text-xs text-admin-secondary">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full ${color}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
      <span className="w-8 text-right text-xs tabular-nums text-admin-ink">{Math.round(value)}</span>
    </div>
  );
}

function SubHeading({ children, className = 'text-admin-muted' }: { children: React.ReactNode; className?: string }) {
  return <h3 className={`mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] ${className}`}>{children}</h3>;
}

function RunDetail({ responseId, onClose }: { responseId: string; onClose: () => void }) {
  const detail = (trpc as any).platformAdmin.getScoringRunDetail.useQuery({ responseId });
  const [showTranscript, setShowTranscript] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  if (detail.isLoading) {
    return (
      <div className="admin-panel p-6 text-sm text-admin-muted">Loading run detail…</div>
    );
  }
  if (detail.error || !detail.data) {
    return (
      <div className="admin-panel p-6 text-sm text-red-700">
        {detail.error?.message || 'Failed to load run.'}
      </div>
    );
  }

  const { response, events } = detail.data;
  const session = response.journey_sessions;
  const candidate = session?.candidate_profiles;
  const ai = (response.aiAnalysis ?? null) as Record<string, unknown> | null;
  const dims = ai
    ? DIMENSION_KEYS.filter(([k]) => typeof ai[k] === 'number').map(([k, label]) => ({ label, value: ai[k] as number }))
    : [];

  return (
    <SectionCard
      icon={<Bot />}
      title={[candidate?.firstName, candidate?.lastName].filter(Boolean).join(' ') || candidate?.email || 'Candidate'}
      description={
        <>
          {session?.positions?.title || 'No position'} · {session?.organizations?.name} ·{' '}
          {session?.candidate_journeys?.name}
        </>
      }
      actions={
        <>
          <StatusPill tone={STATUS_TONE[response.status] || STATUS_TONE.PENDING}>{response.status}</StatusPill>
          <button onClick={onClose} className={buttonClass.ghost} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </>
      }
      className="border-admin-accent-border"
    >
      <div className="space-y-6">
        {response.processingError && (
          <div className="flex items-start gap-2 rounded-admin-sm border border-admin-danger/20 bg-admin-danger-soft px-3 py-2 text-sm text-red-800">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-medium">Processing error</p>
              <p className="whitespace-pre-wrap">{response.processingError}</p>
            </div>
          </div>
        )}

        <div className="rounded-admin-sm border border-admin-border bg-admin-bg/50 p-4">
          <DetailList
            cols={4}
            items={[
              { label: 'Response score', value: <span className="text-xl"><ScoreBadge value={response.score} /></span> },
              { label: 'Confidence', value: <span className="text-xl"><ScoreBadge value={response.confidence} /></span> },
              {
                label: 'Session overall',
                value: (
                  <span className="text-xl">
                    <ScoreBadge value={session?.overallScore != null ? Number(session.overallScore) : null} />
                  </span>
                ),
              },
              { label: 'Processed', value: response.processedAt ? new Date(response.processedAt).toLocaleString() : '—' },
            ]}
          />
        </div>

        {response.questions?.text && (
          <div>
            <SubHeading>Question</SubHeading>
            <p className="text-sm text-admin-ink">{response.questions.text}</p>
          </div>
        )}

        {typeof ai?.hiringRecommendationLevel === 'string' && (
          <div>
            <SubHeading>AI recommendation</SubHeading>
            <p className="text-sm font-semibold text-admin-ink">{String(ai.hiringRecommendationLevel).replace(/_/g, ' ')}</p>
            {typeof ai.rationale === 'string' && (
              <p className="mt-1 whitespace-pre-wrap text-sm text-admin-secondary">{ai.rationale}</p>
            )}
          </div>
        )}

        {dims.length > 0 && (
          <div>
            <SubHeading>Score breakdown</SubHeading>
            <div className="space-y-1.5">
              {dims.map((d) => (
                <DimensionBar key={d.label} label={d.label} value={d.value} />
              ))}
            </div>
          </div>
        )}

        {ai && LIST_KEYS.some(([k]) => Array.isArray(ai[k]) && (ai[k] as unknown[]).length > 0) && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {LIST_KEYS.map(([key, label, color]) => {
              const items = Array.isArray(ai[key]) ? (ai[key] as unknown[]) : [];
              if (items.length === 0) return null;
              return (
                <div key={key} className="rounded-admin-sm border border-admin-border p-3">
                  <SubHeading className={color}>{label}</SubHeading>
                  <ul className="list-disc space-y-0.5 pl-5 text-sm text-admin-secondary">
                    {items.map((item, i) => (
                      <li key={i}>{String(item)}</li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}

        {events.length > 0 && (
          <div>
            <SubHeading>Scoring event timeline</SubHeading>
            <div className="divide-y divide-admin-border rounded-admin-sm border border-admin-border">
              {events.map((e: any) => (
                <div key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                  <span className="text-xs tabular-nums text-admin-muted">{new Date(e.createdAt).toLocaleString()}</span>
                  <StatusPill tone="neutral" dot={false}>{e.eventType}</StatusPill>
                  {e.scoreBefore != null || e.scoreAfter != null ? (
                    <span className="tabular-nums text-admin-ink">
                      {e.scoreBefore ?? '—'} → {e.scoreAfter ?? '—'}
                      {e.delta != null && (
                        <span className={e.delta >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {' '}({e.delta >= 0 ? '+' : ''}{e.delta})
                        </span>
                      )}
                    </span>
                  ) : null}
                  {e.humanScore != null && <span className="text-xs text-admin-muted">human: {e.humanScore}</span>}
                  {(e.modelVersion || e.promptVersion) && (
                    <span className="admin-mono text-xs text-admin-muted">
                      {[e.modelVersion, e.promptVersion].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {response.transcript && (
          <div>
            <button
              onClick={() => setShowTranscript(!showTranscript)}
              className="text-sm font-medium text-admin-accent hover:text-admin-accent-ink"
            >
              {showTranscript ? 'Hide transcript' : `Show transcript (${response.transcript.length.toLocaleString()} chars)`}
            </button>
            {showTranscript && (
              <p className="mt-2 max-h-96 overflow-y-auto whitespace-pre-wrap rounded-admin-sm bg-admin-bg p-4 text-sm text-admin-secondary">
                {response.transcript}
              </p>
            )}
          </div>
        )}

        {ai && (
          <div>
            <button
              onClick={() => setShowRaw(!showRaw)}
              className="text-sm font-medium text-admin-accent hover:text-admin-accent-ink"
            >
              {showRaw ? 'Hide raw evaluation JSON' : 'Show raw evaluation JSON'}
            </button>
            {showRaw && (
              <pre className="mt-2 max-h-96 overflow-x-auto overflow-y-auto rounded-admin-sm bg-slate-900 p-4 text-xs text-slate-100">
                {JSON.stringify(ai, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </SectionCard>
  );
}

export default function ScoringRunsPage() {
  useAdminAuth();
  // Supports deep links like /scoring/runs?org=<id> from the drift alerts.
  const [orgFilter, setOrgFilter] = useState(() =>
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('org') ?? ''
      : '',
  );
  const [statusFilter, setStatusFilter] = useState('');
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);

  const { data: orgs } = (trpc as any).platformAdmin.listOrganizations.useQuery({ page: 1, limit: 100 });
  const runsQuery = (trpc as any).platformAdmin.listScoringRuns.useQuery(
    {
      organizationId: orgFilter || undefined,
      status: statusFilter || undefined,
      onlyErrors: onlyErrors || undefined,
      limit: 50,
      cursor,
    },
    { keepPreviousData: true },
  );

  const runs: any[] = runsQuery.data?.runs ?? [];

  return (
    <AuthenticatedLayout>
      <AdminPageChrome
        icon={<Bot />}
        breadcrumbs={[{ label: 'Operations' }, { label: 'Scoring runs' }]}
        title="Scoring runs"
        description="Every response the scoring engine processed — click a run to see what the AI decided and why."
      >
      <div className="space-y-6">
        <div className="admin-panel flex flex-wrap items-center gap-3 px-3 py-2.5">
          <select
            value={orgFilter}
            onChange={(e) => { setOrgFilter(e.target.value); setCursor(undefined); }}
            className={selectClass}
          >
            <option value="">All organizations</option>
            {(orgs?.organizations ?? []).map((o: any) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCursor(undefined); }}
            className={selectClass}
          >
            <option value="">All statuses</option>
            <option value="COMPLETED">Completed</option>
            <option value="PROCESSING">Processing</option>
            <option value="PENDING">Pending</option>
            <option value="FAILED">Failed</option>
          </select>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-admin-secondary">
            <input
              type="checkbox"
              checked={onlyErrors}
              onChange={(e) => { setOnlyErrors(e.target.checked); setCursor(undefined); }}
              className={checkboxClass}
            />
            Errors only
          </label>
        </div>

        {selectedRun && <RunDetail responseId={selectedRun} onClose={() => setSelectedRun(null)} />}

        <SectionCard icon={<Bot />} title="Runs" description="Newest first, 50 at a time" padded={false}>
          {runsQuery.isLoading ? (
            <p className="px-5 py-8 text-center text-sm text-admin-muted">Loading scoring runs…</p>
          ) : runs.length === 0 ? (
            <EmptyState compact className="border-0 shadow-none" icon={<Bot />} title="No scoring runs match these filters." />
          ) : (
          <div className="overflow-x-auto">
          <DataTableEl>
            <thead>
              <tr>
                <Th>Submitted</Th>
                <Th>Organization</Th>
                <Th>Candidate</Th>
                <Th>Position</Th>
                <Th>Type</Th>
                <Th>Status</Th>
                <Th className="text-right">Score</Th>
                <Th className="text-right">Conf.</Th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedRun(r.id)}
                    className={`cursor-pointer ${selectedRun === r.id ? 'bg-admin-accent-soft' : ''}`}
                  >
                    <Td className="whitespace-nowrap text-admin-muted">
                      {new Date(r.submittedAt).toLocaleString()}
                    </Td>
                    <Td>{r.organizationName}</Td>
                    <Td className="font-medium text-admin-ink">{r.candidateName}</Td>
                    <Td>{r.positionTitle || '—'}</Td>
                    <Td className="text-admin-muted">{r.responseType}</Td>
                    <Td className="whitespace-nowrap">
                      <StatusPill tone={STATUS_TONE[r.status] || STATUS_TONE.PENDING}>{r.status}</StatusPill>
                      {r.processingError && (
                        <AlertTriangle className="ml-1 inline h-4 w-4 text-red-500" />
                      )}
                    </Td>
                    <Td className="text-right"><ScoreBadge value={r.score} /></Td>
                    <Td className="text-right tabular-nums text-admin-muted">
                      {r.confidence != null ? Math.round(r.confidence) : '—'}
                    </Td>
                  </tr>
              ))}
            </tbody>
          </DataTableEl>
          </div>
          )}
        </SectionCard>

        {runsQuery.data?.nextCursor && (
          <div className="flex justify-center">
            <button
              onClick={() => setCursor(runsQuery.data.nextCursor)}
              className={buttonClass.secondary}
            >
              Load older runs
            </button>
          </div>
        )}
      </div>
      </AdminPageChrome>
    </AuthenticatedLayout>
  );
}

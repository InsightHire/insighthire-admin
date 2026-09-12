'use client';
export const dynamic = 'force-dynamic';

/**
 * Scoring runs review — every response the scoring engine processed, with a
 * full drill-down: what the AI saw (transcript), what it decided (score,
 * dimensions, recommendation), and why (rationale, strengths, red flags),
 * plus the scoring event timeline (model/prompt versions, score changes).
 */
import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

const STATUS_STYLES: Record<string, string> = {
  COMPLETED: 'bg-green-100 text-green-800',
  PROCESSING: 'bg-blue-100 text-blue-800',
  PENDING: 'bg-gray-100 text-gray-600',
  FAILED: 'bg-red-100 text-red-800',
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
  ['standoutMoments', 'Standout moments', 'text-indigo-700'],
];

function ScoreBadge({ value }: { value: number | null }) {
  if (value == null) return <span className="text-gray-400">—</span>;
  const color = value >= 70 ? 'text-green-700' : value >= 40 ? 'text-amber-700' : 'text-red-700';
  return <span className={`font-semibold tabular-nums ${color}`}>{Math.round(value)}</span>;
}

function DimensionBar({ label, value }: { label: string; value: number }) {
  const color = value >= 70 ? 'bg-green-500' : value >= 40 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <span className="w-52 shrink-0 text-xs text-gray-600">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
      <span className="w-8 text-right text-xs tabular-nums text-gray-700">{Math.round(value)}</span>
    </div>
  );
}

function RunDetail({ responseId, onClose }: { responseId: string; onClose: () => void }) {
  const detail = (trpc as any).platformAdmin.getScoringRunDetail.useQuery({ responseId });
  const [showTranscript, setShowTranscript] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  if (detail.isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-sm text-gray-400">Loading run detail…</div>
    );
  }
  if (detail.error || !detail.data) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-sm text-red-700">
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
    <div className="bg-white rounded-lg shadow">
      <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {[candidate?.firstName, candidate?.lastName].filter(Boolean).join(' ') || candidate?.email || 'Candidate'}
          </h2>
          <p className="text-sm text-gray-500">
            {session?.positions?.title || 'No position'} · {session?.organizations?.name} ·{' '}
            {session?.candidate_journeys?.name}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-2 py-1 text-xs rounded-full ${STATUS_STYLES[response.status] || STATUS_STYLES.PENDING}`}>
            {response.status}
          </span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="px-6 py-4 space-y-5">
        {response.processingError && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            <ExclamationTriangleIcon className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-medium">Processing error</p>
              <p className="whitespace-pre-wrap">{response.processingError}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Response score</p>
            <p className="text-xl"><ScoreBadge value={response.score} /></p>
          </div>
          <div>
            <p className="text-gray-500">Confidence</p>
            <p className="text-xl"><ScoreBadge value={response.confidence} /></p>
          </div>
          <div>
            <p className="text-gray-500">Session overall</p>
            <p className="text-xl">
              <ScoreBadge value={session?.overallScore != null ? Number(session.overallScore) : null} />
            </p>
          </div>
          <div>
            <p className="text-gray-500">Processed</p>
            <p className="text-sm text-gray-900">
              {response.processedAt ? new Date(response.processedAt).toLocaleString() : '—'}
            </p>
          </div>
        </div>

        {response.questions?.text && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Question</h3>
            <p className="text-sm text-gray-800">{response.questions.text}</p>
          </div>
        )}

        {typeof ai?.hiringRecommendationLevel === 'string' && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">AI recommendation</h3>
            <p className="text-sm font-semibold text-gray-900">{String(ai.hiringRecommendationLevel).replace(/_/g, ' ')}</p>
            {typeof ai.rationale === 'string' && (
              <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{ai.rationale}</p>
            )}
          </div>
        )}

        {dims.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Score breakdown</h3>
            <div className="space-y-1.5">
              {dims.map((d) => (
                <DimensionBar key={d.label} label={d.label} value={d.value} />
              ))}
            </div>
          </div>
        )}

        {ai && LIST_KEYS.some(([k]) => Array.isArray(ai[k]) && (ai[k] as unknown[]).length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {LIST_KEYS.map(([key, label, color]) => {
              const items = Array.isArray(ai[key]) ? (ai[key] as unknown[]) : [];
              if (items.length === 0) return null;
              return (
                <div key={key}>
                  <h3 className={`text-xs font-semibold uppercase tracking-wide mb-1 ${color}`}>{label}</h3>
                  <ul className="list-disc pl-5 text-sm text-gray-700 space-y-0.5">
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
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Scoring event timeline</h3>
            <div className="space-y-2">
              {events.map((e: any) => (
                <div key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm border-b border-gray-50 pb-2">
                  <span className="text-gray-400 tabular-nums text-xs">{new Date(e.createdAt).toLocaleString()}</span>
                  <span className="px-1.5 py-0.5 text-xs rounded bg-gray-100 text-gray-700">{e.eventType}</span>
                  {e.scoreBefore != null || e.scoreAfter != null ? (
                    <span className="tabular-nums text-gray-800">
                      {e.scoreBefore ?? '—'} → {e.scoreAfter ?? '—'}
                      {e.delta != null && (
                        <span className={e.delta >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {' '}({e.delta >= 0 ? '+' : ''}{e.delta})
                        </span>
                      )}
                    </span>
                  ) : null}
                  {e.humanScore != null && <span className="text-xs text-gray-500">human: {e.humanScore}</span>}
                  {(e.modelVersion || e.promptVersion) && (
                    <span className="text-xs text-gray-400">
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
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              {showTranscript ? 'Hide transcript' : `Show transcript (${response.transcript.length.toLocaleString()} chars)`}
            </button>
            {showTranscript && (
              <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                {response.transcript}
              </p>
            )}
          </div>
        )}

        {ai && (
          <div>
            <button
              onClick={() => setShowRaw(!showRaw)}
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              {showRaw ? 'Hide raw evaluation JSON' : 'Show raw evaluation JSON'}
            </button>
            {showRaw && (
              <pre className="mt-2 text-xs bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto max-h-96 overflow-y-auto">
                {JSON.stringify(ai, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ScoringRunsPage() {
  useAdminAuth();
  const [orgFilter, setOrgFilter] = useState('');
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Scoring runs</h1>
          <p className="text-sm text-gray-500">
            Every response the scoring engine processed — click a run to see what the AI decided and why.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={orgFilter}
            onChange={(e) => { setOrgFilter(e.target.value); setCursor(undefined); }}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
          >
            <option value="">All organizations</option>
            {(orgs?.organizations ?? []).map((o: any) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCursor(undefined); }}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
          >
            <option value="">All statuses</option>
            <option value="COMPLETED">Completed</option>
            <option value="PROCESSING">Processing</option>
            <option value="PENDING">Pending</option>
            <option value="FAILED">Failed</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyErrors}
              onChange={(e) => { setOnlyErrors(e.target.checked); setCursor(undefined); }}
              className="rounded border-gray-300"
            />
            Errors only
          </label>
        </div>

        {selectedRun && <RunDetail responseId={selectedRun} onClose={() => setSelectedRun(null)} />}

        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
                <th className="px-4 py-2.5 font-medium">Submitted</th>
                <th className="px-4 py-2.5 font-medium">Organization</th>
                <th className="px-4 py-2.5 font-medium">Candidate</th>
                <th className="px-4 py-2.5 font-medium">Position</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium text-right">Score</th>
                <th className="px-4 py-2.5 font-medium text-right">Conf.</th>
              </tr>
            </thead>
            <tbody>
              {runsQuery.isLoading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Loading scoring runs…</td></tr>
              ) : runs.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No scoring runs match these filters.</td></tr>
              ) : (
                runs.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedRun(r.id)}
                    className={`border-b border-gray-50 cursor-pointer hover:bg-gray-50 ${selectedRun === r.id ? 'bg-blue-50' : ''}`}
                  >
                    <td className="px-4 py-2.5 whitespace-nowrap text-gray-500">
                      {new Date(r.submittedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-gray-700">{r.organizationName}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-900">{r.candidateName}</td>
                    <td className="px-4 py-2.5 text-gray-600">{r.positionTitle || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-500">{r.responseType}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${STATUS_STYLES[r.status] || STATUS_STYLES.PENDING}`}>
                        {r.status}
                      </span>
                      {r.processingError && (
                        <ExclamationTriangleIcon className="inline h-4 w-4 ml-1 text-red-500" />
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right"><ScoreBadge value={r.score} /></td>
                    <td className="px-4 py-2.5 text-right text-gray-500 tabular-nums">
                      {r.confidence != null ? Math.round(r.confidence) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {runsQuery.data?.nextCursor && (
          <div className="flex justify-center">
            <button
              onClick={() => setCursor(runsQuery.data.nextCursor)}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Load older runs
            </button>
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
}

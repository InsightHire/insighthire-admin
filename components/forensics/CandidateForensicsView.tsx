'use client';

import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { trpc } from '@/lib/trpc';
import {
  ScoreBar,
  DeltaBadge,
  KpiCard,
  SectionHeading,
  ValueList,
  StatusChip,
  JsonViewer,
} from './primitives';
import { QuestionCard } from './QuestionCard';

type Props = {
  data: any;
  onSessionChange?: (sessionId: string) => void;
  onRefresh?: () => void;
};

export function CandidateForensicsView({ data, onSessionChange, onRefresh }: Props) {
  const [tab, setTab] = useState('overview');

  const sessions: any[] = data.sessions || [];
  const selected = data.selectedSession;
  const responses: any[] = data.responses || [];
  const calibration = data.calibration;
  const humanFeedback = data.humanFeedback;

  const resetMutation = trpc.platformAdmin.resetJourneyResponse.useMutation({
    onSuccess: () => onRefresh?.(),
  });
  const retryMutation = trpc.platformAdmin.retryStuckCandidate.useMutation({
    onSuccess: () => onRefresh?.(),
  });

  const hasStuck = responses.some(r => {
    const s = (r.status || '').toUpperCase();
    return s === 'PENDING' || s === 'PROCESSING' || s === 'FAILED';
  });

  return (
    <div className="space-y-4">
      <ForensicsHeader
        data={data}
        sessions={sessions}
        selected={selected}
        onSessionChange={onSessionChange}
        onRetryStuck={() => {
          const candidateId = selected?.candidateId || data?.candidate?.id || data?.candidateId;
          if (candidateId) retryMutation.mutate({ candidateId, retryType: 'all' });
        }}
        hasStuck={hasStuck}
        retryBusy={retryMutation.isLoading}
      />

      <Tabs value={tab} onValueChange={setTab} defaultValue="overview">
        <TabsList className="rounded-admin border border-admin-border bg-admin-panel p-1 shadow-sm">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="perQuestion">Per-question ({responses.length})</TabsTrigger>
          <TabsTrigger value="calibration">Calibration & drift</TabsTrigger>
          <TabsTrigger value="raw">Raw</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab data={data} responses={responses} calibration={calibration} humanFeedback={humanFeedback} />
        </TabsContent>

        <TabsContent value="timeline">
          <TimelineTab data={data} />
        </TabsContent>

        <TabsContent value="perQuestion">
          <PerQuestionTab
            responses={responses}
            humanFeedback={humanFeedback}
            calibration={calibration}
            videoRecordingDiagnostics={data.videoRecordingDiagnostics}
            onReset={(responseId) => resetMutation.mutate({ responseId })}
            resetBusy={resetMutation.isLoading}
          />
        </TabsContent>

        <TabsContent value="calibration">
          <CalibrationTab data={data} />
        </TabsContent>

        <TabsContent value="raw">
          <RawTab data={data} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------- Header ----------

function ForensicsHeader({
  data,
  sessions,
  selected,
  onSessionChange,
  onRetryStuck,
  hasStuck,
  retryBusy,
}: {
  data: any;
  sessions: any[];
  selected: any;
  onSessionChange?: (sid: string) => void;
  onRetryStuck: () => void;
  hasStuck: boolean;
  retryBusy: boolean;
}) {
  const cand = data.candidate;
  const humanScore = data.humanFeedback?.application?.humanScore ?? null;
  const aiScore = selected?.overallScore ?? null;
  const delta = aiScore != null && humanScore != null ? aiScore - humanScore : null;

  const sessionLabel = (s: any) => {
    const title = s.positions?.title || s.candidate_journeys?.name || 'Session';
    const when = s.startedAt ? new Date(s.startedAt).toLocaleDateString() : 'unknown';
    return `${title} · ${when} · ${s.status}`;
  };

  return (
    <div className="rounded-admin border border-admin-border bg-admin-panel p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-admin-muted">Candidate</span>
            <span className="text-base font-semibold text-admin-ink">
              {(cand.firstName || '') + ' ' + (cand.lastName || '') || cand.email || 'Unknown'}
            </span>
            <span className="text-xs text-admin-muted">·  {cand.email || '—'}</span>
          </div>
          <div className="admin-mono mt-0.5 text-xs text-admin-muted">{cand.id}</div>
          <div className="mt-2 flex flex-wrap items-center space-x-2">
            <span className="text-xs text-admin-muted">Session</span>
            <select
              value={selected?.id || ''}
              onChange={(e) => onSessionChange?.(e.target.value)}
              className="rounded-admin-sm border border-admin-border bg-white px-2 py-1 text-xs text-admin-ink"
            >
              {sessions.map(s => (
                <option key={s.id} value={s.id}>
                  {sessionLabel(s)}
                </option>
              ))}
            </select>
            <StatusChip status={selected?.status} />
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wide text-admin-muted" title="AI score for this candidate's current session">AI</div>
            <div className="admin-mono text-xl font-bold text-admin-accent-ink tabular-nums">
              {aiScore != null ? Number(aiScore).toFixed(0) : '—'}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wide text-admin-muted" title="Human reviewer score for this candidate (0-100)">Human</div>
            <div className="admin-mono text-xl font-bold text-admin-ok tabular-nums">
              {humanScore != null ? humanScore.toFixed(0) : '—'}
            </div>
          </div>
          <DeltaBadge delta={delta} />
          {hasStuck && (
            <button
              onClick={onRetryStuck}
              disabled={retryBusy}
              className="rounded-admin-sm border border-admin-warn/40 bg-admin-warn-soft px-3 py-2 text-xs text-admin-warn hover:bg-amber-100 disabled:opacity-50"
              title="Retry any stuck responses in this session"
            >
              {retryBusy ? 'Retrying…' : 'Retry stuck'}
            </button>
          )}
        </div>
      </div>

      {data.journeyGraph && <JourneyMap data={data} />}
    </div>
  );
}

// ---------- Journey map (node chips) ----------

function JourneyMap({ data }: { data: any }) {
  const nodes: any[] = data.journeyGraph?.nodes || [];
  const edges: any[] = data.journeyGraph?.edges || [];

  // Traverse in edge order from the start node to give a predictable flow.
  const ordered = useMemo(() => {
    if (!nodes.length) return [];
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const next = new Map<string, string[]>();
    for (const e of edges) {
      if (!next.has(e.source)) next.set(e.source, []);
      next.get(e.source)!.push(e.target);
    }
    const start = nodes.find(n => n.type === 'start') || nodes[0];
    const out: any[] = [];
    const seen = new Set<string>();
    const walk = (id: string) => {
      if (seen.has(id) || !nodeMap.has(id)) return;
      seen.add(id);
      out.push(nodeMap.get(id));
      (next.get(id) || []).forEach(walk);
    };
    walk(start.id);
    for (const n of nodes) if (!seen.has(n.id)) out.push(n);
    return out;
  }, [nodes, edges]);

  const responsesByNode = new Map(((data.responses || []) as any[]).map(r => [r.nodeId, r]));
  // Decision nodes don't produce journey_responses rows; their evidence is in
  // journey_decisions. Index by nodeId so a "Score Gate" / "Branch" chip can
  // light up green when the engine actually evaluated it.
  const decisionsByNode = new Map(
    ((data.selectedSession?.decisions || []) as any[]).map(d => [d.nodeId, d]),
  );
  // Email send activity per node — for SEND_EMAIL nodes that also don't write
  // journey_responses but DO have email_sends or activity_logs.
  const emailLogsByNode = new Map<string, any>();
  for (const log of ((data.activityLogs?.pageVisits || []) as any[])) {
    if (log?.metadata?.nodeId) emailLogsByNode.set(log.metadata.nodeId, log);
  }

  const sessionStatus = String(data.selectedSession?.status || '').toUpperCase();
  const sessionIsComplete = sessionStatus === 'COMPLETED' || sessionStatus === 'COMPLETE';

  // Classify node "kind" so structural / decision nodes get distinct styling
  // from "actionable" content nodes that produce journey_responses.
  type NodeKind = 'start' | 'end' | 'actionable' | 'decision' | 'email' | 'other';
  const classify = (type: string | undefined | null): NodeKind => {
    const t = String(type || '').toLowerCase();
    if (t === 'start') return 'start';
    if (t === 'end' || t === 'journey_end' || t === 'journey-end') return 'end';
    if (
      t === 'video_interview' || t === 'video-interview' || t === 'interview' ||
      t === 'video_question' || t === 'video-question' ||
      t === 'assessment' || t === 'document_upload' || t === 'document-upload' ||
      t === 'coding-challenge' || t === 'coding_challenge' || t === 'code'
    ) return 'actionable';
    if (
      t === 'score_gate' || t === 'score-gate' || t === 'decision' ||
      t === 'condition' || t === 'branch' || t === 'rule' || t === 'gate'
    ) return 'decision';
    if (t === 'send_email' || t === 'send-email' || t === 'email') return 'email';
    return 'other';
  };

  // Mark nodes that the engine actually traversed. We compute this from the
  // index of the last actionable response / decision in the ordered list.
  // Anything BEFORE that is "passed", anything AFTER is "not yet" (or skipped
  // if the session is COMPLETED).
  const lastTouchedIdx = (() => {
    let idx = -1;
    ordered.forEach((n, i) => {
      if (responsesByNode.has(n.id) || decisionsByNode.has(n.id)) idx = i;
    });
    return idx;
  })();

  if (!ordered.length) return null;

  return (
    <div className="mt-4 -mx-2 overflow-x-auto">
      <div className="flex items-stretch space-x-2 px-2 py-1 min-w-max">
        {ordered.map((n, i) => {
          const r = responsesByNode.get(n.id);
          const decision = decisionsByNode.get(n.id);
          const kind = classify(n.type);
          const status = (r?.status || '').toUpperCase();

          // Compute display state per node kind:
          //   complete  – emerald
          //   running   – blue
          //   failed    – red
          //   pending   – amber (only mid-flow, not after END)
          //   passed    – gray-green (structural, traversed by the engine)
          //   skipped   – gray dashed (in a completed session that bypassed it)
          //   upcoming  – plain neutral (still ahead of where the engine is)
          let displayState: 'complete' | 'running' | 'failed' | 'pending' | 'passed' | 'skipped' | 'upcoming' = 'upcoming';
          let subtext: string | null = null;

          if (kind === 'actionable') {
            if (status === 'COMPLETED' || status === 'COMPLETE') {
              displayState = 'complete';
              subtext = 'completed';
            } else if (status === 'FAILED') {
              displayState = 'failed';
              subtext = 'failed';
            } else if (status === 'PROCESSING' || status === 'IN_PROGRESS') {
              displayState = 'running';
              subtext = status.toLowerCase();
            } else if (status === 'PENDING') {
              displayState = 'pending';
              subtext = 'pending';
            } else if (sessionIsComplete && i <= lastTouchedIdx) {
              displayState = 'skipped';
              subtext = 'skipped';
            } else {
              displayState = i <= lastTouchedIdx ? 'pending' : 'upcoming';
              subtext = i <= lastTouchedIdx ? 'awaiting' : 'upcoming';
            }
          } else if (kind === 'decision') {
            if (decision) {
              displayState = 'passed';
              subtext = `evaluated → ${decision.decision || 'next'}`;
            } else if (i < lastTouchedIdx || (sessionIsComplete && i <= ordered.length - 1)) {
              displayState = 'passed';
              subtext = 'evaluated';
            } else {
              displayState = 'upcoming';
              subtext = null;
            }
          } else if (kind === 'email') {
            if (i <= lastTouchedIdx || sessionIsComplete) {
              displayState = 'passed';
              subtext = 'sent';
            } else {
              displayState = 'upcoming';
              subtext = null;
            }
          } else if (kind === 'start') {
            displayState = 'passed';
            subtext = 'started';
          } else if (kind === 'end') {
            if (sessionIsComplete) {
              displayState = 'complete';
              subtext = 'journey complete';
            } else {
              displayState = 'upcoming';
              subtext = null;
            }
          } else {
            // Other / unknown structural nodes: passed if before/at lastTouchedIdx
            if (i <= lastTouchedIdx) {
              displayState = 'passed';
            }
          }

          const tone =
            displayState === 'complete' ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
            : displayState === 'failed' ? 'bg-red-50 border-red-300 text-red-900'
            : displayState === 'running' ? 'bg-blue-50 border-blue-300 text-blue-900'
            : displayState === 'pending' ? 'bg-amber-50 border-amber-300 text-amber-900'
            : displayState === 'passed' ? 'bg-gray-100 border-gray-300 text-gray-700'
            : displayState === 'skipped' ? 'bg-gray-50 border-gray-300 border-dashed text-gray-500'
            : 'bg-white border-gray-200 text-gray-400';

          const label = n.data?.label || n.data?.config?.label || n.type || 'step';
          const score = r?.score != null ? Number(r.score) : null;

          return (
            <a
              key={n.id}
              href={`#response-${r?.id || n.id}`}
              onClick={(e) => {
                e.preventDefault();
                const el = document.getElementById(`response-${r?.id || n.id}`);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
              title={`${kind} · ${displayState}`}
              className={clsx(
                'min-w-[140px] max-w-[180px] border rounded-md px-3 py-2 text-xs transition',
                tone,
                r ? 'hover:shadow-sm' : '',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wide opacity-70">
                  {i + 1}. {n.type}
                </span>
                {score != null && (
                  <span className="text-[10px] font-semibold tabular-nums">{score.toFixed(0)}</span>
                )}
              </div>
              <div className="font-medium truncate">{label}</div>
              {subtext && (
                <div className="text-[10px] mt-0.5 opacity-80">{subtext}</div>
              )}
            </a>
          );
        })}
      </div>
      <div className="text-[10px] text-gray-500 mt-1 ml-2 flex flex-wrap gap-x-3 gap-y-1">
        <LegendDot tone="emerald" label="completed" />
        <LegendDot tone="blue" label="running" />
        <LegendDot tone="amber" label="pending" />
        <LegendDot tone="red" label="failed" />
        <LegendDot tone="gray-solid" label="passed (structural)" />
        <LegendDot tone="gray-dashed" label="skipped" />
        <LegendDot tone="white" label="upcoming" />
      </div>
    </div>
  );
}

function LegendDot({ tone, label }: { tone: 'emerald' | 'blue' | 'amber' | 'red' | 'gray-solid' | 'gray-dashed' | 'white'; label: string }) {
  const cls =
    tone === 'emerald' ? 'bg-emerald-50 border-emerald-300'
    : tone === 'blue' ? 'bg-blue-50 border-blue-300'
    : tone === 'amber' ? 'bg-amber-50 border-amber-300'
    : tone === 'red' ? 'bg-red-50 border-red-300'
    : tone === 'gray-solid' ? 'bg-gray-100 border-gray-300'
    : tone === 'gray-dashed' ? 'bg-gray-50 border-gray-300 border-dashed'
    : 'bg-white border-gray-200';
  return (
    <span className="inline-flex items-center space-x-1">
      <span className={`inline-block w-3 h-3 rounded-sm border ${cls}`} />
      <span>{label}</span>
    </span>
  );
}

// ---------- Overview tab ----------

function OverviewTab({
  data,
  responses,
  calibration,
  humanFeedback,
}: {
  data: any;
  responses: any[];
  calibration: any;
  humanFeedback: any;
}) {
  const totalResponses = responses.length;
  const aiScored = responses.filter(r => r.score != null).length;
  const avgAi = (() => {
    const vals = responses.map(r => r.score).filter((x): x is number => x != null);
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
  })();
  const humanScore = humanFeedback?.application?.humanScore ?? null;
  const sessionDelta = data.deltas?.sessionAverage ?? null;
  const app = humanFeedback?.application;
  const ratingCount = humanFeedback?.ratings?.length ?? 0;
  const reviewerRaw = app?.reviewerScore != null ? Number(app.reviewerScore) : null;
  const sessionScoreSource = data.selectedSession?.scoreSource || null;

  const rolledRedFlags: Array<{ source: string; text: string }> = [];
  for (const r of responses) {
    const ev = r.aiEvaluation || {};
    const a = r.aiAnalysis || {};
    const evFlags = Array.isArray(ev.redFlags) ? ev.redFlags : [];
    for (const f of evFlags) rolledRedFlags.push({ source: 'Eval LLM', text: f });
    if (Array.isArray(a.redFlags)) for (const f of a.redFlags) rolledRedFlags.push({ source: 'Eval LLM', text: f });
    if (a.redFlags && typeof a.redFlags === 'object' && 'redFlagNotes' in a.redFlags && (a.redFlags as any).redFlagNotes) {
      rolledRedFlags.push({ source: 'Eval LLM', text: (a.redFlags as any).redFlagNotes });
    }
    if (r.videoAnalysis && Array.isArray(r.videoAnalysis.redFlags)) {
      for (const f of r.videoAnalysis.redFlags) rolledRedFlags.push({ source: 'Video', text: f });
    }
    if (r.authenticity && Array.isArray(r.authenticity.suspiciousIndicators)) {
      for (const f of r.authenticity.suspiciousIndicators) rolledRedFlags.push({ source: 'Authenticity', text: f });
    }
  }

  const missingAiScore = avgAi == null && responses.length > 0;

  return (
    <div className="space-y-5">
      <div className="text-xs text-gray-500 italic">
        All numbers below are for <strong>this candidate&rsquo;s current session only</strong>. They are <strong>not</strong> org-wide or position-wide averages.
      </div>

      {missingAiScore && <ScoreDiagnosticsBanner responses={responses} />}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard
          label="Responses"
          value={totalResponses}
          sub={`${aiScored} of ${totalResponses} have an AI score`}
        />
        <KpiCard
          label="AI score (this candidate)"
          value={avgAi != null ? avgAi.toFixed(1) : '—'}
          tone="info"
          sub={
            avgAi != null
              ? sessionScoreSource === 'journey_sessions.overallScore'
                ? `session overallScore · same as dashboard`
                : `avg of ${aiScored} scored response${aiScored === 1 ? '' : 's'} · matches dashboard calc`
              : 'no AI score yet'
          }
        />
        <KpiCard
          label="Human score (this candidate)"
          value={humanScore != null ? humanScore.toFixed(1) : '—'}
          tone="info"
          sub={
            reviewerRaw != null
              ? `reviewer gave ${reviewerRaw}/5`
              : ratingCount > 0
                ? `avg of ${ratingCount} category rating${ratingCount === 1 ? '' : 's'}`
                : 'not reviewed yet'
          }
        />
        <KpiCard
          label="AI − Human Δ"
          value={sessionDelta != null ? `${sessionDelta > 0 ? '+' : ''}${sessionDelta.toFixed(1)}` : '—'}
          tone={sessionDelta == null ? 'neutral' : Math.abs(sessionDelta) < 5 ? 'ok' : Math.abs(sessionDelta) < 12 ? 'warn' : 'alert'}
          sub={
            sessionDelta != null
              ? `${Math.abs(sessionDelta) < 5 ? 'aligned' : sessionDelta > 0 ? 'AI higher than human' : 'AI lower than human'} · this session`
              : 'need both AI + human scores'
          }
        />
        <KpiCard
          label="Completion"
          value={`${Math.round(data.selectedSession?.completionPercentage || 0)}%`}
          sub={data.selectedSession?.status}
        />
      </div>

      {data.cohort && (
        <CohortCard cohort={data.cohort} candidateName={`${data.candidate.firstName || ''} ${data.candidate.lastName || ''}`.trim() || 'This candidate'} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4 lg:col-span-2">
          <SectionHeading title="Session summary" />
          <ValueList
            items={[
              { label: 'Journey', value: data.selectedSession?.journey?.name },
              { label: 'Position', value: data.position?.title },
              { label: 'Final outcome', value: data.selectedSession?.finalOutcome || '—' },
              { label: 'Outcome reason', value: data.selectedSession?.outcomeReason || '—' },
              { label: 'Started', value: data.selectedSession?.startedAt ? new Date(data.selectedSession.startedAt).toLocaleString() : '—' },
              { label: 'Completed', value: data.selectedSession?.completedAt ? new Date(data.selectedSession.completedAt).toLocaleString() : '—' },
              { label: 'Last activity', value: data.selectedSession?.lastActivityAt ? new Date(data.selectedSession.lastActivityAt).toLocaleString() : '—' },
              { label: 'Session ID', value: <code className="text-[10px]">{data.selectedSession?.id}</code> },
            ]}
          />
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <SectionHeading title="Tenant calibration" subtitle={calibration ? `latest ${new Date(calibration.createdAt).toLocaleDateString()}` : 'none yet'} />
          {calibration ? (
            <div className="space-y-2 text-xs text-gray-700">
              <ValueList
                columns={1}
                items={[
                  { label: 'Sample size', value: calibration.sampleSize },
                  { label: 'Mean Δ', value: Number(calibration.meanDelta).toFixed(2) },
                  { label: 'MAE', value: Number(calibration.meanAbsoluteError).toFixed(2) },
                  { label: 'Pearson r', value: calibration.pearsonCorrelation != null ? Number(calibration.pearsonCorrelation).toFixed(3) : '—' },
                  { label: 'Drift', value: calibration.driftDetected ? `YES — ${calibration.driftDirection}` : 'ALIGNED' },
                ]}
              />
            </div>
          ) : (
            <div className="text-xs text-gray-500">Run a calibration snapshot from the Scoring page.</div>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <SectionHeading title="Red flags rolled up across layers" subtitle="Evaluation LLM, video analysis, authenticity, etc." />
        {rolledRedFlags.length === 0 ? (
          <div className="text-xs text-gray-500 italic">None detected across any layer.</div>
        ) : (
          <ul className="space-y-1.5">
            {rolledRedFlags.map((f, i) => (
              <li key={i} className="text-sm text-gray-800 flex items-start">
                <span className="mr-2 text-[10px] font-semibold text-gray-500 uppercase border px-1 py-0.5 rounded bg-red-50 text-red-700 border-red-200 mt-0.5">
                  {f.source}
                </span>
                <span>{f.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {app && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <SectionHeading title="Application snapshot" />
          <ValueList
            items={[
              { label: 'Status', value: app.status },
              { label: 'Stage', value: app.stage },
              { label: 'Reviewer score (raw)', value: app.reviewerScore != null ? `${app.reviewerScore}/5` : '—' },
              { label: 'Reviewed at', value: app.reviewedAt ? new Date(app.reviewedAt).toLocaleString() : '—' },
              { label: 'Applied at', value: app.appliedAt ? new Date(app.appliedAt).toLocaleString() : '—' },
              { label: 'Rejection reason', value: app.rejectionReason },
            ]}
          />
        </div>
      )}
    </div>
  );
}

// ---------- Timeline tab ----------

function TimelineTab({ data }: { data: any }) {
  type Ev = { at: Date; kind: string; source: string; text: string; meta?: any };
  const events: Ev[] = [];

  const cand = data.candidate;
  if (cand?.createdAt) events.push({ at: new Date(cand.createdAt), kind: 'candidate', source: 'profile', text: `Candidate profile created` });

  const inv = data.invitation;
  if (inv?.sentAt) events.push({ at: new Date(inv.sentAt), kind: 'invite', source: 'email', text: 'Journey invitation sent' });
  if (inv?.openedAt) events.push({ at: new Date(inv.openedAt), kind: 'invite', source: 'email', text: 'Invitation email opened' });

  for (const v of (data.activityLogs?.pageVisits || [])) {
    if (v.createdAt) events.push({
      at: new Date(v.createdAt),
      kind: 'visit',
      source: 'activity',
      text: `Journey page visit${v.ipAddress ? ` from ${v.ipAddress}` : ''}`,
      meta: v.metadata,
    });
  }
  for (const a of (data.activityLogs?.locationAnomalies || [])) {
    if (a.createdAt) events.push({
      at: new Date(a.createdAt),
      kind: 'anomaly',
      source: 'activity',
      text: `Location anomaly detected${a.ipAddress ? ` (${a.ipAddress})` : ''}`,
      meta: a.metadata,
    });
  }

  for (const r of (data.responses || []) as any[]) {
    if (r.submittedAt) events.push({
      at: new Date(r.submittedAt),
      kind: 'response',
      source: r.nodeType || 'response',
      text: `Response submitted: ${r.question?.text?.slice(0, 80) || r.nodeId}`,
    });
    if (r.processedAt) events.push({
      at: new Date(r.processedAt),
      kind: 'scored',
      source: 'scoring',
      text: `AI scored ${r.score != null ? r.score.toFixed(1) : 'n/a'}${r.processingError ? ` (error: ${r.processingError})` : ''}`,
    });
  }

  for (const ev of (data.scoringEvents || []) as any[]) {
    events.push({
      at: new Date(ev.createdAt),
      kind: 'scoring_event',
      source: `scoring · ${ev.eventType}`,
      text: `${ev.eventType} ${ev.scoreBefore != null ? `(${Number(ev.scoreBefore).toFixed(1)} → ${Number(ev.scoreAfter ?? 0).toFixed(1)})` : ev.scoreAfter != null ? `= ${Number(ev.scoreAfter).toFixed(1)}` : ''}`,
      meta: ev.metadata,
    });
  }

  for (const rh of (data.rescoreHistory || []) as any[]) {
    events.push({
      at: new Date(rh.createdAt),
      kind: 'rescore',
      source: 'rescore',
      text: `${rh.rescoreType} rescore · ${rh.responsesQueued} responses queued · ${rh.status}`,
      meta: rh.metadata,
    });
  }

  for (const d of (data.selectedSession?.decisions || []) as any[]) {
    events.push({
      at: new Date(d.createdAt),
      kind: 'decision',
      source: 'journey',
      text: `Decision on ${d.nodeId}: ${d.decision} → ${d.nextNodeId}${d.automated === false ? ' (manual)' : ''}`,
      meta: d.ruleApplied,
    });
  }

  for (const n of (data.humanFeedback?.notes || []) as any[]) {
    events.push({
      at: new Date(n.createdAt),
      kind: 'note',
      source: `recruiter · ${n.authorName || ''}`,
      text: n.content?.slice(0, 200) || '',
    });
  }

  for (const t of (data.videoRecordingDiagnostics?.timeline || []) as any[]) {
    events.push({
      at: new Date(t.at),
      kind: 'video_upload',
      source: `video · ${t.source || t.kind || 'system'}`,
      text: t.errorMessage ? `${t.label} — ${t.errorMessage}` : t.label,
      meta: {
        questionId: t.questionId,
        status: t.status,
        eventType: t.eventType,
        muxUploadId: t.muxUploadId,
      },
    });
  }

  events.sort((a, b) => b.at.getTime() - a.at.getTime());

  const toneFor = (k: string) =>
    k === 'anomaly' ? 'border-red-300 bg-red-50'
    : k === 'scored' ? 'border-blue-200 bg-blue-50'
    : k === 'response' ? 'border-emerald-200 bg-emerald-50'
    : k === 'video_upload' ? 'border-orange-200 bg-orange-50'
    : k === 'scoring_event' || k === 'rescore' ? 'border-indigo-200 bg-indigo-50'
    : k === 'decision' ? 'border-purple-200 bg-purple-50'
    : k === 'note' ? 'border-amber-200 bg-amber-50'
    : 'border-gray-200 bg-white';

  return (
    <div>
      <SectionHeading title="Unified timeline" subtitle={`${events.length} events across activity, scoring, decisions, and human review`} />
      {events.length === 0 ? (
        <div className="text-xs text-gray-500 italic">No events to show.</div>
      ) : (
        <ol className="relative border-l border-gray-200 ml-2 space-y-3">
          {events.map((e, i) => (
            <li key={i} className="ml-3">
              <span className="absolute -left-1.5 mt-1.5 flex h-3 w-3 rounded-full border border-gray-300 bg-white" />
              <div className={clsx('rounded-md border p-3', toneFor(e.kind))}>
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-gray-500">
                  <span>{e.source}</span>
                  <span>{e.at.toLocaleString()}</span>
                </div>
                <div className="mt-1 text-sm text-gray-900">{e.text}</div>
                {e.meta && <JsonViewer value={e.meta} title="metadata" />}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ---------- Per-question tab ----------

function PerQuestionTab({
  responses,
  humanFeedback,
  calibration,
  videoRecordingDiagnostics,
  onReset,
  resetBusy,
}: {
  responses: any[];
  humanFeedback: any;
  calibration: any;
  videoRecordingDiagnostics?: { attempts?: any[]; timeline?: any[] };
  onReset: (responseId: string) => void;
  resetBusy: boolean;
}) {
  const [filter, setFilter] = useState<'all' | 'failed' | 'unscored' | 'video'>('all');

  const filtered = responses.filter(r => {
    if (filter === 'failed') return (r.status || '').toUpperCase() === 'FAILED' || !!r.processingError;
    if (filter === 'unscored') return r.score == null;
    if (filter === 'video') return !!r.videoUrl;
    return true;
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1">
          {(['all', 'failed', 'unscored', 'video'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={clsx(
                'px-3 py-1.5 text-xs rounded-md border',
                filter === f ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50',
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="text-xs text-gray-500">{filtered.length} of {responses.length}</div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-xs text-gray-500 italic bg-white border border-gray-200 rounded-lg p-6 text-center">
          No responses match this filter.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r, i) => (
            <div key={r.id} id={`response-${r.id}`} className="relative">
              <QuestionCard
                response={r}
                humanFeedback={humanFeedback}
                calibration={calibration}
                videoDiagnostics={
                  r.questionId
                    ? {
                        attempts: (videoRecordingDiagnostics?.attempts || []).filter(
                          (a: any) => a.questionId === r.questionId,
                        ),
                        timeline: (videoRecordingDiagnostics?.timeline || []).filter(
                          (t: any) => t.questionId === r.questionId,
                        ),
                      }
                    : undefined
                }
                defaultOpen={i === 0 && filter !== 'all' ? true : false}
              />
              {((r.status || '').toUpperCase() === 'FAILED' || r.processingError) && (
                <div className="mt-1 text-right">
                  <button
                    onClick={() => onReset(r.id)}
                    disabled={resetBusy}
                    className="text-[11px] text-red-700 hover:underline disabled:opacity-50"
                  >
                    {resetBusy ? 'Resetting…' : 'Reset this response'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Calibration tab ----------

function CalibrationTab({ data }: { data: any }) {
  const c = data.calibration;
  const rescore: any[] = data.rescoreHistory || [];

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <SectionHeading
          title="Latest calibration snapshot"
          subtitle={c ? `generated ${new Date(c.createdAt).toLocaleString()}` : 'No snapshot recorded for this org/position'}
        />
        {c ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard label="Sample size" value={c.sampleSize} />
              <KpiCard label="Mean Δ (AI − human)" value={Number(c.meanDelta).toFixed(2)} tone={Math.abs(Number(c.meanDelta)) < 5 ? 'ok' : Math.abs(Number(c.meanDelta)) < 12 ? 'warn' : 'alert'} />
              <KpiCard label="MAE" value={Number(c.meanAbsoluteError).toFixed(2)} />
              <KpiCard label="Pearson r" value={c.pearsonCorrelation != null ? Number(c.pearsonCorrelation).toFixed(3) : '—'} />
              <KpiCard label="Avg AI" value={Number(c.avgAiScore).toFixed(1)} />
              <KpiCard label="Avg human" value={Number(c.avgHumanScore).toFixed(1)} />
              <KpiCard
                label="Drift"
                value={c.driftDetected ? c.driftDirection || 'YES' : 'ALIGNED'}
                tone={c.driftDetected ? 'alert' : 'ok'}
              />
              <KpiCard label="Position" value={c.positionId ? 'scoped' : 'org-wide'} />
            </div>
            {Array.isArray(c.recommendations) && c.recommendations.length > 0 && (
              <div className="mt-4">
                <div className="text-xs font-semibold text-gray-700 uppercase mb-1">Recommendations</div>
                <ul className="list-disc list-inside text-sm text-gray-800 space-y-1">
                  {c.recommendations.map((r: string, i: number) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            )}
            <div className="mt-4">
              <JsonViewer value={c.scoreDistribution} title="Score distribution buckets" />
            </div>
          </>
        ) : (
          <div className="text-xs text-gray-500 italic">No calibration snapshot yet. Run one from the Scoring page.</div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <SectionHeading title="Rescore history" subtitle={`${rescore.length} events`} />
        {rescore.length === 0 ? (
          <div className="text-xs text-gray-500 italic">No rescores recorded.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] uppercase text-gray-500">When</th>
                  <th className="px-3 py-2 text-left text-[10px] uppercase text-gray-500">Type</th>
                  <th className="px-3 py-2 text-left text-[10px] uppercase text-gray-500">Queued</th>
                  <th className="px-3 py-2 text-left text-[10px] uppercase text-gray-500">Before → After</th>
                  <th className="px-3 py-2 text-left text-[10px] uppercase text-gray-500">Δ</th>
                  <th className="px-3 py-2 text-left text-[10px] uppercase text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {rescore.map(r => (
                  <tr key={r.id}>
                    <td className="px-3 py-2 text-xs text-gray-500">{new Date(r.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-2 text-xs">{r.rescoreType}</td>
                    <td className="px-3 py-2 text-xs tabular-nums">{r.responsesQueued}</td>
                    <td className="px-3 py-2 text-xs tabular-nums">
                      {r.avgScoreBefore != null ? Number(r.avgScoreBefore).toFixed(1) : '—'}
                      <span className="mx-1 text-gray-400">→</span>
                      {r.avgScoreAfter != null ? Number(r.avgScoreAfter).toFixed(1) : '—'}
                    </td>
                    <td className="px-3 py-2 text-xs tabular-nums">
                      {r.scoreDelta != null ? (
                        <span className={Number(r.scoreDelta) >= 0 ? 'text-emerald-700' : 'text-red-700'}>
                          {Number(r.scoreDelta) > 0 ? '+' : ''}{Number(r.scoreDelta).toFixed(1)}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2 text-xs"><StatusChip status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Raw tab ----------

function ScoreDiagnosticsBanner({ responses }: { responses: any[] }) {
  // Roll up the most common candidate fields across every response so we can
  // suggest the right key path. Numeric fields 0-100 that appear on every
  // response are strong candidates for "this is the actual score field".
  const pathCounts = new Map<string, { count: number; samples: number[] }>();
  for (const r of responses) {
    const fields: Array<{ path: string; value: number }> = r.scoreDebug?.numericFieldsOnAi || [];
    for (const f of fields) {
      const cur = pathCounts.get(f.path) || { count: 0, samples: [] };
      cur.count += 1;
      cur.samples.push(f.value);
      pathCounts.set(f.path, cur);
    }
  }
  const ranked = Array.from(pathCounts.entries())
    .map(([path, info]) => ({
      path,
      count: info.count,
      avg: info.samples.reduce((s, v) => s + v, 0) / info.samples.length,
      samples: info.samples,
    }))
    .sort((a, b) => b.count - a.count || b.avg - a.avg);

  return (
    <div className="border-2 border-amber-300 bg-amber-50 rounded-lg p-4">
      <div className="flex items-start space-x-2">
        <span className="text-amber-700 font-bold">⚠</span>
        <div className="flex-1">
          <div className="text-sm font-semibold text-amber-900">
            AI score could not be derived for this session
          </div>
          <div className="text-xs text-amber-800 mt-1">
            We checked every layer (<code>journey_responses.score</code>, <code>ai_evaluations.overallScore</code>, <code>ai_evaluations.hireRecommendation</code>, <code>aiAnalysis.overallScore</code>, <code>aiAnalysis.score</code>, <code>aiAnalysis.overall_score</code>, <code>aiAnalysis.scorePercent</code>, <code>aiAnalysis.overallScore.scorePercent</code>) and got null/0 from all of them on every one of {responses.length} response{responses.length === 1 ? '' : 's'}.
          </div>
          {ranked.length > 0 && (
            <div className="mt-3">
              <div className="text-xs font-semibold text-amber-900 uppercase tracking-wide mb-1">
                Numeric 0–100 fields actually present on aiAnalysis
              </div>
              <div className="text-xs text-amber-800 mb-2">
                These are real numbers in the JSON we got back. The actual score field for this session is almost certainly one of these:
              </div>
              <table className="text-xs">
                <thead>
                  <tr className="text-amber-900 border-b border-amber-300">
                    <th className="text-left py-1 pr-4">Path</th>
                    <th className="text-right py-1 pr-4">Present in</th>
                    <th className="text-right py-1 pr-4">Avg</th>
                    <th className="text-left py-1">Samples</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.slice(0, 25).map(r => (
                    <tr key={r.path}>
                      <td className="py-1 pr-4 font-mono">{r.path}</td>
                      <td className="py-1 pr-4 text-right tabular-nums">{r.count} / {responses.length}</td>
                      <td className="py-1 pr-4 text-right tabular-nums">{r.avg.toFixed(1)}</td>
                      <td className="py-1 font-mono">{r.samples.map(s => s.toFixed(1)).join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <details className="mt-3">
            <summary className="text-xs font-semibold text-amber-900 cursor-pointer">Per-response diagnostic + raw aiAnalysis snippet</summary>
            <div className="mt-2 space-y-3">
              {responses.map((r, i) => (
                <div key={r.id} className="bg-white border border-amber-200 rounded p-3 text-xs">
                  <div className="font-semibold mb-1">Response #{i + 1} — {r.nodeType} — {r.question?.text?.slice(0, 80) || r.id}</div>
                  <div className="text-gray-700">
                    <span className="font-mono">aiAnalysisType:</span> {r.scoreDebug?.aiAnalysisType ?? '?'}
                    <span className="ml-3 font-mono">aiAnalysisIsNull:</span> {String(r.scoreDebug?.aiAnalysisIsNull)}
                    <span className="ml-3 font-mono">wasString:</span> {String(r.scoreDebug?.aiAnalysisWasString)}
                  </div>
                  <div className="text-gray-700 mt-1">
                    <span className="font-mono">topKeys:</span> {(r.scoreDebug?.aiAnalysisTopKeys || []).join(', ') || '—'}
                  </div>
                  {r.scoreDebug?.aiAnalysisSnippet && (
                    <pre className="bg-gray-50 border border-gray-200 rounded p-2 mt-2 overflow-x-auto whitespace-pre text-[10px] max-h-64">
{r.scoreDebug.aiAnalysisSnippet}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}

function CohortCard({ cohort, candidateName }: { cohort: any; candidateName: string }) {
  const pct = cohort.candidatePercentile;
  const rank = cohort.candidateRank;
  const score = cohort.candidateScore;
  const avg = cohort.avgScore;
  const median = cohort.medianScore;
  const min = cohort.minScore;
  const max = cohort.maxScore;
  const total = cohort.scoredCandidates;
  const distribution: Array<{ bucket: string; count: number }> = cohort.distribution || [];
  const maxCount = Math.max(1, ...distribution.map(d => d.count));
  const vsAvg = score != null && avg != null ? score - avg : null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <SectionHeading
        title="Position cohort context"
        subtitle={`Every scored candidate on this position — same score source as the recruiter dashboard`}
      />
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <KpiCard
          label={`${candidateName}'s score`}
          value={score != null ? Number(score).toFixed(1) : '—'}
          tone="info"
        />
        <KpiCard
          label="Rank in cohort"
          value={rank != null ? `#${rank} / ${total}` : '—'}
          sub={pct != null ? `${pct}${ordinalSuffix(pct)} percentile` : undefined}
          tone={
            pct == null ? 'neutral'
            : pct >= 75 ? 'ok'
            : pct >= 50 ? 'info'
            : pct >= 25 ? 'warn'
            : 'alert'
          }
        />
        <KpiCard
          label="Cohort avg"
          value={avg != null ? avg.toFixed(1) : '—'}
          sub={vsAvg != null ? `${vsAvg > 0 ? '+' : ''}${vsAvg.toFixed(1)} vs this candidate` : undefined}
        />
        <KpiCard label="Median" value={median != null ? median.toFixed(1) : '—'} />
        <KpiCard
          label="Range"
          value={min != null && max != null ? `${min.toFixed(0)} – ${max.toFixed(0)}` : '—'}
          sub={`${cohort.completedCandidates}/${cohort.totalCandidates} completed`}
        />
      </div>

      {score == null && (rank != null || cohort.diagnostics) && (
        <div className="mb-4 border-2 border-amber-300 bg-amber-50 rounded p-3 text-xs">
          <div className="font-semibold text-amber-900">
            ⚠ This candidate has cohort context but no derivable session score
          </div>
          <div className="text-amber-800 mt-1">
            The session was loaded but <code>journey_sessions.overallScore</code> couldn&rsquo;t be coerced to a finite number, and per-response derivation also returned null. The session-score derivation block below shows what the raw value was so we can identify the right fix:
          </div>
          {cohort.diagnostics && (
            <pre className="mt-2 bg-white border border-amber-200 rounded p-2 overflow-x-auto whitespace-pre font-mono text-[10px]">
{JSON.stringify(cohort.diagnostics, null, 2)}
            </pre>
          )}
        </div>
      )}

      <div>
        <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Score distribution ({total} candidates)
        </div>
        <div className="space-y-1.5">
          {distribution.map(d => {
            const w = (d.count / maxCount) * 100;
            const contains = score != null && isBucketContaining(d.bucket, score);
            return (
              <div key={d.bucket} className="flex items-center space-x-2">
                <div className="w-14 text-xs text-gray-600 tabular-nums">{d.bucket}</div>
                <div className="flex-1 bg-gray-100 rounded h-5 relative overflow-hidden">
                  <div
                    className={contains ? 'h-5 bg-blue-500' : 'h-5 bg-gray-400'}
                    style={{ width: `${w}%` }}
                  />
                  {contains && score != null && (
                    <span className="absolute inset-0 flex items-center px-2 text-[10px] text-white font-semibold">
                      ← {candidateName.split(' ')[0]} ({score.toFixed(0)})
                    </span>
                  )}
                </div>
                <div className="w-10 text-xs text-gray-700 tabular-nums text-right">{d.count}</div>
              </div>
            );
          })}
        </div>
        <div className="text-[11px] text-gray-500 mt-3">
          Identical calculation to the recruiter dashboard: <code>journey_sessions.overallScore</code> when populated, otherwise average of <code>aiAnalysis.overallScore || aiAnalysis.score</code> per response.
        </div>
      </div>
    </div>
  );
}

function ordinalSuffix(n: number): string {
  const s = n % 100;
  if (s >= 11 && s <= 13) return 'th';
  const last = n % 10;
  return last === 1 ? 'st' : last === 2 ? 'nd' : last === 3 ? 'rd' : 'th';
}

function isBucketContaining(bucket: string, score: number): boolean {
  const parts = bucket.split('-').map(p => parseInt(p.trim(), 10));
  if (parts.length !== 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) return false;
  return score >= parts[0] && score <= parts[1];
}

function RawTab({ data }: { data: any }) {
  return (
    <div className="space-y-3">
      <JsonViewer value={data.candidate} title="candidate_profiles" />
      <JsonViewer value={data.selectedSession} title="journey_sessions (selected)" />
      <JsonViewer value={data.journeyGraph} title="candidate_journeys (nodes + edges)" />
      <JsonViewer value={data.responses} title="journey_responses (with all AI layers)" />
      <JsonViewer value={data.assessmentResponses} title="assessment_responses" />
      <JsonViewer value={data.humanFeedback} title="humanFeedback" />
      <JsonViewer value={data.scoringEvents} title="scoring_events" />
      <JsonViewer value={data.rescoreHistory} title="rescore_history" />
      <JsonViewer value={data.calibration} title="tenant_calibration_snapshots (latest)" />
      <JsonViewer value={data.cohort} title="position cohort (rank, percentile, distribution)" />
      <JsonViewer value={data.activityLogs} title="activity_logs (page visits + anomalies)" />
      <JsonViewer value={data.invitation} title="journey_invitations" />
      <JsonViewer value={data.videoRecordingDiagnostics} title="video_recording_diagnostics" />
    </div>
  );
}

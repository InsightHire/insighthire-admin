'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import { trpc } from '@/lib/trpc';
import {
  ScoreBar,
  DeltaBadge,
  StatusChip,
  JsonViewer,
  SectionHeading,
  ValueList,
  SufficiencyBadge,
} from './primitives';
import { HlsVideo } from './HlsVideo';

const INNER_TABS = [
  { id: 'prompt', label: 'Prompt & criteria' },
  { id: 'response', label: 'Response' },
  { id: 'uploads', label: 'Upload diagnostics' },
  { id: 'conversations', label: 'Conversations LLM' },
  { id: 'evaluation', label: 'Evaluation LLM' },
  { id: 'video', label: 'Video analysis' },
  { id: 'authenticity', label: 'Authenticity' },
  { id: 'human', label: 'Human vs AI' },
  { id: 'history', label: 'Scoring history' },
] as const;

type InnerTabId = typeof INNER_TABS[number]['id'];

export function QuestionCard({
  response,
  humanFeedback,
  calibration,
  videoDiagnostics,
  defaultOpen = false,
}: {
  response: any;
  humanFeedback: any;
  calibration: any;
  videoDiagnostics?: { attempts: any[]; timeline: any[] };
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [innerTab, setInnerTab] = useState<InnerTabId>('evaluation');

  const q = response.question;
  const nodeLabel = response.nodeType || 'Response';
  const questionTitle = q?.text || 'Untitled question';

  const aiScore = response.score;
  const humanScore = humanFeedback?.application?.humanScore ?? null;

  const hasUploadDiagnostics =
    (videoDiagnostics?.attempts?.length ?? 0) > 0 || (videoDiagnostics?.timeline?.length ?? 0) > 0;

  // Quick indicators for the closed row
  const hasVideoAnalysis = !!response.videoAnalysis;
  const hasAuthenticity = !!response.authenticity;
  const hasOrch = (response.orchestrator?.turns?.length ?? 0) > 0
    || (response.orchestrator?.questionAssessments && Object.keys(response.orchestrator.questionAssessments).length > 0);
  const hasEval = !!response.aiEvaluation || !!response.aiAnalysis;

  const statusIsFailed = (response.status || '').toUpperCase() === 'FAILED';

  return (
    <div className={clsx(
      'border rounded-lg bg-white overflow-hidden',
      statusIsFailed ? 'border-red-200' : 'border-gray-200',
    )}>
      <button
        className="w-full flex items-start justify-between px-4 py-3 text-left hover:bg-gray-50"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-start space-x-3 flex-1 min-w-0">
          <span className={`mt-1 text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-2 flex-wrap">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                {nodeLabel}
              </span>
              <StatusChip status={response.status} />
              {hasOrch && (
                <span className="inline-flex px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 text-[10px] font-medium">
                  Conv. LLM
                </span>
              )}
              {hasEval && (
                <span className="inline-flex px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-medium">
                  Eval LLM
                </span>
              )}
              {hasVideoAnalysis && (
                <span className="inline-flex px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-medium">
                  Video
                </span>
              )}
              {hasAuthenticity && (
                <span className="inline-flex px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-medium">
                  Authenticity
                </span>
              )}
            </div>
            <div className="mt-1 text-sm font-medium text-gray-900 line-clamp-2">
              {questionTitle}
            </div>
            {response.processingError && (
              <div className="mt-1 text-xs text-red-700">{response.processingError}</div>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-4 ml-4">
          <div className="text-right">
            <div className="text-[10px] text-gray-500 uppercase tracking-wide">AI</div>
            <div className="text-sm font-semibold text-blue-700 tabular-nums">
              {aiScore != null ? aiScore.toFixed(0) : '—'}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-gray-500 uppercase tracking-wide">Human</div>
            <div className="text-sm font-semibold text-emerald-700 tabular-nums">
              {humanScore != null ? humanScore.toFixed(0) : '—'}
            </div>
          </div>
          <DeltaBadge delta={response.delta} />
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-200 bg-gray-50">
          {/* Inner tab bar */}
          <div className="flex flex-wrap gap-1 p-2 bg-white border-b border-gray-200">
            {INNER_TABS.map(t => {
              const disabled =
                (t.id === 'video' && !hasVideoAnalysis) ||
                (t.id === 'authenticity' && !hasAuthenticity) ||
                (t.id === 'uploads' && !hasUploadDiagnostics);
              return (
                <button
                  key={t.id}
                  disabled={disabled}
                  onClick={() => setInnerTab(t.id)}
                  className={clsx(
                    'px-3 py-1.5 rounded-md text-xs font-medium transition whitespace-nowrap',
                    innerTab === t.id
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : disabled
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'text-gray-600 hover:bg-gray-100',
                  )}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="p-4 space-y-4">
            {innerTab === 'prompt' && <PromptPanel responseId={response.id} fallback={response} />}
            {innerTab === 'response' && <ResponsePanel response={response} />}
            {innerTab === 'uploads' && (
              <UploadDiagnosticsPanel diagnostics={videoDiagnostics} />
            )}
            {innerTab === 'conversations' && <ConversationsPanel response={response} />}
            {innerTab === 'evaluation' && <EvaluationPanel response={response} />}
            {innerTab === 'video' && <VideoAnalysisPanel response={response} />}
            {innerTab === 'authenticity' && <AuthenticityPanel response={response} />}
            {innerTab === 'human' && (
              <HumanVsAiPanel
                response={response}
                humanFeedback={humanFeedback}
                calibration={calibration}
              />
            )}
            {innerTab === 'history' && <ScoringHistoryPanel response={response} />}
    {innerTab === 'history' && response.scoreDebug && (
      <div className="mt-4">
        <SectionHeading title="Score provenance (what we looked at)" subtitle="First layer with a positive value wins. Matches the recruiter dashboard." />
        <JsonViewer value={response.scoreDebug} title="scoreDebug" defaultOpen />
      </div>
    )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Panel: Upload diagnostics ----------

function UploadDiagnosticsPanel({
  diagnostics,
}: {
  diagnostics?: { attempts: any[]; timeline: any[] };
}) {
  const attempts = diagnostics?.attempts ?? [];
  const timeline = diagnostics?.timeline ?? [];

  if (!attempts.length && !timeline.length) {
    return <div className="text-xs text-gray-500 italic">No upload telemetry for this question.</div>;
  }

  return (
    <div className="space-y-4">
      <SectionHeading
        title="Recording & upload timeline"
        subtitle={`${attempts.length} Mux upload attempt(s) · ${timeline.length} event(s)`}
      />
      <ol className="space-y-2">
        {timeline.map((item: any, idx: number) => (
          <li key={`${item.at}-${idx}`} className="bg-white border rounded-md p-3 text-xs">
            <div className="flex justify-between text-[10px] uppercase text-gray-500">
              <span>{item.source || item.kind}</span>
              <span>{new Date(item.at).toLocaleString()}</span>
            </div>
            <div className="mt-1 font-medium text-gray-900">{item.label}</div>
            {item.status && (
              <StatusChip status={item.status} />
            )}
            {item.errorMessage && (
              <div className="mt-1 text-red-700">{item.errorMessage}</div>
            )}
            {item.muxUploadId && (
              <div className="mt-1 font-mono text-[10px] text-gray-400 truncate">{item.muxUploadId}</div>
            )}
          </li>
        ))}
      </ol>
      {attempts.length > 0 && (
        <div>
          <SectionHeading title="Mux upload attempts" />
          <div className="space-y-2">
            {attempts.map((a: any) => (
              <div key={a.id} className="bg-white border rounded-md p-3 text-xs flex justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-mono text-gray-600 truncate">{a.muxUploadId}</div>
                  <div className="text-gray-500 mt-1">{new Date(a.createdAt).toLocaleString()}</div>
                  {a.errorMessage && <div className="text-red-700 mt-1">{a.errorMessage}</div>}
                </div>
                <StatusChip status={a.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Panel: Prompt & criteria ----------

function PromptPanel({ responseId, fallback }: { responseId: string; fallback: any }) {
  const { data, isLoading } = trpc.platformAdmin.getForensicsPromptContext.useQuery(
    { responseId },
    { staleTime: 60_000 },
  );

  if (isLoading) {
    return <div className="text-xs text-gray-500">Loading prompt context...</div>;
  }

  const p = data || {
    questionText: fallback.question?.text,
    questionCategory: fallback.question?.category,
    questionType: fallback.question?.type,
    questionSkills: fallback.question?.skills || [],
    criteriaSections: [],
    positionContext: null,
    modelVersion: 'gpt-5.2-unified-v1.0',
    promptVersion: 'v2-calibrated',
    scoringWeights: { domainCompetency: 0.6, communicationAndProfessionalism: 0.25, structureAndSpecificity: 0.15 },
    scoringScale: [],
    evaluationPhilosophy: [],
    questionInstructions: null,
    questionDescription: null,
    scoringCriteriaRaw: null,
    transcript: fallback.transcript,
  };

  return (
    <div className="space-y-4">
      <div>
        <SectionHeading title="Question" subtitle={`${p.questionCategory || ''} · ${p.questionType || ''}`} />
        <div className="bg-white border rounded-md p-3 text-sm text-gray-800">{p.questionText || '—'}</div>
        {p.questionDescription && (
          <div className="mt-2 text-xs text-gray-600 italic">{p.questionDescription}</div>
        )}
        {p.questionInstructions && (
          <div className="mt-2 text-xs text-gray-700"><span className="font-semibold">Instructions:</span> {p.questionInstructions}</div>
        )}
        {Array.isArray(p.questionSkills) && p.questionSkills.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {p.questionSkills.map((s: string) => (
              <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-medium uppercase tracking-wide">{s}</span>
            ))}
          </div>
        )}
      </div>

      {p.positionContext && (
        <div>
          <SectionHeading title="Position context" />
          <div className="bg-white border rounded-md p-3 text-sm text-gray-800">
            <div className="font-medium">{p.positionContext.title}</div>
            {p.positionContext.description && (
              <div className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">{p.positionContext.description}</div>
            )}
          </div>
        </div>
      )}

      {p.criteriaSections?.length > 0 && (
        <div>
          <SectionHeading
            title="Scoring criteria given to the LLM"
            subtitle="These sections are injected verbatim into the evaluation prompt."
          />
          <div className="space-y-2">
            {p.criteriaSections.map((s: any, i: number) => (
              <div key={i} className="bg-white border rounded-md p-3">
                <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{s.title}</div>
                <pre className="mt-1 text-xs text-gray-800 whitespace-pre-wrap font-sans">{s.body}</pre>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <SectionHeading title="Evaluation philosophy (static preamble)" />
        <ul className="bg-white border rounded-md p-3 text-xs text-gray-700 space-y-1 list-disc list-inside">
          {(p.evaluationPhilosophy || []).map((line: string, i: number) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </div>

      <div>
        <SectionHeading title="Scoring weights & scale" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-white border rounded-md p-3">
            <div className="text-[11px] font-semibold text-gray-500 uppercase">Weights</div>
            <ul className="mt-1 text-xs text-gray-700 space-y-0.5">
              {Object.entries(p.scoringWeights || {}).map(([k, v]) => (
                <li key={k}>
                  <span className="font-mono">{(Number(v) * 100).toFixed(0)}%</span> — {k}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-white border rounded-md p-3">
            <div className="text-[11px] font-semibold text-gray-500 uppercase">Scale</div>
            <ul className="mt-1 text-xs text-gray-700 space-y-0.5">
              {(p.scoringScale || []).map((s: any, i: number) => (
                <li key={i}><span className="font-mono">{s.range}</span> — {s.label}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <ValueList
        items={[
          { label: 'Model version', value: <span className="font-mono text-xs">{p.modelVersion}</span> },
          { label: 'Prompt version', value: <span className="font-mono text-xs">{p.promptVersion}</span> },
        ]}
        columns={2}
      />

      <JsonViewer value={p.scoringCriteriaRaw} title="Raw scoringCriteria JSON" />
    </div>
  );
}

// ---------- Panel: Response ----------

function ResponsePanel({ response }: { response: any }) {
  return (
    <div className="space-y-4">
      {response.videoUrl && (
        <div>
          <SectionHeading title="Candidate video" subtitle={response.videoUrl} />
          <HlsVideo src={response.videoUrl} />
        </div>
      )}
      {(response.metadata as any)?.muxPlaybackUrl && (response.metadata as any).muxPlaybackUrl !== response.videoUrl && (
        <div>
          <SectionHeading title="Mux playback" subtitle={(response.metadata as any).muxPlaybackUrl} />
          <HlsVideo src={(response.metadata as any).muxPlaybackUrl} />
        </div>
      )}
      {response.fileUrl && (
        <div>
          <SectionHeading title="Uploaded file" />
          <a href={response.fileUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-700 hover:underline break-all">{response.fileUrl}</a>
        </div>
      )}
      {response.textResponse && (
        <div>
          <SectionHeading title="Text response" />
          <div className="bg-white border rounded-md p-3 text-sm text-gray-800 whitespace-pre-wrap">{response.textResponse}</div>
        </div>
      )}
      {response.choiceSelected && (
        <div>
          <SectionHeading title="Choice selected" />
          <div className="bg-white border rounded-md p-3 text-sm text-gray-800">{response.choiceSelected}</div>
        </div>
      )}
      <div>
        <SectionHeading
          title="Transcript"
          subtitle={response.orchestrator?.transcriptSource ? `source: ${response.orchestrator.transcriptSource}` : undefined}
        />
        {response.transcript ? (
          <pre className="bg-white border rounded-md p-3 text-sm text-gray-800 whitespace-pre-wrap font-sans">
{response.transcript}
          </pre>
        ) : (
          <div className="text-xs text-gray-500 italic">No transcript captured.</div>
        )}
      </div>
      <ValueList
        columns={3}
        items={[
          { label: 'Submitted', value: response.submittedAt ? new Date(response.submittedAt).toLocaleString() : '—' },
          { label: 'Processed', value: response.processedAt ? new Date(response.processedAt).toLocaleString() : '—' },
          { label: 'Time spent', value: response.timeSpent ? `${response.timeSpent}s` : '—' },
          { label: 'Attempt #', value: response.attemptNumber },
          { label: 'Confidence', value: response.confidence != null ? `${(response.confidence * 100).toFixed(0)}%` : '—' },
          { label: 'Response ID', value: <code className="text-[10px]">{response.id}</code> },
        ]}
      />
    </div>
  );
}

// ---------- Panel: Conversations LLM (orchestrator) ----------

function ConversationsPanel({ response }: { response: any }) {
  const orch = response.orchestrator || {};
  const turns: any[] = orch.turns || [];
  const qa: Record<string, any> = orch.questionAssessments || {};
  const qaEntries = Object.entries(qa);

  if (!turns.length && !qaEntries.length) {
    return (
      <div className="text-xs text-gray-500 italic">
        No Conversations LLM data for this response. Only live interview (orchestrator) nodes populate this panel.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div className="bg-white border rounded-md p-3">
          <div className="text-[11px] font-semibold text-gray-500 uppercase">Avatar / persona</div>
          <div className="text-gray-800 mt-1">{orch.avatarName || '—'}</div>
        </div>
        <div className="bg-white border rounded-md p-3">
          <div className="text-[11px] font-semibold text-gray-500 uppercase">Ended</div>
          <div className="text-gray-800 mt-1">{orch.endedReason || '—'}</div>
        </div>
        <div className="bg-white border rounded-md p-3">
          <div className="text-[11px] font-semibold text-gray-500 uppercase">Turn count</div>
          <div className="text-gray-800 mt-1">{turns.length}</div>
        </div>
      </div>

      {qaEntries.length > 0 && (
        <div>
          <SectionHeading
            title="Per-question live assessments"
            subtitle="Produced by the orchestrator LLM on each candidate utterance"
          />
          <div className="space-y-2">
            {qaEntries.map(([qid, a]: [string, any]) => (
              <div key={qid} className="bg-white border rounded-md p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-gray-600">
                    <span className="font-mono">{qid.slice(0, 16)}</span>
                  </div>
                  <SufficiencyBadge level={a?.sufficiency} />
                </div>
                <div className="text-sm text-gray-800">{a?.question || a?.text || '—'}</div>
                {Array.isArray(a?.keyPointsCovered) && a.keyPointsCovered.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {a.keyPointsCovered.map((p: string, i: number) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">{p}</span>
                    ))}
                  </div>
                )}
                {a?.action && (
                  <div className="mt-2 text-xs text-gray-600">
                    <span className="font-semibold">Last action:</span> <span className="font-mono">{a.action}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {turns.length > 0 && (
        <div>
          <SectionHeading title="Turn-by-turn replay" subtitle="Raw interviewer/candidate utterances" />
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {turns.map((t, i) => {
              const role = (t.role || '').toLowerCase();
              const isCandidate = role === 'candidate' || role === 'user';
              return (
                <div
                  key={i}
                  className={clsx(
                    'rounded-md border p-3',
                    isCandidate ? 'bg-blue-50 border-blue-100' : 'bg-white border-gray-200',
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={clsx('text-[10px] font-semibold uppercase tracking-wide',
                      isCandidate ? 'text-blue-700' : 'text-gray-500',
                    )}>
                      {t.role || 'turn'}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">
                      {t.timestamp ? new Date(t.timestamp).toLocaleTimeString() : `#${t.index ?? i}`}
                    </span>
                  </div>
                  <div className="text-sm text-gray-900 whitespace-pre-wrap">{t.text || '—'}</div>
                  {(t.sufficiency || t.action) && (
                    <div className="mt-2 flex items-center space-x-2">
                      {t.sufficiency && <SufficiencyBadge level={t.sufficiency} />}
                      {t.action && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-mono">
                          {t.action}
                        </span>
                      )}
                    </div>
                  )}
                  {Array.isArray(t.keyPointsCovered) && t.keyPointsCovered.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {t.keyPointsCovered.map((p: string, ii: number) => (
                        <span key={ii} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">{p}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <JsonViewer value={orch} title="Raw orchestrator customData" />
    </div>
  );
}

// ---------- Panel: Evaluation LLM ----------

function EvaluationPanel({ response }: { response: any }) {
  const e = response.aiEvaluation;
  const a = response.aiAnalysis;

  if (!e && !a) {
    return <div className="text-xs text-gray-500 italic">No evaluation has been recorded for this response yet.</div>;
  }

  // Resolve fields from ai_evaluations row (flat columns) or fallback to journey_responses.aiAnalysis (JSON)
  const pick = (key: string) =>
    (e && (e as any)[key] != null ? (e as any)[key] : a && (a as any)[key] != null ? (a as any)[key] : null);

  const score = response.score ?? pick('overallScore') ?? pick('score');
  const rationale = pick('scoreRationale') || pick('rationale');
  const executive = pick('executiveSummary') || pick('overallAssessment');
  const hireLevel = pick('hiringRecommendationLevel');
  const confidenceLevel = pick('confidenceLevel');
  const competency =
    (a && (a as any).competencyAssessment) ||
    null;

  const arrayPick = (key: string): string[] => {
    const v = pick(key);
    return Array.isArray(v) ? v : [];
  };

  const keyStrengths = arrayPick('keyStrengths').length ? arrayPick('keyStrengths') : arrayPick('strengths');
  const developmentAreas = arrayPick('developmentAreas').length ? arrayPick('developmentAreas') : arrayPick('gapsAgainstExpectedAnswer');
  const standoutMoments = arrayPick('standoutMoments');
  const coaching = arrayPick('coachingRecommendations');

  // Red flags may be object {isRedFlagForHiring, redFlagNotes} or array string[]
  const redFlagsRaw = pick('redFlags');
  const redFlagArr: string[] = Array.isArray(redFlagsRaw)
    ? redFlagsRaw
    : redFlagsRaw && typeof redFlagsRaw === 'object' && 'redFlagNotes' in redFlagsRaw && (redFlagsRaw as any).redFlagNotes
      ? [String((redFlagsRaw as any).redFlagNotes)]
      : [];

  // Vector scores (0-100) — pull anything that's a number we recognize.
  const vectorKeys = [
    'timeManagement', 'collaboration', 'initiative', 'accountability', 'goingAboveAndBeyond',
    'adaptability', 'goalSetting', 'clarity', 'structure', 'confidence', 'professionalism',
    'analyticalThinking', 'creativeProblemSolving', 'decisionMaking', 'leadership', 'influence',
    'emotionalIntelligence', 'culturalFit', 'hireRecommendation',
    'situationClarity', 'taskDefinition', 'actionSpecificity', 'resultQuantification', 'starMethodScore',
    'industryBenchmark', 'roleBenchmark',
  ] as const;

  const vector = vectorKeys
    .map(k => ({ label: k, value: Number(pick(k)) }))
    .filter(x => Number.isFinite(x.value) && x.value > 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white border rounded-md p-3">
          <div className="text-[11px] font-semibold text-gray-500 uppercase">Score</div>
          <div className="mt-1 text-3xl font-bold text-blue-700 tabular-nums">
            {score != null ? Number(score).toFixed(0) : '—'}
          </div>
        </div>
        <div className="bg-white border rounded-md p-3">
          <div className="text-[11px] font-semibold text-gray-500 uppercase">Recommendation</div>
          <div className="mt-1 text-sm font-semibold text-gray-900">{hireLevel || '—'}</div>
          {confidenceLevel != null && (
            <div className="text-xs text-gray-500">Confidence {Number(confidenceLevel).toFixed(0)}%</div>
          )}
        </div>
        <div className="bg-white border rounded-md p-3">
          <div className="text-[11px] font-semibold text-gray-500 uppercase">Model</div>
          <div className="mt-1 text-xs text-gray-800 font-mono">{e?.modelVersion || 'gpt-5.2-unified-v1.0'}</div>
          <div className="text-xs text-gray-500">proc. time: {e?.processingTime ?? a?.processingTime ?? '—'} ms</div>
        </div>
      </div>

      {rationale && (
        <div>
          <SectionHeading title="Score rationale" />
          <p className="bg-white border rounded-md p-3 text-sm text-gray-800">{rationale}</p>
        </div>
      )}

      {executive && (
        <div>
          <SectionHeading title="Executive summary" />
          <p className="bg-white border rounded-md p-3 text-sm text-gray-800 whitespace-pre-wrap">{executive}</p>
        </div>
      )}

      {competency && (
        <div>
          <SectionHeading title="Competency assessment (1–5)" />
          <div className="bg-white border rounded-md p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
            {Object.entries(competency).map(([k, v]: [string, any]) => {
              const rating = v?.rating ?? null;
              const evidence = v?.evidence || '';
              return (
                <div key={k} className="border-b border-gray-100 py-2 last:border-none">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-700">{k}</span>
                    <span className="text-xs font-mono text-gray-900 tabular-nums">{rating ?? '—'}/5</span>
                  </div>
                  {rating != null && <ScoreBar value={Number(rating)} max={5} color="purple" compact />}
                  {evidence && <div className="mt-1 text-xs text-gray-600 italic">{evidence}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {vector.length > 0 && (
        <div>
          <SectionHeading title="Full behavioral vector (0–100)" />
          <div className="bg-white border rounded-md p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            {vector.map(v => (
              <ScoreBar key={v.label} value={v.value} label={v.label} color="indigo" />
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {keyStrengths.length > 0 && (
          <ListCard title="Key strengths" items={keyStrengths} tone="emerald" />
        )}
        {developmentAreas.length > 0 && (
          <ListCard title="Development areas" items={developmentAreas} tone="amber" />
        )}
        {standoutMoments.length > 0 && (
          <ListCard title="Standout moments" items={standoutMoments} tone="blue" />
        )}
        {redFlagArr.length > 0 && (
          <ListCard title="Red flags" items={redFlagArr} tone="red" />
        )}
        {coaching.length > 0 && (
          <ListCard title="Coaching recommendations" items={coaching} tone="indigo" />
        )}
      </div>

      <JsonViewer value={a} title="Raw aiAnalysis JSON (what the model returned)" />
      <JsonViewer value={e} title="Raw ai_evaluations row (parsed into flat columns)" />
    </div>
  );
}

function ListCard({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: 'emerald' | 'amber' | 'red' | 'blue' | 'indigo';
}) {
  const bar = {
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
    blue: 'bg-blue-500',
    indigo: 'bg-indigo-500',
  }[tone];
  return (
    <div className="bg-white border rounded-md p-3">
      <div className="flex items-center space-x-2 mb-2">
        <div className={`w-1.5 h-4 rounded-sm ${bar}`} />
        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{title}</span>
      </div>
      <ul className="text-sm text-gray-800 space-y-1.5 list-disc list-inside">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

// ---------- Panel: Video analysis ----------

function VideoAnalysisPanel({ response }: { response: any }) {
  const v = response.videoAnalysis;
  if (!v) return <div className="text-xs text-gray-500 italic">No video analysis present.</div>;

  const emotionKeys = [
    ['joyExpression', 'Joy'],
    ['surpriseExpression', 'Surprise'],
    ['fearExpression', 'Fear'],
    ['angerExpression', 'Anger'],
    ['disgustExpression', 'Disgust'],
    ['sadnessExpression', 'Sadness'],
    ['contemptExpression', 'Contempt'],
    ['neutralExpression', 'Neutral'],
  ] as const;

  const overallKeys = [
    ['facialConfidence', 'Facial confidence'],
    ['engagementScore', 'Engagement'],
    ['authenticityMarkers', 'Authenticity markers'],
    ['emotionalStability', 'Emotional stability'],
    ['postureAssessment', 'Posture'],
    ['gestureAnalysis', 'Gestures'],
    ['eyeContactScore', 'Eye contact'],
    ['professionalismRating', 'Professionalism'],
    ['fluencyScore', 'Fluency'],
    ['clarityRating', 'Clarity'],
    ['voiceAuthenticity', 'Voice authenticity'],
    ['vocalVariety', 'Vocal variety'],
    ['lightingQuality', 'Lighting'],
    ['backgroundProfessionalism', 'Background'],
    ['audioQuality', 'Audio quality'],
    ['technicalSetupScore', 'Technical setup'],
    ['naturalBehavior', 'Natural behavior'],
    ['spontaneousReactions', 'Spontaneous reactions'],
    ['consistentPersona', 'Consistent persona'],
    ['stressIndicators', 'Stress'],
  ] as const;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-white border rounded-md p-3">
          <div className="text-[11px] font-semibold text-gray-500 uppercase">Overall</div>
          <div className="mt-1 text-3xl font-bold text-indigo-700 tabular-nums">
            {v.overallScore != null ? Number(v.overallScore).toFixed(0) : '—'}
          </div>
        </div>
        <div className="bg-white border rounded-md p-3">
          <div className="text-[11px] font-semibold text-gray-500 uppercase">Confidence</div>
          <div className="mt-1 text-2xl font-semibold text-gray-900 tabular-nums">
            {v.confidenceLevel != null ? (Number(v.confidenceLevel) * 100).toFixed(0) : '—'}%
          </div>
        </div>
        <div className="bg-white border rounded-md p-3">
          <div className="text-[11px] font-semibold text-gray-500 uppercase">Frames analyzed</div>
          <div className="mt-1 text-2xl font-semibold text-gray-900 tabular-nums">{v.framesAnalyzed ?? '—'}</div>
        </div>
        <div className="bg-white border rounded-md p-3">
          <div className="text-[11px] font-semibold text-gray-500 uppercase">Method</div>
          <div className="mt-1 text-xs text-gray-800 font-mono break-all">{v.analysisMethod || '—'}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border rounded-md p-3">
          <div className="text-xs font-semibold text-gray-700 uppercase mb-2">Emotion breakdown</div>
          <div className="space-y-2">
            {emotionKeys.map(([k, label]) => (
              <ScoreBar key={k} value={Number(v[k] ?? 0) * 100} label={label} color="purple" />
            ))}
          </div>
        </div>
        <div className="bg-white border rounded-md p-3">
          <div className="text-xs font-semibold text-gray-700 uppercase mb-2">Engagement / quality</div>
          <div className="space-y-2">
            {overallKeys.map(([k, label]) => (
              <ScoreBar key={k} value={Number(v[k] ?? 0) * 100} label={label} color="indigo" />
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ValueList
          items={[
            { label: 'Speaking rate', value: v.speakingRate != null ? `${Number(v.speakingRate).toFixed(1)} wpm` : '—' },
            { label: 'Pause frequency', value: v.pauseFrequency != null ? Number(v.pauseFrequency).toFixed(2) : '—' },
            { label: 'Filler words', value: v.fillerWords ?? '—' },
            { label: 'Fidgeting index', value: v.fidgetingIndex != null ? Number(v.fidgetingIndex).toFixed(2) : '—' },
          ]}
        />
        <ValueList
          items={[
            { label: 'Head movements', value: v.headMovements != null ? Number(v.headMovements).toFixed(2) : '—' },
            { label: 'Hand gestures', value: v.handGestures != null ? Number(v.handGestures).toFixed(2) : '—' },
            { label: 'Body positioning', value: v.bodyPositioning != null ? Number(v.bodyPositioning).toFixed(2) : '—' },
            { label: 'Audio duration', value: v.audioDuration != null ? `${Number(v.audioDuration).toFixed(1)}s` : '—' },
          ]}
        />
      </div>

      {Array.isArray(v.redFlags) && v.redFlags.length > 0 && (
        <ListCard title="Video red flags" items={v.redFlags} tone="red" />
      )}
      {Array.isArray(v.recommendations) && v.recommendations.length > 0 && (
        <ListCard title="Recommendations" items={v.recommendations} tone="blue" />
      )}

      <JsonViewer value={v.detailedAnalysis} title="detailedAnalysis" />
      <JsonViewer value={{ facialExpressions: v.facialExpressions, bodyLanguage: v.bodyLanguage, speechPatterns: v.speechPatterns, environmentalFactors: v.environmentalFactors }} title="Raw facial / body / speech / environment" />
    </div>
  );
}

// ---------- Panel: Authenticity ----------

function AuthenticityPanel({ response }: { response: any }) {
  const a = response.authenticity;
  if (!a) return <div className="text-xs text-gray-500 italic">No authenticity analysis present (legacy assessment path only).</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-white border rounded-md p-3">
          <div className="text-[11px] font-semibold text-gray-500 uppercase">Overall</div>
          <div className={clsx('mt-1 text-3xl font-bold tabular-nums',
            Number(a.overallScore) >= 70 ? 'text-emerald-700' : Number(a.overallScore) >= 40 ? 'text-amber-700' : 'text-red-700',
          )}>
            {a.overallScore != null ? Number(a.overallScore).toFixed(0) : '—'}
          </div>
        </div>
        <div className="bg-white border rounded-md p-3">
          <div className="text-[11px] font-semibold text-gray-500 uppercase">Is authentic</div>
          <div className="mt-1 text-lg font-semibold text-gray-900">{a.isAuthentic ? 'YES' : 'NO'}</div>
        </div>
        <div className="bg-white border rounded-md p-3">
          <div className="text-[11px] font-semibold text-gray-500 uppercase">Risk level</div>
          <div className="mt-1 text-lg font-semibold text-gray-900">{a.riskLevel}</div>
        </div>
        <div className="bg-white border rounded-md p-3">
          <div className="text-[11px] font-semibold text-gray-500 uppercase">Confidence</div>
          <div className="mt-1 text-lg font-semibold text-gray-900 tabular-nums">
            {a.confidence != null ? (Number(a.confidence) * 100).toFixed(0) : '—'}%
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-white border rounded-md p-3 space-y-2">
          <ScoreBar value={Number(a.linguisticScore)} label="Linguistic" color="indigo" />
          <ScoreBar value={Number(a.behavioralScore)} label="Behavioral" color="indigo" />
          <ScoreBar value={Number(a.contentScore)} label="Content" color="indigo" />
          <ScoreBar value={Number(a.temporalScore)} label="Temporal" color="indigo" />
        </div>
        <div className="space-y-2">
          {Array.isArray(a.authenticityMarkers) && a.authenticityMarkers.length > 0 && (
            <ListCard title="Authenticity markers" items={a.authenticityMarkers} tone="emerald" />
          )}
          {Array.isArray(a.suspiciousIndicators) && a.suspiciousIndicators.length > 0 && (
            <ListCard title="Suspicious indicators" items={a.suspiciousIndicators} tone="red" />
          )}
          {Array.isArray(a.detectedPatterns) && a.detectedPatterns.length > 0 && (
            <ListCard title="Detected patterns" items={a.detectedPatterns} tone="amber" />
          )}
        </div>
      </div>

      <JsonViewer value={a.linguisticAnalysis} title="linguisticAnalysis" />
      <JsonViewer value={a.behavioralAnalysis} title="behavioralAnalysis" />
      <JsonViewer value={a.contentAnalysis} title="contentAnalysis" />
      <JsonViewer value={a.temporalAnalysis} title="temporalAnalysis" />
    </div>
  );
}

// ---------- Panel: Human vs AI ----------

function HumanVsAiPanel({
  response,
  humanFeedback,
  calibration,
}: {
  response: any;
  humanFeedback: any;
  calibration: any;
}) {
  const app = humanFeedback?.application;
  const ratings: any[] = humanFeedback?.ratings || [];
  const notes: any[] = humanFeedback?.notes || [];
  const mae = calibration?.meanAbsoluteError != null ? Number(calibration.meanAbsoluteError) : null;

  const aiScore = response.score;
  const humanScore = app?.humanScore ?? null;
  const delta = aiScore != null && humanScore != null ? aiScore - humanScore : null;
  const flagged = mae != null && delta != null && Math.abs(delta) >= mae;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white border rounded-md p-3">
          <div className="text-[11px] font-semibold text-gray-500 uppercase">AI score</div>
          <div className="mt-1 text-3xl font-bold text-blue-700 tabular-nums">{aiScore != null ? aiScore.toFixed(0) : '—'}</div>
        </div>
        <div className="bg-white border rounded-md p-3">
          <div className="text-[11px] font-semibold text-gray-500 uppercase">Human score</div>
          <div className="mt-1 text-3xl font-bold text-emerald-700 tabular-nums">{humanScore != null ? humanScore.toFixed(0) : '—'}</div>
          {app?.reviewerScore != null && <div className="text-xs text-gray-500">Reviewer gave {app.reviewerScore}/5</div>}
        </div>
        <div className={clsx('rounded-md p-3 border',
          flagged ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200',
        )}>
          <div className="text-[11px] font-semibold text-gray-500 uppercase">Delta</div>
          <div className="mt-1 text-3xl font-bold text-gray-900 tabular-nums">
            {delta != null ? `${delta > 0 ? '+' : ''}${delta.toFixed(1)}` : '—'}
          </div>
          {flagged && (
            <div className="text-xs text-red-700 mt-1">
              |Δ| ≥ tenant MAE ({mae?.toFixed(1)}). Worth investigating.
            </div>
          )}
        </div>
      </div>

      {ratings.length > 0 && (
        <div>
          <SectionHeading title="Per-category human ratings (1–5)" />
          <div className="bg-white border rounded-md p-3 space-y-2">
            {ratings.map((r, i) => (
              <ScoreBar key={i} value={Number(r.score)} max={5} label={r.categoryLabel || r.categoryId} color="emerald" />
            ))}
          </div>
        </div>
      )}

      {app?.notes && (
        <div>
          <SectionHeading title="Reviewer note on this application" />
          <div className="bg-white border rounded-md p-3 text-sm text-gray-800 whitespace-pre-wrap">{app.notes}</div>
        </div>
      )}

      {notes.length > 0 && (
        <div>
          <SectionHeading title={`Recruiter notes on candidate (${notes.length})`} />
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {notes.map(n => (
              <div key={n.id} className="bg-white border rounded-md p-3">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span>{n.authorName || 'Unknown'} · {n.type}</span>
                  <span>{new Date(n.createdAt).toLocaleString()}</span>
                </div>
                <div className="text-sm text-gray-800 whitespace-pre-wrap">{n.content}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Panel: Scoring history (per response) ----------

function ScoringHistoryPanel({ response }: { response: any }) {
  const events: any[] = response.scoringEvents || [];
  if (!events.length) {
    return <div className="text-xs text-gray-500 italic">No scoring_events rows recorded for this response.</div>;
  }
  return (
    <div className="space-y-2">
      {events.map(ev => (
        <div key={ev.id} className="bg-white border rounded-md p-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-gray-700">{ev.eventType}</span>
              {ev.modelVersion && (
                <span className="ml-2 text-[10px] font-mono text-gray-500">{ev.modelVersion}</span>
              )}
              {ev.promptVersion && (
                <span className="ml-2 text-[10px] font-mono text-gray-500">{ev.promptVersion}</span>
              )}
            </div>
            <span className="text-xs text-gray-500">{new Date(ev.createdAt).toLocaleString()}</span>
          </div>
          <div className="mt-1 text-sm text-gray-800 tabular-nums">
            <span className="text-gray-500">before</span> {ev.scoreBefore != null ? Number(ev.scoreBefore).toFixed(1) : '—'}
            <span className="mx-2 text-gray-400">→</span>
            <span className="text-gray-500">after</span> {ev.scoreAfter != null ? Number(ev.scoreAfter).toFixed(1) : '—'}
            {ev.delta != null && (
              <span className={`ml-3 ${Number(ev.delta) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                Δ {Number(ev.delta) > 0 ? '+' : ''}{Number(ev.delta).toFixed(1)}
              </span>
            )}
          </div>
          <JsonViewer value={ev.metadata} title="metadata" />
        </div>
      ))}
    </div>
  );
}

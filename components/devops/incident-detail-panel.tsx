'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import {
  AlertTriangle,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  FileCode2,
  GitPullRequest,
  Github,
  RotateCw,
  ScrollText,
  Sparkles,
  XCircle,
} from 'lucide-react';

/* ----------------------------- helpers ----------------------------- */

function formatDate(value: unknown): string {
  if (!value) return '—';
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function relativeTime(value: unknown): string {
  if (!value) return '';
  const d = new Date(value as string).getTime();
  if (Number.isNaN(d)) return '';
  const diff = Date.now() - d;
  const s = Math.round(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  return `${days}d ago`;
}

function formatDuration(ms: unknown): string | null {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return null;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return rem ? `${m}m ${rem}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function formatEventPayload(payload: unknown): string | null {
  if (payload == null) return null;
  if (typeof payload === 'string') return payload;
  try {
    const text = JSON.stringify(payload, null, 2);
    return text === '{}' ? null : text;
  } catch {
    return String(payload);
  }
}

const STATUS_STEPS = [
  'detected',
  'triaging',
  'agent_running',
  'pr_open',
  'deployed',
  'verified',
  'closed',
] as const;

const STATUS_LABEL: Record<string, string> = {
  detected: 'Detected',
  triaging: 'Triaging',
  agent_running: 'Agent running',
  pr_open: 'PR open',
  deployed: 'Deployed',
  verified: 'Verified',
  closed: 'Closed',
  false_positive: 'False positive',
  escalated: 'Escalated',
};

const EVENT_META: Record<string, { label: string; color: string }> = {
  rule_fired: { label: 'Rule fired', color: 'text-amber-600 bg-amber-50' },
  client_error: { label: 'Client error', color: 'text-red-600 bg-red-50' },
  e2e_failure: { label: 'E2E failure', color: 'text-red-600 bg-red-50' },
  slack_sent: { label: 'Slack notified', color: 'text-violet-600 bg-violet-50' },
  github_issue: { label: 'GitHub issue', color: 'text-gray-700 bg-gray-100' },
  agent_spawn: { label: 'Agent spawned', color: 'text-indigo-600 bg-indigo-50' },
  pr_opened: { label: 'PR opened', color: 'text-emerald-600 bg-emerald-50' },
  agent_finished: { label: 'Agent finished', color: 'text-emerald-600 bg-emerald-50' },
  agent_failed: { label: 'Agent failed', color: 'text-red-600 bg-red-50' },
  agent_resume: { label: 'Agent resumed', color: 'text-indigo-600 bg-indigo-50' },
  verify_dispatched: { label: 'Verify dispatched', color: 'text-blue-600 bg-blue-50' },
  verify_complete: { label: 'Verify complete', color: 'text-emerald-600 bg-emerald-50' },
  human_action: { label: 'Operator action', color: 'text-gray-700 bg-gray-100' },
};

function severityColor(sev: string): string {
  return sev === 'p0'
    ? 'bg-red-100 text-red-800'
    : sev === 'p1'
      ? 'bg-amber-100 text-amber-800'
      : 'bg-blue-100 text-blue-800';
}

function fileStatusColor(status: string): string {
  if (status === 'added') return 'text-emerald-700 bg-emerald-50';
  if (status === 'removed') return 'text-red-700 bg-red-50';
  if (status === 'renamed') return 'text-blue-700 bg-blue-50';
  return 'text-gray-700 bg-gray-100';
}

/* ----------------------------- subcomponents ----------------------------- */

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <div className="mt-0.5 text-sm text-gray-900 break-words">{children || '—'}</div>
    </div>
  );
}

function StatusStepper({ status }: { status: string }) {
  if (status === 'false_positive') {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <XCircle className="h-4 w-4" /> Marked false positive
      </div>
    );
  }
  const currentIdx = STATUS_STEPS.indexOf(status as (typeof STATUS_STEPS)[number]);
  const idx = currentIdx === -1 ? 0 : currentIdx;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {STATUS_STEPS.map((step, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <div key={step} className="flex items-center">
            <div
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                active
                  ? 'bg-indigo-600 text-white'
                  : done
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-gray-100 text-gray-400'
              }`}
            >
              {done ? <Check className="h-3 w-3" /> : null}
              {STATUS_LABEL[step]}
            </div>
            {i < STATUS_STEPS.length - 1 && (
              <div className={`h-px w-3 ${done ? 'bg-indigo-300' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Card({
  title,
  icon,
  right,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-4 px-5 py-3 border-b border-gray-100">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          {icon}
          {title}
        </h2>
        {right}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

/* ----------------------------- main ----------------------------- */

export function DevopsIncidentDetailPanel({ incidentId }: { incidentId: string }) {
  const utils = trpc.useUtils();
  const [copied, setCopied] = useState(false);
  const [openEvents, setOpenEvents] = useState<Record<string, boolean>>({});

  const configQuery = trpc.platformAdmin.getDevopsConfig.useQuery();
  const detailQuery = trpc.platformAdmin.getDevopsIncident.useQuery(
    { id: incidentId },
    {
      enabled: Boolean(incidentId),
      retry: false,
      refetchInterval: (data: any) =>
        data?.incident?.status === 'agent_running' ? 5000 : false,
    },
  );

  const refresh = () => {
    void detailQuery.refetch();
    void utils.platformAdmin.listDevopsIncidents.invalidate();
    void utils.platformAdmin.getDevopsMetrics.invalidate();
  };

  const ackMutation = trpc.platformAdmin.ackDevopsIncident.useMutation({ onSuccess: refresh });
  const fpMutation = trpc.platformAdmin.falsePositiveDevopsIncident.useMutation({ onSuccess: refresh });
  const spawnMutation = trpc.platformAdmin.spawnDevopsAgent.useMutation({ onSuccess: refresh });
  const verifyMutation = trpc.platformAdmin.verifyDevopsIncident.useMutation({ onSuccess: refresh });
  const closeMutation = trpc.platformAdmin.closeDevopsIncident.useMutation({ onSuccess: refresh });

  const detail = detailQuery.data;
  const incident = detail?.incident;
  const events = detail?.events ?? [];
  const agentRuns = detail?.agentRuns ?? [];
  const pr = detail?.pr ?? null;
  const status = incident?.status;
  const closed = status === 'closed' || status === 'false_positive';
  const canSpawn =
    !closed &&
    status !== 'agent_running' &&
    ['detected', 'triaging', 'pr_open', 'deployed'].includes(status ?? '');
  const canVerify =
    !closed && ['pr_open', 'deployed', 'triaging', 'verified'].includes(status ?? '');
  const canClose = !closed && status !== 'agent_running';

  const actionError =
    ackMutation.error ??
    fpMutation.error ??
    spawnMutation.error ??
    verifyMutation.error ??
    closeMutation.error;

  const axiomUrl = incident?.axiomUrl ?? configQuery.data?.axiomStreamUrl ?? null;

  // Cursor's latest reply (from the most recent agent run that has one).
  const latestReply = agentRuns.find((r: any) => r.resultSummary)?.resultSummary ?? null;
  const latestRun = agentRuns[0] ?? null;

  if (detailQuery.isLoading) {
    return <p className="text-sm text-gray-500">Loading incident…</p>;
  }
  if (detailQuery.isError) {
    return (
      <p className="text-sm text-red-600">
        Failed to load incident: {detailQuery.error.message}
      </p>
    );
  }
  if (!incident) {
    return <p className="text-sm text-red-600">Incident not found.</p>;
  }

  const copyId = () => {
    void navigator.clipboard?.writeText(incident.id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const btn =
    'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50';
  const linkBtn =
    'inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${severityColor(incident.severity)}`}>
            {incident.severity}
          </span>
          <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-800">
            {STATUS_LABEL[incident.status] ?? incident.status}
          </span>
          {incident.ruleName && (
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
              {incident.ruleName}
            </span>
          )}
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <Clock className="h-3.5 w-3.5" /> opened {relativeTime(incident.createdAt)}
          </span>
          <button
            type="button"
            onClick={refresh}
            className="ml-auto inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
          >
            <RotateCw className={`h-3.5 w-3.5 ${detailQuery.isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">{incident.title}</h1>
        {incident.summary && (
          <p className="mt-2 text-sm text-gray-600 whitespace-pre-wrap">{incident.summary}</p>
        )}
        <button
          type="button"
          onClick={copyId}
          className="mt-2 inline-flex items-center gap-1 text-xs font-mono text-gray-400 hover:text-gray-600"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {incident.id}
        </button>
      </div>

      {/* Status stepper */}
      <div className="rounded-lg border border-gray-200 bg-white px-5 py-4 shadow-sm">
        <StatusStepper status={incident.status} />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {!closed && configQuery.data?.enabled && (
          <>
            <button
              type="button"
              disabled={ackMutation.isPending}
              onClick={() => ackMutation.mutate({ id: incidentId })}
              className={`${btn} bg-indigo-600 text-white hover:bg-indigo-700`}
            >
              {ackMutation.isPending ? 'Acknowledging…' : 'Acknowledge'}
            </button>
            {canSpawn && (
              <button
                type="button"
                disabled={spawnMutation.isPending}
                onClick={() => {
                  if (!window.confirm('Spawn a Cursor cloud agent to investigate and open a PR?')) return;
                  spawnMutation.mutate({ id: incidentId });
                }}
                className={`${btn} bg-violet-600 text-white hover:bg-violet-700`}
              >
                <Bot className="h-4 w-4" />
                {spawnMutation.isPending ? 'Spawning…' : 'Spawn agent'}
              </button>
            )}
            {canVerify && (
              <button
                type="button"
                disabled={verifyMutation.isPending}
                onClick={() => verifyMutation.mutate({ id: incidentId, suite: 'smoke' })}
                className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`}
              >
                {verifyMutation.isPending ? 'Dispatching…' : 'Run verify'}
              </button>
            )}
            {canClose && (
              <button
                type="button"
                disabled={closeMutation.isPending}
                onClick={() => {
                  if (!window.confirm('Close this incident without verify?')) return;
                  closeMutation.mutate({ id: incidentId });
                }}
                className={`${btn} border border-gray-300 text-gray-700 hover:bg-gray-50`}
              >
                {closeMutation.isPending ? 'Closing…' : 'Close'}
              </button>
            )}
            <button
              type="button"
              disabled={fpMutation.isPending}
              onClick={() => {
                const note = window.prompt('Optional note for false positive:') ?? undefined;
                fpMutation.mutate({ id: incidentId, note: note || undefined });
              }}
              className={`${btn} border border-gray-300 text-gray-700 hover:bg-gray-50`}
            >
              {fpMutation.isPending ? 'Updating…' : 'False positive'}
            </button>
          </>
        )}
        {axiomUrl && (
          <a href={axiomUrl} target="_blank" rel="noopener noreferrer" className={linkBtn}>
            <ScrollText className="h-4 w-4" /> Logs in Axiom <ExternalLink className="h-3 w-3" />
          </a>
        )}
        {incident.githubIssueUrl && (
          <a href={incident.githubIssueUrl} target="_blank" rel="noopener noreferrer" className={linkBtn}>
            <Github className="h-4 w-4" /> GitHub issue <ExternalLink className="h-3 w-3" />
          </a>
        )}
        {incident.prUrl && (
          <a href={incident.prUrl} target="_blank" rel="noopener noreferrer" className={linkBtn}>
            <GitPullRequest className="h-4 w-4" /> Pull request <ExternalLink className="h-3 w-3" />
          </a>
        )}
        {incident.cursorAgentUrl && (
          <a href={incident.cursorAgentUrl} target="_blank" rel="noopener noreferrer" className={linkBtn}>
            <Bot className="h-4 w-4" /> Cursor agent <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {actionError && (
        <p className="text-sm text-red-600">
          {'message' in actionError ? String(actionError.message) : 'Action failed'}
        </p>
      )}

      {/* Facts grid */}
      <Card title="Details" icon={<AlertTriangle className="h-4 w-4 text-gray-400" />}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Fact label="Service">{incident.primaryService}</Fact>
          <Fact label="Repo">{incident.likelyRepo}</Fact>
          <Fact label="Rule">{incident.ruleName}</Fact>
          <Fact label="Sample count">{incident.sampleCount != null ? String(incident.sampleCount) : '—'}</Fact>
          <Fact label="Age">{formatDuration(incident.ageMs) ?? '—'}</Fact>
          <Fact label="Deploy SHA">
            {incident.deploySha ? <span className="font-mono text-xs">{incident.deploySha.slice(0, 10)}</span> : '—'}
          </Fact>
          <Fact label="Created">{formatDate(incident.createdAt)}</Fact>
          <Fact label="Updated">{formatDate(incident.updatedAt)}</Fact>
          {incident.closedAt && <Fact label="Closed">{formatDate(incident.closedAt)}</Fact>}
          {incident.verifyRunId && <Fact label="Verify run">{incident.verifyRunId}</Fact>}
          {incident.cursorAgentId && (
            <Fact label="Cursor agent">
              <span className="font-mono text-xs">{incident.cursorAgentId}</span>
            </Fact>
          )}
        </div>
      </Card>

      {/* Proposed changes (PR) */}
      {pr && (
        <Card
          title="Proposed changes"
          icon={<GitPullRequest className="h-4 w-4 text-emerald-600" />}
          right={
            <a
              href={pr.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
            >
              Open PR #{pr.number} <ExternalLink className="h-3 w-3" />
            </a>
          }
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">{pr.title}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                pr.merged
                  ? 'bg-violet-100 text-violet-800'
                  : pr.state === 'open'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-gray-100 text-gray-600'
              }`}
            >
              {pr.merged ? 'merged' : pr.draft ? 'draft' : pr.state}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-gray-500">
            <span className="text-emerald-600 font-medium">+{pr.additions}</span>
            <span className="text-red-600 font-medium">−{pr.deletions}</span>
            <span>{pr.changedFiles} files</span>
            <span>{pr.commits} commits</span>
            {pr.headRef && pr.baseRef && (
              <span className="font-mono">
                {pr.headRef} → {pr.baseRef}
              </span>
            )}
          </div>

          {pr.files.length > 0 && (
            <ul className="mt-4 divide-y divide-gray-100 rounded-md border border-gray-100">
              {pr.files.map((f: any) => (
                <li key={f.filename} className="flex items-center gap-3 px-3 py-2 text-xs">
                  <FileCode2 className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                  <span className="flex-1 truncate font-mono text-gray-700">{f.filename}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${fileStatusColor(f.status)}`}>
                    {f.status}
                  </span>
                  <span className="text-emerald-600">+{f.additions}</span>
                  <span className="text-red-600">−{f.deletions}</span>
                </li>
              ))}
            </ul>
          )}

          {pr.body && (
            <details className="mt-4 group">
              <summary className="cursor-pointer text-xs font-medium text-gray-500 hover:text-gray-700">
                PR description
              </summary>
              <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-3 text-xs text-gray-700">
                {pr.body}
              </pre>
            </details>
          )}
        </Card>
      )}

      {/* Cursor's response */}
      {latestReply && (
        <Card
          title="Cursor's response"
          icon={<Sparkles className="h-4 w-4 text-violet-600" />}
          right={
            <span className="flex items-center gap-2 text-[11px] text-gray-400">
              {latestRun?.model && <span className="font-mono">{latestRun.model}</span>}
              {formatDuration(latestRun?.durationMs) && (
                <span>· {formatDuration(latestRun?.durationMs)}</span>
              )}
            </span>
          }
        >
          <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap rounded bg-violet-50/40 p-4 text-sm leading-relaxed text-gray-800">
            {latestReply}
          </pre>
        </Card>
      )}

      {/* Agent runs */}
      {agentRuns.length > 0 && (
        <Card title={`Agent runs (${agentRuns.length})`} icon={<Bot className="h-4 w-4 text-indigo-600" />}>
          <ul className="space-y-3">
            {agentRuns.map((run: any) => (
              <li key={run.id} className="rounded-md border border-gray-100 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      run.status === 'finished'
                        ? 'bg-emerald-100 text-emerald-800'
                        : run.status === 'error'
                          ? 'bg-red-100 text-red-800'
                          : run.status === 'running' || run.status === 'starting'
                            ? 'bg-indigo-100 text-indigo-800'
                            : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {run.status}
                  </span>
                  {run.model && <span className="font-mono text-[11px] text-gray-500">{run.model}</span>}
                  {formatDuration(run.durationMs) && (
                    <span className="text-[11px] text-gray-500">{formatDuration(run.durationMs)}</span>
                  )}
                  <span className="ml-auto text-[11px] text-gray-400">{relativeTime(run.createdAt)}</span>
                </div>
                <p className="mt-1.5 font-mono text-[11px] text-gray-500">
                  {run.repo ?? '—'} · {run.branch ?? '—'}
                </p>
                {run.resultSummary && (
                  <p className="mt-1.5 line-clamp-3 text-xs text-gray-600 whitespace-pre-wrap">
                    {run.resultSummary}
                  </p>
                )}
                <div className="mt-2 flex gap-3">
                  {run.cursorAgentUrl && (
                    <a
                      href={run.cursorAgentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800"
                    >
                      <Bot className="h-3 w-3" /> Cursor agent
                    </a>
                  )}
                  {run.prUrl && (
                    <a
                      href={run.prUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800"
                    >
                      <GitPullRequest className="h-3 w-3" /> PR
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Timeline */}
      <Card title={`Timeline (${events.length})`} icon={<Clock className="h-4 w-4 text-gray-400" />}>
        {events.length === 0 ? (
          <p className="text-sm text-gray-500">No timeline events yet.</p>
        ) : (
          <ul className="space-y-1">
            {events.map((evt: any, index: number) => {
              const meta = EVENT_META[evt.kind] ?? { label: evt.kind, color: 'text-gray-600 bg-gray-100' };
              const payloadText = formatEventPayload(evt.payload);
              const key = evt.id ?? `${evt.kind}-${index}`;
              const isOpen = openEvents[key];
              return (
                <li key={key} className="rounded-md hover:bg-gray-50">
                  <button
                    type="button"
                    onClick={() => payloadText && setOpenEvents((s) => ({ ...s, [key]: !s[key] }))}
                    className="flex w-full items-center gap-2 px-2 py-2 text-left"
                  >
                    {payloadText ? (
                      isOpen ? (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                      )
                    ) : (
                      <span className="w-3.5" />
                    )}
                    <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${meta.color}`}>
                      {meta.label}
                    </span>
                    {evt.actorId && <span className="text-[11px] text-gray-400">{evt.actorId}</span>}
                    <span className="ml-auto text-[11px] text-gray-400" title={formatDate(evt.createdAt)}>
                      {relativeTime(evt.createdAt)}
                    </span>
                  </button>
                  {isOpen && payloadText && (
                    <pre className="mx-2 mb-2 max-h-72 overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-3 text-xs text-gray-700">
                      {payloadText}
                    </pre>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

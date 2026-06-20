'use client';

import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { ExternalLink } from 'lucide-react';

function formatDate(value: unknown): string {
  if (!value) return '—';
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
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

export function DevopsIncidentDetailPanel({ incidentId }: { incidentId: string }) {
  const utils = trpc.useUtils();

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

  const ackMutation = trpc.platformAdmin.ackDevopsIncident.useMutation({
    onSuccess: () => void detailQuery.refetch(),
  });
  const fpMutation = trpc.platformAdmin.falsePositiveDevopsIncident.useMutation({
    onSuccess: () => {
      void detailQuery.refetch();
      void utils.platformAdmin.listDevopsIncidents.invalidate();
      void utils.platformAdmin.getDevopsMetrics.invalidate();
    },
  });
  const spawnMutation = trpc.platformAdmin.spawnDevopsAgent.useMutation({
    onSuccess: () => void detailQuery.refetch(),
  });
  const verifyMutation = trpc.platformAdmin.verifyDevopsIncident.useMutation({
    onSuccess: () => void detailQuery.refetch(),
  });
  const closeMutation = trpc.platformAdmin.closeDevopsIncident.useMutation({
    onSuccess: () => {
      void detailQuery.refetch();
      void utils.platformAdmin.listDevopsIncidents.invalidate();
      void utils.platformAdmin.getDevopsMetrics.invalidate();
    },
  });

  const detail = detailQuery.data;
  const events = detail?.events ?? [];
  const agentRuns = detail?.agentRuns ?? [];
  const status = detail?.incident?.status;
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

  const axiomUrl =
    detail?.incident?.axiomUrl ?? configQuery.data?.axiomStreamUrl ?? null;

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

  if (!detail?.incident) {
    return <p className="text-sm text-red-600">Incident not found.</p>;
  }

  return (
    <>
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="text-xs font-semibold uppercase text-gray-500">
            {detail.incident.severity}
          </span>
          <span className="text-xs text-gray-400">·</span>
          <span className="text-xs font-medium text-indigo-700">{detail.incident.status}</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{detail.incident.title}</h1>
        {detail.incident.summary && (
          <p className="mt-2 text-sm text-gray-600 whitespace-pre-wrap">
            {detail.incident.summary}
          </p>
        )}
        <p className="mt-2 text-xs font-mono text-gray-400">{detail.incident.id}</p>
        {detail.incident.cursorAgentId && (
          <p className="mt-1 text-xs text-gray-500">
            Cursor agent:{' '}
            <span className="font-mono">{detail.incident.cursorAgentId}</span>
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        {!closed && configQuery.data?.enabled && (
          <>
            <button
              type="button"
              disabled={ackMutation.isPending}
              onClick={() => ackMutation.mutate({ id: incidentId })}
              className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {ackMutation.isPending ? 'Acknowledging…' : 'Acknowledge'}
            </button>
            {canSpawn && (
              <button
                type="button"
                disabled={spawnMutation.isPending}
                onClick={() => {
                  if (!window.confirm('Spawn a Cursor cloud agent to investigate and open a PR?')) {
                    return;
                  }
                  spawnMutation.mutate({ id: incidentId });
                }}
                className="inline-flex items-center rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {spawnMutation.isPending ? 'Spawning…' : 'Spawn agent'}
              </button>
            )}
            {canVerify && (
              <button
                type="button"
                disabled={verifyMutation.isPending}
                onClick={() => verifyMutation.mutate({ id: incidentId, suite: 'smoke' })}
                className="inline-flex items-center rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
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
                className="inline-flex items-center rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
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
              className="inline-flex items-center rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {fpMutation.isPending ? 'Updating…' : 'False positive'}
            </button>
          </>
        )}
        {axiomUrl && (
          <a
            href={axiomUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            Logs for this incident <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        {detail.incident.githubIssueUrl && (
          <a
            href={detail.incident.githubIssueUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            GitHub issue <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        {detail.incident.prUrl && (
          <a
            href={detail.incident.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            Pull request <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {actionError && (
        <p className="mb-4 text-sm text-red-600">
          {'message' in actionError ? String(actionError.message) : 'Action failed'}
        </p>
      )}

      {agentRuns.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Agent runs</h2>
          </div>
          <ul className="divide-y divide-gray-100">
            {agentRuns.map((run) => (
              <li key={run.id} className="px-6 py-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-medium text-gray-900">{run.status}</span>
                  <span className="text-xs text-gray-500 shrink-0">
                    {formatDate(run.createdAt)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-600">
                  {run.repo ?? '—'} · {run.branch ?? '—'}
                </p>
                {run.resultSummary && (
                  <p className="mt-1 text-xs text-gray-500">{run.resultSummary}</p>
                )}
                {run.prUrl && (
                  <a
                    href={run.prUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800"
                  >
                    PR <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Timeline</h2>
        </div>
        {events.length === 0 ? (
          <p className="px-6 py-4 text-sm text-gray-500">No timeline events yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {events.map((evt, index) => {
              const payloadText = formatEventPayload(evt.payload);
              return (
                <li key={evt.id ?? `${evt.kind}-${index}`} className="px-6 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm font-medium text-gray-900">{evt.kind}</span>
                    <span className="text-xs text-gray-500 shrink-0">
                      {formatDate(evt.createdAt)}
                    </span>
                  </div>
                  {payloadText && (
                    <pre className="mt-2 text-xs bg-gray-50 rounded p-3 overflow-x-auto text-gray-700">
                      {payloadText}
                    </pre>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="mt-6 text-xs text-gray-400">
        Shareable link:{' '}
        <Link
          href={`/devops?incident=${encodeURIComponent(incidentId)}`}
          className="font-mono text-indigo-600 hover:text-indigo-800"
        >
          /devops?incident={incidentId}
        </Link>
      </p>
    </>
  );
}

'use client';
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { ArrowLeft, ExternalLink } from 'lucide-react';

export default function DevopsIncidentPage() {
  useAdminAuth();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const utils = trpc.useUtils();

  const configQuery = trpc.platformAdmin.getDevopsConfig.useQuery();
  const detailQuery = trpc.platformAdmin.getDevopsIncident.useQuery(
    { id },
    { enabled: Boolean(id), refetchInterval: (q) => {
      const status = q.state.data?.incident.status;
      return status === 'agent_running' ? 5000 : false;
    } },
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
  const status = detail?.incident.status;
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

  return (
    <AuthenticatedLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/devops"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> Back to DevOps
        </Link>

        {detailQuery.isLoading ? (
          <p className="text-sm text-gray-500">Loading incident…</p>
        ) : !detail ? (
          <p className="text-sm text-red-600">Incident not found.</p>
        ) : (
          <>
            <div className="mb-6">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-xs font-semibold uppercase text-gray-500">{detail.incident.severity}</span>
                <span className="text-xs text-gray-400">·</span>
                <span className="text-xs font-medium text-indigo-700">{detail.incident.status}</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">{detail.incident.title}</h1>
              {detail.incident.summary && (
                <p className="mt-2 text-sm text-gray-600 whitespace-pre-wrap">{detail.incident.summary}</p>
              )}
              <p className="mt-2 text-xs font-mono text-gray-400">{detail.incident.id}</p>
              {detail.incident.cursorAgentId && (
                <p className="mt-1 text-xs text-gray-500">
                  Cursor agent: <span className="font-mono">{detail.incident.cursorAgentId}</span>
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2 mb-8">
              {!closed && configQuery.data?.enabled && (
                <>
                  <button
                    type="button"
                    disabled={ackMutation.isPending}
                    onClick={() => ackMutation.mutate({ id })}
                    className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {ackMutation.isPending ? 'Acknowledging…' : 'Acknowledge'}
                  </button>
                  {canSpawn && (
                    <button
                      type="button"
                      disabled={spawnMutation.isPending}
                      onClick={() => {
                        if (!window.confirm('Spawn a Cursor cloud agent to investigate and open a PR?')) return;
                        spawnMutation.mutate({ id });
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
                      onClick={() => verifyMutation.mutate({ id, suite: 'smoke' })}
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
                        closeMutation.mutate({ id });
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
                      fpMutation.mutate({ id, note: note || undefined });
                    }}
                    className="inline-flex items-center rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {fpMutation.isPending ? 'Updating…' : 'False positive'}
                  </button>
                </>
              )}
              {configQuery.data?.axiomStreamUrl && (
                <a
                  href={configQuery.data.axiomStreamUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Search logs in Axiom <ExternalLink className="h-3.5 w-3.5" />
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
              <p className="mb-4 text-sm text-red-600">{actionError.message}</p>
            )}

            {(detail.agentRuns?.length ?? 0) > 0 && (
              <div className="rounded-lg border border-gray-200 bg-white shadow-sm mb-8">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Agent runs</h2>
                </div>
                <ul className="divide-y divide-gray-100">
                  {detail.agentRuns?.map((run) => (
                    <li key={run.id} className="px-6 py-4">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-sm font-medium text-gray-900">{run.status}</span>
                        <span className="text-xs text-gray-500 shrink-0">
                          {new Date(run.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-gray-600">
                        {run.repo} · {run.branch}
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
              <ul className="divide-y divide-gray-100">
                {detail.events.map((evt) => (
                  <li key={evt.id} className="px-6 py-4">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm font-medium text-gray-900">{evt.kind}</span>
                      <span className="text-xs text-gray-500 shrink-0">
                        {new Date(evt.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {evt.payload && Object.keys(evt.payload as object).length > 0 && (
                      <pre className="mt-2 text-xs bg-gray-50 rounded p-3 overflow-x-auto text-gray-700">
                        {JSON.stringify(evt.payload, null, 2)}
                      </pre>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </AuthenticatedLayout>
  );
}

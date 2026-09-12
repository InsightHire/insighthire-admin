'use client';

/**
 * Demo tenant controls — shown on the org page only for orgs flagged
 * settings.demoTenant === true. Wraps the platformAdmin demo snapshot
 * endpoints: nightly reset runs at 08:00 UTC (see DEMO_TENANT_RESET job).
 */
import { useState } from 'react';
import { trpc } from '@/lib/trpc';

const KEY_COUNTS: Array<{ key: string; label: string }> = [
  { key: 'positions', label: 'positions' },
  { key: 'candidate_profiles', label: 'candidates' },
  { key: 'candidate_applications', label: 'applications' },
  { key: 'journey_sessions', label: 'sessions' },
  { key: 'journey_responses', label: 'responses' },
];

export function DemoTenantPanel({ organizationId }: { organizationId: string }) {
  const utils = (trpc as any).useUtils();
  const [label, setLabel] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const snapshots = (trpc as any).platformAdmin.listDemoTenantSnapshots.useQuery(
    { organizationId },
    { refetchOnWindowFocus: false },
  );

  const capture = (trpc as any).platformAdmin.captureDemoTenantSnapshot.useMutation({
    onSuccess: (res: { snapshotId: string }) => {
      setMessage({ kind: 'ok', text: `Snapshot ${res.snapshotId} captured — this is now the nightly restore point.` });
      setLabel('');
      (utils as any).platformAdmin.listDemoTenantSnapshots.invalidate({ organizationId });
    },
    onError: (err: { message: string }) => setMessage({ kind: 'err', text: err.message }),
  });

  const reset = (trpc as any).platformAdmin.resetDemoTenantNow.useMutation({
    onSuccess: (res: { snapshotId: string; restored: Record<string, number> }) => {
      const total = Object.values(res.restored).reduce((a, b) => a + b, 0);
      setMessage({ kind: 'ok', text: `Reset complete — ${total} rows restored from ${res.snapshotId}.` });
      setConfirmReset(false);
    },
    onError: (err: { message: string }) => {
      setMessage({ kind: 'err', text: err.message });
      setConfirmReset(false);
    },
  });

  const busy = capture.isPending || reset.isPending;
  const rows: Array<{
    id: string;
    label: string | null;
    createdAt: string;
    counts: Record<string, number>;
    totalRows: number;
  }> = snapshots.data ?? [];

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-start justify-between gap-4 mb-1">
        <h2 className="text-lg font-semibold text-gray-900">Demo tenant</h2>
        <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-800">Nightly reset · 08:00 UTC</span>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Every night this tenant is wiped and restored to the latest snapshot below. Users, feature grants, and
        branding are never touched — only candidate and pipeline data.
      </p>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        {confirmReset ? (
          <>
            <span className="text-sm font-medium text-red-700">
              Discard today&apos;s changes and restore the latest snapshot?
            </span>
            <button
              onClick={() => reset.mutate({ organizationId })}
              disabled={busy}
              className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            >
              {reset.isPending ? 'Resetting…' : 'Yes, reset now'}
            </button>
            <button
              onClick={() => setConfirmReset(false)}
              disabled={busy}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={() => setConfirmReset(true)}
            disabled={busy || rows.length === 0}
            className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            title={rows.length === 0 ? 'Capture a snapshot first' : undefined}
          >
            Reset demo now
          </button>
        )}

        <div className="flex items-center gap-2 ml-auto">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Snapshot label (optional)"
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            onClick={() => capture.mutate({ organizationId, label: label || undefined })}
            disabled={busy}
            className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
          >
            {capture.isPending ? 'Capturing…' : 'Save current state as snapshot'}
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`mb-4 rounded-lg border px-3 py-2 text-sm ${
            message.kind === 'ok'
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      {snapshots.isLoading ? (
        <p className="text-sm text-gray-400">Loading snapshots…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          No snapshot exists yet — the nightly reset will fail until one is captured.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="py-2 pr-4 font-medium">Captured</th>
              <th className="py-2 pr-4 font-medium">Label</th>
              <th className="py-2 pr-4 font-medium">Contents</th>
              <th className="py-2 text-right font-medium">Rows</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s, i) => (
              <tr key={s.id} className="border-b border-gray-100">
                <td className="py-2 pr-4 whitespace-nowrap text-gray-900">
                  {new Date(s.createdAt).toLocaleString()}
                  {i === 0 && (
                    <span className="ml-2 px-1.5 py-0.5 text-xs rounded bg-green-100 text-green-800">
                      restore point
                    </span>
                  )}
                </td>
                <td className="py-2 pr-4 text-gray-600">{s.label || '—'}</td>
                <td className="py-2 pr-4 text-gray-500">
                  {KEY_COUNTS.filter((k) => s.counts[k.key])
                    .map((k) => `${s.counts[k.key]} ${k.label}`)
                    .join(' · ')}
                </td>
                <td className="py-2 text-right tabular-nums text-gray-900">{s.totalRows}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

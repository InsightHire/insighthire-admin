'use client';

/**
 * Customer agreement (MSA) status for one org, who accepted which version and
 * when, and the "signed offline" mark for
 * paper or DocuSign contracts (covers later MSA versions until removed).
 */
import { useState } from 'react';
import { trpc } from '@/lib/trpc';

const fmt = (d: string | Date | null | undefined) => (d ? new Date(d).toLocaleString() : '—');
const fmtDay = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleDateString(undefined, { timeZone: 'UTC' }) : '—';

export function OrgLegalAcceptanceSection({ organizationId }: { organizationId: string }) {
  const overview = (trpc as any).legalAcceptance.orgOverview.useQuery({ organizationId }, { refetchOnWindowFocus: false });
  const mark = (trpc as any).legalAcceptance.markMsaSignedOffline.useMutation({ onSuccess: () => overview.refetch() });
  const remove = (trpc as any).legalAcceptance.removeMsaOfflineMark.useMutation({ onSuccess: () => overview.refetch() });
  const [showForm, setShowForm] = useState(false);
  const [signedAt, setSignedAt] = useState('');
  const [note, setNote] = useState('');

  const data = overview.data;
  const activeOffline = data?.msa.history.find((r: any) => r.method === 'OFFLINE' && !r.revokedAt);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold text-gray-900">Customer agreement</h2>
        {data && (
          <span
            className={`px-2 py-0.5 text-xs font-medium rounded-full ${
              data.msa.satisfied ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
            }`}
          >
            {data.msa.satisfied ? 'MSA accepted' : 'MSA not accepted'}
          </span>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-4">
        An org admin accepts the MSA once for the org after signing in. Live MSA: {data?.msa.live?.versionLabel ?? 'none published'}.
      </p>

      {overview.isLoading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : overview.error ? (
        <p className="text-sm text-red-600">{overview.error.message}</p>
      ) : (
        <div className="space-y-5">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">MSA history</p>
              {!showForm && (
                <button
                  type="button"
                  className="text-sm font-medium text-purple-700 hover:text-purple-900"
                  onClick={() => setShowForm(true)}
                >
                  {activeOffline ? 'Replace offline signature' : 'Mark signed offline'}
                </button>
              )}
            </div>

            {showForm && (
              <form
                className="mb-3 space-y-2 rounded-lg border border-gray-200 p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  mark.mutate(
                    { organizationId, signedAt, note },
                    {
                      onSuccess: () => {
                        setShowForm(false);
                        setSignedAt('');
                        setNote('');
                      },
                    },
                  );
                }}
              >
                <p className="text-xs text-gray-500">
                  For a paper or DocuSign contract. It satisfies the MSA for this org, including later versions, until
                  you remove it.
                </p>
                <label className="block text-sm text-gray-700">
                  Date signed
                  <input
                    type="date"
                    required
                    value={signedAt}
                    onChange={(e) => setSignedAt(e.target.value)}
                    className="mt-1 block rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                </label>
                <label className="block text-sm text-gray-700">
                  Note
                  <textarea
                    required
                    maxLength={1000}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. DocuSign envelope 1234, signed by the CFO"
                    className="mt-1 block w-full rounded border border-gray-300 px-2 py-1 text-sm"
                    rows={2}
                  />
                </label>
                {mark.error && <p className="text-sm text-red-600">{mark.error.message}</p>}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={mark.isPending}
                    className="rounded bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                  >
                    {mark.isPending ? 'Saving…' : 'Save'}
                  </button>
                  <button type="button" className="px-3 py-1.5 text-sm text-gray-600" onClick={() => setShowForm(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {data.msa.history.length === 0 ? (
              <p className="text-sm text-gray-400">No one has accepted the MSA for this org yet.</p>
            ) : (
              <div className="divide-y divide-gray-50 border border-gray-100 rounded-lg overflow-hidden">
                {data.msa.history.map((r: any) => (
                  <div key={r.id} className={`px-3 py-2 text-sm ${r.revokedAt ? 'opacity-60' : ''}`}>
                    {r.method === 'OFFLINE' ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-gray-900">Signed offline {fmtDay(r.offlineSignedAt)}</span>
                        <span className="text-xs text-gray-500">recorded by {r.recordedByEmail ?? '—'} on {fmt(r.acceptedAt)}</span>
                        {r.revokedAt ? (
                          <span className="text-xs text-gray-500">removed {fmt(r.revokedAt)} by {r.revokedByEmail ?? '—'}</span>
                        ) : (
                          <button
                            type="button"
                            className="ml-auto text-xs text-red-600 hover:text-red-800"
                            disabled={remove.isPending}
                            onClick={() => {
                              if (confirm('Remove the offline signature? Admins will be asked to accept the MSA.')) {
                                remove.mutate({ acceptanceId: r.id });
                              }
                            }}
                          >
                            Remove
                          </button>
                        )}
                        {r.offlineNote && <p className="w-full text-xs text-gray-600">{r.offlineNote}</p>}
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-gray-900">{r.versionLabel}</span>
                        <span className="text-gray-700">accepted by {r.acceptedByEmail ?? '—'}</span>
                        <span className="text-xs text-gray-500">{fmt(r.acceptedAt)}</span>
                        <span className="text-xs text-gray-400">
                          {r.app === 'crm' ? 'InsightCRM' : 'InsightHire'} · IP {r.ipAddress ?? '—'}
                        </span>
                        {r.userAgent && <p className="w-full truncate text-xs text-gray-400" title={r.userAgent}>{r.userAgent}</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

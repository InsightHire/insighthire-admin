'use client';

/**
 * Scoring drift alerts — AI-vs-human score divergence per org over the last
 * 90 days. Orgs whose bias crosses the threshold surface as alerts with
 * their most divergent sessions linked to the scoring runs review.
 */
import { Fragment, useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';

export function ScoringDriftSection() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const drift = (trpc as any).platformAdmin.getScoringDrift.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  if (drift.isLoading) {
    return <div className="bg-white rounded-lg shadow p-4 text-sm text-gray-400">Checking scoring drift…</div>;
  }
  if (drift.error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        Could not load drift data: {drift.error.message}
      </div>
    );
  }

  const rows: any[] = drift.data ?? [];
  const drifting = rows.filter((r) => r.drifting);

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Scoring drift (AI vs human, 90d)</h2>
          <p className="text-xs text-gray-500">
            Bias = average AI-minus-human gap on a 0–100 scale. Alert at ±15 with 5+ reviewed candidates.
          </p>
        </div>
        {drifting.length > 0 ? (
          <span className="px-2.5 py-1 text-xs rounded-full bg-red-100 text-red-800 font-medium">
            {drifting.length} org{drifting.length === 1 ? '' : 's'} drifting
          </span>
        ) : (
          <span className="px-2.5 py-1 text-xs rounded-full bg-green-100 text-green-800">no drift</span>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-gray-400">
          No orgs have enough human-reviewed candidates in the last 90 days to measure drift.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-gray-500">
              <th className="px-4 py-2 font-medium">Organization</th>
              <th className="px-4 py-2 font-medium text-right">Sample</th>
              <th className="px-4 py-2 font-medium text-right">Bias</th>
              <th className="px-4 py-2 font-medium text-right">MAE</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Fragment key={r.organizationId}>
                <tr
                  onClick={() => setExpanded(expanded === r.organizationId ? null : r.organizationId)}
                  className="border-b border-gray-50 cursor-pointer hover:bg-gray-50"
                >
                  <td className="px-4 py-2 font-medium text-gray-900">{r.organizationName}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-600">{r.sampleSize}</td>
                  <td className={`px-4 py-2 text-right tabular-nums font-medium ${
                    Math.abs(r.bias) >= 15 ? 'text-red-600' : Math.abs(r.bias) >= 8 ? 'text-amber-600' : 'text-gray-700'
                  }`}>
                    {r.bias > 0 ? '+' : ''}{r.bias}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-600">{r.meanAbsoluteError}</td>
                  <td className="px-4 py-2">
                    {r.drifting ? (
                      <span className="px-1.5 py-0.5 text-xs rounded bg-red-100 text-red-800">
                        {r.direction === 'AI_GENEROUS' ? 'AI scoring high' : 'AI scoring low'}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">in range</span>
                    )}
                  </td>
                </tr>
                {expanded === r.organizationId && (
                  <tr className="border-b border-gray-50 bg-gray-50/50">
                    <td colSpan={5} className="px-4 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                          Most divergent candidates
                        </p>
                        <Link
                          href={`/scoring/runs?org=${r.organizationId}`}
                          className="text-xs font-medium text-blue-600 hover:text-blue-700"
                        >
                          Open scoring runs →
                        </Link>
                      </div>
                      <div className="space-y-1">
                        {r.worstOffenders.map((o: any) => (
                          <div key={o.appId} className="flex flex-wrap items-center gap-3 text-xs">
                            {o.candidateId ? (
                              <Link href={`/candidate/${o.candidateId}`} className="font-medium text-blue-600 hover:text-blue-700">
                                {o.candidateName}
                              </Link>
                            ) : (
                              <span className="font-medium text-gray-800">{o.candidateName}</span>
                            )}
                            <span className="text-gray-500">{o.positionTitle || '—'}</span>
                            <span className="tabular-nums text-gray-700">
                              AI {Math.round(o.ai)} vs human {Math.round(o.human)}
                            </span>
                            <span className={`tabular-nums font-medium ${o.delta > 0 ? 'text-red-600' : 'text-blue-600'}`}>
                              {o.delta > 0 ? '+' : ''}{Math.round(o.delta)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

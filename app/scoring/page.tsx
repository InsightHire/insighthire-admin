'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { PipelineSubnav } from '@/components/admin/pipeline-subnav';
import {
  ArrowPathIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  BoltIcon,
} from '@heroicons/react/24/outline';

export default function ScoringObservabilityPage() {
  useAdminAuth();
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [calibratingOrg, setCalibratingOrg] = useState<string | null>(null);

  const { data: orgs } = trpc.platformAdmin.listOrganizations.useQuery({ page: 1, limit: 100 });
  const { data: overview, refetch: refetchOverview, error: overviewErr } = trpc.platformAdmin.getScoringOverview.useQuery(
    { organizationId: selectedOrgId || undefined, days: 30 },
    { refetchInterval: 30000, retry: 1 }
  );
  const { data: rescores, error: rescoresErr } = trpc.platformAdmin.getRescoringHistory.useQuery(
    { organizationId: selectedOrgId || undefined, limit: 30 },
    { retry: 1 }
  );
  const { data: events, error: eventsErr } = trpc.platformAdmin.getScoringEvents.useQuery(
    { organizationId: selectedOrgId || undefined, limit: 50 },
    { retry: 1 }
  );
  const { data: calibrations, refetch: refetchCalibrations, error: calibErr } = trpc.platformAdmin.getCalibrationHistory.useQuery(
    { organizationId: selectedOrgId || undefined },
    { retry: 1 }
  );

  const queryErrors = [overviewErr, rescoresErr, eventsErr, calibErr].filter(Boolean);

  const generateSnapshotMutation = trpc.platformAdmin.generateCalibrationSnapshot.useMutation({
    onSuccess: () => { refetchCalibrations(); refetchOverview(); },
  });

  const orgList = orgs?.organizations || orgs || [];

  return (
    <AuthenticatedLayout>
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PipelineSubnav />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ChartBarIcon className="h-7 w-7 text-purple-600" />
            AI Scoring Observability
          </h1>
          <p className="text-sm text-gray-500 mt-1">Track scoring events, rescores, drift detection, and tenant calibration</p>
        </div>
        <select
          value={selectedOrgId}
          onChange={(e) => setSelectedOrgId(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900"
        >
          <option value="">All Organizations</option>
          {(Array.isArray(orgList) ? orgList : []).filter((org: any) => org?.id && org?.name).map((org: any) => (
            <option key={org.id} value={org.id}>{org.name}</option>
          ))}
        </select>
      </div>

      {queryErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="font-semibold text-red-800 mb-1">Data loading errors</h3>
          {queryErrors.map((err: any, i) => (
            <p key={i} className="text-sm text-red-700">{err?.message || 'Unknown query error'}</p>
          ))}
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Total Scoring Events</span>
            <BoltIcon className="h-5 w-5 text-blue-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900 mt-2">{overview?.totalEvents ?? 0}</p>
          <p className="text-xs text-gray-400 mt-1">Last 30 days</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Initial Scores</span>
            <CheckCircleIcon className="h-5 w-5 text-green-500" />
          </div>
          <p className="text-3xl font-bold text-green-600 mt-2">{overview?.initialScores ?? 0}</p>
          <p className="text-xs text-gray-400 mt-1">New evaluations</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Rescores</span>
            <ArrowPathIcon className="h-5 w-5 text-purple-500" />
          </div>
          <p className="text-3xl font-bold text-purple-600 mt-2">{overview?.rescoreEvents ?? 0}</p>
          <p className="text-xs text-gray-400 mt-1">Re-evaluations triggered</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Calibration Snapshots</span>
            <ChartBarIcon className="h-5 w-5 text-amber-500" />
          </div>
          <p className="text-3xl font-bold text-amber-600 mt-2">{overview?.calibrations?.length ?? 0}</p>
          <p className="text-xs text-gray-400 mt-1">AI vs Human comparisons</p>
        </div>
      </div>

      {/* Drift Alerts */}
      {overview?.calibrations?.some((c: any) => c.driftDetected) && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
            <h3 className="font-semibold text-red-800">Drift Detected</h3>
          </div>
          {overview.calibrations.filter((c: any) => c.driftDetected).map((c: any) => (
            <div key={c.id} className="text-sm text-red-700 mt-1">
              Org {c.organizationId.slice(0, 8)}... — {c.driftDirection === 'AI_TOO_HIGH' ? 'AI scoring too high' : c.driftDirection === 'AI_TOO_LOW' ? 'AI scoring too low' : c.driftDirection}
              {' '}(MAE: {Number(c.meanAbsoluteError).toFixed(1)}, Delta: {Number(c.meanDelta) > 0 ? '+' : ''}{Number(c.meanDelta).toFixed(1)})
            </div>
          ))}
        </div>
      )}

      {/* Calibration Snapshots */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Tenant Calibration</h2>
          {selectedOrgId && (
            <button
              disabled={!!calibratingOrg}
              onClick={async () => {
                setCalibratingOrg(selectedOrgId);
                try {
                  await generateSnapshotMutation.mutateAsync({ organizationId: selectedOrgId });
                } catch (err: any) {
                  alert(err.message || 'Failed to generate snapshot');
                }
                setCalibratingOrg(null);
              }}
              className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {calibratingOrg ? 'Generating...' : 'Generate Snapshot'}
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Org</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Sample</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Avg AI</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Avg Human</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Correlation</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">MAE</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Drift</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recommendations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(calibrations || []).map((c: any) => (
                <tr key={c.id} className={c.driftDetected ? 'bg-red-50' : ''}>
                  <td className="px-4 py-3 text-gray-600">{new Date(c.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.organizationId.slice(0, 12)}...</td>
                  <td className="px-4 py-3 text-center">{c.sampleSize}</td>
                  <td className="px-4 py-3 text-center font-medium">{Number(c.avgAiScore).toFixed(0)}</td>
                  <td className="px-4 py-3 text-center font-medium">{Number(c.avgHumanScore).toFixed(0)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`font-bold ${Number(c.pearsonCorrelation) >= 0.7 ? 'text-green-600' : Number(c.pearsonCorrelation) >= 0.4 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {Number(c.pearsonCorrelation).toFixed(3)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">{Number(c.meanAbsoluteError).toFixed(1)}</td>
                  <td className="px-4 py-3 text-center">
                    {c.driftDetected ? (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
                        {c.driftDirection === 'AI_TOO_HIGH' ? '↑ High' : c.driftDirection === 'AI_TOO_LOW' ? '↓ Low' : c.driftDirection}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold">Aligned</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 max-w-xs">
                    {Array.isArray(c.recommendations) ? c.recommendations.join(' ') : '-'}
                  </td>
                </tr>
              ))}
              {(!calibrations || calibrations.length === 0) && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No calibration snapshots yet. Select an org and click "Generate Snapshot".</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rescore History */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Rescore History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Responses</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Avg Before</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Avg After</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Delta</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(rescores || []).map((r: any) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 text-gray-600">{new Date(r.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      r.rescoreType === 'BULK_POSITION' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                    }`}>
                      {r.rescoreType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">{r.responsesQueued}</td>
                  <td className="px-4 py-3 text-center">{r.avgScoreBefore ? Number(r.avgScoreBefore).toFixed(0) : '-'}</td>
                  <td className="px-4 py-3 text-center">{r.avgScoreAfter ? Number(r.avgScoreAfter).toFixed(0) : '-'}</td>
                  <td className="px-4 py-3 text-center font-medium">
                    {r.scoreDelta ? (
                      <span className={Number(r.scoreDelta) > 0 ? 'text-green-600' : 'text-red-600'}>
                        {Number(r.scoreDelta) > 0 ? '+' : ''}{Number(r.scoreDelta).toFixed(1)}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      r.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                      r.status === 'PROCESSING' ? 'bg-yellow-100 text-yellow-700' :
                      r.status === 'FAILED' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
              {(!rescores || rescores.length === 0) && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No rescores yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Scoring Events */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent Scoring Events</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Response</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Before</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">After</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Model</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Position</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(events || []).map((e: any) => (
                <tr key={e.id}>
                  <td className="px-4 py-3 text-gray-600 text-xs">{new Date(e.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      e.eventType === 'INITIAL_SCORE' ? 'bg-green-100 text-green-700' :
                      e.eventType === 'RESCORE' ? 'bg-purple-100 text-purple-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {e.eventType}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{e.responseId?.slice(0, 12)}...</td>
                  <td className="px-4 py-3 text-center">{e.scoreBefore ? Number(e.scoreBefore).toFixed(0) : '-'}</td>
                  <td className="px-4 py-3 text-center font-medium">{e.scoreAfter ? Number(e.scoreAfter).toFixed(0) : '-'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{e.modelVersion || '-'}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{e.positionTitle || '-'}</td>
                </tr>
              ))}
              {(!events || events.length === 0) && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No scoring events yet. They will appear as candidates are scored.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    </AuthenticatedLayout>
  );
}

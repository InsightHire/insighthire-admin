'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { PipelineSubnav } from '@/components/admin/pipeline-subnav';
import { ScoringDriftSection } from '@/components/platform-admin/scoring-drift';
import { OutcomeCalibrationEvidence } from '@/components/platform-admin/outcome-calibration-evidence';
import { AlertTriangle, BarChart3, CheckCircle2, RefreshCw, Scale, SlidersHorizontal, Zap } from 'lucide-react';
import { AdminPageChrome } from '@/components/admin/page-chrome';
import { SectionCard } from '@/components/admin/section-card';
import { StatGrid, StatTile } from '@/components/admin/stat-tile';
import { StatusPill } from '@/components/admin/status-pill';
import { EmptyState } from '@/components/admin/empty-state';
import { Segmented } from '@/components/admin/segmented';
import { DataTableEl, Th, Td } from '@/components/admin/data-table';
import { buttonClass, selectClass } from '@/components/admin/controls';

type Leniency = 'HARSH' | 'BALANCED' | 'GENEROUS';

export default function ScoringObservabilityPage() {
  useAdminAuth();
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [calibratingOrg, setCalibratingOrg] = useState<string | null>(null);
  const [leniencyDraft, setLeniencyDraft] = useState<Leniency>('BALANCED');
  const [offsetDraft, setOffsetDraft] = useState(0);
  const [calibrationDirty, setCalibrationDirty] = useState(false);

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
  const {
    data: scoringCalibration,
    refetch: refetchScoringCalibration,
    error: scoringCalibErr,
  } = trpc.platformAdmin.getScoringCalibration.useQuery(
    { organizationId: selectedOrgId },
    { enabled: !!selectedOrgId, retry: 1 },
  );

  useEffect(() => {
    if (!scoringCalibration || calibrationDirty) return;
    setLeniencyDraft(scoringCalibration.calibration.leniency);
    setOffsetDraft(scoringCalibration.calibration.scoreOffset);
  }, [scoringCalibration, calibrationDirty]);

  const queryErrors = [overviewErr, rescoresErr, eventsErr, calibErr, scoringCalibErr].filter(Boolean);

  const generateSnapshotMutation = trpc.platformAdmin.generateCalibrationSnapshot.useMutation({
    onSuccess: () => { refetchCalibrations(); refetchOverview(); },
  });
  const setCalibrationMutation = trpc.platformAdmin.setScoringCalibration.useMutation({
    onSuccess: async () => {
      setCalibrationDirty(false);
      await refetchScoringCalibration();
    },
  });

  const orgList = orgs?.organizations || orgs || [];

  return (
    <AuthenticatedLayout>
    <AdminPageChrome
      icon={<BarChart3 />}
      breadcrumbs={[{ label: 'Operations' }, { label: 'Pipeline', href: '/pipeline' }, { label: 'AI scoring' }]}
      title="AI scoring observability"
      description="Track scoring events, rescores, drift detection, and tenant calibration"
      actions={
        <select
          value={selectedOrgId}
          onChange={(e) => {
            setSelectedOrgId(e.target.value);
            setCalibrationDirty(false);
          }}
          className={selectClass}
        >
          <option value="">All Organizations</option>
          {(Array.isArray(orgList) ? orgList : []).filter((org: any) => org?.id && org?.name).map((org: any) => (
            <option key={org.id} value={org.id}>{org.name}</option>
          ))}
        </select>
      }
    >
    <div className="space-y-6">
      <PipelineSubnav />

      <ScoringDriftSection />

      {selectedOrgId && (
        <SectionCard
          icon={<SlidersHorizontal />}
          title="AI bias / leniency control"
          description={
            <>
              Adjust how harshly AI scores this tenant. Applies to new scores and rescored responses.
              {scoringCalibration?.organizationName
                ? ` Current tenant: ${scoringCalibration.organizationName}.`
                : ''}
            </>
          }
        >
          <div className="space-y-5">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-admin-ink">Prompt leniency</label>
              <Segmented<Leniency>
                ariaLabel="Prompt leniency"
                options={[
                  { value: 'HARSH', label: 'Harsh' },
                  { value: 'BALANCED', label: 'Balanced' },
                  { value: 'GENEROUS', label: 'Generous' },
                ]}
                value={leniencyDraft}
                onChange={(value) => {
                  setLeniencyDraft(value);
                  setCalibrationDirty(true);
                }}
              />
              <p className="mt-2 text-xs text-admin-muted">
                {leniencyDraft === 'HARSH' && 'Strict bar — prefers the low side of a score band when evidence is incomplete.'}
                {leniencyDraft === 'BALANCED' && 'Default calibrated recruiter bar (no extra prompt bias).'}
                {leniencyDraft === 'GENEROUS' && 'Lenient bar — prefers the high side when substance is clear (good for harsh-AI complaints).'}
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-admin-ink">
                Score offset: {offsetDraft > 0 ? '+' : ''}{offsetDraft} pts
              </label>
              <input
                type="range"
                min={-15}
                max={15}
                step={1}
                value={offsetDraft}
                onChange={(e) => {
                  setOffsetDraft(Number(e.target.value));
                  setCalibrationDirty(true);
                }}
                className="w-full accent-admin-accent"
              />
              <div className="mt-1 flex justify-between text-xs text-admin-muted">
                <span>−15 (harsher)</span>
                <span>0</span>
                <span>+15 (more lenient)</span>
              </div>
              <p className="mt-2 text-xs text-admin-muted">
                Applied after the model scores, before the score gate. Clamped to 0–100.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-admin-border pt-4">
            <button
              type="button"
              disabled={!calibrationDirty || setCalibrationMutation.isPending}
              onClick={async () => {
                try {
                  await setCalibrationMutation.mutateAsync({
                    organizationId: selectedOrgId,
                    leniency: leniencyDraft,
                    scoreOffset: offsetDraft,
                  });
                } catch (err: any) {
                  alert(err.message || 'Failed to save calibration');
                }
              }}
              className={buttonClass.primary}
            >
              {setCalibrationMutation.isPending ? 'Saving...' : 'Save bias settings'}
            </button>
            {calibrationDirty && (
              <button
                type="button"
                className={buttonClass.ghost}
                onClick={() => {
                  setLeniencyDraft(scoringCalibration?.calibration.leniency ?? 'BALANCED');
                  setOffsetDraft(scoringCalibration?.calibration.scoreOffset ?? 0);
                  setCalibrationDirty(false);
                }}
              >
                Reset
              </button>
            )}
            {setCalibrationMutation.isSuccess && !calibrationDirty && (
              <span className="text-sm text-admin-ok">Saved. Rescore candidates to apply to existing scores.</span>
            )}
          </div>
          </div>
        </SectionCard>
      )}

      {selectedOrgId && <OutcomeCalibrationEvidence organizationId={selectedOrgId} />}

      {queryErrors.length > 0 && (
        <div className="rounded-admin border border-admin-danger/20 bg-admin-danger-soft p-4">
          <h3 className="mb-1 font-semibold text-red-800">Data loading errors</h3>
          {queryErrors.map((err: any, i) => (
            <p key={i} className="text-sm text-red-700">{err?.message || 'Unknown query error'}</p>
          ))}
        </div>
      )}

      <StatGrid cols={4}>
        <StatTile label="Total scoring events" icon={Zap} tone="brand" value={overview?.totalEvents ?? 0} hint="Last 30 days" />
        <StatTile label="Initial scores" icon={CheckCircle2} tone="ok" value={overview?.initialScores ?? 0} hint="New evaluations" />
        <StatTile label="Rescores" icon={RefreshCw} tone="info" value={overview?.rescoreEvents ?? 0} hint="Re-evaluations triggered" />
        <StatTile label="Calibration snapshots" icon={BarChart3} tone="warn" value={overview?.calibrations?.length ?? 0} hint="AI vs Human comparisons" />
      </StatGrid>

      {overview?.calibrations?.some((c: any) => c.driftDetected) && (
        <div className="rounded-admin border border-admin-danger/20 bg-admin-danger-soft p-4">
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-admin-danger" />
            <h3 className="font-semibold text-red-800">Drift Detected</h3>
          </div>
          {overview.calibrations.filter((c: any) => c.driftDetected).map((c: any) => (
            <div key={c.id} className="mt-1 text-sm text-red-700">
              Org {c.organizationId.slice(0, 8)}... — {c.driftDirection === 'AI_TOO_HIGH' ? 'AI scoring too high' : c.driftDirection === 'AI_TOO_LOW' ? 'AI scoring too low' : c.driftDirection}
              {' '}(MAE: {Number(c.meanAbsoluteError).toFixed(1)}, Delta: {Number(c.meanDelta) > 0 ? '+' : ''}{Number(c.meanDelta).toFixed(1)})
            </div>
          ))}
        </div>
      )}

      <SectionCard
        icon={<Scale />}
        title="Tenant calibration"
        description="AI scores compared with human overrides, per snapshot"
        padded={false}
        actions={
          selectedOrgId ? (
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
              className={buttonClass.primary}
            >
              {calibratingOrg ? 'Generating...' : 'Generate Snapshot'}
            </button>
          ) : null
        }
      >
        {(!calibrations || calibrations.length === 0) ? (
          <EmptyState
            compact
            className="border-0 shadow-none"
            icon={<Scale />}
            title="No calibration snapshots yet"
            description='Select an org and click "Generate Snapshot".'
          />
        ) : (
        <div className="overflow-x-auto">
          <DataTableEl>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Org</Th>
                <Th className="text-center">Sample</Th>
                <Th className="text-center">Avg AI</Th>
                <Th className="text-center">Avg Human</Th>
                <Th className="text-center">Correlation</Th>
                <Th className="text-center">MAE</Th>
                <Th className="text-center">Drift</Th>
                <Th>Recommendations</Th>
              </tr>
            </thead>
            <tbody>
              {(calibrations || []).map((c: any) => (
                <tr key={c.id} className={c.driftDetected ? 'bg-admin-danger-soft/50' : ''}>
                  <Td>{new Date(c.createdAt).toLocaleDateString()}</Td>
                  <Td mono>{c.organizationId.slice(0, 12)}...</Td>
                  <Td className="text-center tabular-nums">{c.sampleSize}</Td>
                  <Td className="text-center font-medium tabular-nums text-admin-ink">{Number(c.avgAiScore).toFixed(0)}</Td>
                  <Td className="text-center font-medium tabular-nums text-admin-ink">{Number(c.avgHumanScore).toFixed(0)}</Td>
                  <Td className="text-center">
                    <span className={`font-bold tabular-nums ${Number(c.pearsonCorrelation) >= 0.7 ? 'text-green-600' : Number(c.pearsonCorrelation) >= 0.4 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {Number(c.pearsonCorrelation).toFixed(3)}
                    </span>
                  </Td>
                  <Td className="text-center tabular-nums">{Number(c.meanAbsoluteError).toFixed(1)}</Td>
                  <Td className="text-center">
                    {c.driftDetected ? (
                      <StatusPill tone="danger">
                        {c.driftDirection === 'AI_TOO_HIGH' ? '↑ High' : c.driftDirection === 'AI_TOO_LOW' ? '↓ Low' : c.driftDirection}
                      </StatusPill>
                    ) : (
                      <StatusPill tone="success">Aligned</StatusPill>
                    )}
                  </Td>
                  <Td className="max-w-xs text-xs">
                    {Array.isArray(c.recommendations) ? c.recommendations.join(' ') : '-'}
                  </Td>
                </tr>
              ))}
            </tbody>
          </DataTableEl>
        </div>
        )}
      </SectionCard>

      <SectionCard icon={<RefreshCw />} title="Rescore history" description="Most recent 30 rescore jobs" padded={false}>
        {(!rescores || rescores.length === 0) ? (
          <EmptyState compact className="border-0 shadow-none" icon={<RefreshCw />} title="No rescores yet." />
        ) : (
        <div className="overflow-x-auto">
          <DataTableEl>
            <thead>
              <tr>
                <Th>Time</Th>
                <Th>Type</Th>
                <Th className="text-center">Responses</Th>
                <Th className="text-center">Avg Before</Th>
                <Th className="text-center">Avg After</Th>
                <Th className="text-center">Delta</Th>
                <Th className="text-center">Status</Th>
              </tr>
            </thead>
            <tbody>
              {(rescores || []).map((r: any) => (
                <tr key={r.id}>
                  <Td className="whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</Td>
                  <Td>
                    <StatusPill tone={r.rescoreType === 'BULK_POSITION' ? 'info' : 'brand'} dot={false}>
                      {r.rescoreType}
                    </StatusPill>
                  </Td>
                  <Td className="text-center tabular-nums">{r.responsesQueued}</Td>
                  <Td className="text-center tabular-nums">{r.avgScoreBefore ? Number(r.avgScoreBefore).toFixed(0) : '-'}</Td>
                  <Td className="text-center tabular-nums">{r.avgScoreAfter ? Number(r.avgScoreAfter).toFixed(0) : '-'}</Td>
                  <Td className="text-center font-medium tabular-nums">
                    {r.scoreDelta ? (
                      <span className={Number(r.scoreDelta) > 0 ? 'text-green-600' : 'text-red-600'}>
                        {Number(r.scoreDelta) > 0 ? '+' : ''}{Number(r.scoreDelta).toFixed(1)}
                      </span>
                    ) : '-'}
                  </Td>
                  <Td className="text-center">
                    <StatusPill
                      tone={
                        r.status === 'COMPLETED' ? 'success' :
                        r.status === 'PROCESSING' ? 'warn' :
                        r.status === 'FAILED' ? 'danger' :
                        'neutral'
                      }
                    >
                      {r.status}
                    </StatusPill>
                  </Td>
                </tr>
              ))}
            </tbody>
          </DataTableEl>
        </div>
        )}
      </SectionCard>

      <SectionCard icon={<Zap />} title="Recent scoring events" description="Latest 50 initial scores and rescores" padded={false}>
        {(!events || events.length === 0) ? (
          <EmptyState
            compact
            className="border-0 shadow-none"
            icon={<Zap />}
            title="No scoring events yet"
            description="They will appear as candidates are scored."
          />
        ) : (
        <div className="overflow-x-auto">
          <DataTableEl>
            <thead>
              <tr>
                <Th>Time</Th>
                <Th>Type</Th>
                <Th>Response</Th>
                <Th className="text-center">Before</Th>
                <Th className="text-center">After</Th>
                <Th>Model</Th>
                <Th>Position</Th>
              </tr>
            </thead>
            <tbody>
              {(events || []).map((e: any) => (
                <tr key={e.id}>
                  <Td className="whitespace-nowrap text-xs">{new Date(e.createdAt).toLocaleString()}</Td>
                  <Td>
                    <StatusPill
                      dot={false}
                      tone={
                        e.eventType === 'INITIAL_SCORE' ? 'success' :
                        e.eventType === 'RESCORE' ? 'brand' :
                        'neutral'
                      }
                    >
                      {e.eventType}
                    </StatusPill>
                  </Td>
                  <Td mono>{e.responseId?.slice(0, 12)}...</Td>
                  <Td className="text-center tabular-nums">{e.scoreBefore ? Number(e.scoreBefore).toFixed(0) : '-'}</Td>
                  <Td className="text-center font-medium tabular-nums text-admin-ink">{e.scoreAfter ? Number(e.scoreAfter).toFixed(0) : '-'}</Td>
                  <Td className="text-xs text-admin-muted">{e.modelVersion || '-'}</Td>
                  <Td className="text-xs">{e.positionTitle || '-'}</Td>
                </tr>
              ))}
            </tbody>
          </DataTableEl>
        </div>
        )}
      </SectionCard>
    </div>
    </AdminPageChrome>
    </AuthenticatedLayout>
  );
}

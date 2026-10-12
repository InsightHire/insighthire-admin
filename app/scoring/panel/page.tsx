'use client';
export const dynamic = 'force-dynamic';

/**
 * TON-825 grader panel: kill switch, sampling, "use panel as the score"
 * (global + per org), and the panel vs single-grader comparison report.
 * Runbook: ih-docs/hire/multi-grader-panel.md.
 */
import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { PipelineSubnav } from '@/components/admin/pipeline-subnav';
import { Building2, Coins, Gavel, ListChecks, Power, Users } from 'lucide-react';
import { AdminPageChrome } from '@/components/admin/page-chrome';
import { SectionCard } from '@/components/admin/section-card';
import { StatGrid, StatTile } from '@/components/admin/stat-tile';
import { StatusPill } from '@/components/admin/status-pill';
import { EmptyState } from '@/components/admin/empty-state';
import { Segmented } from '@/components/admin/segmented';
import { DataTableEl, Th, Td } from '@/components/admin/data-table';
import { buttonClass, checkboxClass, inputClass, selectClass } from '@/components/admin/controls';

type Stats = { label?: string; n: number; meanAbsDiff: number; meanDiff: number; within05: number; flagRate: number };
type OrgMode = 'follow' | 'off' | 'score';

const pct = (v: number) => `${Math.round(v * 100)}%`;
const num = (v: number | null | undefined, dp = 2) => (v == null ? '—' : v.toFixed(dp));
const usd = (v: number | null | undefined) => (v == null ? 'not priced' : `$${v.toFixed(4)}`);
const ms = (v: number | null | undefined) => (v == null ? '—' : `${(v / 1000).toFixed(1)}s`);

function BreakdownTable({ title, rows }: { title: string; rows: Stats[] }) {
  return (
    <SectionCard title={title} padded={false}>
      {rows.length === 0 ? (
        <EmptyState compact className="border-0 shadow-none" icon={<Users />} title="No panel results yet." />
      ) : (
      <div className="overflow-x-auto">
      <DataTableEl>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th className="text-right">Answers</Th>
            <Th className="text-right">Mean diff</Th>
            <Th className="text-right">Bias (panel − single)</Th>
            <Th className="text-right">Within 0.5</Th>
            <Th className="text-right">Disagreement flags</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
              <tr key={r.label}>
                <Td className="text-admin-ink">{r.label}</Td>
                <Td className="text-right tabular-nums">{r.n}</Td>
                <Td className="text-right tabular-nums">{num(r.meanAbsDiff)}</Td>
                <Td className="text-right tabular-nums">{num(r.meanDiff)}</Td>
                <Td className="text-right tabular-nums">{pct(r.within05)}</Td>
                <Td className="text-right tabular-nums">{pct(r.flagRate)}</Td>
              </tr>
          ))}
        </tbody>
      </DataTableEl>
      </div>
      )}
    </SectionCard>
  );
}

export default function GraderPanelPage() {
  useAdminAuth();
  const [days, setDays] = useState(30);
  const [orgId, setOrgId] = useState('');
  const [orgMode, setOrgMode] = useState<OrgMode>('off');
  const [sampleDraft, setSampleDraft] = useState<string>('');

  const overview = (trpc as any).platformAdmin.multiGrader.overview.useQuery({ days }, { refetchOnWindowFocus: false });
  const { data: orgs } = (trpc as any).platformAdmin.listOrganizations.useQuery({ page: 1, limit: 100 });
  const setGlobal = (trpc as any).platformAdmin.multiGrader.setGlobal.useMutation({ onSuccess: () => overview.refetch() });
  const setOrg = (trpc as any).platformAdmin.multiGrader.setOrg.useMutation({ onSuccess: () => overview.refetch() });

  const d = overview.data;
  const orgList: Array<{ id: string; name: string }> = orgs?.organizations || orgs || [];

  const toggleAsScore = (next: boolean) => {
    if (next) {
      const warn = d?.report.readyToPromote
        ? 'Make the panel the score for every org? New answers will be scored by the panel.'
        : 'The promotion criteria are NOT met yet. Make the panel the score for every org anyway?';
      if (!window.confirm(warn)) return;
    }
    setGlobal.mutate({ asScoreOn: next });
  };

  const saveOrg = () => {
    if (!orgId) return;
    if (orgMode === 'score' && !window.confirm('Make the panel the score for this org?')) return;
    setOrg.mutate({
      organizationId: orgId,
      enabled: orgMode === 'off' ? false : null,
      useAsScore: orgMode === 'score' ? true : null,
    });
  };

  return (
    <AuthenticatedLayout>
      <AdminPageChrome
        icon={<Users />}
        breadcrumbs={[{ label: 'Operations' }, { label: 'Pipeline', href: '/pipeline' }, { label: 'Grader panel' }]}
        title="Grader panel"
        description={
          <>
            Three independent AI graders and a supervisor score each interview answer beside the normal grader.
            In shadow mode the panel never changes scores or gates. Promote it only when the criteria below are met.
            Candidates who asked for a human review are never AI-scored by either method.
          </>
        }
        meta={d ? <StatusPill tone={d.global.killSwitchOn ? 'success' : 'neutral'}>{d.global.killSwitchOn ? 'Running' : 'Off'}</StatusPill> : null}
        actions={
          <Segmented
            size="sm"
            ariaLabel="Time window"
            options={[
              { value: 7, label: 'Last 7 days' },
              { value: 30, label: 'Last 30 days' },
              { value: 90, label: 'Last 90 days' },
            ]}
            value={days}
            onChange={setDays}
          />
        }
      >
      <div className="space-y-6">
        <PipelineSubnav />

        {overview.isLoading ? (
          <p className="text-sm text-admin-muted">Loading…</p>
        ) : overview.error ? (
          <div className="rounded-admin border border-admin-danger/20 bg-admin-danger-soft px-4 py-3 text-sm text-red-900">{overview.error.message}</div>
        ) : d ? (
          <>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <SectionCard icon={<Power />} title="Panel running (kill switch)" description="Off stops the panel everywhere, including orgs where it is the score (they fall back to the single grader).">
                <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm text-admin-ink">
                  <input
                    type="checkbox"
                    checked={d.global.killSwitchOn}
                    disabled={setGlobal.isLoading}
                    onChange={(e) => setGlobal.mutate({ killSwitchOn: e.target.checked })}
                    className={checkboxClass}
                  />
                  {d.global.killSwitchOn ? 'On' : 'Off'}
                </label>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-admin-secondary">Shadow sample</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    placeholder={String(Math.round(d.global.sampleRate * 100))}
                    value={sampleDraft}
                    onChange={(e) => setSampleDraft(e.target.value)}
                    className={`${inputClass} w-20 py-1`}
                  />
                  <span className="text-admin-muted">% of answers</span>
                  <button
                    type="button"
                    disabled={sampleDraft === '' || setGlobal.isLoading}
                    onClick={() => {
                      setGlobal.mutate({ sampleRate: Math.min(100, Math.max(0, Number(sampleDraft))) / 100 });
                      setSampleDraft('');
                    }}
                    className={buttonClass.small}
                  >
                    Save
                  </button>
                </div>
                <p className="text-xs text-admin-muted">Currently {pct(d.global.sampleRate)}. Orgs where the panel is the score always run it.</p>
                </div>
              </SectionCard>

              <SectionCard
                icon={<Gavel />}
                title="Use panel as the score (all orgs)"
                description={
                  <>
                    Score = supervisor result. Grader disagreement over 1.5/5 flags the answer and a score gate never rejects on it.
                    If the panel fails, the single grader scores.
                  </>
                }
              >
                <label className="flex items-center gap-2 text-sm text-admin-ink">
                  <input type="checkbox" checked={d.global.asScoreOn} disabled={setGlobal.isLoading} onChange={(e) => toggleAsScore(e.target.checked)} className={checkboxClass} />
                  {d.global.asScoreOn ? 'On — panel scores every org' : 'Off — shadow only'}
                </label>
              </SectionCard>

              <SectionCard
                icon={<ListChecks />}
                title="Promotion criteria"
                actions={<StatusPill tone={d.report.readyToPromote ? 'success' : 'neutral'}>{d.report.readyToPromote ? 'Ready' : 'Not ready'}</StatusPill>}
                className={d.report.readyToPromote ? 'border-admin-ok/30 bg-admin-ok-soft/40' : undefined}
              >
                <div className="space-y-2">
                {d.report.checks.map((c: any) => (
                  <div key={c.key} className="flex items-start gap-2 text-sm">
                    <span className={c.ok ? 'text-green-600' : 'text-admin-muted'}>{c.ok ? '✓' : '○'}</span>
                    <span className="text-admin-secondary">
                      {c.label} <span className="text-admin-muted">(now {typeof c.actual === 'number' && c.actual < 1 && c.key !== 'meanAbsDiff' ? pct(c.actual) : c.actual})</span>
                    </span>
                  </div>
                ))}
                <p className="pt-1 text-xs text-admin-muted">{d.report.readyToPromote ? 'Ready to promote.' : 'Not ready yet.'}</p>
                </div>
              </SectionCard>
            </div>

            <StatGrid cols={6}>
              {[
                ['Answers compared', String(d.report.overall.n)],
                ['Mean diff (of 5)', num(d.report.overall.meanAbsDiff)],
                ['Within 0.5', pct(d.report.overall.within05)],
                ['Disagreement flags', pct(d.report.overall.flagRate)],
                ['Panel latency (median / p90)', `${ms(d.report.latencyMs.median)} / ${ms(d.report.latencyMs.p90)}`],
                ['Supervisor fallbacks', pct(d.report.supervisorFallbackRate)],
              ].map(([label, value]) => (
                <StatTile key={label} label={label} value={value} />
              ))}
            </StatGrid>

            <SectionCard
              icon={<Coins />}
              title="Cost per answer"
              description="From AI usage records. Dollar cost shows once the model has a price configured."
              padded={false}
            >
              <div className="overflow-x-auto">
              <DataTableEl>
                <thead>
                  <tr>
                    <Th>Method</Th>
                    <Th className="text-right">Answers</Th>
                    <Th className="text-right">Input tokens</Th>
                    <Th className="text-right">Output tokens</Th>
                    <Th className="text-right">Cost</Th>
                  </tr>
                </thead>
                <tbody>
                  {(['single', 'panel'] as const).map((k) => (
                    <tr key={k}>
                      <Td className="text-admin-ink">{k === 'single' ? 'Single grader' : 'Panel (3 graders + supervisor)'}</Td>
                      <Td className="text-right tabular-nums">{d.cost[k].answers}</Td>
                      <Td className="text-right tabular-nums">{d.cost[k].promptTokens ?? '—'}</Td>
                      <Td className="text-right tabular-nums">{d.cost[k].completionTokens ?? '—'}</Td>
                      <Td className="text-right tabular-nums">{usd(d.cost[k].costUsd)}</Td>
                    </tr>
                  ))}
                </tbody>
              </DataTableEl>
              </div>
            </SectionCard>

            <BreakdownTable title="By organization" rows={d.report.byOrg} />
            <BreakdownTable title="By job" rows={d.report.byPosition} />
            <BreakdownTable title="By question" rows={d.report.byQuestion} />

            <SectionCard icon={<Building2 />} title="Per-org overrides" description="Turn the panel off, or make it the score, for one org">
              <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <select value={orgId} onChange={(e) => setOrgId(e.target.value)} className={selectClass}>
                  <option value="">Choose an org…</option>
                  {orgList.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
                <select value={orgMode} onChange={(e) => setOrgMode(e.target.value as OrgMode)} className={selectClass}>
                  <option value="follow">Follow global switches</option>
                  <option value="off">Panel off for this org</option>
                  <option value="score">Panel is the score for this org</option>
                </select>
                <button type="button" disabled={!orgId || setOrg.isLoading} onClick={saveOrg} className={buttonClass.primary}>
                  Save
                </button>
              </div>
              {d.orgOverrides.length === 0 ? (
                <EmptyState
                  compact
                  className="border-dashed shadow-none"
                  icon={<Building2 />}
                  title="No overrides"
                  description="Every org follows the global switches."
                />
              ) : (
                <ul className="divide-y divide-admin-border rounded-admin-sm border border-admin-border text-sm">
                  {d.orgOverrides.map((o: any) => (
                    <li key={o.organizationId} className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-admin-ink">{o.organizationName}</span>
                      <span className="flex items-center gap-3">
                        <StatusPill tone={o.enabled === false ? 'neutral' : o.useAsScore ? 'brand' : 'info'}>
                          {o.enabled === false ? 'Panel off' : o.useAsScore ? 'Panel is the score' : 'Follows global'}
                        </StatusPill>
                        <button
                          type="button"
                          onClick={() => setOrg.mutate({ organizationId: o.organizationId, enabled: null, useAsScore: null })}
                          className="text-xs font-medium text-admin-accent hover:text-admin-accent-ink"
                        >
                          Clear
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              </div>
            </SectionCard>
          </>
        ) : null}
      </div>
      </AdminPageChrome>
    </AuthenticatedLayout>
  );
}

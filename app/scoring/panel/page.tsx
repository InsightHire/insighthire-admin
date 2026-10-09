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

type Stats = { label?: string; n: number; meanAbsDiff: number; meanDiff: number; within05: number; flagRate: number };
type OrgMode = 'follow' | 'off' | 'score';

const pct = (v: number) => `${Math.round(v * 100)}%`;
const num = (v: number | null | undefined, dp = 2) => (v == null ? '—' : v.toFixed(dp));
const usd = (v: number | null | undefined) => (v == null ? 'not priced' : `$${v.toFixed(4)}`);
const ms = (v: number | null | undefined) => (v == null ? '—' : `${(v / 1000).toFixed(1)}s`);

function BreakdownTable({ title, rows }: { title: string; rows: Stats[] }) {
  return (
    <div className="bg-white rounded-lg shadow overflow-x-auto">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
            <th className="px-4 py-2.5 font-medium">Name</th>
            <th className="px-4 py-2.5 font-medium text-right">Answers</th>
            <th className="px-4 py-2.5 font-medium text-right">Mean diff</th>
            <th className="px-4 py-2.5 font-medium text-right">Bias (panel − single)</th>
            <th className="px-4 py-2.5 font-medium text-right">Within 0.5</th>
            <th className="px-4 py-2.5 font-medium text-right">Disagreement flags</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">No panel results yet.</td></tr>
          ) : (
            rows.map((r) => (
              <tr key={r.label} className="border-b border-gray-50">
                <td className="px-4 py-2 text-gray-800">{r.label}</td>
                <td className="px-4 py-2 text-right tabular-nums">{r.n}</td>
                <td className="px-4 py-2 text-right tabular-nums">{num(r.meanAbsDiff)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{num(r.meanDiff)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{pct(r.within05)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{pct(r.flagRate)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <PipelineSubnav />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Grader panel</h1>
            <p className="text-sm text-gray-500 max-w-3xl">
              Three independent AI graders and a supervisor score each interview answer beside the normal grader.
              In shadow mode the panel never changes scores or gates. Promote it only when the criteria below are met.
              Candidates who asked for a human review are never AI-scored by either method.
            </p>
          </div>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm">
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>

        {overview.isLoading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : overview.error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{overview.error.message}</div>
        ) : d ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg shadow p-5 space-y-3">
                <h2 className="text-sm font-semibold text-gray-900">Panel running (kill switch)</h2>
                <p className="text-xs text-gray-500">Off stops the panel everywhere, including orgs where it is the score (they fall back to the single grader).</p>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={d.global.killSwitchOn}
                    disabled={setGlobal.isLoading}
                    onChange={(e) => setGlobal.mutate({ killSwitchOn: e.target.checked })}
                  />
                  {d.global.killSwitchOn ? 'On' : 'Off'}
                </label>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-600">Shadow sample</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    placeholder={String(Math.round(d.global.sampleRate * 100))}
                    value={sampleDraft}
                    onChange={(e) => setSampleDraft(e.target.value)}
                    className="w-20 rounded border border-gray-300 px-2 py-1"
                  />
                  <span className="text-gray-500">% of answers</span>
                  <button
                    type="button"
                    disabled={sampleDraft === '' || setGlobal.isLoading}
                    onClick={() => {
                      setGlobal.mutate({ sampleRate: Math.min(100, Math.max(0, Number(sampleDraft))) / 100 });
                      setSampleDraft('');
                    }}
                    className="rounded bg-gray-900 px-2 py-1 text-xs text-white disabled:opacity-40"
                  >
                    Save
                  </button>
                </div>
                <p className="text-xs text-gray-400">Currently {pct(d.global.sampleRate)}. Orgs where the panel is the score always run it.</p>
              </div>

              <div className="bg-white rounded-lg shadow p-5 space-y-3">
                <h2 className="text-sm font-semibold text-gray-900">Use panel as the score (all orgs)</h2>
                <p className="text-xs text-gray-500">
                  Score = supervisor result. Grader disagreement over 1.5/5 flags the answer and a score gate never rejects on it.
                  If the panel fails, the single grader scores.
                </p>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={d.global.asScoreOn} disabled={setGlobal.isLoading} onChange={(e) => toggleAsScore(e.target.checked)} />
                  {d.global.asScoreOn ? 'On — panel scores every org' : 'Off — shadow only'}
                </label>
              </div>

              <div className={`rounded-lg shadow p-5 space-y-2 ${d.report.readyToPromote ? 'bg-green-50' : 'bg-white'}`}>
                <h2 className="text-sm font-semibold text-gray-900">Promotion criteria</h2>
                {d.report.checks.map((c: any) => (
                  <div key={c.key} className="flex items-start gap-2 text-sm">
                    <span className={c.ok ? 'text-green-600' : 'text-gray-400'}>{c.ok ? '✓' : '○'}</span>
                    <span className="text-gray-700">
                      {c.label} <span className="text-gray-400">(now {typeof c.actual === 'number' && c.actual < 1 && c.key !== 'meanAbsDiff' ? pct(c.actual) : c.actual})</span>
                    </span>
                  </div>
                ))}
                <p className="text-xs text-gray-500 pt-1">{d.report.readyToPromote ? 'Ready to promote.' : 'Not ready yet.'}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
              {[
                ['Answers compared', String(d.report.overall.n)],
                ['Mean diff (of 5)', num(d.report.overall.meanAbsDiff)],
                ['Within 0.5', pct(d.report.overall.within05)],
                ['Disagreement flags', pct(d.report.overall.flagRate)],
                ['Panel latency (median / p90)', `${ms(d.report.latencyMs.median)} / ${ms(d.report.latencyMs.p90)}`],
                ['Supervisor fallbacks', pct(d.report.supervisorFallbackRate)],
              ].map(([label, value]) => (
                <div key={label} className="bg-white rounded-lg shadow p-4">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-xl font-bold text-gray-900 tabular-nums">{value}</p>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-lg shadow overflow-x-auto">
              <div className="px-4 py-3 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900">Cost per answer</h2>
                <p className="text-xs text-gray-500">From AI usage records. Dollar cost shows once the model has a price configured.</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
                    <th className="px-4 py-2.5 font-medium">Method</th>
                    <th className="px-4 py-2.5 font-medium text-right">Answers</th>
                    <th className="px-4 py-2.5 font-medium text-right">Input tokens</th>
                    <th className="px-4 py-2.5 font-medium text-right">Output tokens</th>
                    <th className="px-4 py-2.5 font-medium text-right">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {(['single', 'panel'] as const).map((k) => (
                    <tr key={k} className="border-b border-gray-50">
                      <td className="px-4 py-2 text-gray-800">{k === 'single' ? 'Single grader' : 'Panel (3 graders + supervisor)'}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{d.cost[k].answers}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{d.cost[k].promptTokens ?? '—'}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{d.cost[k].completionTokens ?? '—'}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{usd(d.cost[k].costUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <BreakdownTable title="By organization" rows={d.report.byOrg} />
            <BreakdownTable title="By job" rows={d.report.byPosition} />
            <BreakdownTable title="By question" rows={d.report.byQuestion} />

            <div className="bg-white rounded-lg shadow p-5 space-y-4">
              <h2 className="text-sm font-semibold text-gray-900">Per-org overrides</h2>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <select value={orgId} onChange={(e) => setOrgId(e.target.value)} className="rounded border border-gray-300 px-2 py-1.5">
                  <option value="">Choose an org…</option>
                  {orgList.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
                <select value={orgMode} onChange={(e) => setOrgMode(e.target.value as OrgMode)} className="rounded border border-gray-300 px-2 py-1.5">
                  <option value="follow">Follow global switches</option>
                  <option value="off">Panel off for this org</option>
                  <option value="score">Panel is the score for this org</option>
                </select>
                <button type="button" disabled={!orgId || setOrg.isLoading} onClick={saveOrg} className="rounded bg-gray-900 px-3 py-1.5 text-white disabled:opacity-40">
                  Save
                </button>
              </div>
              {d.orgOverrides.length === 0 ? (
                <p className="text-sm text-gray-400">No overrides. Every org follows the global switches.</p>
              ) : (
                <ul className="divide-y divide-gray-100 text-sm">
                  {d.orgOverrides.map((o: any) => (
                    <li key={o.organizationId} className="flex items-center justify-between py-2">
                      <span className="text-gray-800">{o.organizationName}</span>
                      <span className="flex items-center gap-3">
                        <span className="text-gray-500">{o.enabled === false ? 'Panel off' : o.useAsScore ? 'Panel is the score' : 'Follows global'}</span>
                        <button
                          type="button"
                          onClick={() => setOrg.mutate({ organizationId: o.organizationId, enabled: null, useAsScore: null })}
                          className="text-xs text-blue-600 hover:text-blue-700"
                        >
                          Clear
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : null}
      </div>
    </AuthenticatedLayout>
  );
}

'use client';
export const dynamic = 'force-dynamic';

/**
 * Tenant health & churn signals — per-org usage trends (seats, journeys,
 * scoring volume, last login) with at-risk flags so support reaches out
 * before a tenant quietly churns.
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Building2, HeartPulse } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { AdminPageChrome } from '@/components/admin/page-chrome';
import { SectionCard } from '@/components/admin/section-card';
import { StatusPill, type StatusTone } from '@/components/admin/status-pill';
import { EmptyState } from '@/components/admin/empty-state';
import { DataTableEl, Th, Td } from '@/components/admin/data-table';
import { checkboxClass } from '@/components/admin/controls';

const FLAG_LABELS: Record<string, [string, StatusTone]> = {
  USAGE_DOWN_50: ['Usage down 50%+', 'danger'],
  NO_LOGINS_14D: ['No logins 14d', 'warn'],
  TRIAL_EXPIRING: ['Trial expiring', 'warn'],
  EXPIRED: ['Expired', 'danger'],
};

function Trend({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0) return <span className="text-slate-300">—</span>;
  const pct = previous === 0 ? 100 : Math.round(((current - previous) / previous) * 100);
  const color = pct > 0 ? 'text-admin-ok' : pct < 0 ? 'text-admin-danger' : 'text-admin-muted';
  return (
    <span className="whitespace-nowrap">
      <span className="tabular-nums text-admin-ink">{current}</span>{' '}
      <span className={`text-xs tabular-nums ${color}`}>
        {pct > 0 ? '+' : ''}{pct}%
      </span>
    </span>
  );
}

export default function TenantHealthPage() {
  useAdminAuth();
  const [onlyAtRisk, setOnlyAtRisk] = useState(false);
  const health = (trpc as any).platformAdmin.getTenantHealth.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const rows: any[] = useMemo(() => {
    const all = health.data ?? [];
    return onlyAtRisk ? all.filter((r: any) => r.flags.length > 0) : all;
  }, [health.data, onlyAtRisk]);

  const atRiskCount = (health.data ?? []).filter((r: any) => r.flags.length > 0 && !r.isDemo).length;

  return (
    <AuthenticatedLayout>
      <AdminPageChrome
        icon={<HeartPulse />}
        breadcrumbs={[{ label: 'Tenants', href: '/organizations' }, { label: 'Tenant health' }]}
        title="Tenant health"
        description="30-day usage vs the prior 30 days. Flags mark tenants worth a proactive call."
        meta={atRiskCount > 0 ? <StatusPill tone="danger">{atRiskCount} at risk</StatusPill> : null}
      >
        <SectionCard
          icon={<Building2 />}
          title="Organizations"
          description="Seats, journeys, scoring volume, AI cost and last login"
          padded={false}
          actions={
            <label className="flex cursor-pointer items-center gap-2 text-sm text-admin-secondary">
              <input
                type="checkbox"
                checked={onlyAtRisk}
                onChange={(e) => setOnlyAtRisk(e.target.checked)}
                className={checkboxClass}
              />
              At-risk only
            </label>
          }
        >
          {health.isLoading ? (
            <p className="px-5 py-8 text-center text-sm text-admin-muted">Loading tenant health…</p>
          ) : rows.length === 0 ? (
            <EmptyState
              compact
              className="border-0 shadow-none"
              icon={<HeartPulse />}
              title={onlyAtRisk ? 'No at-risk tenants right now.' : 'No organizations found.'}
            />
          ) : (
            <div className="overflow-x-auto">
              <DataTableEl>
                <thead>
                  <tr>
                    <Th>Organization</Th>
                    <Th>Plan</Th>
                    <Th className="text-right">Seats (active/total)</Th>
                    <Th className="text-right">Journeys 30d</Th>
                    <Th className="text-right">Scoring 30d</Th>
                    <Th className="text-right">AI cost 30d</Th>
                    <Th>Last login</Th>
                    <Th>Signals</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <Td>
                        <Link href={`/organizations/${r.id}`} className="font-medium text-admin-ink hover:text-admin-accent-ink">
                          {r.name || r.id}
                        </Link>
                        {r.isDemo && (
                          <StatusPill tone="warn" dot={false} className="ml-2">demo</StatusPill>
                        )}
                      </Td>
                      <Td>
                        {r.plan}
                        <span className="block text-xs text-admin-muted">{r.status}</span>
                      </Td>
                      <Td className="text-right tabular-nums text-admin-ink">
                        {r.activeSeats}/{r.seats}
                      </Td>
                      <Td className="text-right">
                        <Trend current={r.sessions30} previous={r.sessionsPrev30} />
                      </Td>
                      <Td className="text-right">
                        <Trend current={r.scored30} previous={r.scoredPrev30} />
                      </Td>
                      <Td className="whitespace-nowrap text-right tabular-nums text-admin-ink">
                        {r.aiCost30 > 0 ? `$${r.aiCost30.toFixed(2)}` : '—'}
                        {r.aiCostPrev30 > 0 && r.aiCost30 > 0 && (
                          <span className={`block text-xs ${r.aiCost30 > r.aiCostPrev30 ? 'text-admin-danger' : 'text-admin-ok'}`}>
                            {r.aiCost30 > r.aiCostPrev30 ? '+' : ''}
                            {Math.round(((r.aiCost30 - r.aiCostPrev30) / r.aiCostPrev30) * 100)}%
                          </span>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap text-admin-muted">
                        {r.lastLoginAt ? new Date(r.lastLoginAt).toLocaleDateString() : 'never'}
                      </Td>
                      <Td>
                        <div className="flex flex-wrap gap-1">
                          {r.flags.map((f: string) => {
                            const [label, tone] = FLAG_LABELS[f] ?? [f, 'neutral' as StatusTone];
                            return (
                              <StatusPill key={f} tone={tone}>
                                {label}
                              </StatusPill>
                            );
                          })}
                          {r.flags.length === 0 && <StatusPill tone="success">healthy</StatusPill>}
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </DataTableEl>
            </div>
          )}
        </SectionCard>
      </AdminPageChrome>
    </AuthenticatedLayout>
  );
}

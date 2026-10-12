'use client';
export const dynamic = 'force-dynamic';

/**
 * AI cost observability — per-org LLM spend and tokens by model, plus
 * spend by call site, from llm_usage_events. Pricing and abuse detection.
 */
import { Fragment, useState } from 'react';
import Link from 'next/link';
import { Building2, Code2, Coins, Cpu, DollarSign, Hash } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { AdminPageChrome } from '@/components/admin/page-chrome';
import { SectionCard } from '@/components/admin/section-card';
import { StatGrid, StatTile } from '@/components/admin/stat-tile';
import { EmptyState } from '@/components/admin/empty-state';
import { Segmented } from '@/components/admin/segmented';
import { DataTableEl, Th, Td } from '@/components/admin/data-table';

function usd(v: number): string {
  return v >= 100 ? `$${v.toFixed(0)}` : v >= 1 ? `$${v.toFixed(2)}` : `$${v.toFixed(4)}`;
}

function tokens(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
}

export default function AiCostsPage() {
  useAdminAuth();
  const [days, setDays] = useState(30);
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null);

  const summary = (trpc as any).platformAdmin.getAiCostSummary.useQuery(
    { days },
    { refetchOnWindowFocus: false, keepPreviousData: true },
  );
  const d = summary.data;

  return (
    <AuthenticatedLayout>
      <AdminPageChrome
        icon={<Coins />}
        breadcrumbs={[{ label: 'Operations' }, { label: 'AI costs' }]}
        title="AI costs"
        description="LLM spend and token volume per tenant and per call site."
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
        {summary.isLoading ? (
          <p className="text-sm text-admin-muted">Loading AI cost data…</p>
        ) : summary.error ? (
          <div className="rounded-admin border border-admin-danger/20 bg-admin-danger-soft px-4 py-3 text-sm text-red-900">
            {summary.error.message}
          </div>
        ) : (
          <div className="space-y-6">
            <StatGrid cols={3}>
              <StatTile label="Total spend" icon={DollarSign} tone="brand" value={usd(d.totalCost)} />
              <StatTile label="Tokens" icon={Hash} tone="info" value={tokens(d.totalTokens)} />
              <StatTile label="Calls" icon={Cpu} tone="muted" value={d.totalCalls.toLocaleString()} />
            </StatGrid>

            <SectionCard
              icon={<Building2 />}
              title="Spend by organization"
              description="Click a row to see spend by model"
              padded={false}
            >
              {d.byOrg.length === 0 ? (
                <EmptyState compact className="border-0 shadow-none" icon={<Coins />} title="No LLM usage in this window." />
              ) : (
                <div className="overflow-x-auto">
                  <DataTableEl>
                    <thead>
                      <tr>
                        <Th>Organization</Th>
                        <Th className="text-right">Spend</Th>
                        <Th className="text-right">Tokens</Th>
                        <Th className="text-right">Calls</Th>
                        <Th className="text-right">Failed</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.byOrg.map((o: any) => {
                        const key = o.organizationId ?? 'platform';
                        const expanded = expandedOrg === key;
                        return (
                          <Fragment key={key}>
                            <tr onClick={() => setExpandedOrg(expanded ? null : key)} className="cursor-pointer">
                              <Td>
                                {o.organizationId ? (
                                  <Link
                                    href={`/organizations/${o.organizationId}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="font-medium text-admin-accent hover:text-admin-accent-ink"
                                  >
                                    {o.organizationName}
                                  </Link>
                                ) : (
                                  <span className="font-medium text-admin-ink">{o.organizationName}</span>
                                )}
                                <span className="ml-2 text-xs text-admin-muted">{expanded ? '▾' : '▸'}</span>
                              </Td>
                              <Td className="text-right font-medium tabular-nums text-admin-ink">{usd(o.cost)}</Td>
                              <Td className="text-right tabular-nums">{tokens(o.tokens)}</Td>
                              <Td className="text-right tabular-nums">{o.calls.toLocaleString()}</Td>
                              <Td className={`text-right tabular-nums ${o.failedCalls > 0 ? 'font-medium text-red-600' : 'text-admin-muted'}`}>
                                {o.failedCalls}
                              </Td>
                            </tr>
                            {expanded && o.models.map((m: any) => (
                              <tr key={`${key}-${m.model}`} className="bg-admin-bg/50 text-xs">
                                <Td className="py-1.5 pl-10 text-admin-muted">{m.model}</Td>
                                <Td className="py-1.5 text-right tabular-nums">{usd(m.cost)}</Td>
                                <Td className="py-1.5 text-right tabular-nums text-admin-muted">{tokens(m.tokens)}</Td>
                                <Td className="py-1.5 text-right tabular-nums text-admin-muted">{m.calls.toLocaleString()}</Td>
                                <Td />
                              </tr>
                            ))}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </DataTableEl>
                </div>
              )}
            </SectionCard>

            <SectionCard icon={<Code2 />} title="Spend by call site" description="Where in the code the LLM calls come from" padded={false}>
              <div className="overflow-x-auto">
                <DataTableEl>
                  <thead>
                    <tr>
                      <Th>Call site</Th>
                      <Th className="text-right">Spend</Th>
                      <Th className="text-right">Tokens</Th>
                      <Th className="text-right">Calls</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.byCallSite.map((c: any) => (
                      <tr key={c.callSite}>
                        <Td mono className="text-admin-ink">{c.callSite}</Td>
                        <Td className="text-right font-medium tabular-nums text-admin-ink">{usd(c.cost)}</Td>
                        <Td className="text-right tabular-nums">{tokens(c.tokens)}</Td>
                        <Td className="text-right tabular-nums">{c.calls.toLocaleString()}</Td>
                      </tr>
                    ))}
                  </tbody>
                </DataTableEl>
              </div>
            </SectionCard>
          </div>
        )}
      </AdminPageChrome>
    </AuthenticatedLayout>
  );
}

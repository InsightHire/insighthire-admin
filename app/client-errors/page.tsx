'use client';
export const dynamic = 'force-dynamic';

/**
 * Browser-side errors reported by the tenant app (error boundaries and the
 * candidate journey reporter), grouped by fingerprint. The intake is the web
 * app's /api/errors route, which forwards to the API's /client-errors sink.
 */
import { useState } from 'react';
import { Bug, CheckCircle2, ChevronDown, ChevronRight, Layers, RotateCcw } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { AdminPageChrome } from '@/components/admin/page-chrome';
import { SectionCard } from '@/components/admin/section-card';
import { StatusPill } from '@/components/admin/status-pill';
import { SeverityBadge } from '@/components/admin/severity-badge';
import { EmptyState } from '@/components/admin/empty-state';
import { Segmented } from '@/components/admin/segmented';
import { buttonClass } from '@/components/admin/controls';

const DAY_OPTIONS = [1, 7, 30] as const;

function ErrorGroupDetail({ fingerprint }: { fingerprint: string }) {
  const detail = (trpc as any).platformAdmin.getClientErrorGroup.useQuery(
    { fingerprint },
    { refetchOnWindowFocus: false },
  );
  const events: any[] = detail.data ?? [];
  if (detail.isLoading) return <p className="px-3 py-2 text-xs text-admin-muted">Loading events…</p>;
  return (
    <div className="space-y-2 rounded-admin-sm border border-admin-border bg-admin-bg/60 px-3 py-2">
      {events.map((e) => (
        <div key={e.id} className="border-b border-admin-border pb-2 text-xs text-admin-secondary last:border-0 last:pb-0">
          <p className="text-admin-muted">
            {new Date(e.createdAt).toLocaleString()}
            {e.url ? <span className="ml-2 text-admin-muted">{e.url}</span> : null}
            {e.ip ? <span className="ml-2 font-mono text-admin-muted">{e.ip}</span> : null}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            {e.organizationName ? (
              <StatusPill tone="brand" dot={false}>{e.organizationName}</StatusPill>
            ) : (
              <StatusPill tone="neutral" dot={false}>no tenant</StatusPill>
            )}
            {e.userEmail ? <span className="text-admin-ink">{e.userEmail}</span> : null}
            {e.userRole ? <span className="text-admin-muted">{e.userRole}</span> : null}
            {e.impersonating ? <StatusPill tone="warn" dot={false}>impersonating</StatusPill> : null}
            {e.journeySessionId ? (
              <span className="font-mono text-admin-muted">session {e.journeySessionId}</span>
            ) : null}
            {e.viewport ? <span className="font-mono text-admin-muted">{e.viewport}</span> : null}
            {e.releaseSha ? <span className="font-mono text-admin-muted">build {e.releaseSha.slice(0, 8)}</span> : null}
          </p>
          {e.stack && (
            <pre className="mt-1.5 max-h-40 overflow-auto whitespace-pre-wrap rounded-admin-sm border border-admin-border bg-white p-2 font-mono text-[11px] text-admin-secondary">
              {e.stack}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}

export default function ClientErrorsPage() {
  useAdminAuth();
  const [days, setDays] = useState<number>(7);
  const [open, setOpen] = useState<string | null>(null);
  const [recovered, setRecovered] = useState<string | null>(null);

  const list = (trpc as any).platformAdmin.listClientErrors.useQuery(
    { days },
    { refetchOnWindowFocus: false },
  );
  const groups: any[] = list.data ?? [];

  /**
   * Re-resolve the tenant for rows recorded before the URL was parsed. Every
   * journey crash carries its session in the URL, so this is recoverable
   * history — it also runs nightly, this is just the impatient path.
   */
  const backfill = (trpc as any).platformAdmin.backfillClientErrorTenants.useMutation({
    onSuccess: (res: { scanned: number; resolved: number; stillUnknown: number }) => {
      setRecovered(`Recovered ${res.resolved} of ${res.scanned} — ${res.stillUnknown} have no tenant signal in their URL.`);
      void list.refetch();
    },
    onError: (err: { message?: string }) => setRecovered(err?.message ?? 'Backfill failed'),
  });

  return (
    <AuthenticatedLayout>
      <AdminPageChrome
        icon={<Bug />}
        breadcrumbs={[{ label: 'Operations' }, { label: 'Client errors' }]}
        title="Client errors"
        description="Browser crashes reported by the tenant app, grouped by fingerprint."
        actions={
          <>
            <Segmented
              size="sm"
              ariaLabel="Time window"
              options={DAY_OPTIONS.map((d) => ({ value: d as number, label: d === 1 ? '24h' : `${d}d` }))}
              value={days}
              onChange={setDays}
            />
            <button
              onClick={() => backfill.mutate({})}
              disabled={backfill.isPending}
              title="Re-resolve tenants from the session id in each error's URL"
              className={buttonClass.secondary}
            >
              <RotateCcw className="h-4 w-4" />
              {backfill.isPending ? 'Recovering…' : 'Recover tenants'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {recovered ? (
            <div className="rounded-admin-sm border border-admin-border bg-admin-bg px-4 py-2 text-xs text-admin-secondary">{recovered}</div>
          ) : null}

          <SectionCard
            icon={<Layers />}
            title="Error groups"
            description={`Last ${days === 1 ? '24 hours' : `${days} days`}. Click a group to see its events.`}
            padded={false}
          >
            {list.isLoading ? (
              <p className="px-5 py-6 text-sm text-admin-muted">Loading…</p>
            ) : groups.length === 0 ? (
              <EmptyState
                compact
                className="border-0 shadow-none"
                icon={<CheckCircle2 />}
                title={`No client errors reported in the last ${days === 1 ? '24 hours' : `${days} days`}.`}
                description="Good sign."
              />
            ) : (
              <div className="divide-y divide-admin-border">
                {groups.map((g) => (
                  <div key={g.fingerprint} className="px-5 py-3.5">
                    <button
                      onClick={() => setOpen(open === g.fingerprint ? null : g.fingerprint)}
                      className="flex w-full flex-wrap items-start gap-3 text-left"
                    >
                      <SeverityBadge severity={g.count >= 10 ? 'critical' : 'warn'} className="shrink-0 tabular-nums">
                        ×{g.count}
                      </SeverityBadge>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-admin-ink">
                          {g.sample?.message ?? g.fingerprint}
                        </p>
                        <p className="mt-0.5 text-xs text-admin-muted">
                          <span className="font-mono">{g.sample?.source}</span>
                          {g.sample?.kind ? <span className="ml-2 font-mono">{g.sample.kind}</span> : null}
                          {g.sample?.url ? <span className="ml-2">{g.sample.url}</span> : null}
                        </p>
                        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                          {/* Blast radius. "Every tenant" and "one customer" are
                              the same message but completely different problems. */}
                          {g.organizationCount > 0 ? (
                            g.organizations.slice(0, 3).map((o: any) => (
                              <StatusPill key={o.id} tone="brand" dot={false}>{o.name}</StatusPill>
                            ))
                          ) : (
                            <StatusPill tone="neutral" dot={false}>no tenant recorded</StatusPill>
                          )}
                          {g.organizationCount > 3 ? (
                            <span className="text-admin-muted">+{g.organizationCount - 3} more tenants</span>
                          ) : null}
                          {g.userCount > 0 ? (
                            <span className="text-admin-muted">
                              {g.userCount} {g.userCount === 1 ? 'user' : 'users'}
                            </span>
                          ) : null}
                          {g.sample?.userEmail && g.userCount === 1 ? (
                            <span className="text-admin-secondary">{g.sample.userEmail}</span>
                          ) : null}
                          {g.sample?.impersonating ? <StatusPill tone="warn" dot={false}>impersonating</StatusPill> : null}
                          {g.unattributed > 0 && g.organizationCount > 0 ? (
                            <span className="text-admin-muted">{g.unattributed} unattributed</span>
                          ) : null}
                        </p>
                        <p className="mt-1 text-xs text-admin-muted">
                          First {new Date(g.firstSeen).toLocaleString()} · Last {new Date(g.lastSeen).toLocaleString()}
                        </p>
                      </div>
                      {open === g.fingerprint ? (
                        <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-admin-muted" />
                      ) : (
                        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-admin-muted" />
                      )}
                    </button>
                    {open === g.fingerprint && (
                      <div className="mt-3">
                        <ErrorGroupDetail fingerprint={g.fingerprint} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </AdminPageChrome>
    </AuthenticatedLayout>
  );
}

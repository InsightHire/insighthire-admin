'use client';
export const dynamic = 'force-dynamic';

/**
 * Unified alert inbox. Merges tenant health flags, billing alerts, scoring
 * drift, and client errors (last 24h) into one list with acknowledge state.
 * Acks are stored by stable alertKey; when the underlying alert stops firing
 * it simply disappears from this list.
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { BellOff, CheckCircle2, Inbox } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { AdminPageChrome } from '@/components/admin/page-chrome';
import { SectionCard } from '@/components/admin/section-card';
import { SeverityBadge } from '@/components/admin/severity-badge';
import { StatusPill } from '@/components/admin/status-pill';
import { EmptyState } from '@/components/admin/empty-state';
import { buttonClass, checkboxClass } from '@/components/admin/controls';

type InboxAlert = {
  key: string;
  severity: 'danger' | 'warn';
  category: string;
  title: string;
  detail?: string;
  href?: string;
};

const HEALTH_FLAG_LABELS: Record<string, { label: string; severity: 'danger' | 'warn' }> = {
  USAGE_DOWN_50: { label: 'Usage down >50%', severity: 'warn' },
  NO_LOGINS_14D: { label: 'No logins in 14 days', severity: 'warn' },
  TRIAL_EXPIRING: { label: 'Trial expiring', severity: 'warn' },
  EXPIRED: { label: 'Subscription expired', severity: 'danger' },
};

const STALL_LABELS: Record<string, string> = {
  STALLED_NO_POSITION: 'No position created yet',
  STALLED_NO_CANDIDATE: 'No candidates yet',
};

export default function AlertsPage() {
  useAdminAuth();
  const utils = (trpc as any).useUtils();
  const [showAcked, setShowAcked] = useState(false);

  const health = (trpc as any).platformAdmin.getTenantHealth.useQuery(undefined, { refetchOnWindowFocus: false });
  const billing = (trpc as any).platformAdmin.getBillingAlerts.useQuery(undefined, { refetchOnWindowFocus: false });
  const drift = (trpc as any).platformAdmin.getScoringDrift.useQuery(undefined, { refetchOnWindowFocus: false });
  const clientErrors = (trpc as any).platformAdmin.listClientErrors.useQuery({ days: 1 }, { refetchOnWindowFocus: false });
  const activation = (trpc as any).platformAdmin.getActivationFunnel.useQuery(undefined, { refetchOnWindowFocus: false });
  const indeed = (trpc as any).platformAdmin.indeedListFailures.useQuery(undefined, { refetchOnWindowFocus: false });
  const acks = (trpc as any).platformAdmin.listAlertAcks.useQuery(undefined, { refetchOnWindowFocus: false });

  const invalidateAcks = () => (utils as any).platformAdmin.listAlertAcks.invalidate();
  const ack = (trpc as any).platformAdmin.ackAlert.useMutation({ onSuccess: invalidateAcks });
  const unack = (trpc as any).platformAdmin.unackAlert.useMutation({ onSuccess: invalidateAcks });

  const alerts: InboxAlert[] = useMemo(() => {
    const out: InboxAlert[] = [];
    for (const org of (health.data as any[]) ?? []) {
      for (const flag of org.flags ?? []) {
        const meta = HEALTH_FLAG_LABELS[flag] ?? { label: flag, severity: 'warn' as const };
        out.push({
          key: `health:${flag}:${org.id}`,
          severity: meta.severity,
          category: 'Tenant health',
          title: `${org.name}: ${meta.label}`,
          href: '/tenant-health',
        });
      }
    }
    for (const a of (billing.data as any)?.alerts ?? []) {
      out.push({
        key: `billing:${a.kind}:${a.organizationId}`,
        severity: a.kind === 'PAST_DUE' || a.kind === 'OVERDUE_INVOICE' ? 'danger' : 'warn',
        category: 'Billing',
        title: `${a.organizationName}: ${a.kind.replace(/_/g, ' ').toLowerCase()}`,
        detail: a.detail,
        href: '/billing',
      });
    }
    for (const d of (drift.data as any[]) ?? []) {
      if (!d.drifting) continue;
      out.push({
        key: `drift:${d.organizationId}`,
        severity: 'warn',
        category: 'Scoring drift',
        title: `${d.organizationName}: AI ${d.direction === 'AI_GENEROUS' ? 'scoring high' : 'scoring low'} (bias ${d.bias > 0 ? '+' : ''}${d.bias})`,
        detail: `${d.sampleSize} overridden scores`,
        href: '/scoring/runs',
      });
    }
    for (const g of (clientErrors.data as any[]) ?? []) {
      out.push({
        key: `clienterror:${String(g.fingerprint).slice(0, 280)}`,
        severity: g.count >= 10 ? 'danger' : 'warn',
        category: 'Client errors',
        title: `${g.sample?.message ?? g.fingerprint}`,
        detail: `×${g.count} in the last 24h`,
        href: '/client-errors',
      });
    }
    for (const org of (activation.data as any[]) ?? []) {
      for (const stall of org.stalls ?? []) {
        out.push({
          key: `activation:${stall}:${org.organizationId}`,
          severity: 'warn',
          category: 'Activation',
          title: `${org.organizationName}: ${STALL_LABELS[stall] ?? stall}`,
          detail: `${org.ageDays} days old`,
          href: '/activation',
        });
      }
    }
    for (const f of (indeed.data as any[]) ?? []) {
      out.push({
        key: `indeed:${f.positionId}`,
        severity: 'danger',
        category: 'Indeed',
        title: `${f.organizationName}: Indeed pull failed on "${f.positionTitle}"`,
        detail: f.reason,
        href: `/indeed?positionId=${f.positionId}`,
      });
    }
    return out.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'danger' ? -1 : 1));
  }, [health.data, billing.data, drift.data, clientErrors.data, activation.data, indeed.data]);

  const ackedKeys = useMemo(
    () => new Set(((acks.data as any[]) ?? []).map((a) => a.alertKey)),
    [acks.data],
  );
  const active = alerts.filter((a) => !ackedKeys.has(a.key));
  const acked = alerts.filter((a) => ackedKeys.has(a.key));
  const loading = health.isLoading || billing.isLoading || drift.isLoading || clientErrors.isLoading || activation.isLoading;

  const renderRow = (a: InboxAlert, isAcked: boolean) => (
    <li key={a.key} className={`flex flex-wrap items-start gap-3 px-5 py-3.5 transition-colors hover:bg-admin-bg/70 ${isAcked ? 'opacity-60' : ''}`}>
      <SeverityBadge severity={a.severity === 'danger' ? 'critical' : 'warn'} className="shrink-0">
        {a.category}
      </SeverityBadge>
      <div className="min-w-0 flex-1">
        {a.href ? (
          <Link href={a.href} className="text-sm font-medium text-admin-ink hover:text-admin-accent-ink">
            {a.title}
          </Link>
        ) : (
          <p className="text-sm font-medium text-admin-ink">{a.title}</p>
        )}
        {a.detail && <p className="mt-0.5 text-xs text-admin-muted">{a.detail}</p>}
      </div>
      <button
        onClick={() => (isAcked ? unack.mutate({ alertKey: a.key }) : ack.mutate({ alertKey: a.key }))}
        disabled={ack.isPending || unack.isPending}
        className={`${buttonClass.small} shrink-0`}
      >
        {isAcked ? 'Un-acknowledge' : 'Acknowledge'}
      </button>
    </li>
  );

  return (
    <AuthenticatedLayout>
      <AdminPageChrome
        width="narrow"
        icon={<Inbox />}
        breadcrumbs={[{ label: 'Attention', href: '/attention' }, { label: 'Alerts' }]}
        title="Alert inbox"
        description={
          <>
            Tenant health, billing, scoring drift, and client errors in one place.
            Acknowledged alerts stay hidden until they stop firing or you bring them back.
          </>
        }
        meta={!loading ? <StatusPill tone={active.length > 0 ? 'warn' : 'success'}>{active.length} active</StatusPill> : null}
        actions={
          <label className="flex items-center gap-2 text-sm text-admin-secondary">
            <input
              type="checkbox"
              checked={showAcked}
              onChange={(e) => setShowAcked(e.target.checked)}
              className={checkboxClass}
            />
            Show acknowledged ({acked.length})
          </label>
        }
      >
        <div className="space-y-6">
          <SectionCard
            icon={<Inbox />}
            title="Needs attention"
            description="Sorted by severity, most urgent first"
            padded={false}
          >
            {loading ? (
              <p className="px-5 py-6 text-sm text-admin-muted">Gathering alerts…</p>
            ) : active.length === 0 ? (
              <EmptyState
                compact
                className="border-0 shadow-none"
                icon={<CheckCircle2 />}
                title="Inbox zero"
                description="Nothing needs attention."
              />
            ) : (
              <ul className="divide-y divide-admin-border">{active.map((a) => renderRow(a, false))}</ul>
            )}
          </SectionCard>

          {showAcked && acked.length > 0 && (
            <SectionCard
              icon={<BellOff />}
              title="Acknowledged"
              description="Hidden until they stop firing or you bring them back"
              padded={false}
            >
              <ul className="divide-y divide-admin-border">{acked.map((a) => renderRow(a, true))}</ul>
            </SectionCard>
          )}
        </div>
      </AdminPageChrome>
    </AuthenticatedLayout>
  );
}

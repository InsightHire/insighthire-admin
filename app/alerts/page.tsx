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
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';

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
    return out.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'danger' ? -1 : 1));
  }, [health.data, billing.data, drift.data, clientErrors.data, activation.data]);

  const ackedKeys = useMemo(
    () => new Set(((acks.data as any[]) ?? []).map((a) => a.alertKey)),
    [acks.data],
  );
  const active = alerts.filter((a) => !ackedKeys.has(a.key));
  const acked = alerts.filter((a) => ackedKeys.has(a.key));
  const loading = health.isLoading || billing.isLoading || drift.isLoading || clientErrors.isLoading || activation.isLoading;

  const renderRow = (a: InboxAlert, isAcked: boolean) => (
    <div key={a.key} className={`px-4 py-3 flex flex-wrap items-start gap-3 ${isAcked ? 'opacity-60' : ''}`}>
      <span className={`px-1.5 py-0.5 text-xs rounded shrink-0 font-medium ${
        a.severity === 'danger' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
      }`}>
        {a.category}
      </span>
      <div className="min-w-0 flex-1">
        {a.href ? (
          <Link href={a.href} className="text-sm font-medium text-gray-900 hover:text-purple-700">
            {a.title}
          </Link>
        ) : (
          <p className="text-sm font-medium text-gray-900">{a.title}</p>
        )}
        {a.detail && <p className="text-xs text-gray-500 mt-0.5">{a.detail}</p>}
      </div>
      <button
        onClick={() => (isAcked ? unack.mutate({ alertKey: a.key }) : ack.mutate({ alertKey: a.key }))}
        disabled={ack.isPending || unack.isPending}
        className="px-2.5 py-1 text-xs rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 shrink-0"
      >
        {isAcked ? 'Un-acknowledge' : 'Acknowledge'}
      </button>
    </div>
  );

  return (
    <AuthenticatedLayout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Alert inbox</h1>
            <p className="text-sm text-gray-500">
              Tenant health, billing, scoring drift, and client errors in one place.
              Acknowledged alerts stay hidden until they stop firing or you bring them back.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={showAcked}
              onChange={(e) => setShowAcked(e.target.checked)}
              className="rounded border-gray-300"
            />
            Show acknowledged ({acked.length})
          </label>
        </div>

        <div className="bg-white rounded-lg shadow divide-y divide-gray-50">
          {loading ? (
            <p className="px-4 py-6 text-sm text-gray-400">Gathering alerts…</p>
          ) : active.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-400">Inbox zero — nothing needs attention.</p>
          ) : (
            active.map((a) => renderRow(a, false))
          )}
        </div>

        {showAcked && acked.length > 0 && (
          <div className="bg-white rounded-lg shadow divide-y divide-gray-50">
            <div className="px-4 py-3">
              <h2 className="text-sm font-semibold text-gray-500">Acknowledged</h2>
            </div>
            {acked.map((a) => renderRow(a, true))}
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
}

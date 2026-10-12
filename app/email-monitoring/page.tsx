'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AlertTriangle, Archive, BarChart3, CheckCircle2, Inbox, Send, Server } from 'lucide-react';
import { StatStrip } from '@/components/admin/stat-strip';
import { SectionCard } from '@/components/admin/section-card';
import { StatusPill } from '@/components/admin/status-pill';
import { EmptyState } from '@/components/admin/empty-state';
import { buttonClass, selectClass } from '@/components/admin/controls';
import { formatDate } from './_utils';

export default function EmailMonitoringOverviewPage() {
  const { isLoading: authLoading } = useAdminAuth();
  const [triggerOrgId, setTriggerOrgId] = useState('');
  const [triggerType, setTriggerType] = useState<'DAILY' | 'WEEKLY'>('DAILY');
  const [triggerResult, setTriggerResult] = useState<{ success: boolean; message: string } | null>(null);
  const [triggerOpen, setTriggerOpen] = useState(false);

  const { data: orgsData } = trpc.platformAdmin.listOrganizations.useQuery(
    { page: 1, limit: 100 },
    { enabled: !authLoading, retry: false }
  );
  const { data: overview, isLoading: overviewLoading } = (trpc.platformAdmin as any).getEmailMonitoringOverview.useQuery(
    undefined,
    { enabled: !authLoading, retry: false, refetchInterval: 30000 }
  );
  const triggerDigestMutation = trpc.platformAdmin.triggerDigestNow.useMutation({
    onSuccess: (data: { success: boolean; message: string; recipients?: string[] }) => {
      const msg = data.recipients?.length
        ? `${data.message}\nRecipients: ${data.recipients.join(', ')}`
        : data.message;
      setTriggerResult({ success: data.success, message: msg });
      setTimeout(() => setTriggerResult(null), 8000);
    },
    onError: (err: { message: string }) => {
      setTriggerResult({ success: false, message: err.message });
      setTimeout(() => setTriggerResult(null), 5000);
    },
  });

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-admin-accent" />
      </div>
    );
  }

  if (overviewLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-admin-accent mx-auto" />
      </div>
    );
  }

  if (!overview) {
    return <EmptyState icon={<BarChart3 />} title="No data available" />;
  }

  const { queue, volume, providers, inbound, archive, recentFailures } = overview;

  return (
    <div className="space-y-6">
      <StatStrip
        items={[
          {
            label: 'Digest pending',
            value: queue.pending,
            severity: queue.pending > 0 ? 'warn' : 'ok',
            hint: 'Live queue depth',
            href: '/email-monitoring/digest?status=PENDING',
          },
          {
            label: 'Digest failed',
            value: queue.failed,
            severity: queue.failed > 0 ? 'critical' : 'ok',
            href: '/email-monitoring/digest?status=FAILED',
          },
          {
            label: 'Sent 24h',
            value: volume.sent24h,
            severity: 'info',
            href: '/email-monitoring/sent-emails',
          },
          {
            label: 'Sent 7d',
            value: volume.sent7d,
            severity: 'muted',
            hint: `${volume.openRate7d}% open · ${volume.bounceRate7d}% bounce`,
          },
        ]}
      />

      <StatStrip
        className="lg:grid-cols-4"
        items={[
          {
            label: 'Opens 7d',
            value: volume.opens7d,
            severity: 'ok',
          },
          {
            label: 'Clicks 7d',
            value: volume.clicks7d,
            severity: 'info',
          },
          {
            label: 'Bounces 7d',
            value: volume.bounces7d,
            severity: volume.bounces7d > 0 ? 'warn' : 'ok',
          },
          {
            label: 'Archive coverage',
            value: `${archive.withBodyPct}%`,
            severity: archive.withBodyPct < 95 ? 'warn' : 'ok',
            hint:
              archive.missingBodyCount > 0
                ? `${archive.missingBodyCount} missing body · ${archive.unattributedCount} unattributed`
                : `${archive.unattributedCount} unattributed`,
            href: archive.missingBodyCount > 0 ? '/email-monitoring/sent-emails?missingBody=1' : undefined,
          },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard icon={<Server />} title="Provider split (7d)">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-admin-muted">Resend</span>
              <span className="admin-mono font-medium">{providers.resend}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-admin-muted">Mailgun</span>
              <span className="admin-mono font-medium">{providers.mailgun}</span>
            </div>
            {providers.other > 0 && (
              <div className="flex justify-between">
                <span className="text-admin-muted">Other</span>
                <span className="admin-mono font-medium">{providers.other}</span>
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard icon={<Inbox />} title="Inbound (24h)" href="/email-monitoring/inbound">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-admin-muted">Received</span>
              <span className="admin-mono font-medium">{inbound.received24h}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-admin-muted">Failed</span>
              <span className={`admin-mono font-medium ${inbound.failed24h > 0 ? 'text-admin-danger' : ''}`}>
                {inbound.failed24h}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-admin-muted">Ignored</span>
              <span className="admin-mono font-medium">{inbound.ignored24h}</span>
            </div>
          </div>
        </SectionCard>

        <SectionCard icon={<Archive />} title="Archive health">
          <p className="text-sm text-admin-muted mb-2">
            Durable bodies in <code className="text-xs">email_sends</code> /{' '}
            <code className="text-xs">inbound_email_logs</code> past provider retention.
          </p>
          <div className="text-2xl font-semibold admin-mono text-admin-ink">{archive.withBodyPct}%</div>
          <p className="text-xs text-admin-muted mt-1">
            {archive.withBodyCount} of {volume.sent7d} sends (7d) have HTML
          </p>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard
          icon={<AlertTriangle />}
          title="Recent failed / bounced sends"
          href="/email-monitoring/sent-emails?status=FAILED"
          hrefLabel="Sent Emails"
          padded={false}
        >
          {recentFailures.sends.length === 0 ? (
            <EmptyState compact className="border-0 shadow-none" icon={<CheckCircle2 />} title="No recent failures" />
          ) : (
            <ul className="divide-y divide-admin-border">
              {recentFailures.sends.map((s: any) => (
                <li key={s.id} className="px-5 py-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-admin-ink truncate">{s.subject || '(no subject)'}</div>
                      <div className="text-xs text-admin-muted truncate">
                        {s.recipientEmail} · {s.organizationName}
                      </div>
                      {s.errorMessage && (
                        <div className="text-xs text-admin-danger mt-1 truncate">{s.errorMessage}</div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <StatusPill tone="danger" dot={false} className="text-[10px]">
                        {s.status}
                      </StatusPill>
                      <div className="text-[10px] text-admin-muted mt-1">{formatDate(s.sentAt)}</div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          icon={<AlertTriangle />}
          title="Failed digests"
          href="/email-monitoring/digest?status=FAILED"
          hrefLabel="Digest Queue"
          padded={false}
        >
          {recentFailures.digests.length === 0 ? (
            <EmptyState compact className="border-0 shadow-none" icon={<CheckCircle2 />} title="No failed digests" />
          ) : (
            <ul className="divide-y divide-admin-border">
              {recentFailures.digests.map((d: any) => (
                <li key={d.id} className="px-5 py-3 text-sm">
                  <div className="font-medium text-admin-ink">{d.notificationType}</div>
                  <div className="text-xs text-admin-muted">
                    {d.organizationName} · {d.userEmail || '—'} · {d.deliveryMethod}
                  </div>
                  {d.errorMessage && (
                    <div className="text-xs text-admin-danger mt-1 truncate">{d.errorMessage}</div>
                  )}
                  <div className="text-[10px] text-admin-muted mt-1">{formatDate(d.createdAt)}</div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard
        icon={<Send />}
        title="Manually trigger digest"
        description="Secondary ops tool — sends are archived to email_sends."
        actions={
          <button type="button" onClick={() => setTriggerOpen((o) => !o)} className={buttonClass.small}>
            {triggerOpen ? 'Hide' : 'Show'}
          </button>
        }
        className={triggerOpen ? undefined : '[&>header]:border-b-0'}
        bodyClassName={triggerOpen ? undefined : 'hidden'}
      >
        {triggerOpen && (
          <div>
            {triggerResult && (
              <div
                className={`mb-4 p-3 rounded-admin-sm whitespace-pre-wrap text-sm ${
                  triggerResult.success
                    ? 'bg-admin-ok-soft text-green-800 border border-green-200'
                    : 'bg-admin-danger-soft text-red-800 border border-red-200'
                }`}
              >
                {triggerResult.message}
              </div>
            )}
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-admin-secondary mb-1">Organization</label>
                <select
                  value={triggerOrgId}
                  onChange={(e) => setTriggerOrgId(e.target.value)}
                  className={`${selectClass} w-full`}
                >
                  <option value="">Select organization...</option>
                  {orgsData?.organizations?.map((org: any) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-40">
                <label className="block text-sm font-medium text-admin-secondary mb-1">Digest Type</label>
                <select
                  value={triggerType}
                  onChange={(e) => setTriggerType(e.target.value as 'DAILY' | 'WEEKLY')}
                  className={`${selectClass} w-full`}
                >
                  <option value="DAILY">Daily Digest</option>
                  <option value="WEEKLY">Weekly Digest</option>
                </select>
              </div>
              <button
                onClick={() =>
                  triggerOrgId &&
                  triggerDigestMutation.mutate({ organizationId: triggerOrgId, digestType: triggerType })
                }
                disabled={!triggerOrgId || triggerDigestMutation.isPending}
                className={buttonClass.primary}
              >
                {triggerDigestMutation.isPending ? 'Sending...' : 'Send Digest Now'}
              </button>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

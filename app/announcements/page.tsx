'use client';
export const dynamic = 'force-dynamic';

/**
 * Platform announcements — create and manage banners that appear in every
 * tenant dashboard (maintenance windows, incidents, product notices).
 */
import { useState } from 'react';
import { History, Megaphone, PenSquare } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { useIsSuperAdmin } from '@/lib/use-super-admin';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { AdminPageChrome } from '@/components/admin/page-chrome';
import { SectionCard } from '@/components/admin/section-card';
import { StatusPill, type StatusTone } from '@/components/admin/status-pill';
import { EmptyState } from '@/components/admin/empty-state';
import { Segmented } from '@/components/admin/segmented';
import { cn } from '@/lib/cn';
import { buttonClass, inputClass } from '@/components/admin/controls';

const SEVERITIES = [
  ['info', 'Info'],
  ['maintenance', 'Maintenance'],
  ['incident', 'Incident'],
] as const;

const SEVERITY_TONE: Record<string, StatusTone> = {
  info: 'info',
  maintenance: 'warn',
  incident: 'danger',
};

export default function AnnouncementsPage() {
  useAdminAuth();
  const isSuperAdmin = useIsSuperAdmin();
  const utils = (trpc as any).useUtils();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [severity, setSeverity] = useState<'info' | 'maintenance' | 'incident'>('info');
  const [endsAt, setEndsAt] = useState('');
  const [error, setError] = useState<string | null>(null);

  const list = (trpc as any).platformAdmin.listAnnouncements.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const invalidate = () => (utils as any).platformAdmin.listAnnouncements.invalidate();

  const create = (trpc as any).platformAdmin.createAnnouncement.useMutation({
    onSuccess: () => { setTitle(''); setBody(''); setEndsAt(''); setError(null); invalidate(); },
    onError: (e: { message: string }) => setError(e.message),
  });
  const update = (trpc as any).platformAdmin.updateAnnouncement.useMutation({
    onSuccess: invalidate,
    onError: (e: { message: string }) => setError(e.message),
  });
  const remove = (trpc as any).platformAdmin.deleteAnnouncement.useMutation({
    onSuccess: invalidate,
    onError: (e: { message: string }) => setError(e.message),
  });

  const rows: any[] = list.data ?? [];
  const now = Date.now();

  return (
    <AuthenticatedLayout>
      <AdminPageChrome
        width="narrow"
        icon={<Megaphone />}
        breadcrumbs={[{ label: 'System' }, { label: 'Announcements' }]}
        title="Announcements"
        description="Active announcements appear as a banner in every tenant dashboard."
      >
        <div className="space-y-6">
          <SectionCard icon={<PenSquare />} title="New announcement" description="Published immediately to every tenant">
            <div className="space-y-4">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title (e.g. Scheduled maintenance Saturday 02:00–04:00 UTC)"
                className={inputClass}
              />
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Details shown under the title…"
                rows={3}
                className={inputClass}
              />
              <div className="flex flex-wrap items-center gap-3">
                <Segmented
                  size="sm"
                  ariaLabel="Severity"
                  options={SEVERITIES.map(([value, label]) => ({ value, label }))}
                  value={severity}
                  onChange={setSeverity}
                />
                <label className="flex items-center gap-2 text-sm text-admin-secondary">
                  Ends
                  <input
                    type="datetime-local"
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                    className={cn(inputClass, 'w-auto py-1.5')}
                  />
                  <span className="text-xs text-admin-muted">(empty = until deactivated)</span>
                </label>
                <button
                  onClick={() => create.mutate({
                    title, body, severity,
                    endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
                  })}
                  disabled={create.isPending || !title.trim() || !body.trim()}
                  className={`${buttonClass.primary} ml-auto`}
                >
                  {create.isPending ? 'Publishing…' : 'Publish to all tenants'}
                </button>
              </div>
              {error && (
                <p className="rounded-admin-sm border border-admin-danger/20 bg-admin-danger-soft px-3 py-2 text-sm text-red-700">{error}</p>
              )}
            </div>
          </SectionCard>

          <SectionCard icon={<History />} title="History" description="Every announcement, newest first" padded={false}>
            {list.isLoading ? (
              <p className="px-5 py-6 text-sm text-admin-muted">Loading…</p>
            ) : rows.length === 0 ? (
              <EmptyState compact className="border-0 shadow-none" icon={<Megaphone />} title="No announcements yet." />
            ) : (
              <div className="divide-y divide-admin-border">
                {rows.map((a) => {
                  const live = a.active
                    && new Date(a.startsAt).getTime() <= now
                    && (!a.endsAt || new Date(a.endsAt).getTime() > now);
                  return (
                    <div key={a.id} className="flex flex-wrap items-start gap-3 px-5 py-4">
                      <StatusPill tone={SEVERITY_TONE[a.severity] ?? 'neutral'} dot={false} className="shrink-0">
                        {a.severity}
                      </StatusPill>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-admin-ink">
                          {a.title}
                          {live && <StatusPill tone="success" className="ml-2">live</StatusPill>}
                        </p>
                        <p className="mt-0.5 whitespace-pre-wrap text-sm text-admin-secondary">{a.body}</p>
                        <p className="mt-1 text-xs text-admin-muted">
                          {new Date(a.startsAt).toLocaleString()}
                          {a.endsAt ? ` → ${new Date(a.endsAt).toLocaleString()}` : ' → until deactivated'}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          onClick={() => update.mutate({ id: a.id, active: !a.active })}
                          disabled={update.isPending}
                          className={buttonClass.small}
                        >
                          {a.active ? 'Deactivate' : 'Reactivate'}
                        </button>
                        {isSuperAdmin && (
                          <button
                            onClick={() => remove.mutate({ id: a.id })}
                            disabled={remove.isPending}
                            className={cn(buttonClass.small, 'border-red-200 text-red-700 hover:border-red-300 hover:bg-red-50')}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>
      </AdminPageChrome>
    </AuthenticatedLayout>
  );
}

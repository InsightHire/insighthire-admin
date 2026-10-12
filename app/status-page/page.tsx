'use client';
export const dynamic = 'force-dynamic';

/**
 * Public status page controls: live component checks, posting and updating
 * incidents shown on insighthire.com/status, the internal incident record
 * (root cause, corrective actions; never public) and SLA publication.
 */
import { useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, ExternalLink, FileText, Megaphone } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { AdminPageChrome } from '@/components/admin/page-chrome';
import { SectionCard } from '@/components/admin/section-card';
import { StatusPill, type StatusTone } from '@/components/admin/status-pill';
import { EmptyState } from '@/components/admin/empty-state';
import { buttonClass, checkboxClass, inputClass, selectClass } from '@/components/admin/controls';

const IMPACTS = ['none', 'minor', 'major', 'critical'] as const;
const STATUSES = ['investigating', 'identified', 'monitoring', 'resolved'] as const;
const SEVERITIES = ['sev1', 'sev2', 'sev3', 'sev4'] as const;

const STATE_TONE: Record<string, StatusTone> = {
  operational: 'success',
  degraded: 'warn',
  partial_outage: 'warn',
  major_outage: 'danger',
  unknown: 'neutral',
};
const STATE_LABEL: Record<string, string> = {
  operational: 'Operational',
  degraded: 'Degraded',
  partial_outage: 'Partial outage',
  major_outage: 'Major outage',
  unknown: 'No data',
};

type Incident = {
  id: string;
  title: string;
  impact: string;
  status: string;
  components: string[];
  isPublic: boolean;
  severity: string;
  startedAt: string;
  resolvedAt: string | null;
  rootCause: string | null;
  correctiveActions: string | null;
  postmortemUrl: string | null;
  updates: Array<{ id: string; status: string; message: string; createdBy: string | null; createdAt: string }>;
};

function NewIncident({ components, onDone }: { components: Array<{ id: string; name: string }>; onDone: () => void }) {
  const [title, setTitle] = useState('');
  const [impact, setImpact] = useState<(typeof IMPACTS)[number]>('minor');
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>('sev2');
  const [picked, setPicked] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const create = (trpc as any).platformTrust.createIncident.useMutation({
    onSuccess: () => {
      setTitle('');
      setMessage('');
      setPicked([]);
      onDone();
    },
  });
  return (
    <form
      className="space-y-3 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate({ title, impact, severity, components: picked, message, isPublic, status: 'investigating' });
      }}
    >
      <input className={inputClass} placeholder="Title, e.g. Slow video uploads" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} />
      <div className="flex flex-wrap gap-3">
        <label className="text-xs text-admin-muted">
          Public impact
          <select className={`${selectClass} mt-1`} value={impact} onChange={(e) => setImpact(e.target.value as any)}>
            {IMPACTS.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-admin-muted">
          Internal severity
          <select className={`${selectClass} mt-1`} value={severity} onChange={(e) => setSeverity(e.target.value as any)}>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <div className="text-xs text-admin-muted">
          Affected
          <div className="mt-2 flex flex-wrap gap-3">
            {components.map((c) => (
              <label key={c.id} className="inline-flex items-center gap-1.5 text-sm text-admin-ink">
                <input
                  type="checkbox"
                  className={checkboxClass}
                  checked={picked.includes(c.id)}
                  onChange={(e) => setPicked((p) => (e.target.checked ? [...p, c.id] : p.filter((x) => x !== c.id)))}
                />
                {c.name}
              </label>
            ))}
          </div>
        </div>
      </div>
      <textarea className={`${inputClass} h-24`} placeholder="First public update: what customers see and what we're doing" value={message} onChange={(e) => setMessage(e.target.value)} required minLength={3} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex items-center gap-2 text-sm text-admin-ink">
          <input type="checkbox" className={checkboxClass} checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
          Show on the public status page
        </label>
        <div className="flex items-center gap-3">
          {create.error && <span className="text-sm text-admin-danger">{create.error.message}</span>}
          <button type="submit" className={buttonClass.primary} disabled={create.isLoading}>
            <Megaphone className="h-4 w-4" />
            Post incident
          </button>
        </div>
      </div>
    </form>
  );
}

function IncidentRow({ incident, onDone }: { incident: Incident; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<string>(incident.status);
  const [message, setMessage] = useState('');
  const [rootCause, setRootCause] = useState(incident.rootCause ?? '');
  const [actions, setActions] = useState(incident.correctiveActions ?? '');
  const [postmortemUrl, setPostmortemUrl] = useState(incident.postmortemUrl ?? '');
  const post = (trpc as any).platformTrust.postIncidentUpdate.useMutation({ onSuccess: () => { setMessage(''); onDone(); } });
  const record = (trpc as any).platformTrust.updateIncidentRecord.useMutation({ onSuccess: onDone });
  return (
    <div className="px-5 py-3.5">
      <button type="button" className="flex w-full items-start gap-3 text-left" onClick={() => setOpen((o) => !o)}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={incident.resolvedAt ? 'neutral' : incident.impact === 'major' || incident.impact === 'critical' ? 'danger' : 'warn'}>{incident.status}</StatusPill>
            <p className="text-sm font-medium text-admin-ink">{incident.title}</p>
            {!incident.isPublic && <StatusPill tone="info">Internal only</StatusPill>}
          </div>
          <p className="mt-1 text-xs text-admin-muted">
            {incident.severity} · impact {incident.impact} · {incident.components.join(', ') || 'no components'} · started {new Date(incident.startedAt).toLocaleString()}
            {incident.resolvedAt && ` · resolved ${new Date(incident.resolvedAt).toLocaleString()}`}
          </p>
        </div>
      </button>
      {open && (
        <div className="mt-3 space-y-4">
          <ol className="space-y-2 border-l border-admin-border pl-4">
            {incident.updates.map((u) => (
              <li key={u.id} className="text-sm">
                <span className="font-medium text-admin-ink">{u.status}</span>{' '}
                <span className="text-xs text-admin-muted">
                  {new Date(u.createdAt).toLocaleString()}
                  {u.createdBy && ` · ${u.createdBy}`}
                </span>
                <p className="text-admin-secondary">{u.message}</p>
              </li>
            ))}
          </ol>
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              post.mutate({ incidentId: incident.id, status, message });
            }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-admin-muted">Post a public update</p>
            <div className="flex flex-wrap gap-2">
              <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <input className={`${inputClass} min-w-[16rem] flex-1`} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What changed" required minLength={3} />
              <button type="submit" className={buttonClass.secondary} disabled={post.isLoading}>
                Post update
              </button>
            </div>
            {post.error && <p className="text-sm text-admin-danger">{post.error.message}</p>}
          </form>
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              record.mutate({ incidentId: incident.id, rootCause: rootCause || null, correctiveActions: actions || null, postmortemUrl: postmortemUrl || null });
            }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-admin-muted">Internal incident record (never public)</p>
            <textarea className={`${inputClass} h-20`} placeholder="Root cause" value={rootCause} onChange={(e) => setRootCause(e.target.value)} />
            <textarea className={`${inputClass} h-20`} placeholder="Corrective actions and owners" value={actions} onChange={(e) => setActions(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              <input className={`${inputClass} min-w-[16rem] flex-1`} placeholder="Postmortem URL" value={postmortemUrl} onChange={(e) => setPostmortemUrl(e.target.value)} />
              <button type="submit" className={buttonClass.secondary} disabled={record.isLoading}>
                Save record
              </button>
              <button
                type="button"
                className={buttonClass.small}
                onClick={() => record.mutate({ incidentId: incident.id, isPublic: !incident.isPublic })}
              >
                {incident.isPublic ? 'Hide from public page' : 'Show on public page'}
              </button>
            </div>
            {record.error && <p className="text-sm text-admin-danger">{record.error.message}</p>}
          </form>
        </div>
      )}
    </div>
  );
}

export default function StatusPageAdmin() {
  useAdminAuth();
  const overview = (trpc as any).platformTrust.statusOverview.useQuery(undefined, { refetchInterval: 60_000 });
  const publish = (trpc as any).platformTrust.setSlaPublished.useMutation({
    onSuccess: () => overview.refetch(),
    onError: (e: { message: string }) => alert(e.message),
  });
  const data = overview.data;
  const incidents: Incident[] = data?.incidents ?? [];
  const sla = data?.sla;

  return (
    <AuthenticatedLayout>
      <AdminPageChrome
        icon={<Activity />}
        breadcrumbs={[{ label: 'Operations' }, { label: 'Status page' }]}
        title="Status page"
        description="Live checks for web, API, VMS and admin every minute. Incidents you post here show on insighthire.com/status."
        actions={
          <a href="https://www.insighthire.com/status" target="_blank" rel="noreferrer" className={buttonClass.secondary}>
            <ExternalLink className="h-4 w-4" />
            Open public page
          </a>
        }
      >
        {overview.isLoading ? (
          <p className="text-sm text-admin-muted">Loading…</p>
        ) : overview.error ? (
          <p className="text-sm text-admin-danger">{overview.error.message}</p>
        ) : (
          <div className="space-y-6">
            <SectionCard icon={<Activity />} title="Components" description="Last check and uptime from the API's probes">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {(data?.status?.components ?? []).map((c: any) => (
                  <div key={c.id} className="rounded-admin-sm border border-admin-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-admin-ink">{c.name}</p>
                      <StatusPill tone={STATE_TONE[c.state] ?? 'neutral'}>{STATE_LABEL[c.state] ?? c.state}</StatusPill>
                    </div>
                    <p className="mt-2 text-xs text-admin-muted">
                      30 days: {c.uptime30 == null ? '—' : `${c.uptime30.toFixed(2)}%`} · 90 days: {c.uptime90 == null ? '—' : `${c.uptime90.toFixed(2)}%`}
                    </p>
                    <p className="text-xs text-admin-muted">Checked {c.lastCheckedAt ? new Date(c.lastCheckedAt).toLocaleTimeString() : 'never'}</p>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard icon={<Megaphone />} title="Post an incident" padded={false}>
              <NewIncident components={data?.components ?? []} onDone={() => overview.refetch()} />
            </SectionCard>

            <SectionCard icon={<AlertTriangle />} title="Incidents" description="Newest first. Click one to post updates or fill in the internal record." padded={false}>
              {incidents.length === 0 ? (
                <EmptyState compact className="border-0 shadow-none" icon={<CheckCircle2 />} title="No incidents posted." />
              ) : (
                <div className="divide-y divide-admin-border">
                  {incidents.map((i) => (
                    <IncidentRow key={i.id} incident={i} onDone={() => overview.refetch()} />
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard
              icon={<FileText />}
              title="SLA page"
              description="insighthire.com/sla stays hidden until the owner approves these numbers. Publishing needs a super admin."
            >
              <div className="space-y-3 text-sm text-admin-secondary">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill tone={sla?.published ? 'success' : 'warn'}>{sla?.published ? 'Published' : 'Draft (hidden)'}</StatusPill>
                  <span>Policy version {sla?.policy?.version}</span>
                  {sla?.approvedBy && (
                    <span className="text-xs text-admin-muted">
                      Approved by {sla.approvedBy}
                      {sla.approvedAt && ` on ${new Date(sla.approvedAt).toLocaleDateString()}`}
                    </span>
                  )}
                </div>
                <p>
                  Uptime target {sla?.policy?.uptime?.monthlyTargetPercent}% a month. Response targets by tier and severity:
                </p>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="text-left text-admin-muted">
                        <th className="py-1 pr-4">Tier</th>
                        {(sla?.policy?.severities ?? []).map((s: any) => (
                          <th key={s.id} className="py-1 pr-4">
                            {s.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(sla?.policy?.tiers ?? []).map((t: any) => (
                        <tr key={t.id} className="border-t border-admin-border">
                          <td className="py-1.5 pr-4 font-medium text-admin-ink">{t.label}</td>
                          {t.targets.map((x: any) => (
                            <td key={x.severity} className="py-1.5 pr-4">
                              {x.firstResponse} / {x.resolution}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-1 text-xs text-admin-muted">First response / resolution target.</p>
                </div>
                <button
                  type="button"
                  className={sla?.published ? buttonClass.secondary : buttonClass.primary}
                  disabled={publish.isLoading}
                  onClick={() => {
                    const next = !sla?.published;
                    if (confirm(next ? 'Publish the SLA? These numbers become customer-facing on insighthire.com/sla.' : 'Hide the SLA page again?')) publish.mutate({ published: next });
                  }}
                >
                  {sla?.published ? 'Unpublish SLA' : 'Approve and publish SLA'}
                </button>
              </div>
            </SectionCard>
          </div>
        )}
      </AdminPageChrome>
    </AuthenticatedLayout>
  );
}

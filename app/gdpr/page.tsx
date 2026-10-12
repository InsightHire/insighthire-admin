'use client';

import { useState } from 'react';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { trpc } from '@/lib/trpc';
import {
  Shield,
  Download,
  Trash2,
  Clock,
  CheckCircle,
  AlertTriangle,
  FileText,
  Users,
  Database,
  ShieldAlert,
  Settings,
  ScrollText,
} from 'lucide-react';
import { ConsentDisclaimerPanel } from '@/components/gdpr/consent-disclaimer-panel';
import { VmsPrivacyPanel } from '@/components/gdpr/vms-privacy-panel';
import { cn } from '@/lib/cn';
import { AdminPageChrome } from '@/components/admin/page-chrome';
import { SectionCard } from '@/components/admin/section-card';
import { StatGrid, StatTile } from '@/components/admin/stat-tile';
import { StatusPill, type StatusTone } from '@/components/admin/status-pill';
import { EmptyState } from '@/components/admin/empty-state';
import { Segmented } from '@/components/admin/segmented';
import { DataTableEl, Th, Td } from '@/components/admin/data-table';
import { buttonClass, inputClass, selectClass } from '@/components/admin/controls';

type RequestStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'DENIED';
type RequestType = 'ACCESS' | 'ERASURE' | 'RECTIFICATION' | 'PORTABILITY' | 'RESTRICTION' | 'OBJECTION';

const STATUS_STYLES: Record<RequestStatus, { tone: StatusTone; icon: typeof Clock }> = {
  PENDING: { tone: 'warn', icon: Clock },
  IN_PROGRESS: { tone: 'info', icon: Clock },
  COMPLETED: { tone: 'success', icon: CheckCircle },
  DENIED: { tone: 'danger', icon: AlertTriangle },
};

const TYPE_ICONS: Record<RequestType, typeof Download> = {
  ACCESS: FileText,
  ERASURE: Trash2,
  RECTIFICATION: FileText,
  PORTABILITY: Download,
  RESTRICTION: Shield,
  OBJECTION: AlertTriangle,
};

export default function GDPRDashboardPage() {
  const [statusFilter, setStatusFilter] = useState<RequestStatus | ''>('');
  const [newRequestEmail, setNewRequestEmail] = useState('');
  const [newRequestType, setNewRequestType] = useState<RequestType>('ACCESS');
  const [showNewForm, setShowNewForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'requests' | 'vms' | 'breach' | 'retention' | 'consent'>('requests');

  // Breach form state
  const [breachForm, setBreachForm] = useState({
    title: '',
    description: '',
    affectedDataCategories: '' as string,
    estimatedAffectedCount: 0,
    severity: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    containmentActions: '' as string,
  });
  const [breachSubmitted, setBreachSubmitted] = useState(false);

  const requestsQuery = trpc.gdpr.listAllRequests.useQuery(
    statusFilter ? { status: statusFilter as RequestStatus } : undefined,
    { retry: false }
  );

  const fulfillMutation = trpc.gdpr.fulfillAnyRequest.useMutation({
    onSuccess: () => requestsQuery.refetch(),
  });

  const breachMutation = trpc.gdpr.reportBreach.useMutation({
    onSuccess: () => {
      setBreachSubmitted(true);
      setBreachForm({ title: '', description: '', affectedDataCategories: '', estimatedAffectedCount: 0, severity: 'MEDIUM', containmentActions: '' });
    },
  });

  const retentionQuery = trpc.gdpr.getRetentionPolicies.useQuery(undefined, { retry: false });
  const seedRetention = trpc.gdpr.seedRetentionDefaults.useMutation({
    onSuccess: () => retentionQuery.refetch(),
  });

  const requests = requestsQuery.data || [];

  const stats = {
    total: requests.length,
    pending: requests.filter((r: any) => r.status === 'PENDING').length,
    overdue: requests.filter((r: any) => r.status === 'PENDING' && new Date(r.dueBy) < new Date()).length,
    completed: requests.filter((r: any) => r.status === 'COMPLETED').length,
  };

  const labelClass = 'mb-1 block text-xs font-medium text-admin-secondary';

  return (
    <AuthenticatedLayout>
      <AdminPageChrome
        icon={<Shield />}
        breadcrumbs={[{ label: 'System' }, { label: 'GDPR' }]}
        title="GDPR & Data Privacy"
        description="Manage data subject requests, retention policies, and compliance obligations"
      >
        {/* Stats */}
        <StatGrid cols={4} className="mb-6">
          <StatTile label="Total Requests" value={stats.total} icon={Database} tone="brand" />
          <StatTile label="Pending" value={stats.pending} icon={Clock} tone={stats.pending > 0 ? 'warn' : 'muted'} />
          <StatTile label="Overdue" value={stats.overdue} icon={AlertTriangle} tone={stats.overdue > 0 ? 'critical' : 'muted'} />
          <StatTile label="Completed" value={stats.completed} icon={CheckCircle} tone="ok" />
        </StatGrid>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 overflow-x-auto border-b border-admin-border">
          {([
            { key: 'requests' as const, label: 'Data Requests', icon: FileText },
            { key: 'vms' as const, label: 'Agency users & workers', icon: Users },
            { key: 'consent' as const, label: 'Candidate consent', icon: ScrollText },
            { key: 'breach' as const, label: 'Breach Reporting', icon: ShieldAlert },
            { key: 'retention' as const, label: 'Retention Policies', icon: Settings },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              aria-current={activeTab === tab.key ? 'page' : undefined}
              className={cn(
                'relative flex items-center gap-2 whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-colors',
                activeTab === tab.key ? 'text-admin-accent-ink' : 'text-admin-muted hover:text-admin-ink',
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {activeTab === tab.key ? (
                <span className="nav-indicator absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-admin-accent" />
              ) : null}
            </button>
          ))}
        </div>

        {/* ──────── Data Requests Tab ──────── */}
        {activeTab === 'requests' && (<div className="space-y-6">

        {/* New Request Form */}
        {showNewForm && (
          <SectionCard
            icon={<FileText />}
            title="Create Data Subject Request"
            footer="GDPR requires response within 30 days. The due date is set automatically."
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Subject Email</label>
                <input
                  type="email"
                  value={newRequestEmail}
                  onChange={e => setNewRequestEmail(e.target.value)}
                  className={inputClass}
                  placeholder="candidate@example.com"
                />
              </div>
              <div>
                <label className={labelClass}>Request Type</label>
                <select
                  value={newRequestType}
                  onChange={e => setNewRequestType(e.target.value as RequestType)}
                  className={`${selectClass} w-full`}
                >
                  <option value="ACCESS">Right of Access (Art. 15)</option>
                  <option value="ERASURE">Right to Erasure (Art. 17)</option>
                  <option value="PORTABILITY">Data Portability (Art. 20)</option>
                  <option value="RECTIFICATION">Rectification (Art. 16)</option>
                  <option value="RESTRICTION">Restriction (Art. 18)</option>
                  <option value="OBJECTION">Objection (Art. 21)</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  disabled={!newRequestEmail}
                  className={`${buttonClass.primary} w-full`}
                >
                  Create Request
                </button>
              </div>
            </div>
          </SectionCard>
        )}

        {/* Requests Table */}
        <SectionCard
          icon={<Users />}
          title="Data subject requests"
          padded={false}
          actions={
            <>
              <Segmented<RequestStatus | ''>
                size="sm"
                ariaLabel="Filter by status"
                options={(['', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'DENIED'] as const).map(status => ({
                  value: status,
                  label: status || 'All',
                }))}
                value={statusFilter}
                onChange={setStatusFilter}
              />
              <button
                onClick={() => setShowNewForm(!showNewForm)}
                className={buttonClass.primary}
              >
                + New Request
              </button>
            </>
          }
        >
          {requests.length === 0 ? (
            <EmptyState
              compact
              className="border-0 shadow-none"
              icon={<Users />}
              title="No data subject requests found."
            />
          ) : (
            <div className="overflow-x-auto">
              <DataTableEl>
                <thead>
                  <tr>
                    <Th className="px-6">Type</Th>
                    <Th className="px-6">Subject</Th>
                    <Th className="px-6">Status</Th>
                    <Th className="px-6">Requested</Th>
                    <Th className="px-6">Due By</Th>
                    <Th className="px-6 text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req: any) => {
                    const statusStyle = STATUS_STYLES[req.status as RequestStatus] || STATUS_STYLES.PENDING;
                    const TypeIcon = TYPE_ICONS[req.type as RequestType] || FileText;
                    const isOverdue = req.status === 'PENDING' && new Date(req.dueBy) < new Date();

                    return (
                      <tr key={req.id} className={isOverdue ? 'bg-red-50' : ''}>
                        <Td className="px-6">
                          <div className="flex items-center gap-2">
                            <TypeIcon className="h-4 w-4 text-admin-muted" />
                            <span className="text-sm font-medium text-admin-ink">{req.type}</span>
                          </div>
                        </Td>
                        <Td className="px-6">{req.subjectEmail}</Td>
                        <Td className="px-6">
                          <StatusPill tone={statusStyle.tone}>
                            {req.status}
                            {isOverdue && <AlertTriangle className="h-3 w-3" />}
                          </StatusPill>
                        </Td>
                        <Td className="px-6">
                          {new Date(req.requestedAt).toLocaleDateString()}
                        </Td>
                        <Td className="px-6">
                          <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                            {new Date(req.dueBy).toLocaleDateString()}
                          </span>
                        </Td>
                        <Td className="px-6 text-right">
                          {req.status === 'PENDING' && (
                            <button
                              onClick={() => fulfillMutation.mutate({ requestId: req.id })}
                              disabled={fulfillMutation.isPending}
                              className="text-sm font-medium text-admin-accent hover:text-admin-accent-ink disabled:opacity-50"
                            >
                              Fulfill
                            </button>
                          )}
                          {req.status === 'COMPLETED' && req.exportUrl && (
                            <span className="text-sm text-green-600">Exported</span>
                          )}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </DataTableEl>
            </div>
          )}
        </SectionCard>

        </div>)}

        {/* ──────── Candidate Consent Tab ──────── */}
        {activeTab === 'vms' && <VmsPrivacyPanel />}

        {activeTab === 'consent' && <ConsentDisclaimerPanel />}

        {/* ──────── Breach Reporting Tab ──────── */}
        {activeTab === 'breach' && (
          <SectionCard
            icon={<ShieldAlert />}
            title="Report Data Breach (GDPR Art. 33–34)"
            description="Breaches must be reported to the supervisory authority within 72 hours of discovery."
          >
            {breachSubmitted ? (
              <EmptyState
                compact
                className="border-0 shadow-none"
                icon={<CheckCircle className="text-green-600" />}
                title="Breach Report Filed"
                description="The breach has been logged and affected users will be notified according to GDPR Art. 34."
                action={
                  <button onClick={() => setBreachSubmitted(false)} className={buttonClass.primary}>
                    File Another Report
                  </button>
                }
              />
            ) : (
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Breach Title</label>
                  <input
                    value={breachForm.title}
                    onChange={e => setBreachForm(f => ({ ...f, title: e.target.value }))}
                    className={inputClass}
                    placeholder="e.g. Unauthorized access to candidate database"
                  />
                </div>
                <div>
                  <label className={labelClass}>Description</label>
                  <textarea
                    value={breachForm.description}
                    onChange={e => setBreachForm(f => ({ ...f, description: e.target.value }))}
                    rows={3}
                    className={inputClass}
                    placeholder="Describe the nature of the breach, how it was discovered, and what data was affected..."
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Affected Data Categories</label>
                    <input
                      value={breachForm.affectedDataCategories}
                      onChange={e => setBreachForm(f => ({ ...f, affectedDataCategories: e.target.value }))}
                      className={inputClass}
                      placeholder="e.g. Names, Emails, Video recordings (comma-separated)"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Estimated Affected Count</label>
                    <input
                      type="number"
                      value={breachForm.estimatedAffectedCount}
                      onChange={e => setBreachForm(f => ({ ...f, estimatedAffectedCount: parseInt(e.target.value) || 0 }))}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Severity</label>
                    <select
                      value={breachForm.severity}
                      onChange={e => setBreachForm(f => ({ ...f, severity: e.target.value as typeof f.severity }))}
                      className={`${selectClass} w-full`}
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="CRITICAL">Critical</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Containment Actions Taken</label>
                    <input
                      value={breachForm.containmentActions}
                      onChange={e => setBreachForm(f => ({ ...f, containmentActions: e.target.value }))}
                      className={inputClass}
                      placeholder="e.g. Revoked access, Reset credentials (comma-separated)"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => breachMutation.mutate({
                      ...breachForm,
                      affectedDataCategories: breachForm.affectedDataCategories.split(',').map(s => s.trim()).filter(Boolean),
                      containmentActions: breachForm.containmentActions.split(',').map(s => s.trim()).filter(Boolean),
                    })}
                    disabled={breachMutation.isPending || !breachForm.title || !breachForm.description}
                    className={buttonClass.danger}
                  >
                    {breachMutation.isPending ? 'Submitting...' : 'File Breach Report'}
                  </button>
                </div>
                {breachMutation.isError && (
                  <p className="text-sm text-red-600">Error: {breachMutation.error.message}</p>
                )}
              </div>
            )}
          </SectionCard>
        )}

        {/* ──────── Retention Policies Tab ──────── */}
        {activeTab === 'retention' && (
          <SectionCard
            icon={<Settings />}
            title="Data Retention Policies (GDPR Art. 5(1)(e))"
            description="Automated enforcement runs daily at 3 AM UTC. Data past retention is deleted or anonymized."
            padded={false}
            actions={
              (!retentionQuery.data || retentionQuery.data.length === 0) && (
                <button
                  onClick={() => seedRetention.mutate()}
                  disabled={seedRetention.isPending}
                  className={buttonClass.primary}
                >
                  {seedRetention.isPending ? 'Seeding...' : 'Initialize Defaults'}
                </button>
              )
            }
          >
            {retentionQuery.data && retentionQuery.data.length > 0 ? (
              <div className="overflow-x-auto">
                <DataTableEl>
                  <thead>
                    <tr>
                      <Th className="px-6">Category</Th>
                      <Th className="px-6">Retention</Th>
                      <Th className="px-6">Action</Th>
                      <Th className="px-6">Status</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {(retentionQuery.data as any[]).map((policy: any) => (
                      <tr key={policy.id}>
                        <Td className="px-6 font-medium text-admin-ink">{policy.dataCategory}</Td>
                        <Td className="px-6">
                          {policy.retentionDays} days ({Math.round(policy.retentionDays / 30)} months)
                        </Td>
                        <Td className="px-6">
                          <StatusPill tone={policy.action === 'DELETE' ? 'danger' : 'info'} dot={false}>
                            {policy.action}
                          </StatusPill>
                        </Td>
                        <Td className="px-6">
                          <StatusPill tone={policy.isDefault ? 'neutral' : 'success'} dot={false}>
                            {policy.isDefault ? 'Default' : 'Custom'}
                          </StatusPill>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </DataTableEl>
              </div>
            ) : (
              <EmptyState
                compact
                className="border-0 shadow-none"
                icon={<Database />}
                title="No retention policies configured."
                description={<>Click &quot;Initialize Defaults&quot; to set up standard policies.</>}
              />
            )}
          </SectionCard>
        )}

        {/* Compliance Checklist */}
        <SectionCard className="mt-6" icon={<CheckCircle />} title="GDPR Compliance Checklist">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
            <CheckItem done label="Privacy Policy published" />
            <CheckItem done label="Cookie consent banner active" />
            <CheckItem done label="Cookie Policy published" />
            <CheckItem done label="Sub-processor list disclosed" />
            <CheckItem done label="Candidate consent gate built" />
            <CheckItem done label="Data Subject Request system built" />
            <CheckItem done label="Right to Erasure (hard delete) implemented" />
            <CheckItem done label="Data export / portability endpoint" />
            <CheckItem done label="Field-level PII encryption (opt-in)" />
            <CheckItem done label="Log sanitization (PII redaction)" />
            <CheckItem done label="Email unsubscribe enforcement" />
            <CheckItem done label="Candidate self-service data portal" />
            <CheckItem done label="Data breach reporting workflow" />
            <CheckItem done label="Data retention automation" />
            <CheckItem done={false} label="DPAs signed with all sub-processors" />
            <CheckItem done={false} label="DPIA for AI scoring completed" />
            <CheckItem done={false} label="Staff GDPR training completed" />
          </div>
        </SectionCard>
      </AdminPageChrome>
    </AuthenticatedLayout>
  );
}

function CheckItem({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      {done ? (
        <CheckCircle className="h-5 w-5 text-admin-ok flex-shrink-0" />
      ) : (
        <div className="h-5 w-5 rounded-full border-2 border-admin-border-strong flex-shrink-0" />
      )}
      <span className={`text-sm ${done ? 'text-admin-secondary' : 'text-admin-muted'}`}>{label}</span>
    </div>
  );
}

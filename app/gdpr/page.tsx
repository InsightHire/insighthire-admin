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

type RequestStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'DENIED';
type RequestType = 'ACCESS' | 'ERASURE' | 'RECTIFICATION' | 'PORTABILITY' | 'RESTRICTION' | 'OBJECTION';

const STATUS_STYLES: Record<RequestStatus, { bg: string; text: string; icon: typeof Clock }> = {
  PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Clock },
  IN_PROGRESS: { bg: 'bg-blue-100', text: 'text-blue-800', icon: Clock },
  COMPLETED: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle },
  DENIED: { bg: 'bg-red-100', text: 'text-red-800', icon: AlertTriangle },
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
  const [activeTab, setActiveTab] = useState<'requests' | 'breach' | 'retention' | 'consent'>('requests');

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

  const fulfillMutation = trpc.gdpr.fulfillRequest.useMutation({
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

  return (
    <AuthenticatedLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="h-7 w-7 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">GDPR & Data Privacy</h1>
          </div>
          <p className="text-gray-500">Manage data subject requests, retention policies, and compliance obligations</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Requests" value={stats.total} icon={Database} color="blue" />
          <StatCard label="Pending" value={stats.pending} icon={Clock} color="yellow" />
          <StatCard label="Overdue" value={stats.overdue} icon={AlertTriangle} color="red" />
          <StatCard label="Completed" value={stats.completed} icon={CheckCircle} color="green" />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
          {([
            { key: 'requests' as const, label: 'Data Requests', icon: FileText },
            { key: 'consent' as const, label: 'Candidate consent', icon: ScrollText },
            { key: 'breach' as const, label: 'Breach Reporting', icon: ShieldAlert },
            { key: 'retention' as const, label: 'Retention Policies', icon: Settings },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ──────── Data Requests Tab ──────── */}
        {activeTab === 'requests' && (<>

        {/* Filters */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Filter:</span>
            {(['', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'DENIED'] as const).map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {status || 'All'}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowNewForm(!showNewForm)}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            + New Request
          </button>
        </div>

        {/* New Request Form */}
        {showNewForm && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Create Data Subject Request</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Subject Email</label>
                <input
                  type="email"
                  value={newRequestEmail}
                  onChange={e => setNewRequestEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="candidate@example.com"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Request Type</label>
                <select
                  value={newRequestType}
                  onChange={e => setNewRequestType(e.target.value as RequestType)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
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
                  className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40"
                >
                  Create Request
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              GDPR requires response within 30 days. The due date is set automatically.
            </p>
          </div>
        )}

        {/* Requests Table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Subject</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Requested</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Due By</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500">
                    <Users className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    No data subject requests found.
                  </td>
                </tr>
              ) : (
                requests.map((req: any) => {
                  const statusStyle = STATUS_STYLES[req.status as RequestStatus] || STATUS_STYLES.PENDING;
                  const TypeIcon = TYPE_ICONS[req.type as RequestType] || FileText;
                  const isOverdue = req.status === 'PENDING' && new Date(req.dueBy) < new Date();

                  return (
                    <tr key={req.id} className={isOverdue ? 'bg-red-50' : ''}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <TypeIcon className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-900">{req.type}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{req.subjectEmail}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                          {req.status}
                          {isOverdue && <AlertTriangle className="h-3 w-3" />}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(req.requestedAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                          {new Date(req.dueBy).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {req.status === 'PENDING' && (
                          <button
                            onClick={() => fulfillMutation.mutate({ requestId: req.id })}
                            disabled={fulfillMutation.isPending}
                            className="text-sm text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
                          >
                            Fulfill
                          </button>
                        )}
                        {req.status === 'COMPLETED' && req.exportUrl && (
                          <span className="text-sm text-green-600">Exported</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        </>)}

        {/* ──────── Candidate Consent Tab ──────── */}
        {activeTab === 'consent' && <ConsentDisclaimerPanel />}

        {/* ──────── Breach Reporting Tab ──────── */}
        {activeTab === 'breach' && (
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <ShieldAlert className="h-5 w-5 text-red-600" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Report Data Breach (GDPR Art. 33–34)</h2>
                <p className="text-sm text-gray-500">
                  Breaches must be reported to the supervisory authority within 72 hours of discovery.
                </p>
              </div>
            </div>

            {breachSubmitted ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Breach Report Filed</h3>
                <p className="text-gray-600 mb-4">
                  The breach has been logged and affected users will be notified according to GDPR Art. 34.
                </p>
                <button
                  onClick={() => setBreachSubmitted(false)}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                >
                  File Another Report
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Breach Title</label>
                  <input
                    value={breachForm.title}
                    onChange={e => setBreachForm(f => ({ ...f, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-red-500 focus:border-red-500"
                    placeholder="e.g. Unauthorized access to candidate database"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={breachForm.description}
                    onChange={e => setBreachForm(f => ({ ...f, description: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-red-500 focus:border-red-500"
                    placeholder="Describe the nature of the breach, how it was discovered, and what data was affected..."
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Affected Data Categories</label>
                    <input
                      value={breachForm.affectedDataCategories}
                      onChange={e => setBreachForm(f => ({ ...f, affectedDataCategories: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="e.g. Names, Emails, Video recordings (comma-separated)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Affected Count</label>
                    <input
                      type="number"
                      value={breachForm.estimatedAffectedCount}
                      onChange={e => setBreachForm(f => ({ ...f, estimatedAffectedCount: parseInt(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
                    <select
                      value={breachForm.severity}
                      onChange={e => setBreachForm(f => ({ ...f, severity: e.target.value as typeof f.severity }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="CRITICAL">Critical</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Containment Actions Taken</label>
                    <input
                      value={breachForm.containmentActions}
                      onChange={e => setBreachForm(f => ({ ...f, containmentActions: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
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
                    className="px-6 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {breachMutation.isPending ? 'Submitting...' : 'File Breach Report'}
                  </button>
                </div>
                {breachMutation.isError && (
                  <p className="text-sm text-red-600">Error: {breachMutation.error.message}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ──────── Retention Policies Tab ──────── */}
        {activeTab === 'retention' && (
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Settings className="h-5 w-5 text-gray-600" />
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Data Retention Policies (GDPR Art. 5(1)(e))</h2>
                  <p className="text-sm text-gray-500">
                    Automated enforcement runs daily at 3 AM UTC. Data past retention is deleted or anonymized.
                  </p>
                </div>
              </div>
              {(!retentionQuery.data || retentionQuery.data.length === 0) && (
                <button
                  onClick={() => seedRetention.mutate()}
                  disabled={seedRetention.isPending}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {seedRetention.isPending ? 'Seeding...' : 'Initialize Defaults'}
                </button>
              )}
            </div>

            {retentionQuery.data && retentionQuery.data.length > 0 ? (
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Category</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Retention</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Action</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {(retentionQuery.data as any[]).map((policy: any) => (
                      <tr key={policy.id}>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{policy.dataCategory}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {policy.retentionDays} days ({Math.round(policy.retentionDays / 30)} months)
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                            policy.action === 'DELETE' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {policy.action}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                            policy.isDefault ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700'
                          }`}>
                            {policy.isDefault ? 'Default' : 'Custom'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Database className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No retention policies configured. Click &quot;Initialize Defaults&quot; to set up standard policies.</p>
              </div>
            )}
          </div>
        )}

        {/* Compliance Checklist */}
        <div className="mt-8 bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">GDPR Compliance Checklist</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
        </div>
      </div>
    </AuthenticatedLayout>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    red: 'bg-red-50 text-red-600',
    green: 'bg-green-50 text-green-600',
  };
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`p-3 rounded-xl ${colorMap[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function CheckItem({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      {done ? (
        <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
      ) : (
        <div className="h-5 w-5 rounded-full border-2 border-gray-300 flex-shrink-0" />
      )}
      <span className={`text-sm ${done ? 'text-gray-700' : 'text-gray-400'}`}>{label}</span>
    </div>
  );
}

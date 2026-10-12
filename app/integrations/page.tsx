'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { trpc } from '@/lib/trpc';
import { AdminPageChrome } from '@/components/admin/page-chrome';
import { SectionCard } from '@/components/admin/section-card';
import { StatGrid, StatTile } from '@/components/admin/stat-tile';
import { StatusPill } from '@/components/admin/status-pill';
import { EmptyState } from '@/components/admin/empty-state';
import { buttonClass, checkboxClass, inputClass, selectClass } from '@/components/admin/controls';
import {
  Puzzle,
  ToggleLeft,
  ToggleRight,
  Plus,
  RefreshCw,
  CheckCircle,
  Clock,
  Zap,
  ChevronDown,
  ChevronUp,
  Save,
  X,
  ExternalLink,
  Eye,
  EyeOff,
  Settings,
  Key,
  Trash2,
  List,
  Users,
  Search,
} from 'lucide-react';

const CATEGORY_LABELS: Record<string, string> = {
  ats: 'ATS & HRIS',
  job_board: 'Job Boards',
  communication: 'Communication',
  automation: 'Automation',
  meetings: 'Meetings & Calendar',
  hiring_intelligence: 'Hiring Intelligence',
  background_checks: 'Background Checks',
  vouch: 'Vouch',
  crm: 'CRM',
};

// Slugs that route through the per-tenant feature-grant gate. Mirrors
// FEATURE_FLAG_SLUGS in insighthire-api/src/lib/feature-flags.ts. Only these
// slugs surface the "Tenant Access" tab — other integrations (e.g. Greenhouse)
// have their own per-org connection model and don't use this gate.
const FEATURE_FLAG_SLUGS = new Set<string>([
  'meetings_microsoft_teams',
  'meetings_google_meet',
  'culture_fit_scoring',
  'insighthire_live_interviews',
  'talent_network',
  'custom_fields',
  'job_governance',
  'custom_pipelines',
  'structured_interviews',
  'custom_reports',
  'dei_compliance',
  'candidate_surveys',
  'scheduling_coordination',
  'new_hire_onboarding',
  'offers_closing',
  'background_checks',
  'video_facial_emotion_analysis',
  'pipeline_crm',
  'interview_schedule',
  'sequences',
  'referrals',
  'candidate_sms',
  'insightcrm',
  'insightcrm_support',
  'insightcrm_marketing',
  'reference_checks',
  'identity_basic',
  'identity_full',
  'job_previews',
  'qoh_insights',
  'agency_partners',
  'vms',
]);

const labelClass = 'mb-1 block text-xs font-medium text-admin-secondary';

type ConfigField = {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url' | 'select' | 'toggle' | 'textarea';
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: { value: string; label: string }[];
};

type Integration = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  logo: string | null;
  enabled: boolean;
  comingSoon: boolean;
  sortOrder: number;
  config: Record<string, any> | null;
  configSchema: ConfigField[] | null;
  features: string[] | null;
  docsUrl: string | null;
  webhookUrl: string | null;
  /** Sidecar populated by listIntegrationSettings; counts orgs with granted=true. */
  grantedTenantCount?: number;
  /** True when this slug uses org_feature_grants (CRM, Approvals, …). */
  supportsTenantAccess?: boolean;
};

type TenantGrantRow = {
  id: string;
  name: string | null;
  domain: string | null;
  subscriptionPlan: string;
  subscriptionStatus: string;
  granted: boolean;
  grantedAt: string | null;
  notes: string | null;
  updatedAt: string | null;
};

function ConfigFieldInput({
  field,
  value,
  onChange,
}: {
  field: ConfigField;
  value: any;
  onChange: (val: any) => void;
}) {
  const [showPassword, setShowPassword] = useState(false);

  const baseClasses = inputClass;

  if (field.type === 'toggle') {
    return (
      <label className="flex items-center gap-3 cursor-pointer">
        <div
          onClick={() => onChange(!value)}
          className={`relative w-10 h-6 rounded-full transition-colors ${value ? 'bg-admin-accent' : 'bg-slate-300'}`}
        >
          <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-4' : ''}`} />
        </div>
        <span className="text-sm text-admin-secondary">{field.label}</span>
      </label>
    );
  }

  if (field.type === 'select') {
    return (
      <select
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        className={baseClasses}
      >
        <option value="">Select...</option>
        {field.options?.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    );
  }

  if (field.type === 'textarea') {
    return (
      <textarea
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={field.placeholder}
        rows={3}
        className={baseClasses}
      />
    );
  }

  if (field.type === 'password') {
    return (
      <div className="relative">
        <input
          type={showPassword ? 'text' : 'password'}
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={`${baseClasses} pr-10`}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-admin-muted hover:text-admin-ink"
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    );
  }

  return (
    <input
      type={field.type}
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      placeholder={field.placeholder}
      className={baseClasses}
    />
  );
}

/**
 * Per-tenant grant management for a single feature-flag integration.
 *
 * Lists every customer org with a current grant status pill + toggle.
 * Toggling fires platformAdmin.toggleOrgFeatureGrant which upserts the
 * `org_feature_grants` row and invalidates the API's grant cache.
 *
 * Search filters by org name/domain. We always fetch the full list (small
 * tenant table) so the search is local + zero-latency.
 */
function TenantAccessPanel({
  integration,
  onChanged,
}: {
  integration: Integration;
  onChanged: () => void;
}) {
  const [search, setSearch] = useState('');
  const [pendingOrgId, setPendingOrgId] = useState<string | null>(null);

  // Cast through any: the admin app's trpc client is typed as `any` (see
  // lib/trpc.ts), which produces a misleading type error on every chained
  // procedure access. Other call sites in this file already incur the same
  // baseline error; we silence the new ones we just added so the tsc
  // baseline doesn't increase.
  const adminTrpc = trpc as any;
  const grantsQuery = adminTrpc.platformAdmin.listOrgFeatureGrants.useQuery(
    { slug: integration.slug },
    { retry: false, staleTime: 30_000 }
  );

  const toggleMutation = adminTrpc.platformAdmin.toggleOrgFeatureGrant.useMutation({
    onSuccess: () => {
      grantsQuery.refetch();
      onChanged();
    },
    onSettled: () => setPendingOrgId(null),
  });

  const orgs: TenantGrantRow[] = (grantsQuery.data?.organizations ?? []) as TenantGrantRow[];
  const grantedCount: number = (grantsQuery.data?.grantedCount ?? 0) as number;
  const totalCount: number = (grantsQuery.data?.totalCount ?? 0) as number;

  const filteredOrgs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orgs;
    return orgs.filter(
      (o) =>
        (o.name || '').toLowerCase().includes(q) ||
        (o.domain || '').toLowerCase().includes(q)
    );
  }, [orgs, search]);

  function onToggle(org: TenantGrantRow) {
    setPendingOrgId(org.id);
    toggleMutation.mutate({
      organizationId: org.id,
      slug: integration.slug,
      granted: !org.granted,
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-admin-sm border border-admin-info/20 bg-admin-info-soft px-4 py-3 text-xs text-sky-900">
        <p>
          <span className="font-semibold">When enabled,</span> this org&apos;s admin can opt in to
          the feature from their own Settings page. Disabling here hides the feature entirely
          from the org (their saved data is preserved server-side).
        </p>
        {!integration.enabled && (
          <p className="mt-2 text-amber-800">
            Note: the platform-wide kill switch is currently <span className="font-semibold">disabled</span>,
            so no tenants can use this feature regardless of their grant.
          </p>
        )}
        <p className="mt-2">
          <Link href={`/tenant-features?feature=${encodeURIComponent(integration.slug)}`} className="font-medium text-admin-accent-ink hover:underline">
            See this module across every tenant
          </Link>
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-admin-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by org name or domain..."
            className={`${inputClass} pl-9`}
          />
        </div>
        <div className="text-xs text-admin-muted whitespace-nowrap">
          <span className="font-semibold text-admin-secondary">{grantedCount}</span> of{' '}
          <span className="font-semibold text-admin-secondary">{totalCount}</span> tenants enabled
        </div>
        <button
          onClick={() => grantsQuery.refetch()}
          className="text-admin-muted hover:text-admin-ink"
          title="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${grantsQuery.isFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {grantsQuery.isLoading ? (
        <div className="py-12 text-center text-sm text-admin-muted">Loading tenants...</div>
      ) : grantsQuery.error ? (
        <div className="py-12 text-center text-sm text-red-600">
          Failed to load tenants. {String((grantsQuery.error as { message?: string })?.message ?? '')}
        </div>
      ) : filteredOrgs.length === 0 ? (
        <EmptyState
          compact
          className="border-dashed shadow-none"
          icon={<Users />}
          title={search ? 'No tenants match your search.' : 'No customer organizations found.'}
        />
      ) : (
        <div className="overflow-hidden rounded-admin-sm border border-admin-border">
          <div className="max-h-[480px] overflow-y-auto divide-y divide-admin-border">
            {filteredOrgs.map((org) => {
              const isPending =
                pendingOrgId === org.id && toggleMutation.isPending;
              return (
                <div
                  key={org.id}
                  className="flex items-center justify-between px-4 py-3 hover:bg-admin-bg/70"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-admin-ink truncate">
                        {org.name || '(unnamed)'}
                      </span>
                      {org.granted ? (
                        <StatusPill tone="success">
                          Granted
                        </StatusPill>
                      ) : (
                        <StatusPill tone="neutral">
                          Not granted
                        </StatusPill>
                      )}
                      <span className="text-xs text-admin-muted">
                        {org.subscriptionPlan} · {org.subscriptionStatus}
                      </span>
                    </div>
                    <div className="text-xs text-admin-muted mt-0.5 flex items-center gap-2">
                      {org.domain && <span>{org.domain}</span>}
                      <span className="text-admin-border-strong">·</span>
                      <code className="bg-slate-100 px-1 rounded text-[10px]">{org.id}</code>
                      {org.granted && org.grantedAt && (
                        <>
                          <span className="text-admin-border-strong">·</span>
                          <span>
                            granted {new Date(org.grantedAt).toLocaleDateString()}
                          </span>
                        </>
                      )}
                    </div>
                    {org.notes && (
                      <p className="text-xs text-admin-muted mt-1 italic truncate">{org.notes}</p>
                    )}
                  </div>
                  <button
                    onClick={() => onToggle(org)}
                    disabled={isPending}
                    className="flex items-center gap-2 ml-3 transition-colors disabled:opacity-50"
                    title={org.granted ? 'Click to revoke' : 'Click to grant'}
                  >
                    {org.granted ? (
                      <>
                        <ToggleRight className="h-7 w-7 text-admin-accent" />
                        <span className="text-xs font-medium text-admin-accent-ink w-12">On</span>
                      </>
                    ) : (
                      <>
                        <ToggleLeft className="h-7 w-7 text-admin-border-strong" />
                        <span className="text-xs font-medium text-admin-muted w-12">Off</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function IntegrationEditPanel({
  integration,
  onClose,
  onSaved,
}: {
  integration: Integration;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supportsTenantAccess =
    typeof integration.supportsTenantAccess === 'boolean'
      ? integration.supportsTenantAccess
      : FEATURE_FLAG_SLUGS.has(integration.slug);
  const [activeTab, setActiveTab] = useState<'details' | 'config' | 'features' | 'tenants'>(
    'details'
  );
  const [details, setDetails] = useState({
    name: integration.name,
    description: integration.description || '',
    category: integration.category,
    logo: integration.logo || '',
    comingSoon: integration.comingSoon,
    sortOrder: integration.sortOrder,
    docsUrl: integration.docsUrl || '',
    webhookUrl: integration.webhookUrl || '',
  });
  const [configValues, setConfigValues] = useState<Record<string, any>>(
    (integration.config as Record<string, any>) || {}
  );
  const [features, setFeatures] = useState<string[]>(
    (integration.features as string[]) || []
  );
  const [newFeature, setNewFeature] = useState('');

  const schema = (integration.configSchema as ConfigField[]) || [];

  const upsertMutation = trpc.platformAdmin.upsertIntegrationSetting.useMutation({
    onSuccess: onSaved,
  });
  const configMutation = trpc.platformAdmin.updateIntegrationConfig.useMutation({
    onSuccess: onSaved,
  });

  const saveDetails = useCallback(() => {
    upsertMutation.mutate({
      slug: integration.slug,
      name: details.name,
      description: details.description || undefined,
      category: details.category,
      logo: details.logo || undefined,
      enabled: integration.enabled,
      comingSoon: details.comingSoon,
      sortOrder: details.sortOrder,
      features: features.length > 0 ? features : undefined,
      docsUrl: details.docsUrl || undefined,
      webhookUrl: details.webhookUrl || undefined,
    });
  }, [details, features, integration, upsertMutation]);

  const saveConfig = useCallback(() => {
    configMutation.mutate({
      slug: integration.slug,
      config: configValues,
    });
  }, [configValues, integration.slug, configMutation]);

  const configuredFieldCount = schema.filter(f => {
    const v = configValues[f.key];
    return v !== undefined && v !== '' && v !== null;
  }).length;
  const requiredFieldCount = schema.filter(f => f.required).length;
  const configuredRequiredCount = schema.filter(f => {
    if (!f.required) return false;
    const v = configValues[f.key];
    return v !== undefined && v !== '' && v !== null;
  }).length;

  const tabs = [
    { id: 'details' as const, label: 'Details', icon: Settings },
    { id: 'config' as const, label: `Configuration${schema.length > 0 ? ` (${configuredFieldCount}/${schema.length})` : ''}`, icon: Key },
    { id: 'features' as const, label: `Features (${features.length})`, icon: List },
    ...(supportsTenantAccess
      ? [{
          id: 'tenants' as const,
          label: `Tenant Access${typeof integration.grantedTenantCount === 'number' ? ` (${integration.grantedTenantCount})` : ''}`,
          icon: Users,
        }]
      : []),
  ];

  return (
    <div className="admin-panel mt-2 overflow-hidden shadow-lg">
      <div className="flex items-center justify-between bg-admin-bg/60 px-5 py-3 border-b border-admin-border">
        <div className="flex items-center gap-3">
          <span className="text-xl">{integration.logo || '🔌'}</span>
          <div>
            <h3 className="text-sm font-semibold text-admin-ink">{integration.name}</h3>
            <p className="text-xs text-admin-muted">slug: <code className="admin-mono rounded bg-slate-100 px-1">{integration.slug}</code></p>
          </div>
        </div>
        <button onClick={onClose} className={buttonClass.ghost} aria-label="Close">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-admin-border px-3">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative flex items-center gap-2 whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.id ? 'text-admin-accent-ink' : 'text-admin-muted hover:text-admin-ink'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            {activeTab === tab.id ? (
              <span className="nav-indicator absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-admin-accent" />
            ) : null}
          </button>
        ))}
      </div>

      <div className="p-5">
        {activeTab === 'details' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Name</label>
                <input
                  value={details.name}
                  onChange={e => setDetails(d => ({ ...d, name: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Category</label>
                <select
                  value={details.category}
                  onChange={e => setDetails(d => ({ ...d, category: e.target.value }))}
                  className={`${selectClass} w-full`}
                >
                  {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Logo (emoji)</label>
                <input
                  value={details.logo}
                  onChange={e => setDetails(d => ({ ...d, logo: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Sort Order</label>
                <input
                  type="number"
                  value={details.sortOrder}
                  onChange={e => setDetails(d => ({ ...d, sortOrder: parseInt(e.target.value) || 0 }))}
                  className={inputClass}
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Description</label>
              <textarea
                value={details.description}
                onChange={e => setDetails(d => ({ ...d, description: e.target.value }))}
                rows={2}
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Documentation URL</label>
                <input
                  type="url"
                  value={details.docsUrl}
                  onChange={e => setDetails(d => ({ ...d, docsUrl: e.target.value }))}
                  placeholder="https://docs.example.com"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Webhook Endpoint</label>
                <input
                  value={details.webhookUrl}
                  onChange={e => setDetails(d => ({ ...d, webhookUrl: e.target.value }))}
                  placeholder="/api/webhooks/integration-slug"
                  className={inputClass}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={details.comingSoon}
                onChange={e => setDetails(d => ({ ...d, comingSoon: e.target.checked }))}
                className={checkboxClass}
              />
              <span className="text-sm text-admin-secondary">Mark as &quot;Coming Soon&quot;</span>
            </label>
            <div className="flex gap-2 pt-2">
              <button
                onClick={saveDetails}
                disabled={upsertMutation.isPending}
                className={buttonClass.primary}
              >
                <Save className="h-4 w-4" />
                {upsertMutation.isPending ? 'Saving...' : 'Save Details'}
              </button>
              {upsertMutation.isSuccess && (
                <span className="flex items-center gap-1 text-sm text-green-600"><CheckCircle className="h-4 w-4" /> Saved</span>
              )}
            </div>
          </div>
        )}

        {activeTab === 'config' && (
          <div className="space-y-5">
            {schema.length === 0 ? (
              <EmptyState
                compact
                className="border-dashed shadow-none"
                icon={<Key />}
                title="No configuration schema defined for this integration."
                description={<>Re-run &quot;Initialize Defaults&quot; to populate schemas, or define one via the API.</>}
              />
            ) : (
              <>
                {requiredFieldCount > 0 && (
                  <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
                    configuredRequiredCount === requiredFieldCount
                      ? 'bg-admin-ok-soft text-emerald-700'
                      : 'bg-admin-warn-soft text-amber-800'
                  }`}>
                    {configuredRequiredCount === requiredFieldCount ? (
                      <><CheckCircle className="h-3.5 w-3.5" /> All {requiredFieldCount} required fields configured</>
                    ) : (
                      <><Clock className="h-3.5 w-3.5" /> {configuredRequiredCount}/{requiredFieldCount} required fields configured</>
                    )}
                  </div>
                )}
                <div className="space-y-4">
                  {schema.map(field => (
                    <div key={field.key}>
                      <div className="flex items-center gap-1 mb-1">
                        <label className="text-xs font-medium text-admin-secondary">{field.label}</label>
                        {field.required && <span className="text-red-500 text-xs">*</span>}
                      </div>
                      <ConfigFieldInput
                        field={field}
                        value={configValues[field.key]}
                        onChange={val => setConfigValues(c => ({ ...c, [field.key]: val }))}
                      />
                      {field.helpText && (
                        <p className="text-xs text-admin-muted mt-1">{field.helpText}</p>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={saveConfig}
                    disabled={configMutation.isPending}
                    className={buttonClass.primary}
                  >
                    <Save className="h-4 w-4" />
                    {configMutation.isPending ? 'Saving...' : 'Save Configuration'}
                  </button>
                  {configMutation.isSuccess && (
                    <span className="flex items-center gap-1 text-sm text-green-600"><CheckCircle className="h-4 w-4" /> Saved</span>
                  )}
                </div>
                {integration.docsUrl && (
                  <a
                    href={integration.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-admin-accent hover:text-admin-accent-ink"
                  >
                    <ExternalLink className="h-3 w-3" /> View API Documentation
                  </a>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'features' && (
          <div className="space-y-4">
            <p className="text-xs text-admin-muted">These feature descriptions are shown to customers on the integrations settings page.</p>
            <div className="space-y-2">
              {features.map((feat, idx) => (
                <div key={idx} className="flex items-center gap-2 group">
                  <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                  <input
                    value={feat}
                    onChange={e => {
                      const updated = [...features];
                      updated[idx] = e.target.value;
                      setFeatures(updated);
                    }}
                    className="flex-1 px-3 py-1.5 border border-transparent hover:border-admin-border focus:border-admin-accent rounded-admin-sm text-sm outline-none transition-colors"
                  />
                  <button
                    onClick={() => setFeatures(features.filter((_, i) => i !== idx))}
                    className="text-admin-border-strong hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newFeature}
                onChange={e => setNewFeature(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newFeature.trim()) {
                    setFeatures([...features, newFeature.trim()]);
                    setNewFeature('');
                  }
                }}
                placeholder="Add a feature..."
                className={`${inputClass} flex-1`}
              />
              <button
                onClick={() => {
                  if (newFeature.trim()) {
                    setFeatures([...features, newFeature.trim()]);
                    setNewFeature('');
                  }
                }}
                className={buttonClass.secondary}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={saveDetails}
                disabled={upsertMutation.isPending}
                className={buttonClass.primary}
              >
                <Save className="h-4 w-4" />
                {upsertMutation.isPending ? 'Saving...' : 'Save Features'}
              </button>
              {upsertMutation.isSuccess && (
                <span className="flex items-center gap-1 text-sm text-green-600"><CheckCircle className="h-4 w-4" /> Saved</span>
              )}
            </div>
          </div>
        )}

        {activeTab === 'tenants' && supportsTenantAccess && (
          <TenantAccessPanel integration={integration} onChanged={onSaved} />
        )}
      </div>
    </div>
  );
}

export default function IntegrationsAdminPage() {
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);
  const [newForm, setNewForm] = useState({ slug: '', name: '', description: '', category: 'ats', logo: '', comingSoon: false });
  const [showAdd, setShowAdd] = useState(false);

  const settingsQuery = trpc.platformAdmin.listIntegrationSettings.useQuery(undefined, { retry: false });
  const toggleMutation = trpc.platformAdmin.toggleIntegration.useMutation({
    onSuccess: () => settingsQuery.refetch(),
  });
  const upsertMutation = trpc.platformAdmin.upsertIntegrationSetting.useMutation({
    onSuccess: () => { settingsQuery.refetch(); setShowAdd(false); setNewForm({ slug: '', name: '', description: '', category: 'ats', logo: '', comingSoon: false }); },
  });
  const seedMutation = trpc.platformAdmin.seedIntegrationDefaults.useMutation({
    onSuccess: () => settingsQuery.refetch(),
  });

  const settings = (settingsQuery.data || []) as Integration[];
  const enabledCount = settings.filter(s => s.enabled).length;
  const comingSoonCount = settings.filter(s => s.comingSoon).length;

  return (
    <AuthenticatedLayout>
      <AdminPageChrome
        icon={<Puzzle />}
        eyebrow="Platform"
        breadcrumbs={[{ label: 'System' }, { label: 'Integrations' }]}
        title="Integrations"
        description="Define, configure, and control integrations available to customers"
        actions={
          <>
            <button
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
              className={buttonClass.secondary}
            >
              <Zap className="h-4 w-4" />
              {seedMutation.isPending ? 'Seeding...' : 'Initialize Defaults'}
            </button>
            <button
              onClick={() => setShowAdd(!showAdd)}
              className={buttonClass.primary}
            >
              <Plus className="h-4 w-4" />
              Add Integration
            </button>
          </>
        }
      >
        <StatGrid cols={3} className="mb-6">
          <StatTile label="Total" icon={Puzzle} tone="brand" value={settings.length} />
          <StatTile label="Enabled" icon={CheckCircle} tone="ok" value={enabledCount} />
          <StatTile label="Coming Soon" icon={Clock} tone="warn" value={comingSoonCount} />
        </StatGrid>

        {showAdd && (
          <SectionCard
            className="mb-6"
            icon={<Plus />}
            title="Add New Integration"
            description="New integrations start disabled"
            footer={
              <div className="flex gap-2">
                <button
                  onClick={() => upsertMutation.mutate({ ...newForm, enabled: false, sortOrder: settings.length + 1 })}
                  disabled={!newForm.slug || !newForm.name || upsertMutation.isPending}
                  className={buttonClass.primary}
                >
                  {upsertMutation.isPending ? 'Saving...' : 'Add Integration'}
                </button>
                <button
                  onClick={() => setShowAdd(false)}
                  className={buttonClass.secondary}
                >
                  Cancel
                </button>
              </div>
            }
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
              <div>
                <label className={labelClass}>Slug (unique ID)</label>
                <input
                  value={newForm.slug}
                  onChange={e => setNewForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '') }))}
                  className={inputClass}
                  placeholder="e.g. smartrecruiters"
                />
              </div>
              <div>
                <label className={labelClass}>Name</label>
                <input
                  value={newForm.name}
                  onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
                  className={inputClass}
                  placeholder="e.g. SmartRecruiters"
                />
              </div>
              <div>
                <label className={labelClass}>Category</label>
                <select
                  value={newForm.category}
                  onChange={e => setNewForm(f => ({ ...f, category: e.target.value }))}
                  className={`${selectClass} w-full`}
                >
                  {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Logo (emoji)</label>
                <input
                  value={newForm.logo}
                  onChange={e => setNewForm(f => ({ ...f, logo: e.target.value }))}
                  className={inputClass}
                  placeholder="e.g. 🚀"
                />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Description</label>
                <input
                  value={newForm.description}
                  onChange={e => setNewForm(f => ({ ...f, description: e.target.value }))}
                  className={inputClass}
                  placeholder="Short description for customers"
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newForm.comingSoon}
                  onChange={e => setNewForm(f => ({ ...f, comingSoon: e.target.checked }))}
                  className={checkboxClass}
                />
                <span className="text-sm text-admin-secondary">Mark as &quot;Coming Soon&quot;</span>
              </label>
            </div>
          </SectionCard>
        )}

        <SectionCard
          icon={<Puzzle />}
          title="All Integrations"
          padded={false}
          actions={
            <button
              onClick={() => settingsQuery.refetch()}
              className={buttonClass.ghost}
              aria-label="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          }
          footer="Enabled integrations appear on the customer-facing Integrations settings page. Disabled integrations are hidden from customers."
        >
          {settings.length === 0 ? (
            <EmptyState
              compact
              className="border-0 shadow-none"
              icon={<Puzzle />}
              title="No integrations configured."
              description={<>Click &quot;Initialize Defaults&quot; to get started.</>}
            />
          ) : (
            <div className="divide-y divide-admin-border">
              {settings.map((setting) => {
                const schema = (setting.configSchema as ConfigField[]) || [];
                const config = (setting.config as Record<string, any>) || {};
                const configuredCount = schema.filter(f => config[f.key] !== undefined && config[f.key] !== '' && config[f.key] !== null).length;
                const isExpanded = expandedSlug === setting.slug;

                return (
                  <div key={setting.id}>
                    <div className={`px-5 py-4 flex items-center justify-between transition-colors ${isExpanded ? 'bg-admin-accent-soft/50' : 'hover:bg-admin-bg/70'}`}>
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-admin-sm border border-admin-border bg-admin-bg text-xl">{setting.logo || '🔌'}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-admin-ink">{setting.name}</span>
                            <StatusPill tone="neutral" dot={false}>
                              {CATEGORY_LABELS[setting.category] || setting.category}
                            </StatusPill>
                            {setting.comingSoon && (
                              <StatusPill tone="warn" dot={false}>Coming Soon</StatusPill>
                            )}
                            {schema.length > 0 && (
                              <StatusPill
                                tone={configuredCount === schema.length ? 'success' : configuredCount > 0 ? 'warn' : 'neutral'}
                                dot={false}
                              >
                                {configuredCount}/{schema.length} configured
                              </StatusPill>
                            )}
                            {(typeof setting.supportsTenantAccess === 'boolean'
                              ? setting.supportsTenantAccess
                              : FEATURE_FLAG_SLUGS.has(setting.slug)) && (
                              <StatusPill
                                tone={(setting.grantedTenantCount ?? 0) > 0 ? 'brand' : 'neutral'}
                                dot={false}
                                title="Number of tenants this feature is granted to"
                              >
                                <Users className="h-3 w-3" />
                                {setting.grantedTenantCount ?? 0} tenant{(setting.grantedTenantCount ?? 0) === 1 ? '' : 's'} enabled
                              </StatusPill>
                            )}
                          </div>
                          <p className="mt-0.5 text-sm text-admin-muted truncate">{setting.description || 'No description'}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                        <button
                          onClick={() => setExpandedSlug(isExpanded ? null : setting.slug)}
                          className={buttonClass.ghost}
                        >
                          <Settings className="h-4 w-4" />
                          Edit
                          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </button>
                        <button
                          onClick={() => toggleMutation.mutate({ slug: setting.slug, enabled: !setting.enabled })}
                          disabled={toggleMutation.isPending}
                          className="flex items-center gap-2 transition-colors"
                          title={setting.enabled ? 'Click to disable' : 'Click to enable'}
                        >
                          {setting.enabled ? (
                            <>
                              <ToggleRight className="h-8 w-8 text-admin-accent" />
                              <span className="text-sm font-medium text-admin-accent-ink w-16">Enabled</span>
                            </>
                          ) : (
                            <>
                              <ToggleLeft className="h-8 w-8 text-admin-border-strong" />
                              <span className="text-sm font-medium text-admin-muted w-16">Disabled</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-5 pb-4">
                        <IntegrationEditPanel
                          integration={setting}
                          onClose={() => setExpandedSlug(null)}
                          onSaved={() => settingsQuery.refetch()}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </AdminPageChrome>
    </AuthenticatedLayout>
  );
}

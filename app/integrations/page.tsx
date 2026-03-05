'use client';

import { useState, useEffect, useCallback } from 'react';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { trpc } from '@/lib/trpc';
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
} from 'lucide-react';

const CATEGORY_LABELS: Record<string, string> = {
  ats: 'ATS & HRIS',
  job_board: 'Job Boards',
  communication: 'Communication',
  automation: 'Automation',
};

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

  const baseClasses = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-colors';

  if (field.type === 'toggle') {
    return (
      <label className="flex items-center gap-3 cursor-pointer">
        <div
          onClick={() => onChange(!value)}
          className={`relative w-10 h-6 rounded-full transition-colors ${value ? 'bg-purple-600' : 'bg-gray-300'}`}
        >
          <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-4' : ''}`} />
        </div>
        <span className="text-sm text-gray-700">{field.label}</span>
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
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
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

function IntegrationEditPanel({
  integration,
  onClose,
  onSaved,
}: {
  integration: Integration;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'details' | 'config' | 'features'>('details');
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
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg mt-2 overflow-hidden">
      <div className="flex items-center justify-between bg-gray-50 px-6 py-3 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <span className="text-xl">{integration.logo || '🔌'}</span>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{integration.name}</h3>
            <p className="text-xs text-gray-500">slug: <code className="bg-gray-100 px-1 rounded">{integration.slug}</code></p>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex border-b border-gray-200">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === tab.id
                ? 'text-purple-700 border-purple-600 bg-purple-50/50'
                : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-6">
        {activeTab === 'details' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                <input
                  value={details.name}
                  onChange={e => setDetails(d => ({ ...d, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={details.category}
                  onChange={e => setDetails(d => ({ ...d, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                >
                  {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Logo (emoji)</label>
                <input
                  value={details.logo}
                  onChange={e => setDetails(d => ({ ...d, logo: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Sort Order</label>
                <input
                  type="number"
                  value={details.sortOrder}
                  onChange={e => setDetails(d => ({ ...d, sortOrder: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={details.description}
                onChange={e => setDetails(d => ({ ...d, description: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Documentation URL</label>
                <input
                  type="url"
                  value={details.docsUrl}
                  onChange={e => setDetails(d => ({ ...d, docsUrl: e.target.value }))}
                  placeholder="https://docs.example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Webhook Endpoint</label>
                <input
                  value={details.webhookUrl}
                  onChange={e => setDetails(d => ({ ...d, webhookUrl: e.target.value }))}
                  placeholder="/api/webhooks/integration-slug"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={details.comingSoon}
                onChange={e => setDetails(d => ({ ...d, comingSoon: e.target.checked }))}
                className="h-4 w-4 rounded text-purple-600"
              />
              <span className="text-sm text-gray-700">Mark as &quot;Coming Soon&quot;</span>
            </label>
            <div className="flex gap-2 pt-2">
              <button
                onClick={saveDetails}
                disabled={upsertMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50"
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
              <div className="text-center py-8 text-gray-500">
                <Key className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No configuration schema defined for this integration.</p>
                <p className="text-xs text-gray-400 mt-1">Re-run &quot;Initialize Defaults&quot; to populate schemas, or define one via the API.</p>
              </div>
            ) : (
              <>
                {requiredFieldCount > 0 && (
                  <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
                    configuredRequiredCount === requiredFieldCount
                      ? 'bg-green-50 text-green-700'
                      : 'bg-amber-50 text-amber-700'
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
                        <label className="text-xs font-medium text-gray-700">{field.label}</label>
                        {field.required && <span className="text-red-500 text-xs">*</span>}
                      </div>
                      <ConfigFieldInput
                        field={field}
                        value={configValues[field.key]}
                        onChange={val => setConfigValues(c => ({ ...c, [field.key]: val }))}
                      />
                      {field.helpText && (
                        <p className="text-xs text-gray-400 mt-1">{field.helpText}</p>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={saveConfig}
                    disabled={configMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50"
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
                    className="inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800"
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
            <p className="text-xs text-gray-500">These feature descriptions are shown to customers on the integrations settings page.</p>
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
                    className="flex-1 px-3 py-1.5 border border-transparent hover:border-gray-300 focus:border-purple-500 rounded-lg text-sm outline-none transition-colors"
                  />
                  <button
                    onClick={() => setFeatures(features.filter((_, i) => i !== idx))}
                    className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
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
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
              />
              <button
                onClick={() => {
                  if (newFeature.trim()) {
                    setFeatures([...features, newFeature.trim()]);
                    setNewFeature('');
                  }
                }}
                className="px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={saveDetails}
                disabled={upsertMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50"
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
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Puzzle className="h-7 w-7 text-purple-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Integration Settings</h1>
                <p className="text-gray-500 text-sm">Define, configure, and control integrations available to customers</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => seedMutation.mutate()}
                disabled={seedMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                <Zap className="h-4 w-4" />
                {seedMutation.isPending ? 'Seeding...' : 'Initialize Defaults'}
              </button>
              <button
                onClick={() => setShowAdd(!showAdd)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800"
              >
                <Plus className="h-4 w-4" />
                Add Integration
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-2xl font-bold text-gray-900">{settings.length}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <p className="text-sm text-gray-500">Enabled</p>
            </div>
            <p className="text-2xl font-bold text-green-600">{enabledCount}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <p className="text-sm text-gray-500">Coming Soon</p>
            </div>
            <p className="text-2xl font-bold text-amber-600">{comingSoonCount}</p>
          </div>
        </div>

        {showAdd && (
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-6 mb-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Add New Integration</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Slug (unique ID)</label>
                <input
                  value={newForm.slug}
                  onChange={e => setNewForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '') }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="e.g. smartrecruiters"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                <input
                  value={newForm.name}
                  onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="e.g. SmartRecruiters"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={newForm.category}
                  onChange={e => setNewForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Logo (emoji)</label>
                <input
                  value={newForm.logo}
                  onChange={e => setNewForm(f => ({ ...f, logo: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="e.g. 🚀"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                <input
                  value={newForm.description}
                  onChange={e => setNewForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="Short description for customers"
                />
              </div>
            </div>
            <div className="flex items-center gap-4 mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newForm.comingSoon}
                  onChange={e => setNewForm(f => ({ ...f, comingSoon: e.target.checked }))}
                  className="h-4 w-4 rounded text-purple-600"
                />
                <span className="text-sm text-gray-700">Mark as &quot;Coming Soon&quot;</span>
              </label>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => upsertMutation.mutate({ ...newForm, enabled: false, sortOrder: settings.length + 1 })}
                disabled={!newForm.slug || !newForm.name || upsertMutation.isPending}
                className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {upsertMutation.isPending ? 'Saving...' : 'Add Integration'}
              </button>
              <button
                onClick={() => setShowAdd(false)}
                className="px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">All Integrations</span>
            <button
              onClick={() => settingsQuery.refetch()}
              className="text-gray-400 hover:text-gray-600"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {settings.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              <Puzzle className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No integrations configured. Click &quot;Initialize Defaults&quot; to get started.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {settings.map((setting) => {
                const schema = (setting.configSchema as ConfigField[]) || [];
                const config = (setting.config as Record<string, any>) || {};
                const configuredCount = schema.filter(f => config[f.key] !== undefined && config[f.key] !== '' && config[f.key] !== null).length;
                const isExpanded = expandedSlug === setting.slug;

                return (
                  <div key={setting.id}>
                    <div className={`px-6 py-4 flex items-center justify-between transition-colors ${isExpanded ? 'bg-purple-50/50' : 'hover:bg-gray-50'}`}>
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <span className="text-2xl w-10 text-center">{setting.logo || '🔌'}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-gray-900">{setting.name}</span>
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                              {CATEGORY_LABELS[setting.category] || setting.category}
                            </span>
                            {setting.comingSoon && (
                              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Coming Soon</span>
                            )}
                            {schema.length > 0 && (
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                configuredCount === schema.length
                                  ? 'bg-green-100 text-green-700'
                                  : configuredCount > 0
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-gray-100 text-gray-500'
                              }`}>
                                {configuredCount}/{schema.length} configured
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 truncate">{setting.description || 'No description'}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                        <button
                          onClick={() => setExpandedSlug(isExpanded ? null : setting.slug)}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors"
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
                              <ToggleRight className="h-8 w-8 text-green-500" />
                              <span className="text-sm font-medium text-green-600 w-16">Enabled</span>
                            </>
                          ) : (
                            <>
                              <ToggleLeft className="h-8 w-8 text-gray-300" />
                              <span className="text-sm font-medium text-gray-400 w-16">Disabled</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-6 pb-4">
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
        </div>

        <p className="mt-4 text-xs text-gray-500">
          Enabled integrations appear on the customer-facing Integrations settings page. Disabled integrations are hidden from customers.
        </p>
      </div>
    </AuthenticatedLayout>
  );
}

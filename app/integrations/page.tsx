'use client';

import { useState } from 'react';
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
} from 'lucide-react';

const CATEGORY_LABELS: Record<string, string> = {
  ats: 'ATS & HRIS',
  job_board: 'Job Boards',
  communication: 'Communication',
  automation: 'Automation',
};

export default function IntegrationsAdminPage() {
  const [editSlug, setEditSlug] = useState<string | null>(null);
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

  const settings = settingsQuery.data || [];
  const enabledCount = settings.filter((s: any) => s.enabled).length;
  const comingSoonCount = settings.filter((s: any) => s.comingSoon).length;

  return (
    <AuthenticatedLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Puzzle className="h-7 w-7 text-purple-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Integration Settings</h1>
                <p className="text-gray-500 text-sm">Control which integrations are available to customers</p>
              </div>
            </div>
            <div className="flex gap-2">
              {settings.length === 0 && (
                <button
                  onClick={() => seedMutation.mutate()}
                  disabled={seedMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  <Zap className="h-4 w-4" />
                  {seedMutation.isPending ? 'Seeding...' : 'Initialize Defaults'}
                </button>
              )}
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

        {/* Stats */}
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

        {/* Add New Form */}
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
                  <option value="ats">ATS & HRIS</option>
                  <option value="job_board">Job Board</option>
                  <option value="communication">Communication</option>
                  <option value="automation">Automation</option>
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

        {/* Integration List */}
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
              {(settings as any[]).map((setting: any) => (
                <div key={setting.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <span className="text-2xl w-10 text-center">{setting.logo || '🔌'}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{setting.name}</span>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {CATEGORY_LABELS[setting.category] || setting.category}
                        </span>
                        {setting.comingSoon && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Coming Soon</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">{setting.description || 'No description'}</p>
                      <p className="text-xs text-gray-400 mt-0.5">slug: <code className="bg-gray-100 px-1 rounded">{setting.slug}</code></p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
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
              ))}
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

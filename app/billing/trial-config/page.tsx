'use client';

import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { Save, Loader2, Clock, Mail } from 'lucide-react';

export default function TrialConfigPage() {
  const { isAuthenticated, isLoading: authLoading } = useAdminAuth();
  const [defaultDays, setDefaultDays] = useState(14);
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderDays, setReminderDays] = useState('7, 3, 1');
  const [saved, setSaved] = useState(false);

  const { data: config, isLoading } = trpc.platformAdmin.getTrialConfig.useQuery(undefined, {
    enabled: !authLoading && isAuthenticated,
  });

  const updateMutation = trpc.platformAdmin.updateTrialConfig.useMutation({
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (e) => alert(e.message),
  });

  useEffect(() => {
    if (config) {
      setDefaultDays(config.defaultTrialDays);
      setReminderEnabled(config.reminderEnabled);
      setReminderDays(config.reminderDaysBefore.join(', '));
    }
  }, [config]);

  const handleSave = () => {
    const daysBefore = reminderDays
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n > 0);

    updateMutation.mutate({
      defaultTrialDays: defaultDays,
      reminderEnabled,
      reminderDaysBefore: daysBefore,
    });
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Trial Configuration</h2>
        <p className="text-gray-500 mt-1">
          Configure default trial duration and email reminder schedule for new organizations.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 divide-y">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-gray-900">Default Trial Duration</h3>
              <p className="text-sm text-gray-500 mt-1">
                How many days new organizations get when they sign up.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={defaultDays}
                  onChange={(e) => setDefaultDays(parseInt(e.target.value, 10) || 14)}
                  className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-600">days</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-purple-50 rounded-lg">
              <Mail className="h-5 w-5 text-purple-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-gray-900">Expiry Reminder Emails</h3>
              <p className="text-sm text-gray-500 mt-1">
                Send automated emails to org admins before their trial expires.
              </p>
              <div className="mt-3 space-y-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={reminderEnabled}
                    onChange={(e) => setReminderEnabled(e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700">Send reminder emails</span>
                </label>
                {reminderEnabled && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Days before expiry (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={reminderDays}
                      onChange={(e) => setReminderDays(e.target.value)}
                      placeholder="7, 3, 1"
                      className="w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Example: "7, 3, 1" sends emails 7 days, 3 days, and 1 day before expiry.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {updateMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Configuration
        </button>
        {saved && (
          <span className="text-sm text-green-600 font-medium">Saved!</span>
        )}
      </div>

      <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
        <h4 className="text-sm font-medium text-gray-900 mb-2">How it works</h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>New orgs start with a {defaultDays}-day free trial (TRIAL status).</li>
          <li>A background job runs hourly and automatically expires trials past their date.</li>
          <li>Expired orgs go read-only — they can view data but can&apos;t create new sessions.</li>
          <li>Org admins see a persistent banner with days remaining and an upgrade button.</li>
          <li>When they subscribe via Stripe Checkout, status changes to ACTIVE automatically.</li>
        </ul>
      </div>
    </div>
  );
}

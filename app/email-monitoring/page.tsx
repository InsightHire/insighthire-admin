'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { ClockIcon, CheckCircleIcon, XCircleIcon, EnvelopeIcon } from '@heroicons/react/24/outline';
import { StatCard } from './_utils';

export default function EmailMonitoringOverviewPage() {
  const { isLoading: authLoading } = useAdminAuth();
  const [triggerOrgId, setTriggerOrgId] = useState('');
  const [triggerType, setTriggerType] = useState<'DAILY' | 'WEEKLY'>('DAILY');
  const [triggerResult, setTriggerResult] = useState<{ success: boolean; message: string } | null>(null);

  const { data: orgsData } = trpc.platformAdmin.listOrganizations.useQuery(
    { page: 1, limit: 100 },
    { enabled: !authLoading, retry: false }
  );
  const { data: statsData, isLoading: statsLoading } = trpc.platformAdmin.getEmailStats.useQuery(
    { days: 7 },
    { enabled: !authLoading, retry: false, refetchInterval: 30000 }
  );
  const triggerDigestMutation = trpc.platformAdmin.triggerDigestNow.useMutation({
    onSuccess: (data) => {
      setTriggerResult({ success: data.success, message: data.message });
      setTimeout(() => setTriggerResult(null), 5000);
    },
    onError: (err) => {
      setTriggerResult({ success: false, message: err.message });
      setTimeout(() => setTriggerResult(null), 5000);
    },
  });

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {statsLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
        </div>
      ) : statsData ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Digest Pending" value={statsData.digest.pending} icon={ClockIcon} color="yellow" />
            <StatCard title="Digest Sent" value={statsData.digest.sent} icon={CheckCircleIcon} color="green" />
            <StatCard title="Digest Failed" value={statsData.digest.failed} icon={XCircleIcon} color="red" />
            <StatCard title="Emails Sent" value={statsData.emails.sent} icon={EnvelopeIcon} color="blue" />
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Email Performance ({statsData.period})</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-3xl font-bold text-green-600">{statsData.emails.openRate}%</div>
                <div className="text-sm text-gray-500 mt-1">Open Rate</div>
                <div className="text-xs text-gray-400">{statsData.emails.opened} opened</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-3xl font-bold text-red-600">{statsData.emails.bounceRate}%</div>
                <div className="text-sm text-gray-500 mt-1">Bounce Rate</div>
                <div className="text-xs text-gray-400">{statsData.emails.bounced} bounced</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-3xl font-bold text-blue-600">{statsData.emails.sent}</div>
                <div className="text-sm text-gray-500 mt-1">Total Sent</div>
                <div className="text-xs text-gray-400">{statsData.period}</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Manually Trigger Digest</h3>
            <p className="text-sm text-gray-500 mb-4">Send a digest email to all admins/recruiters in an organization for testing.</p>
            {triggerResult && (
              <div className={`mb-4 p-3 rounded-lg ${triggerResult.success ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                {triggerResult.message}
              </div>
            )}
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">Organization</label>
                <select
                  value={triggerOrgId}
                  onChange={(e) => setTriggerOrgId(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white"
                >
                  <option value="">Select organization...</option>
                  {orgsData?.organizations?.map((org: any) => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
              </div>
              <div className="w-40">
                <label className="block text-sm font-medium text-gray-700 mb-1">Digest Type</label>
                <select
                  value={triggerType}
                  onChange={(e) => setTriggerType(e.target.value as 'DAILY' | 'WEEKLY')}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white"
                >
                  <option value="DAILY">Daily Digest</option>
                  <option value="WEEKLY">Weekly Digest</option>
                </select>
              </div>
              <button
                onClick={() => triggerOrgId && triggerDigestMutation.mutate({ organizationId: triggerOrgId, digestType: triggerType })}
                disabled={!triggerOrgId || triggerDigestMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {triggerDigestMutation.isPending ? 'Sending...' : 'Send Digest Now'}
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center text-gray-500 py-12">No data available</div>
      )}
    </div>
  );
}

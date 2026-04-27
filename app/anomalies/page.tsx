'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { 
  ExclamationTriangleIcon, 
  MapPinIcon,
  CheckCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import Link from 'next/link';

export default function AnomaliesPage() {
  const [daysBack, setDaysBack] = useState(7);
  
  const { data, isLoading, refetch } = trpc.platformAdmin.getLocationAnomalies.useQuery({
    daysBack,
    limit: 100,
  });

  const dismissMutation = trpc.platformAdmin.dismissAnomaly.useMutation({
    onSuccess: () => {
      refetch();
    }
  });

  const handleDismiss = (anomalyId: string) => {
    if (confirm('Dismiss this anomaly? This will mark it as reviewed.')) {
      dismissMutation.mutate({ anomalyId, reason: 'Reviewed by admin' });
    }
  };

  return (
    <AuthenticatedLayout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
              <ExclamationTriangleIcon className="h-7 w-7 text-amber-500" />
              <span>Location Anomalies</span>
            </h1>
            <p className="text-gray-500 mt-1">
              Suspicious location changes during candidate journeys
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <label className="text-sm text-gray-600">Show last:</label>
            <select 
              value={daysBack}
              onChange={(e) => setDaysBack(Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            >
              <option value={1}>24 hours</option>
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
            </select>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-red-700">
              {data?.anomalies?.filter((a: any) => a.severity === 'high').length || 0}
            </div>
            <div className="text-sm text-red-600">High Severity</div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-amber-700">
              {data?.anomalies?.filter((a: any) => a.severity === 'medium').length || 0}
            </div>
            <div className="text-sm text-amber-600">Medium Severity</div>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-gray-700">
              {data?.total || 0}
            </div>
            <div className="text-sm text-gray-600">Total Anomalies</div>
          </div>
        </div>

        {/* Anomalies List */}
        {isLoading ? (
          <div className="text-center py-12 text-gray-500">Loading anomalies...</div>
        ) : !data?.anomalies?.length ? (
          <div className="text-center py-12 bg-green-50 rounded-lg">
            <CheckCircleIcon className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <p className="text-green-700 font-medium">No location anomalies detected</p>
            <p className="text-green-600 text-sm">All candidate locations appear normal</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Candidate</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hiring Flow</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location Change</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Distance</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Severity</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.anomalies.map((anomaly: any) => (
                  <tr key={anomaly.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {new Date(anomaly.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      {anomaly.candidateId ? (
                        <Link 
                          href={`/candidate/${anomaly.candidateId}`}
                          className="text-sm font-medium text-blue-600 hover:underline"
                        >
                          {anomaly.candidateName}
                        </Link>
                      ) : (
                        <span className="text-sm text-gray-900">{anomaly.candidateName}</span>
                      )}
                      <div className="text-xs text-gray-500">{anomaly.candidateEmail}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {anomaly.journeyName}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-2 text-sm">
                        <span className="text-gray-700">
                          {anomaly.previousLocation?.city || anomaly.previousLocation?.country || '?'}
                        </span>
                        <span className="text-gray-400">→</span>
                        <span className="text-gray-700">
                          {anomaly.currentLocation?.city || anomaly.currentLocation?.country || '?'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        IP: {anomaly.ipAddress}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-red-600">
                      {anomaly.distanceKm?.toLocaleString()} km
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        anomaly.severity === 'high' 
                          ? 'bg-red-100 text-red-700' 
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {anomaly.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-2">
                        {anomaly.candidateId && (
                          <Link
                            href={`/candidate/${anomaly.candidateId}`}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            View
                          </Link>
                        )}
                        <button
                          onClick={() => handleDismiss(anomaly.id)}
                          className="text-xs text-gray-500 hover:text-gray-700 flex items-center"
                          disabled={dismissMutation.isPending}
                        >
                          <XMarkIcon className="h-4 w-4 mr-1" />
                          Dismiss
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Info box */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-800 mb-2">How Anomaly Detection Works</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• <strong>High severity:</strong> &gt;5,000km change in &lt;24 hours (likely different country/continent)</li>
            <li>• <strong>Medium severity:</strong> &gt;2,000km in &lt;8 hours, or &gt;500km in &lt;2 hours</li>
            <li>• Anomalies may indicate VPN usage, credential sharing, or proxy access</li>
            <li>• Consider reaching out to candidates with multiple high-severity anomalies</li>
          </ul>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}

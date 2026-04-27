'use client';

import { useParams, useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  PlayIcon,
  UserIcon,
  EnvelopeIcon,
  BuildingOfficeIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  LinkIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';
import { useState, useRef, useEffect, useCallback } from 'react';
import { PlayCircleIcon, XMarkIcon } from '@heroicons/react/24/solid';
import Hls from 'hls.js';

function HlsVideo({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    if (src.includes('.m3u8')) {
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = src;
        video.play().catch(() => {});
      } else if (Hls.isSupported()) {
        const hls = new Hls();
        hlsRef.current = hls;
        hls.loadSource(src);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {});
        });
      }
    } else {
      video.src = src;
      video.play().catch(() => {});
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src]);

  return (
    <video
      ref={videoRef}
      controls
      playsInline
      className="w-full max-h-80 rounded-lg"
    />
  );
}

export default function CandidateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { isLoading: authLoading } = useAdminAuth();
  const candidateId = params.id as string;
  const [retrying, setRetrying] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);

  // Fetch journey breakdown
  const { data: journeyData, isLoading: loadingJourney, error: journeyError, refetch } = trpc.platformAdmin.getCandidateJourneyBreakdown.useQuery(
    { candidateId },
    { enabled: !authLoading && !!candidateId, retry: false }
  );

  // Retry mutation
  const retryMutation = trpc.platformAdmin.retryStuckCandidate.useMutation();
  const resetResponseMutation = trpc.platformAdmin.resetJourneyResponse.useMutation();
  const sendRetakeNoticeMutation = trpc.platformAdmin.sendRetakeNotice.useMutation();
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [sendingRetake, setSendingRetake] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await retryMutation.mutateAsync({ candidateId, retryType: 'all' });
      await refetch();
      alert('Retry initiated successfully!');
    } catch (error) {
      alert('Retry failed: ' + (error as Error).message);
    } finally {
      setRetrying(false);
    }
  };

  const handleResetResponse = async (responseId: string) => {
    if (!confirm('This will delete this response and rewind the candidate to re-record it. Continue?')) return;
    setResettingId(responseId);
    try {
      const result = await resetResponseMutation.mutateAsync({ responseId });
      await refetch();
      alert(result.rewindedToNode
        ? 'Response deleted and session rewound to the interview step.'
        : 'Response deleted. The candidate can re-record it.');
    } catch (error) {
      alert('Reset failed: ' + (error as Error).message);
    } finally {
      setResettingId(null);
    }
  };

  const handleSendRetakeNotice = async () => {
    if (!journeyData?.sessionId) return;
    setSendingRetake(true);
    try {
      const result = await sendRetakeNoticeMutation.mutateAsync({
        candidateId,
        sessionId: journeyData.sessionId,
      });
      alert(result.emailSent
        ? 'Retake notice sent to the candidate.'
        : 'Session updated but email could not be sent. Check logs.');
    } catch (error) {
      alert('Failed to send retake notice: ' + (error as Error).message);
    } finally {
      setSendingRetake(false);
    }
  };

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'start': return '🚀';
      case 'end': return '🏁';
      case 'assessment': return '📝';
      case 'interview': 
      case 'video-interview': 
      case 'video_question': return '🎥';
      case 'scoring_gate':
      case 'scoring-gate': return '⚖️';
      case 'decision': return '🔀';
      case 'email':
      case 'send-email': return '📧';
      case 'delay': return '⏳';
      default: return '📌';
    }
  };

  const getStatusColor = (status: string, hasFailed: boolean) => {
    if (hasFailed) return 'bg-red-100 border-red-300 text-red-800';
    switch (status) {
      case 'completed': return 'bg-green-100 border-green-300 text-green-800';
      case 'current':
      case 'in_progress': return 'bg-blue-100 border-blue-300 text-blue-800';
      case 'pending': return 'bg-gray-100 border-gray-300 text-gray-600';
      case 'skipped': return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      default: return 'bg-gray-100 border-gray-300 text-gray-600';
    }
  };

  const getStatusBadge = (status: string, hasFailed: boolean) => {
    if (hasFailed) {
      return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">Failed</span>;
    }
    switch (status) {
      case 'completed':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">Completed</span>;
      case 'current':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700 animate-pulse">Current</span>;
      case 'in_progress':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">In Progress</span>;
      case 'pending':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">Pending</span>;
      case 'skipped':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-500">Skipped</span>;
      default:
        return null;
    }
  };

  if (authLoading || loadingJourney) {
    return (
      <AuthenticatedLayout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </AuthenticatedLayout>
    );
  }

  if (journeyError) {
    return (
      <AuthenticatedLayout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center max-w-lg">
            <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900">Error Loading Candidate</h2>
            <p className="text-gray-500 mt-2">Something went wrong fetching this candidate&apos;s data.</p>
            <pre className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-left text-xs text-red-700 overflow-auto max-h-48">
              {journeyError.message}
            </pre>
            <div className="mt-4 flex gap-3 justify-center">
              <button onClick={() => refetch()} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                Retry
              </button>
              <button onClick={() => router.back()} className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 text-gray-700">
                Go Back
              </button>
            </div>
          </div>
        </div>
      </AuthenticatedLayout>
    );
  }

  if (!journeyData || journeyData.status === 'NOT_FOUND') {
    return (
      <AuthenticatedLayout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-900">Candidate Not Found</h2>
            <p className="text-gray-500 mt-2">No hiring flow session found for this candidate</p>
            <button onClick={() => router.back()} className="mt-4 text-blue-600 hover:underline">
              Go Back
            </button>
          </div>
        </div>
      </AuthenticatedLayout>
    );
  }

  const summary = journeyData.summary;
  const hasFailed = summary.failed > 0;

  return (
    <AuthenticatedLayout>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg">
                  <ArrowLeftIcon className="h-5 w-5" />
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{journeyData.candidateName}</h1>
                  <p className="text-gray-600">{journeyData.journeyName} • {journeyData.organizationName}</p>
                </div>
              </div>
              {hasFailed && (
                <button
                  onClick={handleRetry}
                  disabled={retrying}
                  className={`px-4 py-2 rounded-lg flex items-center space-x-2 ${
                    retrying ? 'bg-gray-400' : 'bg-red-600 hover:bg-red-700'
                  } text-white`}
                >
                  <ArrowPathIcon className={`h-5 w-5 ${retrying ? 'animate-spin' : ''}`} />
                  <span>{retrying ? 'Retrying...' : 'Retry Failed Jobs'}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Candidate Info Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-full">
                  <UserIcon className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Candidate</p>
                  <p className="font-medium text-gray-900">{journeyData.candidateName}</p>
                </div>
              </div>
              {journeyData.candidateEmail && (
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gray-100 rounded-full">
                    <EnvelopeIcon className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    <p className="font-medium text-gray-900 truncate text-sm">{journeyData.candidateEmail}</p>
                  </div>
                </div>
              )}
              {journeyData.organizationName && (
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-purple-100 rounded-full">
                    <BuildingOfficeIcon className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Organization</p>
                    <p className="font-medium text-gray-900">{journeyData.organizationName}</p>
                  </div>
                </div>
              )}
              {journeyData.positionTitle && (
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-green-100 rounded-full">
                    <PlayIcon className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Position</p>
                    <p className="font-medium text-gray-900">{journeyData.positionTitle}</p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Candidate Journey Link */}
            {journeyData.candidateJourneyUrl && (
              <div className="mt-6 pt-6 border-t">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <LinkIcon className="h-5 w-5 text-gray-400" />
                    <span className="text-sm font-medium text-gray-700">Candidate hiring flow link</span>
                  </div>
                  <a
                    href={`${journeyData.candidateJourneyUrl}?admin_preview=true`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    <span>View as Candidate</span>
                    <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                  </a>
                </div>
                <div className="mt-2 flex items-center space-x-2">
                  <input 
                    type="text" 
                    readOnly 
                    value={journeyData.candidateJourneyUrl}
                    className="flex-1 text-xs text-gray-500 font-mono bg-gray-100 p-2 rounded border-0"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(journeyData.candidateJourneyUrl!);
                      alert('Link copied!');
                    }}
                    className="px-3 py-2 text-xs bg-gray-200 hover:bg-gray-300 rounded"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}

            {/* Location Anomalies Alert */}
            {journeyData.locationAnomalies && journeyData.locationAnomalies.length > 0 && (
              <div className="mt-6 pt-6 border-t">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
                    <span className="text-sm font-bold text-red-800">⚠️ Location Anomaly Detected</span>
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                      {journeyData.locationAnomalies.length} alert{journeyData.locationAnomalies.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className="text-xs text-red-700 mb-3">
                    Suspicious location changes detected - candidate may be using VPN or sharing credentials.
                  </p>
                  <div className="space-y-2">
                    {journeyData.locationAnomalies.map((anomaly: any, index: number) => {
                      const meta = anomaly.metadata as any;
                      return (
                        <div key={index} className="bg-white border border-red-100 rounded p-3 text-xs">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-gray-900">
                              {new Date(anomaly.createdAt).toLocaleString()}
                            </span>
                            <span className={`px-2 py-0.5 rounded ${
                              meta?.severity === 'high' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {meta?.severity || 'medium'} severity
                            </span>
                          </div>
                          <div className="text-gray-700">
                            <span className="font-medium">{meta?.previousLocation?.city || meta?.previousLocation?.country || 'Unknown'}</span>
                            <span className="mx-2">→</span>
                            <span className="font-medium">{meta?.currentLocation?.city || meta?.currentLocation?.country || 'Unknown'}</span>
                            <span className="ml-2 text-red-600">({meta?.distanceKm?.toLocaleString()}km jump)</span>
                          </div>
                          <div className="mt-1 text-gray-500">
                            IP: {anomaly.ipAddress}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Page Visit History */}
            {journeyData.pageVisits && journeyData.pageVisits.length > 0 && (
              <div className="mt-6 pt-6 border-t">
                <div className="flex items-center space-x-2 mb-3">
                  <ClockIcon className="h-5 w-5 text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">Page Visit History</span>
                  <span className="text-xs text-gray-500">({journeyData.pageVisits.length} visits)</span>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {journeyData.pageVisits.map((visit: any, index: number) => {
                    const meta = visit.metadata as any;
                    const location = meta?.geoLocation;
                    return (
                      <div key={index} className="flex items-center justify-between text-xs bg-gray-50 p-2 rounded">
                        <div className="flex items-center space-x-3">
                          <span className="text-gray-900 font-medium">
                            {new Date(visit.createdAt).toLocaleString()}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            meta?.deviceType === 'mobile' ? 'bg-purple-100 text-purple-700' :
                            meta?.deviceType === 'tablet' ? 'bg-blue-100 text-blue-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {meta?.deviceType || 'unknown'}
                          </span>
                          {location?.city && (
                            <span className="text-gray-600">
                              📍 {location.city}, {location.region || location.country}
                            </span>
                          )}
                          {meta?.page && (
                            <span className="text-gray-500">{meta.page}</span>
                          )}
                        </div>
                        <span className="text-gray-400 font-mono">{visit.ipAddress}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* No visits yet message */}
            {journeyData.candidateJourneyUrl && (!journeyData.pageVisits || journeyData.pageVisits.length === 0) && (
              <div className="mt-4 text-xs text-gray-500 italic">
                No page visits recorded yet
              </div>
            )}

            {/* Progress Bar */}
            <div className="mt-6 pt-6 border-t">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Hiring flow progress</span>
                <span className="text-sm font-bold text-gray-900">{journeyData.completionPercentage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${hasFailed ? 'bg-red-500' : 'bg-blue-600'}`}
                  style={{ width: `${journeyData.completionPercentage}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                <span>Started: {new Date(journeyData.startedAt).toLocaleString()}</span>
                {journeyData.lastActivityAt && (
                  <span>Last Activity: {new Date(journeyData.lastActivityAt).toLocaleString()}</span>
                )}
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm border p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{summary.total}</p>
              <p className="text-xs text-gray-500">Total Steps</p>
            </div>
            <div className="bg-green-50 border-green-200 rounded-lg shadow-sm border p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{summary.completed}</p>
              <p className="text-xs text-gray-500">Completed</p>
            </div>
            <div className={`rounded-lg shadow-sm border p-4 text-center ${summary.inProgress > 0 ? 'bg-blue-50 border-blue-200' : 'bg-white'}`}>
              <p className={`text-2xl font-bold ${summary.inProgress > 0 ? 'text-blue-600' : 'text-gray-900'}`}>{summary.inProgress}</p>
              <p className="text-xs text-gray-500">In Progress</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{summary.pending}</p>
              <p className="text-xs text-gray-500">Pending</p>
            </div>
            <div className={`rounded-lg shadow-sm border p-4 text-center ${summary.failed > 0 ? 'bg-red-50 border-red-200' : 'bg-white'}`}>
              <p className={`text-2xl font-bold ${summary.failed > 0 ? 'text-red-600' : 'text-gray-900'}`}>{summary.failed}</p>
              <p className="text-xs text-gray-500">Failed</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-4 text-center">
              <p className="text-2xl font-bold text-gray-400">{summary.skipped}</p>
              <p className="text-xs text-gray-500">Skipped</p>
            </div>
          </div>

          {/* Journey Nodes Breakdown */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Hiring flow breakdown</h2>
              <p className="text-sm text-gray-500">Step-by-step progress through the hiring flow</p>
            </div>

            <div className="divide-y divide-gray-100">
              {journeyData.nodes.map((node: any, index: number) => {
                const isExpanded = expandedNodes.has(node.id);
                const hasPipeline = node.processingPipeline && node.processingPipeline.length > 0;
                
                return (
                  <div key={node.id} className={`${node.isCurrent ? 'bg-blue-50' : ''}`}>
                    {/* Node Header */}
                    <div 
                      className={`px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 ${
                        node.isCurrent ? 'hover:bg-blue-100' : ''
                      }`}
                      onClick={() => hasPipeline && toggleNode(node.id)}
                    >
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-lg">
                          {getNodeIcon(node.type)}
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className="text-sm text-gray-400 font-mono">#{index + 1}</span>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-medium text-gray-900">{node.label}</span>
                              {node.isActionable && (
                                <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-100 text-blue-700">
                                  ACTION
                                </span>
                              )}
                            </div>
                            {node.description && (
                              <p className="text-xs text-gray-500 mt-0.5">{node.description}</p>
                            )}
                            <p className="text-xs text-gray-400 mt-0.5">Type: {node.type}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        {node.hasFailed && (
                          <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
                        )}
                        {/* Show score for completed nodes */}
                        {node.status === 'completed' && node.averageScore !== null && (
                          <span className={`px-2 py-1 text-sm font-bold rounded ${
                            node.averageScore >= 80 ? 'bg-green-100 text-green-700' :
                            node.averageScore >= 60 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {node.averageScore}%
                          </span>
                        )}
                        {getStatusBadge(node.status, node.hasFailed)}
                        {hasPipeline && (
                          <div className="text-gray-400">
                            {isExpanded ? (
                              <ChevronDownIcon className="h-5 w-5" />
                            ) : (
                              <ChevronRightIcon className="h-5 w-5" />
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Expanded Processing Pipeline */}
                    {isExpanded && hasPipeline && (
                      <div className="px-6 pb-4 bg-gray-50">
                        <div className="ml-12 space-y-3">
                          {node.processingPipeline.map((item: any) => (
                            <div key={item.id} className="bg-white rounded-lg border p-4">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex-1">
                                  <span className={`px-2 py-1 text-xs font-medium rounded ${
                                    item.type === 'interview' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                                  }`}>
                                    {item.type}
                                  </span>
                                  <p className="text-sm text-gray-700 mt-1">{item.questionText}</p>
                                </div>
                                <div className="flex items-center space-x-2 ml-4">
                                  {/* Individual score */}
                                  {item.score !== null && item.score !== undefined && (
                                    <span className={`px-3 py-1 text-sm font-bold rounded ${
                                      item.score >= 80 ? 'bg-green-100 text-green-700' :
                                      item.score >= 60 ? 'bg-yellow-100 text-yellow-700' :
                                      'bg-red-100 text-red-700'
                                    }`}>
                                      {Math.round(item.score)}%
                                    </span>
                                  )}
                                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                    item.processingStatus === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                                    item.processingStatus === 'FAILED' ? 'bg-red-100 text-red-700' :
                                    item.processingStatus === 'PROCESSING' ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-gray-100 text-gray-600'
                                  }`}>
                                    {item.processingStatus}
                                  </span>
                                </div>
                              </div>

                              {/* Pipeline Steps */}
                              <div className="flex items-center space-x-2 text-xs">
                                <div className={`flex items-center space-x-1 px-2 py-1 rounded ${
                                  item.videoUploaded ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                                }`}>
                                  {item.videoUploaded ? <CheckCircleIcon className="h-4 w-4" /> : <ClockIcon className="h-4 w-4" />}
                                  <span>Video</span>
                                </div>
                                <span className="text-gray-300">→</span>
                                
                                <div className={`flex items-center space-x-1 px-2 py-1 rounded ${
                                  item.transcriptionCompleted ? 'bg-green-100 text-green-800' :
                                  item.transcriptionError ? 'bg-red-100 text-red-800' :
                                  'bg-gray-100 text-gray-500'
                                }`}>
                                  {item.transcriptionCompleted ? <CheckCircleIcon className="h-4 w-4" /> :
                                   item.transcriptionError ? <XCircleIcon className="h-4 w-4" /> :
                                   <ClockIcon className="h-4 w-4" />}
                                  <span>Transcription</span>
                                </div>
                                <span className="text-gray-300">→</span>
                                
                                <div className={`flex items-center space-x-1 px-2 py-1 rounded ${
                                  item.aiEvaluationCompleted ? 'bg-green-100 text-green-800' :
                                  item.aiEvaluationError ? 'bg-red-100 text-red-800' :
                                  'bg-gray-100 text-gray-500'
                                }`}>
                                  {item.aiEvaluationCompleted ? <CheckCircleIcon className="h-4 w-4" /> :
                                   item.aiEvaluationError ? <XCircleIcon className="h-4 w-4" /> :
                                   <ClockIcon className="h-4 w-4" />}
                                  <span>AI Eval</span>
                                </div>
                                <span className="text-gray-300">→</span>
                                
                                <div className={`flex items-center space-x-1 px-2 py-1 rounded ${
                                  item.scoreGenerated ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                                }`}>
                                  {item.scoreGenerated ? <CheckCircleIcon className="h-4 w-4" /> : <ClockIcon className="h-4 w-4" />}
                                  <span>Score</span>
                                </div>
                              </div>

                              {/* Video preview */}
                              {item.videoUrl && (
                                <div className="mt-3">
                                  {playingVideoId === item.id ? (
                                    <div className="relative rounded-lg overflow-hidden bg-black">
                                      <button
                                        onClick={() => setPlayingVideoId(null)}
                                        className="absolute top-2 right-2 z-10 p-1 bg-black/60 hover:bg-black/80 rounded-full text-white transition-colors"
                                      >
                                        <XMarkIcon className="h-5 w-5" />
                                      </button>
                                      <HlsVideo src={item.videoUrl} />
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setPlayingVideoId(item.id)}
                                      className="flex items-center space-x-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
                                    >
                                      <PlayCircleIcon className="h-4 w-4" />
                                      <span>Watch Video</span>
                                    </button>
                                  )}
                                </div>
                              )}

                              {/* Error display */}
                              {(item.transcriptionError || item.aiEvaluationError) && (
                                <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-700">
                                  <strong>Error:</strong> {item.transcriptionError || item.aiEvaluationError}
                                </div>
                              )}

                              {/* Reset response action */}
                              {item.videoUploaded && (item.processingStatus === 'FAILED' || item.transcriptionError || item.aiEvaluationError) && (
                                <div className="mt-3 pt-3 border-t border-gray-100">
                                  <button
                                    onClick={() => handleResetResponse(item.id)}
                                    disabled={resettingId === item.id}
                                    className="flex items-center space-x-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white text-xs font-medium rounded-lg transition-colors"
                                  >
                                    <XCircleIcon className="h-4 w-4" />
                                    <span>{resettingId === item.id ? 'Resetting...' : 'Reset Response'}</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}

                          {/* Send retake notice at node level */}
                          {node.hasFailed && journeyData?.sessionId && (
                            <div className="mt-3 pt-3 border-t border-dashed border-gray-300">
                              <button
                                onClick={handleSendRetakeNotice}
                                disabled={sendingRetake}
                                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-lg transition-colors"
                              >
                                <EnvelopeIcon className="h-4 w-4" />
                                <span>{sendingRetake ? 'Sending...' : 'Send Retake Notice to Candidate'}</span>
                              </button>
                              <p className="mt-1 text-xs text-gray-500">
                                Emails the candidate a link to continue and re-record the failed question(s).
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}

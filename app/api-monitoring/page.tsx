'use client';
export const dynamic = 'force-dynamic';


import { useState, useEffect } from 'react';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { AdminPage } from '@/components/admin/page-chrome';
import { PageHeader } from '@/components/admin/page-header';
import { SectionCard } from '@/components/admin/section-card';
import { StatGrid, StatTile } from '@/components/admin/stat-tile';
import { StatusPill, type StatusTone } from '@/components/admin/status-pill';
import { EmptyState } from '@/components/admin/empty-state';
import { Segmented } from '@/components/admin/segmented';
import { buttonClass } from '@/components/admin/controls';
import { 
  Activity, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  Database, 
  Globe, 
  RefreshCw, 
  Server, 
  Shield, 
  Zap,
  XCircle,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Info
} from 'lucide-react';

interface ApiService {
  id: string;
  name: string;
  displayName: string;
  category: string;
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  isCritical: boolean;
  lastCheck?: string;
  responseTime?: number;
  errorCount?: number;
}

interface ServiceMetrics {
  uptime: number;
  avgResponseTime: number;
  errorRate: number;
  totalRequests: number;
  failedRequests: number;
  last24Hours: {
    uptime: number;
    avgResponseTime: number;
    errorCount: number;
    requestCount: number;
  };
  last7Days: {
    uptime: number;
    avgResponseTime: number;
    errorCount: number;
    requestCount: number;
  };
}

interface ApiError {
  id: string;
  service: { displayName: string };
  errorType: string;
  errorMessage: string;
  severity: string;
  occurredAt: string;
  resolved: boolean;
}

interface StatusSummary {
  totalServices: number;
  healthy: number;
  degraded: number;
  down: number;
  critical: Array<{
    name: string;
    status: string;
    lastCheck?: string;
  }>;
  services: ApiService[];
}

export default function ApiMonitoringPage() {
  // Fixed errors array handling and AlertTitle import
  const [statusSummary, setStatusSummary] = useState<StatusSummary | null>(null);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [serviceMetrics, setServiceMetrics] = useState<ServiceMetrics | null>(null);
  const [recentErrors, setRecentErrors] = useState<ApiError[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('services');

  useEffect(() => {
    loadMonitoringData();
    const interval = setInterval(loadMonitoringData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadMonitoringData = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.insighthire.com';
      const token = typeof window !== "undefined" && localStorage.getItem('auth_token');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      // Load status summary
      const statusResponse = await fetch(`${apiUrl}/api/monitoring/status`, { headers });
      if (statusResponse.ok) {
        const data = await statusResponse.json();
        setStatusSummary(data);
      }

      // Load recent errors
      const errorsResponse = await fetch(`${apiUrl}/api/monitoring/errors?limit=20&resolved=false`, { headers });
      if (errorsResponse.ok) {
        const data = await errorsResponse.json();
        // Ensure we always have an array
        setRecentErrors(Array.isArray(data.errors) ? data.errors : []);
      } else {
        setRecentErrors([]);
      }
    } catch (error) {
      console.error('Failed to load monitoring data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadServiceDetails = async (serviceId: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.insighthire.com';
      const token = typeof window !== "undefined" && localStorage.getItem('auth_token');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      const response = await fetch(`${apiUrl}/api/monitoring/services/${serviceId}`, { headers });
      if (response.ok) {
        const data = await response.json();
        setServiceMetrics(data.metrics);
      }
    } catch (error) {
      console.error('Failed to load service details:', error);
    }
  };

  const runHealthCheck = async (serviceId?: string) => {
    setRefreshing(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.insighthire.com';
      const token = typeof window !== "undefined" && localStorage.getItem('auth_token');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      const body = serviceId ? JSON.stringify({ serviceId }) : '{}';
      await fetch(`${apiUrl}/api/monitoring/health-check`, {
        method: 'POST',
        headers,
        body,
      });

      // Reload data after health check
      await loadMonitoringData();
      if (serviceId) {
        await loadServiceDetails(serviceId);
      }
    } catch (error) {
      console.error('Failed to run health check:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const resolveError = async (errorId: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.insighthire.com';
      const token = typeof window !== "undefined" && localStorage.getItem('auth_token');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      await fetch(`${apiUrl}/api/monitoring/errors/${errorId}/resolve`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ notes: 'Resolved from monitoring dashboard' }),
      });

      // Reload errors
      await loadMonitoringData();
    } catch (error) {
      console.error('Failed to resolve error:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'degraded':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'down':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <AlertCircle className="h-5 w-5 text-admin-muted" />;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'ai':
        return <Zap className="h-5 w-5" />;
      case 'database':
        return <Database className="h-5 w-5" />;
      case 'auth':
        return <Shield className="h-5 w-5" />;
      case 'infrastructure':
        return <Server className="h-5 w-5" />;
      case 'ats':
        return <Globe className="h-5 w-5" />;
      default:
        return <Activity className="h-5 w-5" />;
    }
  };

  const getSeverityTone = (severity: string): StatusTone => {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'danger';
      case 'medium':
        return 'warn';
      case 'low':
        return 'success';
      default:
        return 'neutral';
    }
  };

  const statusTone = (status: string): StatusTone =>
    status === 'healthy' ? 'success' : status === 'degraded' ? 'warn' : status === 'down' ? 'danger' : 'neutral';

  const uptimeBar = (value: number) => (
    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
      <div className="h-full bg-admin-accent transition-all duration-300" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-admin-muted" />
      </div>
    );
  }

  return (
    <AdminPage className="pt-0 sm:px-6 lg:px-6 lg:pt-0">
      <PageHeader
        icon={<Activity />}
        breadcrumbs={[{ label: 'Operations' }, { label: 'Pipeline', href: '/pipeline' }, { label: 'API health' }]}
        title="API Monitoring Dashboard"
        description="Track the health and performance of external API services"
        actions={
          <button
            onClick={() => runHealthCheck()}
            disabled={refreshing}
            className={buttonClass.primary}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Run Health Check
          </button>
        }
      />

      <div className="space-y-6">
      {/* Critical Alerts */}
      {statusSummary?.critical && statusSummary.critical.length > 0 && (
        <div className="rounded-admin border border-admin-danger/20 bg-admin-danger-soft p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 text-admin-danger" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-900">Critical Services Down</h3>
              <div className="mt-2 space-y-1 text-sm">
                {statusSummary.critical.map((service, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="font-medium text-admin-ink">{service.name}</span>
                    <StatusPill tone="danger">{service.status}</StatusPill>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Service Classification Info */}
      <div className="flex items-start gap-3 rounded-admin border border-admin-info/20 bg-admin-info-soft p-4 text-sm text-admin-secondary">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-admin-info" />
        <p>
          <strong className="text-admin-ink">Critical Services</strong> are essential for core application functionality.
          If these services go down, users will experience significant issues.
          <strong className="text-admin-ink"> Non-Critical Services</strong> are supplementary and won&apos;t block core features if unavailable.
        </p>
      </div>

      {/* Status Overview Cards */}
      <StatGrid cols={4}>
        <StatTile label="Total Services" icon={Server} tone="brand" value={statusSummary?.totalServices || 0} />
        <StatTile label="Healthy" icon={CheckCircle} tone="ok" value={statusSummary?.healthy || 0} />
        <StatTile label="Degraded" icon={AlertTriangle} tone={(statusSummary?.degraded || 0) > 0 ? 'warn' : 'muted'} value={statusSummary?.degraded || 0} />
        <StatTile label="Down" icon={XCircle} tone={(statusSummary?.down || 0) > 0 ? 'critical' : 'muted'} value={statusSummary?.down || 0} />
      </StatGrid>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <Segmented
          ariaLabel="View"
          options={[
            { value: 'services', label: 'Services' },
            { value: 'errors', label: 'Recent Errors' },
            { value: 'metrics', label: 'Metrics' },
          ]}
          value={tab}
          onChange={setTab}
        />

        {/* Services Tab */}
        <TabsContent value="services" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {statusSummary?.services.map((service) => (
              <div
                key={service.id}
                className={`admin-panel admin-panel-hover cursor-pointer p-5 ${
                  selectedService === service.id ? 'ring-2 ring-admin-accent' : ''
                }`}
                onClick={() => {
                  setSelectedService(service.id);
                  loadServiceDetails(service.id);
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-admin-accent-border bg-admin-accent-soft text-admin-accent [&>svg]:h-4 [&>svg]:w-4">
                      {getCategoryIcon(service.category)}
                    </div>
                    <div>
                      <h3 className="text-[15px] font-semibold text-admin-ink">{service.displayName}</h3>
                      <div className="mt-1 flex items-center gap-2">
                        <StatusPill tone={service.isCritical ? 'brand' : 'neutral'} dot={false}>
                          {service.isCritical ? 'Critical Service' : 'Non-Critical'}
                        </StatusPill>
                        <StatusPill tone="neutral" dot={false}>{service.category}</StatusPill>
                      </div>
                    </div>
                  </div>
                  {getStatusIcon(service.status)}
                </div>
                <div className="mt-4 space-y-2 border-t border-admin-border pt-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-admin-muted">Status</span>
                    <StatusPill tone={statusTone(service.status)}>{service.status}</StatusPill>
                  </div>
                  {service.responseTime && (
                    <div className="flex justify-between text-sm">
                      <span className="text-admin-muted">Response Time</span>
                      <span className="font-medium tabular-nums text-admin-ink">{service.responseTime}ms</span>
                    </div>
                  )}
                  {service.lastCheck && (
                    <div className="flex justify-between text-sm">
                      <span className="text-admin-muted">Last Check</span>
                      <span className="font-medium text-admin-ink">
                        {new Date(service.lastCheck).toLocaleTimeString()}
                      </span>
                    </div>
                  )}
                  {service.status !== 'healthy' && (service as any).errorMessage && (
                    <div className="mt-2 text-xs text-admin-secondary">
                      <span className="font-medium">Note:</span> {(service as any).errorMessage}
                    </div>
                  )}
                  <button
                    className={`${buttonClass.secondary} mt-3 w-full`}
                    onClick={(e) => {
                      e.stopPropagation();
                      runHealthCheck(service.id);
                    }}
                  >
                    Check Now
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Service Details */}
          {selectedService && serviceMetrics && (
            <SectionCard icon={<TrendingUp />} title="Service Metrics" className="mt-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs font-medium text-admin-muted">24h Uptime</p>
                  <div className="mt-1 flex items-center gap-2">
                    {uptimeBar(serviceMetrics.last24Hours.uptime)}
                    <span className="text-sm font-medium tabular-nums text-admin-ink">
                      {serviceMetrics.last24Hours.uptime.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-admin-muted">Avg Response Time (24h)</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-admin-ink">
                    {serviceMetrics.last24Hours.avgResponseTime.toFixed(0)}ms
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-admin-muted">Error Count (24h)</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-admin-ink">
                    {serviceMetrics.last24Hours.errorCount}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-admin-muted">Total Requests (24h)</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-admin-ink">
                    {serviceMetrics.last24Hours.requestCount}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 border-t border-admin-border pt-6 md:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs font-medium text-admin-muted">7d Uptime</p>
                  <div className="mt-1 flex items-center gap-2">
                    {uptimeBar(serviceMetrics.last7Days.uptime)}
                    <span className="text-sm font-medium tabular-nums text-admin-ink">
                      {serviceMetrics.last7Days.uptime.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-admin-muted">Avg Response Time (7d)</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-admin-ink">
                    {serviceMetrics.last7Days.avgResponseTime.toFixed(0)}ms
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-admin-muted">Error Count (7d)</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-admin-ink">
                    {serviceMetrics.last7Days.errorCount}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-admin-muted">Total Requests (7d)</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-admin-ink">
                    {serviceMetrics.last7Days.requestCount}
                  </p>
                </div>
              </div>
            </SectionCard>
          )}
        </TabsContent>

        {/* Errors Tab */}
        <TabsContent value="errors" className="space-y-4">
          <SectionCard
            icon={<AlertCircle />}
            title="Recent Errors"
            description="Unresolved errors from the last 24 hours"
            padded={false}
          >
            {!recentErrors || recentErrors.length === 0 ? (
              <EmptyState compact className="border-0 shadow-none" icon={<CheckCircle />} title="No recent errors" />
            ) : (
              <div className="max-h-[600px] divide-y divide-admin-border overflow-y-auto">
                {(recentErrors || []).map((error) => (
                  <div key={error.id} className="flex items-start justify-between gap-3 px-5 py-4">
                    <div className="flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <StatusPill tone={getSeverityTone(error.severity)}>{error.severity}</StatusPill>
                        <StatusPill tone="neutral" dot={false}>{error.errorType}</StatusPill>
                        <span className="text-sm text-admin-secondary">
                          {error.service.displayName}
                        </span>
                      </div>
                      <p className="mb-1 text-sm font-medium text-admin-ink">
                        {error.errorMessage}
                      </p>
                      <p className="text-xs text-admin-muted">
                        {new Date(error.occurredAt).toLocaleString()}
                      </p>
                    </div>
                    <button
                      className={buttonClass.small}
                      onClick={() => resolveError(error.id)}
                    >
                      Resolve
                    </button>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </TabsContent>

        {/* Metrics Tab */}
        <TabsContent value="metrics" className="space-y-4">
          <SectionCard
            icon={<Activity />}
            title="System Metrics"
            description="Overall system performance and reliability metrics"
          >
            <div className="space-y-6">
              <div>
                <h3 className="mb-3 text-sm font-semibold text-admin-ink">Overall System Health</h3>
                <StatGrid cols={3}>
                  <StatTile
                    label="System Uptime"
                    icon={TrendingUp}
                    tone="ok"
                    value={`${statusSummary && statusSummary.totalServices > 0
                      ? ((statusSummary.healthy / statusSummary.totalServices) * 100).toFixed(1)
                      : 0}%`}
                  />
                  <StatTile
                    label="Critical Services"
                    icon={Shield}
                    tone="info"
                    value={statusSummary?.services.filter(s => s.isCritical).length || 0}
                  />
                  <StatTile
                    label="Active Incidents"
                    icon={AlertCircle}
                    tone="critical"
                    value={statusSummary?.critical.length || 0}
                  />
                </StatGrid>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-semibold text-admin-ink">Service Categories</h3>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  {['ai', 'database', 'auth', 'infrastructure'].map((category) => {
                    const categoryServices = statusSummary?.services.filter(
                      s => s.category === category
                    ) || [];
                    const healthyCount = categoryServices.filter(
                      s => s.status === 'healthy'
                    ).length;

                    return (
                      <div key={category} className="rounded-admin-sm border border-admin-border p-4">
                        <div className="mb-2 flex items-center gap-2 text-admin-accent">
                          {getCategoryIcon(category)}
                          <span className="text-sm font-medium capitalize text-admin-ink">
                            {category}
                          </span>
                        </div>
                        <div className="text-xl font-bold tabular-nums text-admin-ink">
                          {healthyCount}/{categoryServices.length}
                        </div>
                        <div className="text-xs text-admin-muted">healthy</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>
      </div>
    </AdminPage>
  );
}

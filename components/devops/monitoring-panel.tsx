'use client';

import { CheckCircle2, AlertTriangle, Clock, Server } from 'lucide-react';

type ProbeResult = {
  service?: string;
  url?: string;
  ok?: boolean;
  statusCode?: number;
  latencyMs?: number;
  error?: string;
  consecutiveFailures?: number;
};

type UptimeScan = {
  at?: string;
  targets?: number;
  down?: number;
  results?: ProbeResult[];
};

type RailwayScan = {
  at?: string;
  configured?: boolean;
  services?: number;
  unhealthy?: number;
  error?: string;
  results?: Array<{
    railwayName?: string;
    healthy?: boolean;
    deploymentStatus?: string;
    instanceStatus?: string;
    reason?: string;
  }>;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
}

function ServiceRow({
  name,
  ok,
  detail,
}: {
  name: string;
  ok: boolean;
  detail: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-2 min-w-0">
        {ok ? (
          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
        )}
        <span className="text-sm font-medium text-gray-900 truncate">{name}</span>
      </div>
      <span className={`text-xs shrink-0 ${ok ? 'text-gray-500' : 'text-red-700'}`}>{detail}</span>
    </div>
  );
}

export function DevopsMonitoringPanel({
  worker,
  workerInfo,
}: {
  worker: unknown;
  workerInfo: unknown;
}) {
  const health = asRecord(worker);
  const info = asRecord(workerInfo);
  const uptime = asRecord(health?.last_uptime_probe) as UptimeScan | null;
  const railway = asRecord(health?.last_railway_monitor) as RailwayScan | null;
  const uptimeConfig = asRecord(info?.uptime_probe);
  const railwayConfig = asRecord(info?.railway_monitor);

  const probeIntervalSec =
    typeof uptimeConfig?.interval_ms === 'number'
      ? Math.round(uptimeConfig.interval_ms / 1000)
      : 60;

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden mb-8">
      <div className="px-6 py-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Server className="h-5 w-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900">Production monitoring</h2>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-gray-500">
          {info?.auto_spawn === true && (
            <span className="rounded-full bg-indigo-100 text-indigo-800 px-2 py-0.5 font-medium">
              Cursor auto-fix on
            </span>
          )}
          {uptime?.at && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              Probes every {probeIntervalSec}s · last {new Date(String(uptime.at)).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">HTTP uptime ({uptime?.targets ?? 0} services)</h3>
          {!uptime?.results?.length ? (
            <p className="text-sm text-gray-500">No probe data yet.</p>
          ) : (
            <div>
              {uptime.results.map((r) => (
                <ServiceRow
                  key={r.service ?? r.url}
                  name={String(r.service ?? 'unknown')}
                  ok={Boolean(r.ok)}
                  detail={
                    r.ok
                      ? `HTTP ${r.statusCode ?? '—'} · ${r.latencyMs ?? '—'}ms`
                      : r.error ?? `HTTP ${r.statusCode ?? 'fail'}`
                  }
                />
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Railway deployment status</h3>
          {railway?.configured === false ? (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-3">
              Railway API token not set on the devops worker — set <code className="text-xs">RAILWAY_API_TOKEN</code>{' '}
              to monitor Postgres, Redis, locomotive, and crash states.
            </p>
          ) : !railway?.results?.length ? (
            <p className="text-sm text-gray-500">{railway?.error ?? 'No Railway scan data yet.'}</p>
          ) : (
            <div>
              {railway.results.map((r) => (
                <ServiceRow
                  key={r.railwayName}
                  name={String(r.railwayName)}
                  ok={Boolean(r.healthy)}
                  detail={
                    r.healthy
                      ? `${r.deploymentStatus ?? 'ok'} / ${r.instanceStatus ?? '—'}`
                      : r.reason ?? `${r.deploymentStatus ?? 'unhealthy'}`
                  }
                />
              ))}
            </div>
          )}
          {railwayConfig?.api_configured === true && (
            <p className="text-xs text-gray-500 mt-3">
              Scanning {railway?.services ?? 0} Railway services every{' '}
              {typeof railwayConfig.interval_ms === 'number'
                ? Math.round(railwayConfig.interval_ms / 1000)
                : 60}
              s
            </p>
          )}
        </div>
      </div>

      <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
        This dashboard is served from{' '}
        <span className="font-medium text-gray-700">admin.insighthire.com/devops</span> via the API — the devops
        worker runs as an internal Railway service, not an operator-facing app.
      </div>
    </div>
  );
}

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
    <div className="flex items-center justify-between gap-3 py-2 border-b border-admin-border last:border-0">
      <div className="flex items-center gap-2 min-w-0">
        {ok ? (
          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
        )}
        <span className="text-sm font-medium text-admin-ink truncate">{name}</span>
      </div>
      <span className={`text-xs shrink-0 ${ok ? 'text-admin-muted' : 'text-red-700'}`}>{detail}</span>
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
    <div className="admin-panel overflow-hidden mb-6">
      <div className="px-5 py-4 border-b border-admin-border flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-admin-accent-border bg-admin-accent-soft text-admin-accent">
            <Server className="h-4 w-4" />
          </div>
          <h2 className="text-[15px] font-semibold text-admin-ink">Production monitoring</h2>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-admin-muted">
          {info?.auto_spawn === true && (
            <span className="rounded-full bg-admin-accent-soft text-admin-accent-ink ring-1 ring-inset ring-admin-accent/20 px-2 py-0.5 font-medium">
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

      <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className="text-sm font-semibold text-admin-ink mb-3">HTTP uptime ({uptime?.targets ?? 0} services)</h3>
          {!uptime?.results?.length ? (
            <p className="text-sm text-admin-muted">No probe data yet.</p>
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
          <h3 className="text-sm font-semibold text-admin-ink mb-3">Railway deployment status</h3>
          {railway?.configured === false ? (
            <p className="text-sm text-amber-900 bg-admin-warn-soft border border-admin-warn/25 rounded-admin-sm p-3">
              Railway API token not set on the devops worker — set <code className="text-xs">RAILWAY_API_TOKEN</code>{' '}
              to monitor Postgres, Redis, locomotive, and crash states.
            </p>
          ) : !railway?.results?.length ? (
            <p className="text-sm text-admin-muted">{railway?.error ?? 'No Railway scan data yet.'}</p>
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
            <p className="text-xs text-admin-muted mt-3">
              Scanning {railway?.services ?? 0} Railway services every{' '}
              {typeof railwayConfig.interval_ms === 'number'
                ? Math.round(railwayConfig.interval_ms / 1000)
                : 60}
              s
            </p>
          )}
        </div>
      </div>

      <div className="px-5 py-3 bg-admin-bg/50 border-t border-admin-border text-xs text-admin-muted">
        This dashboard is served from{' '}
        <span className="font-medium text-admin-secondary">admin.insighthire.com/devops</span> via the API — the devops
        worker runs as an internal Railway service, not an operator-facing app.
      </div>
    </div>
  );
}

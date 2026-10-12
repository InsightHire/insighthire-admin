import Link from 'next/link';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Severity } from './severity-badge';

const TONE_COLOR: Record<Severity | 'brand', string> = {
  brand: '#097f3c',
  ok: '#059669',
  critical: '#dc2626',
  warn: '#d97706',
  info: '#0284c7',
  muted: '#94a3b8',
};

const TONE_DOT: Record<Severity | 'brand', string> = {
  brand: 'bg-admin-accent',
  ok: 'bg-admin-ok',
  critical: 'bg-admin-danger',
  warn: 'bg-admin-warn',
  info: 'bg-admin-info',
  muted: 'bg-slate-300',
};

const TONE_ICON: Record<Severity | 'brand', string> = {
  brand: 'bg-admin-accent-soft text-admin-accent border-admin-accent-border',
  ok: 'bg-admin-ok-soft text-admin-ok border-admin-ok/20',
  critical: 'bg-admin-danger-soft text-admin-danger border-admin-danger/20',
  warn: 'bg-admin-warn-soft text-admin-warn border-admin-warn/25',
  info: 'bg-admin-info-soft text-admin-info border-admin-info/20',
  muted: 'bg-slate-50 text-slate-500 border-slate-200',
};

export type StatTone = Severity | 'brand';

/** Small SVG area chart; renders nothing when every point is zero. */
export function Sparkline({
  data,
  tone = 'brand',
  className,
}: {
  data: number[];
  tone?: StatTone;
  className?: string;
}) {
  if (data.length < 2 || !data.some((v) => v > 0)) return null;
  const w = 100;
  const h = 32;
  const max = Math.max(...data, 1);
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => [i * step, h - 2 - (v / max) * (h - 6)] as const);
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const area = `${line} L${w},${h} L0,${h} Z`;
  const color = TONE_COLOR[tone];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn('h-10 w-full', className)} aria-hidden>
      <path d={area} fill={color} fillOpacity={0.1} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export type StatDelta = { value: string; direction: 'up' | 'down' | 'flat'; good?: boolean; label?: string };

export function DeltaChip({ delta }: { delta: StatDelta }) {
  const tone =
    delta.direction === 'flat' || delta.good === undefined
      ? 'bg-slate-100 text-slate-600'
      : delta.good
        ? 'bg-admin-ok-soft text-admin-ok'
        : 'bg-admin-danger-soft text-admin-danger';
  const Icon = delta.direction === 'down' ? ArrowDownRight : ArrowUpRight;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-xs">
      <span className={cn('inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold tabular-nums', tone)}>
        {delta.direction !== 'flat' ? <Icon className="h-3 w-3" strokeWidth={2.5} /> : null}
        {delta.value}
      </span>
      {delta.label ? <span className="truncate text-admin-muted">{delta.label}</span> : null}
    </span>
  );
}

export type StatTileProps = {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: StatTone;
  delta?: StatDelta;
  spark?: number[];
  href?: string;
  loading?: boolean;
  className?: string;
};

/** KPI tile: label, big number, optional delta, hint and a sparkline pinned to the bottom. */
export function StatTile({ label, value, hint, icon: Icon, tone = 'muted', delta, spark, href, loading, className }: StatTileProps) {
  const hasSpark = !loading && !!spark && spark.length > 1 && spark.some((v) => v > 0);
  const body = (
    <div
      className={cn(
        'admin-panel group relative h-full overflow-hidden p-4',
        hasSpark && 'pb-12',
        href && 'admin-panel-hover',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          {!Icon ? <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', TONE_DOT[tone])} /> : null}
          <span className="truncate text-xs font-medium text-admin-muted">{label}</span>
        </span>
        {Icon ? (
          <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md border', TONE_ICON[tone])}>
            <Icon className="h-3.5 w-3.5" />
          </span>
        ) : null}
      </div>
      {loading ? (
        <div className="mt-2.5 space-y-2">
          <div className="h-7 w-20 animate-pulse rounded bg-slate-100" />
          <div className="h-3.5 w-28 animate-pulse rounded bg-slate-100" />
        </div>
      ) : (
        <>
          <p className="mt-1.5 truncate text-[1.65rem] font-bold leading-tight tracking-tight text-admin-ink tabular-nums">
            {value}
          </p>
          {delta ? (
            <div className="mt-1.5">
              <DeltaChip delta={delta} />
            </div>
          ) : null}
          {hint ? <p className="mt-1 truncate text-[11px] text-admin-muted">{hint}</p> : null}
        </>
      )}
      {hasSpark ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0">
          <Sparkline data={spark!} tone={tone === 'muted' ? 'brand' : tone} />
        </div>
      ) : null}
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}

const GRID_COLS: Record<number, string> = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
  5: 'sm:grid-cols-3 xl:grid-cols-5',
  6: 'sm:grid-cols-3 xl:grid-cols-6',
};

export function StatGrid({ children, cols = 4, className }: { children: React.ReactNode; cols?: number; className?: string }) {
  return <div className={cn('grid grid-cols-2 gap-3', GRID_COLS[cols] ?? GRID_COLS[4], className)}>{children}</div>;
}

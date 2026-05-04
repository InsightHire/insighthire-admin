'use client';

import { useState } from 'react';
import { clsx } from 'clsx';

// ---------- Score + delta presentation ----------

export function ScoreBar({
  value,
  max = 100,
  color = 'blue',
  label,
  compact = false,
}: {
  value: number | null | undefined;
  max?: number;
  color?: 'blue' | 'emerald' | 'amber' | 'red' | 'indigo' | 'purple';
  label?: string;
  compact?: boolean;
}) {
  const bar = {
    blue: 'bg-blue-500',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
    indigo: 'bg-indigo-500',
    purple: 'bg-purple-500',
  }[color];
  const v = value == null ? 0 : Number(value);
  const pct = Math.max(0, Math.min(100, (v / max) * 100));

  if (value == null) {
    return <span className="text-gray-400 text-xs">—</span>;
  }

  return (
    <div className={compact ? 'flex items-center space-x-2' : 'w-full'}>
      {label && !compact && (
        <div className="flex justify-between text-xs text-gray-600 mb-0.5">
          <span>{label}</span>
          <span className="tabular-nums">{v.toFixed(max === 5 ? 1 : 0)}{max === 100 ? '' : `/${max}`}</span>
        </div>
      )}
      <div className={clsx('bg-gray-200 rounded-full h-2', compact ? 'w-20' : 'w-full')}>
        <div className={`${bar} h-2 rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      {compact && (
        <span className="text-xs tabular-nums text-gray-700 w-10 text-right">{v.toFixed(0)}</span>
      )}
    </div>
  );
}

export function DeltaBadge({ delta }: { delta: number | null | undefined }) {
  if (delta == null) return <span className="text-gray-400 text-xs">—</span>;
  const d = Number(delta);
  const abs = Math.abs(d);
  const tone =
    abs < 5 ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : abs < 12 ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-red-50 text-red-700 border-red-200';
  const sign = d > 0 ? '+' : '';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${tone}`}>
      AI {sign}{d.toFixed(1)}
    </span>
  );
}

export function StatusChip({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-gray-400 text-xs">—</span>;
  const s = status.toUpperCase();
  const tone =
    s === 'COMPLETED' || s === 'COMPLETE' ? 'bg-emerald-100 text-emerald-800'
    : s === 'PROCESSING' || s === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800'
    : s === 'PENDING' ? 'bg-gray-100 text-gray-700'
    : s === 'FAILED' || s === 'ERROR' ? 'bg-red-100 text-red-800'
    : s === 'REQUIRES_REVIEW' ? 'bg-amber-100 text-amber-800'
    : 'bg-gray-100 text-gray-800';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${tone}`}>
      {status}
    </span>
  );
}

// ---------- Small stat card ----------

export function KpiCard({
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: 'neutral' | 'ok' | 'warn' | 'alert' | 'info';
}) {
  const toneCls =
    tone === 'ok' ? 'border-emerald-200 bg-emerald-50'
    : tone === 'warn' ? 'border-amber-200 bg-amber-50'
    : tone === 'alert' ? 'border-red-200 bg-red-50'
    : tone === 'info' ? 'border-blue-200 bg-blue-50'
    : 'border-gray-200 bg-white';
  return (
    <div className={`rounded-lg border ${toneCls} p-4`}>
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-900 tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-xs text-gray-600">{sub}</div>}
    </div>
  );
}

// ---------- Section header ----------

export function SectionHeading({
  title,
  subtitle,
  right,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

// ---------- Collapsible JSON viewer ----------

export function JsonViewer({
  value,
  title = 'JSON',
  defaultOpen = false,
  max = 20000,
}: {
  value: unknown;
  title?: string;
  defaultOpen?: boolean;
  max?: number;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);
  if (value == null || (typeof value === 'object' && !Array.isArray(value) && Object.keys(value as object).length === 0)) {
    return (
      <div className="text-xs text-gray-400 italic">No {title.toLowerCase()} data.</div>
    );
  }
  const s = JSON.stringify(value, null, 2);
  const truncated = s.length > max;
  const display = truncated ? `${s.slice(0, max)}\n... [truncated ${s.length - max} chars]` : s;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 transition"
        onClick={() => setOpen(o => !o)}
      >
        <span className="flex items-center space-x-2">
          <span className={`transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
          <span>{title}</span>
          <span className="text-gray-400 font-normal">({(s.length / 1024).toFixed(1)} KB)</span>
        </span>
        {open && (
          <span
            className="text-[10px] px-2 py-0.5 rounded border text-gray-600 hover:bg-white"
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(s);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </span>
        )}
      </button>
      {open && (
        <pre className="p-3 text-xs text-gray-800 bg-white overflow-x-auto max-h-96 whitespace-pre font-mono">
{display}
        </pre>
      )}
    </div>
  );
}

// ---------- Disclosure (simple expandable block) ----------

export function Disclosure({
  title,
  subtitle,
  defaultOpen = false,
  children,
  rightBadge,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  rightBadge?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center space-x-3">
          <span className={`text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
          <div>
            <div className="text-sm font-medium text-gray-900">{title}</div>
            {subtitle && <div className="text-xs text-gray-500 mt-0.5">{subtitle}</div>}
          </div>
        </div>
        {rightBadge}
      </button>
      {open && <div className="border-t border-gray-200 p-4 bg-gray-50">{children}</div>}
    </div>
  );
}

// ---------- Value list for labeled key/value grids ----------

export function ValueList({
  items,
  columns = 2,
}: {
  items: Array<{ label: string; value: React.ReactNode }>;
  columns?: 1 | 2 | 3;
}) {
  const cls = columns === 1 ? '' : columns === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2';
  return (
    <dl className={`grid grid-cols-1 ${cls} gap-x-6 gap-y-2`}>
      {items.map((it, i) => (
        <div key={i} className="flex justify-between items-start border-b border-gray-100 py-1.5">
          <dt className="text-xs text-gray-500 uppercase tracking-wide">{it.label}</dt>
          <dd className="text-sm text-gray-900 text-right ml-4 break-words">
            {it.value == null || it.value === '' ? <span className="text-gray-400">—</span> : it.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// ---------- Sufficiency badge used in orchestrator replay ----------

export function SufficiencyBadge({ level }: { level: string | null | undefined }) {
  if (!level) return <span className="text-gray-400 text-xs">—</span>;
  const tone =
    level === 'sufficient' ? 'bg-emerald-100 text-emerald-800'
    : level === 'partial' ? 'bg-amber-100 text-amber-800'
    : level === 'insufficient' ? 'bg-red-100 text-red-800'
    : 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${tone}`}>
      {level}
    </span>
  );
}

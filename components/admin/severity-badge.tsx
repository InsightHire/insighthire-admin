import { cn } from '@/lib/cn';

const severityStyles = {
  critical: 'bg-admin-danger-soft text-admin-danger border-admin-danger/20',
  warn: 'bg-admin-warn-soft text-admin-warn border-admin-warn/25',
  info: 'bg-admin-info-soft text-admin-info border-admin-info/20',
  ok: 'bg-admin-ok-soft text-admin-ok border-admin-ok/20',
  muted: 'bg-slate-100 text-slate-600 border-slate-200',
} as const;

export type Severity = keyof typeof severityStyles;

export function SeverityBadge({
  severity,
  children,
  pulse,
  className,
}: {
  severity: Severity;
  children: React.ReactNode;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-admin-sm border px-2 py-0.5 text-xs font-semibold tracking-wide',
        severityStyles[severity],
        pulse && severity === 'critical' && 'severity-pulse',
        className,
      )}
    >
      {children}
    </span>
  );
}

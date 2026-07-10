import { cn } from '@/lib/cn';
import type { Severity } from './severity-badge';

export type StatItem = {
  label: string;
  value: string | number;
  hint?: string;
  severity?: Severity;
  href?: string;
};

const severityBorder: Record<Severity, string> = {
  critical: 'border-l-admin-danger',
  warn: 'border-l-admin-warn',
  info: 'border-l-admin-info',
  ok: 'border-l-admin-ok',
  muted: 'border-l-slate-300',
};

export function StatStrip({ items, className }: { items: StatItem[]; className?: string }) {
  return (
    <div className={cn('grid grid-cols-2 gap-3 lg:grid-cols-4', className)}>
      {items.map((item) => {
        const inner = (
          <div
            className={cn(
              'admin-panel border-l-4 p-4 transition-colors',
              severityBorder[item.severity ?? 'muted'],
              item.href && 'hover:border-admin-accent/40',
            )}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-admin-muted">
              {item.label}
            </p>
            <p className="admin-mono mt-2 text-2xl font-semibold tabular-nums text-admin-ink">
              {item.value}
            </p>
            {item.hint ? <p className="mt-1 text-xs text-admin-muted">{item.hint}</p> : null}
          </div>
        );
        return item.href ? (
          <a key={item.label} href={item.href} className="block">
            {inner}
          </a>
        ) : (
          <div key={item.label}>{inner}</div>
        );
      })}
    </div>
  );
}

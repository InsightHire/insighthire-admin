import type { Severity } from './severity-badge';
import { StatGrid, StatTile } from './stat-tile';

export type StatItem = {
  label: string;
  value: string | number;
  hint?: string;
  severity?: Severity;
  href?: string;
  icon?: React.ComponentType<{ className?: string }>;
  spark?: number[];
};

export function StatStrip({ items, className }: { items: StatItem[]; className?: string }) {
  return (
    <StatGrid cols={items.length >= 4 ? 4 : items.length} className={className}>
      {items.map((item) => (
        <StatTile
          key={item.label}
          label={item.label}
          value={item.value}
          hint={item.hint}
          tone={item.severity ?? 'muted'}
          href={item.href}
          icon={item.icon}
          spark={item.spark}
        />
      ))}
    </StatGrid>
  );
}

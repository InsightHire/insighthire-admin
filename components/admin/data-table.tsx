import { cn } from '@/lib/cn';

export function DataTable({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('admin-panel overflow-hidden', className)}>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

export function DataTableEl({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <table className={cn('min-w-full divide-y divide-admin-border text-left text-sm', className)}>
      {children}
    </table>
  );
}

export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        'bg-slate-50/80 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-admin-muted',
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className, mono }: { children?: React.ReactNode; className?: string; mono?: boolean }) {
  return (
    <td className={cn('px-3 py-2.5 text-admin-secondary', mono && 'admin-mono text-xs', className)}>
      {children}
    </td>
  );
}

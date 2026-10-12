import { Inbox } from 'lucide-react';
import { cn } from '@/lib/cn';

export function EmptyState({
  title,
  description,
  icon,
  action,
  compact,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  /** Smaller padding for use inside cards. */
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'admin-panel flex flex-col items-center justify-center text-center',
        compact ? 'px-6 py-10' : 'px-6 py-16',
        className,
      )}
    >
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-admin-border bg-admin-bg text-admin-muted [&>svg]:h-5 [&>svg]:w-5">
        {icon ?? <Inbox />}
      </div>
      <p className="text-sm font-semibold text-admin-ink">{title}</p>
      {description ? <p className="mt-1 max-w-md text-sm text-admin-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

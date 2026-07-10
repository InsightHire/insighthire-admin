import { cn } from '@/lib/cn';

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'admin-panel flex flex-col items-center justify-center px-6 py-16 text-center',
        className,
      )}
    >
      {icon ? <div className="mb-3 text-admin-muted">{icon}</div> : null}
      <p className="text-sm font-semibold text-admin-ink">{title}</p>
      {description ? <p className="mt-1 max-w-md text-sm text-admin-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

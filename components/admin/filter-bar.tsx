import { cn } from '@/lib/cn';

export function FilterBar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'admin-panel mb-4 flex flex-wrap items-center gap-3 px-3 py-2.5',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function FilterSelect({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  className?: string;
}) {
  return (
    <label className={cn('flex items-center gap-2 text-xs text-admin-muted', className)}>
      <span className="font-medium whitespace-nowrap">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-admin-sm border-admin-border bg-white py-1.5 pl-2 pr-8 text-sm text-admin-ink shadow-sm focus:border-admin-accent focus:ring-admin-accent"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FilterInput({
  label,
  value,
  onChange,
  placeholder,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={cn('flex min-w-[12rem] flex-1 items-center gap-2 text-xs text-admin-muted', className)}>
      <span className="font-medium whitespace-nowrap">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-admin-sm border-admin-border bg-white py-1.5 px-2.5 text-sm text-admin-ink shadow-sm focus:border-admin-accent focus:ring-admin-accent"
      />
    </label>
  );
}

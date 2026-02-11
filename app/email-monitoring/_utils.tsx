'use client';

export function formatDate(date: string | Date | null) {
  if (!date) return '-';
  return new Date(date).toLocaleString();
}

export function getStatusBadge(status: string) {
  const styles: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    SENT: 'bg-green-100 text-green-800',
    FAILED: 'bg-red-100 text-red-800',
    CANCELLED: 'bg-gray-100 text-gray-800',
    OPENED: 'bg-blue-100 text-blue-800',
    CLICKED: 'bg-purple-100 text-purple-800',
    BOUNCED: 'bg-red-100 text-red-800',
    accepted: 'bg-green-100 text-green-800',
    delivered: 'bg-green-100 text-green-800',
    opened: 'bg-blue-100 text-blue-800',
    clicked: 'bg-purple-100 text-purple-800',
    failed: 'bg-red-100 text-red-800',
    rejected: 'bg-red-100 text-red-800',
    stored: 'bg-gray-100 text-gray-800',
  };
  return styles[status] || 'bg-gray-100 text-gray-800';
}

export function getDeliveryBadge(method: string) {
  const styles: Record<string, string> = {
    IMMEDIATE: 'bg-blue-100 text-blue-800',
    DAILY_DIGEST: 'bg-indigo-100 text-indigo-800',
    WEEKLY_DIGEST: 'bg-purple-100 text-purple-800',
  };
  return styles[method] || 'bg-gray-100 text-gray-800';
}

export function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

export function StatCard({ title, value, icon: Icon, color }: { title: string; value: number; icon: any; color: string }) {
  const colors: Record<string, string> = {
    yellow: 'bg-yellow-50 text-yellow-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
  };
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-500">{title}</div>
          <div className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</div>
        </div>
        <div className={`p-3 rounded-full ${colors[color]}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}

export function MiniStat({ label, value, color, suffix }: { label: string; value?: number | null; color: string; suffix?: string }) {
  const colors: Record<string, string> = {
    yellow: 'border-yellow-300 bg-yellow-50',
    green: 'border-green-300 bg-green-50',
    red: 'border-red-300 bg-red-50',
    blue: 'border-blue-300 bg-blue-50',
    purple: 'border-purple-300 bg-purple-50',
    gray: 'border-gray-300 bg-gray-50',
  };
  return (
    <div className={`rounded-lg border p-3 ${colors[color]}`}>
      <div className="text-xs text-gray-600">{label}</div>
      <div className="text-lg font-semibold text-gray-900">
        {(value ?? 0).toLocaleString()}
        {suffix && <span className="text-xs text-gray-500 ml-1">{suffix}</span>}
      </div>
    </div>
  );
}

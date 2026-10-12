'use client';

import { StatTile, type StatTone } from '@/components/admin/stat-tile';

export function formatDate(date: string | Date | null) {
  if (!date) return '-';
  return new Date(date).toLocaleString();
}

const BADGE = {
  warn: 'bg-admin-warn-soft text-amber-800 ring-1 ring-inset ring-amber-600/20',
  ok: 'bg-admin-ok-soft text-emerald-700 ring-1 ring-inset ring-emerald-600/15',
  danger: 'bg-admin-danger-soft text-red-700 ring-1 ring-inset ring-red-600/15',
  neutral: 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-500/15',
  info: 'bg-admin-info-soft text-sky-700 ring-1 ring-inset ring-sky-600/15',
  brand: 'bg-admin-accent-soft text-admin-accent-ink ring-1 ring-inset ring-admin-accent/20',
  purple: 'bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/15',
} as const;

export function getStatusBadge(status: string) {
  const styles: Record<string, string> = {
    PENDING: BADGE.warn,
    SENT: BADGE.ok,
    FAILED: BADGE.danger,
    CANCELLED: BADGE.neutral,
    OPENED: BADGE.info,
    CLICKED: BADGE.purple,
    BOUNCED: BADGE.danger,
    accepted: BADGE.ok,
    delivered: BADGE.ok,
    opened: BADGE.info,
    clicked: BADGE.purple,
    failed: BADGE.danger,
    rejected: BADGE.danger,
    stored: BADGE.neutral,
  };
  return styles[status] || BADGE.neutral;
}

export function getDeliveryBadge(method: string) {
  const styles: Record<string, string> = {
    IMMEDIATE: BADGE.info,
    DAILY_DIGEST: BADGE.brand,
    WEEKLY_DIGEST: BADGE.purple,
  };
  return styles[method] || BADGE.neutral;
}

export function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

const COLOR_TONE: Record<string, StatTone> = {
  yellow: 'warn',
  green: 'ok',
  red: 'critical',
  blue: 'info',
  purple: 'brand',
  gray: 'muted',
};

export function StatCard({ title, value, icon: Icon, color }: { title: string; value: number; icon: any; color: string }) {
  return <StatTile label={title} value={value.toLocaleString()} icon={Icon} tone={COLOR_TONE[color] ?? 'muted'} />;
}

export function MiniStat({ label, value, color, suffix }: { label: string; value?: number | null; color: string; suffix?: string }) {
  return <StatTile label={label} value={(value ?? 0).toLocaleString()} hint={suffix} tone={COLOR_TONE[color] ?? 'muted'} />;
}

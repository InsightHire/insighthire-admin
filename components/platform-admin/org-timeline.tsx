'use client';

/**
 * Support timeline — one chronological feed for an org merging admin audit
 * entries, scoring events, sent emails, and rescore operations, so "what
 * happened to this customer this week" is one glance.
 */
import { useState } from 'react';
import { trpc } from '@/lib/trpc';

const TYPE_STYLES: Record<string, [string, string]> = {
  audit: ['Admin', 'bg-purple-100 text-purple-800'],
  scoring: ['Scoring', 'bg-blue-100 text-blue-800'],
  email: ['Email', 'bg-green-100 text-green-800'],
  rescore: ['Rescore', 'bg-amber-100 text-amber-800'],
};

const FILTERS = ['all', 'audit', 'scoring', 'email', 'rescore'] as const;

export function OrgTimelineSection({ organizationId }: { organizationId: string }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');
  const timeline = (trpc as any).platformAdmin.getOrgTimeline.useQuery(
    { organizationId, limit: 60 },
    { refetchOnWindowFocus: false },
  );

  const entries: { id: string; at: string; type: string; title: string; detail: string }[] =
    (timeline.data ?? []).filter((e: any) => filter === 'all' || e.type === filter);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Support timeline</h2>
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 text-xs rounded-full font-medium capitalize ${
                filter === f ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {timeline.isLoading ? (
        <p className="text-sm text-gray-400">Loading timeline…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-gray-400">No activity recorded for this filter.</p>
      ) : (
        <div className="space-y-0 max-h-[28rem] overflow-y-auto">
          {entries.map((e) => {
            const [label, style] = TYPE_STYLES[e.type] ?? [e.type, 'bg-gray-100 text-gray-600'];
            return (
              <div key={e.id} className="flex items-start gap-3 py-2 border-b border-gray-50 text-sm">
                <span className="text-xs text-gray-400 tabular-nums whitespace-nowrap w-32 shrink-0 pt-0.5">
                  {new Date(e.at).toLocaleString(undefined, {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </span>
                <span className={`px-1.5 py-0.5 text-xs rounded shrink-0 ${style}`}>{label}</span>
                <span className="min-w-0">
                  <span className="block font-medium text-gray-900 truncate">{e.title}</span>
                  {e.detail && <span className="block text-xs text-gray-500 truncate">{e.detail}</span>}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

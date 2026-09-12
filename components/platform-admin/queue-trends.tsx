'use client';

/**
 * Real BullMQ getJobCounts() trend per queue — early warning for scoring
 * backlogs. Separate from the Queue Overview cards above (those derive their
 * two cards from Prisma row counts, not the actual job queue).
 */
import { trpc } from '@/lib/trpc';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';

type Sample = { t: number; waiting: number; active: number; completed: number; failed: number; delayed: number };
type Trend = { name: string; series: Sample[]; oldestWaitingAgeMs: number | null };

export function QueueTrendsSection() {
  const trends = (trpc as any).platformAdmin.getQueueTrends.useQuery(undefined, {
    refetchOnWindowFocus: false,
    refetchInterval: 5 * 60 * 1000,
  });

  const rows: Trend[] = (trends.data ?? [])
    .filter((t: Trend) => t.series.length > 0)
    .sort((a: Trend, b: Trend) => {
      const aw = a.series[a.series.length - 1]?.waiting ?? 0;
      const bw = b.series[b.series.length - 1]?.waiting ?? 0;
      return bw - aw;
    });

  if (trends.isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <p className="text-sm text-gray-400">Loading queue trends…</p>
      </div>
    );
  }
  if (rows.length === 0) return null;

  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Queue trends</h2>
      <p className="text-sm text-gray-500 mb-4">
        Sampled every 5 minutes, 48h retention. Red border = waiting is growing while active is flat.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.map((q) => {
          const latest = q.series[q.series.length - 1];
          const earlier = q.series[Math.max(0, q.series.length - 6)];
          const growingBacklog =
            latest && earlier && latest.waiting > earlier.waiting && latest.active <= earlier.active;
          const oldestMin = q.oldestWaitingAgeMs != null ? Math.round(q.oldestWaitingAgeMs / 60000) : null;

          return (
            <div
              key={q.name}
              className={`bg-white rounded-lg shadow p-4 ${growingBacklog ? 'border-2 border-red-400' : ''}`}
            >
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium text-gray-900 truncate">{q.name.replace(/_/g, ' ')}</p>
                <p className="text-xs text-gray-500 shrink-0">
                  {latest?.waiting ?? 0} waiting{latest ? ` · ${latest.active} active` : ''}
                </p>
              </div>
              <div className="h-12">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={q.series}>
                    <YAxis hide domain={[0, 'auto']} />
                    <Line type="monotone" dataKey="waiting" stroke="#dc2626" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="active" stroke="#7c3aed" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {oldestMin != null && oldestMin > 30 && (
                <p className="text-xs text-red-700 mt-1">Oldest waiting job: {oldestMin}min</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

'use client';

import { trpc } from '@/lib/trpc';

type Family = {
  family: string;
  hires: number;
  retained90Pct: number | null;
  stayersAvgScore: number | null;
  leaversAvgScore: number | null;
  scoreGap: number | null;
  retentionDelta: number | null;
  enoughData: boolean;
  hint: 'SCORES_TOO_GENEROUS' | 'SCORES_SEPARATE' | 'NO_CLEAR_DIFFERENCE' | 'NOT_ENOUGH_DATA';
};

type Evidence = { months: number; hiresWithOutcome: number; minSample: number; families: Family[] };

const HINT: Record<Family['hint'], { text: string; tone: string }> = {
  SCORES_TOO_GENEROUS: { text: 'Leavers scored higher than stayers. Scores may be too generous here.', tone: 'text-amber-700' },
  SCORES_SEPARATE: { text: 'Scores separate stayers from leavers.', tone: 'text-green-700' },
  NO_CLEAR_DIFFERENCE: { text: 'No clear difference between stayers and leavers.', tone: 'text-gray-600' },
  NOT_ENOUGH_DATA: { text: 'Not enough hires with a 90-day outcome yet.', tone: 'text-gray-400' },
};

const show = (v: number | null, suffix = '') => (v === null ? '—' : `${v}${suffix}`);

/** ONBX-R05: 90-day outcome deltas per job family. Advisory: nothing here changes a score. */
export function OutcomeCalibrationEvidence({ organizationId }: { organizationId: string }) {
  const q = trpc.platformAdmin.getOutcomeCalibrationEvidence.useQuery({ organizationId, months: 24 }, { retry: 1 });
  const d = q.data as Evidence | undefined;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">90-day outcome evidence (advisory)</h2>
        <p className="text-sm text-gray-500 mt-1">
          Hires from the last 24 months with a 90-day outcome, by job family (EEO job category, else department). Score is
          the Journey score, else the AI score at decision. Use it to inform the leniency setting above; it never changes
          scores on its own. Families need {d?.minSample ?? 20} hires before a hint is shown.
        </p>
      </div>
      {q.error && <p className="text-sm text-red-600">{q.error.message}</p>}
      {q.isLoading && <p className="text-sm text-gray-500">Loading…</p>}
      {d && d.families.length === 0 && <p className="text-sm text-gray-500">No hires with a 90-day outcome yet.</p>}
      {d && d.families.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="py-1 pr-3 font-medium">Job family</th>
                <th className="py-1 pr-3 font-medium">Hires</th>
                <th className="py-1 pr-3 font-medium">Stayed 90 days</th>
                <th className="py-1 pr-3 font-medium">Avg score, stayers</th>
                <th className="py-1 pr-3 font-medium">Avg score, leavers</th>
                <th className="py-1 pr-3 font-medium">Top half vs bottom half</th>
                <th className="py-1 font-medium">Reading</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {d.families.map((f) => (
                <tr key={f.family} className={f.enoughData ? '' : 'opacity-60'}>
                  <td className="py-1.5 pr-3">{f.family.replace(/_/g, ' ').toLowerCase()}</td>
                  <td className="py-1.5 pr-3">{f.hires}</td>
                  <td className="py-1.5 pr-3">{show(f.retained90Pct, '%')}</td>
                  <td className="py-1.5 pr-3">{show(f.stayersAvgScore)}</td>
                  <td className="py-1.5 pr-3">{show(f.leaversAvgScore)}</td>
                  <td className="py-1.5 pr-3">{f.retentionDelta === null ? '—' : `${f.retentionDelta > 0 ? '+' : ''}${f.retentionDelta} pts`}</td>
                  <td className={`py-1.5 text-xs ${HINT[f.hint].tone}`}>{HINT[f.hint].text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

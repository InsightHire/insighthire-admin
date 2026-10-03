'use client';

import { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { PageHeader } from '@/components/admin/page-header';

type StudyRow = {
  slug: string;
  company: string;
  headline: string;
  approved: boolean;
};

export default function CaseStudyApprovalsPage() {
  const { data, isLoading, refetch } = trpc.caseStudies.list.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const [rows, setRows] = useState<StudyRow[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data?.studies) setRows(data.studies as StudyRow[]);
  }, [data?.studies]);

  const updateMutation = trpc.caseStudies.setApprovals.useMutation({
    onSuccess: () => {
      void refetch();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const handleSave = () => {
    const decisions: Record<string, boolean> = {};
    for (const row of rows) decisions[row.slug] = row.approved;
    updateMutation.mutate({ decisions });
  };

  return (
    <AuthenticatedLayout>
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <PageHeader
          eyebrow="Content"
          title="Case studies"
          description="Named stories stay off www.insighthire.com until you approve them. Anonymous pilot results stay on the case studies page."
        />

        {isLoading ? (
          <div className="admin-panel py-16 text-center text-sm text-admin-muted">Loading…</div>
        ) : (
          <div className="admin-panel space-y-4 p-6">
            {rows.map((row) => (
              <label
                key={row.slug}
                className="flex cursor-pointer items-start gap-3 rounded-admin-sm border border-admin-border p-4 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={row.approved}
                  onChange={(e) =>
                    setRows((current) =>
                      current.map((item) =>
                        item.slug === row.slug ? { ...item, approved: e.target.checked } : item,
                      ),
                    )
                  }
                  className="mt-1 h-4 w-4 rounded border-admin-border text-admin-accent focus:ring-admin-accent"
                />
                <div>
                  <span className="text-sm font-semibold text-admin-ink">{row.company}</span>
                  <p className="mt-1 text-xs text-admin-muted">{row.headline}</p>
                </div>
              </label>
            ))}

            {updateMutation.error ? (
              <p className="text-sm text-red-600">
                {(updateMutation.error as { message?: string }).message ?? 'Save failed'}
              </p>
            ) : null}

            <div className="flex items-center gap-3 border-t border-admin-border pt-4">
              <button
                type="button"
                onClick={handleSave}
                disabled={updateMutation.isPending || rows.length === 0}
                className="inline-flex items-center rounded-admin-sm bg-admin-ink px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {updateMutation.isPending ? 'Saving…' : 'Save'}
              </button>
              {saved ? <span className="text-sm font-medium text-emerald-600">Saved</span> : null}
            </div>
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
}

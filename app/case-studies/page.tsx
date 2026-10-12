'use client';

import { useEffect, useState } from 'react';
import { BookOpen, Trophy } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { AdminPageChrome } from '@/components/admin/page-chrome';
import { SectionCard } from '@/components/admin/section-card';
import { StatusPill } from '@/components/admin/status-pill';
import { EmptyState } from '@/components/admin/empty-state';
import { buttonClass, checkboxClass } from '@/components/admin/controls';

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
      <AdminPageChrome
        width="narrow"
        icon={<Trophy />}
        breadcrumbs={[{ label: 'Content' }, { label: 'Case studies' }]}
        title="Case studies"
        description="Named stories stay off www.insighthire.com until you approve them. Anonymous pilot results stay on the case studies page."
      >
        {isLoading ? (
          <div className="admin-panel py-16 text-center text-sm text-admin-muted">Loading…</div>
        ) : (
          <SectionCard
            icon={<BookOpen />}
            title="Named stories"
            description="Check a story to publish it on the marketing site"
            bodyClassName="space-y-4"
          >
            {rows.length === 0 ? (
              <EmptyState compact className="border-dashed shadow-none" icon={<BookOpen />} title="No case studies yet" />
            ) : null}
            {rows.map((row) => (
              <label
                key={row.slug}
                className="flex cursor-pointer items-start gap-3 rounded-admin-sm border border-admin-border p-4 hover:bg-admin-bg/70"
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
                  className={`${checkboxClass} mt-1`}
                />
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-semibold text-admin-ink">{row.company}</span>
                  <p className="mt-1 text-xs text-admin-muted">{row.headline}</p>
                </div>
                <StatusPill tone={row.approved ? 'success' : 'neutral'}>{row.approved ? 'Approved' : 'Hidden'}</StatusPill>
              </label>
            ))}

            {updateMutation.error ? (
              <p className="text-sm text-admin-danger">
                {(updateMutation.error as { message?: string }).message ?? 'Save failed'}
              </p>
            ) : null}

            <div className="flex items-center gap-3 border-t border-admin-border pt-4">
              <button
                type="button"
                onClick={handleSave}
                disabled={updateMutation.isPending || rows.length === 0}
                className={buttonClass.primary}
              >
                {updateMutation.isPending ? 'Saving…' : 'Save'}
              </button>
              {saved ? <StatusPill tone="success">Saved</StatusPill> : null}
            </div>
          </SectionCard>
        )}
      </AdminPageChrome>
    </AuthenticatedLayout>
  );
}

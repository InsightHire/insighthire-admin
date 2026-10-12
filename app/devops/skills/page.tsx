'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { AdminPageChrome } from '@/components/admin/page-chrome';
import { SectionCard } from '@/components/admin/section-card';
import { StatusPill } from '@/components/admin/status-pill';
import { EmptyState } from '@/components/admin/empty-state';
import { buttonClass, inputClass } from '@/components/admin/controls';
import { ArrowLeft, BookOpen, Save } from 'lucide-react';

function DevopsSkillsContent() {
  useAdminAuth();
  const utils = trpc.useUtils();
  const skillsQuery = trpc.platformAdmin.listDevopsSkills.useQuery();
  const updateMutation = trpc.platformAdmin.updateDevopsSkill.useMutation({
    onSuccess: () => utils.platformAdmin.listDevopsSkills.invalidate(),
  });

  const skills = skillsQuery.data?.skills ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftBody, setDraftBody] = useState('');
  const [saved, setSaved] = useState(false);

  const selected = useMemo(
    () => skills.find((s) => s.id === selectedId) ?? null,
    [skills, selectedId],
  );

  const selectSkill = (id: string, body: string) => {
    setSelectedId(id);
    setDraftBody(body);
    setSaved(false);
  };

  const handleSave = async () => {
    if (!selectedId || !draftBody.trim()) return;
    await updateMutation.mutateAsync({ id: selectedId, body: draftBody });
    setSaved(true);
  };

  return (
    <AdminPageChrome
      icon={<BookOpen />}
      breadcrumbs={[{ label: 'System' }, { label: 'DevOps', href: '/devops' }, { label: 'Skills' }]}
      title="Agent skills"
      description="Reusable playbooks injected into Cursor agent prompts on spawn. Matched by incident rule, repo, and service — plus always-on baseline guardrails."
      actions={
        <Link href="/devops" className={buttonClass.secondary}>
          <ArrowLeft className="h-4 w-4" /> DevOps
        </Link>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-2">
          {skillsQuery.isLoading && (
            <p className="text-sm text-admin-muted">Loading skills…</p>
          )}
          {skills.map((skill) => (
            <button
              key={skill.id}
              type="button"
              onClick={() => selectSkill(skill.id, skill.body)}
              className={`w-full text-left rounded-admin border p-4 shadow-panel transition-colors ${
                selectedId === skill.id
                  ? 'border-admin-accent bg-admin-accent-soft/60 ring-1 ring-admin-accent/20'
                  : 'border-admin-border bg-white hover:border-admin-border-strong'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-admin-ink">{skill.name}</span>
                {skill.alwaysApply && (
                  <StatusPill tone="brand" dot={false} className="text-[10px] font-semibold uppercase tracking-wide">
                    Always
                  </StatusPill>
                )}
              </div>
              <p className="text-xs text-admin-muted mt-1 font-mono">{skill.slug}</p>
              {skill.description && (
                <p className="text-xs text-admin-secondary mt-2 line-clamp-2">{skill.description}</p>
              )}
            </button>
          ))}
        </div>

        <SectionCard
          className="lg:col-span-2"
          icon={selected ? <BookOpen /> : undefined}
          title={selected?.name}
          description={selected?.description}
          footer={
            selected ? (
              <div className="flex items-center justify-between">
                <span>Markdown · changes apply on next agent spawn</span>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={updateMutation.isLoading || !draftBody.trim()}
                  className={buttonClass.primary}
                >
                  <Save className="h-4 w-4" />
                  {updateMutation.isLoading ? 'Saving…' : saved ? 'Saved' : 'Save skill'}
                </button>
              </div>
            ) : undefined
          }
        >
          {!selected ? (
            <EmptyState
              compact
              className="border-0 shadow-none"
              icon={<BookOpen />}
              title="Select a skill to view or edit its playbook."
            />
          ) : (
            <textarea
              value={draftBody}
              onChange={(e) => {
                setDraftBody(e.target.value);
                setSaved(false);
              }}
              rows={22}
              className={`${inputClass} font-mono`}
              spellCheck={false}
            />
          )}
        </SectionCard>
      </div>
    </AdminPageChrome>
  );
}

export default function DevopsSkillsPage() {
  return (
    <AuthenticatedLayout>
      <DevopsSkillsContent />
    </AuthenticatedLayout>
  );
}
